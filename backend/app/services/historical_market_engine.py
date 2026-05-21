"""Historical market data engine for SCAnalyticsPlatform.

This module provides the ingestion, normalization, deduplication,
bulk persistence, rolling analytics, and cleanup orchestration for
high-frequency Sim Companies market data.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from statistics import mean, pstdev
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSeverity, AlertType
from app.models.historical_market_event import (
    EventKind,
    HistoricalMarketEvent,
    ImpactLevel,
)
from app.models.market_price import MarketPrice
from app.models.volatility_metric import VolatilityMetric
from app.services.cache import CacheService


@dataclass(slots=True)
class NormalizedMarketPoint:
    realm: int
    product_id: int
    observed_at: datetime
    lowest_ask: Decimal
    highest_ask: Decimal
    vwap: Decimal
    total_supply: int
    offer_count: int
    demand_score: Decimal
    price_volatility: Decimal
    momentum_24h: Decimal
    dedupe_hash: str
    raw_payload: dict[str, Any]


@dataclass(slots=True)
class RollingSnapshot:
    average_price_1h: float
    average_price_24h: float
    average_quantity_1h: float
    average_quantity_24h: float
    volatility_1h: float
    volatility_24h: float
    momentum_1h: float
    momentum_24h: float
    z_score_price: float
    z_score_quantity: float
    anomaly_score: float
    anomaly_flags: list[str]


class HistoricalMarketDataEngine:
    """Ingest, persist, and analyze historical market data.

    Responsibilities:
    - realtime ingestion from market providers / extension relays
    - timestamp normalization
    - deduplication with deterministic hashes
    - bulk upserts into market_prices
    - rolling average / volatility calculations
    - trend calculations for anomaly detection preparation
    - Redis cache for latest snapshots + aggregates
    - scheduled cleanup of aged rows
    """

    CACHE_LATEST_TTL = 60 * 10
    CACHE_ROLLING_TTL = 60 * 5

    def __init__(self, cache_service: CacheService | None = None) -> None:
        self.cache = cache_service or CacheService()

    async def ingest_market_batch(
        self,
        session: AsyncSession,
        *,
        realm: int,
        payloads: list[dict[str, Any]],
        source: str = "api",
    ) -> dict[str, int]:
        """Normalize, de-duplicate, bulk insert, and compute metrics."""
        normalized = self._normalize_batch(realm=realm, payloads=payloads, source=source)
        if not normalized:
            return {"received": len(payloads), "inserted": 0, "duplicates": 0, "metrics": 0}

        deduped = await self._deduplicate(session, normalized)
        inserted = await self._bulk_insert_market_prices(session, deduped)
        metric_rows = await self._recompute_metrics_for_products(
            session, realm=realm, product_ids=sorted({item.product_id for item in deduped})
        )

        await session.commit()
        await self._refresh_cache_for_points(deduped, metric_rows)

        return {
            "received": len(payloads),
            "inserted": inserted,
            "duplicates": max(len(normalized) - inserted, 0),
            "metrics": metric_rows,
        }

    def _normalize_batch(
        self,
        *,
        realm: int,
        payloads: list[dict[str, Any]],
        source: str,
    ) -> list[NormalizedMarketPoint]:
        points: list[NormalizedMarketPoint] = []

        for payload in payloads:
            product_id = int(
                payload.get("product_id")
                or payload.get("resourceId")
                or payload.get("itemId")
                or payload.get("id")
            )

            observed_at = self._normalize_timestamp(payload.get("observed_at") or payload.get("timestamp"))
            lowest_ask = Decimal(str(payload.get("lowest_ask") or payload.get("bid") or 0))
            highest_ask = Decimal(str(payload.get("highest_ask") or payload.get("ask") or lowest_ask or 0))
            vwap = Decimal(str(payload.get("vwap") or payload.get("price") or lowest_ask or 0))
            total_supply = int(payload.get("total_supply") or payload.get("quantity") or payload.get("stock") or 0)
            offer_count = int(payload.get("offer_count") or payload.get("orders") or 0)
            demand_score = Decimal(str(payload.get("demand_score") or payload.get("demand") or 0))
            price_volatility = Decimal(str(payload.get("price_volatility") or 0))
            momentum_24h = Decimal(str(payload.get("momentum_24h") or 0))

            raw_payload = {
                "source": source,
                **payload,
            }
            dedupe_hash = self._build_dedupe_hash(
                realm=realm,
                product_id=product_id,
                observed_at=observed_at,
                price=vwap,
                quantity=total_supply,
            )

            points.append(
                NormalizedMarketPoint(
                    realm=realm,
                    product_id=product_id,
                    observed_at=observed_at,
                    lowest_ask=lowest_ask,
                    highest_ask=highest_ask,
                    vwap=vwap,
                    total_supply=total_supply,
                    offer_count=offer_count,
                    demand_score=demand_score,
                    price_volatility=price_volatility,
                    momentum_24h=momentum_24h,
                    dedupe_hash=dedupe_hash,
                    raw_payload=raw_payload,
                )
            )

        return points

    async def _deduplicate(
        self,
        session: AsyncSession,
        points: list[NormalizedMarketPoint],
    ) -> list[NormalizedMarketPoint]:
        """Remove duplicates within batch and against DB cache window."""
        unique: dict[str, NormalizedMarketPoint] = {}
        for point in points:
            unique.setdefault(point.dedupe_hash, point)

        hashes = list(unique.keys())
        if not hashes:
            return []

        result = await session.execute(
            select(MarketPrice.id, MarketPrice.meta)
            .where(MarketPrice.meta["dedupe_hash"].astext.in_(hashes))
        )
        existing_hashes = {
            row.meta.get("dedupe_hash")
            for row in result
            if row.meta and row.meta.get("dedupe_hash")
        }

        return [point for point in unique.values() if point.dedupe_hash not in existing_hashes]

    async def _bulk_insert_market_prices(
        self,
        session: AsyncSession,
        points: list[NormalizedMarketPoint],
    ) -> int:
        if not points:
            return 0

        rows = [
            {
                "realm": point.realm,
                "product_id": point.product_id,
                "observed_at": point.observed_at,
                "lowest_ask": point.lowest_ask,
                "highest_ask": point.highest_ask,
                "vwap": point.vwap,
                "total_supply": point.total_supply,
                "offer_count": point.offer_count,
                "demand_score": point.demand_score,
                "price_volatility": point.price_volatility,
                "momentum_24h": point.momentum_24h,
                "meta": {
                    **point.raw_payload,
                    "dedupe_hash": point.dedupe_hash,
                    "normalized_at": datetime.now(UTC).isoformat(),
                },
            }
            for point in points
        ]

        stmt = insert(MarketPrice)
        await session.execute(stmt, rows)
        return len(rows)

    async def _recompute_metrics_for_products(
        self,
        session: AsyncSession,
        *,
        realm: int,
        product_ids: list[int],
    ) -> int:
        if not product_ids:
            return 0

        metric_count = 0
        now = datetime.now(UTC)
        for product_id in product_ids:
            snapshots = await self._fetch_recent_points(session, realm=realm, product_id=product_id)
            if not snapshots:
                continue

            rolling = self._compute_rolling_snapshot(snapshots)
            await self._upsert_volatility_metric(
                session,
                realm=realm,
                product_id=product_id,
                computed_at=now,
                rolling=rolling,
            )
            await self._prepare_market_event(session, realm=realm, product_id=product_id, rolling=rolling, now=now)
            metric_count += 1

        return metric_count

    async def _fetch_recent_points(
        self,
        session: AsyncSession,
        *,
        realm: int,
        product_id: int,
    ) -> list[MarketPrice]:
        since = datetime.now(UTC) - timedelta(days=7)
        result = await session.execute(
            select(MarketPrice)
            .where(
                MarketPrice.realm == realm,
                MarketPrice.product_id == product_id,
                MarketPrice.observed_at >= since,
            )
            .order_by(MarketPrice.observed_at.asc())
        )
        return list(result.scalars().all())

    def _compute_rolling_snapshot(self, snapshots: list[MarketPrice]) -> RollingSnapshot:
        now = datetime.now(UTC)
        prices_1h: list[float] = []
        prices_24h: list[float] = []
        qty_1h: list[float] = []
        qty_24h: list[float] = []
        all_prices: list[float] = []
        all_qty: list[float] = []

        first_1h: float | None = None
        last_1h: float | None = None
        first_24h: float | None = None
        last_24h: float | None = None

        for row in snapshots:
            age = now - row.observed_at.replace(tzinfo=UTC)
            price = float(row.vwap)
            qty = float(row.total_supply)
            all_prices.append(price)
            all_qty.append(qty)

            if age <= timedelta(hours=24):
                prices_24h.append(price)
                qty_24h.append(qty)
                first_24h = price if first_24h is None else first_24h
                last_24h = price
            if age <= timedelta(hours=1):
                prices_1h.append(price)
                qty_1h.append(qty)
                first_1h = price if first_1h is None else first_1h
                last_1h = price

        average_price_1h = mean(prices_1h) if prices_1h else 0.0
        average_price_24h = mean(prices_24h) if prices_24h else 0.0
        average_quantity_1h = mean(qty_1h) if qty_1h else 0.0
        average_quantity_24h = mean(qty_24h) if qty_24h else 0.0
        volatility_1h = pstdev(prices_1h) if len(prices_1h) > 1 else 0.0
        volatility_24h = pstdev(prices_24h) if len(prices_24h) > 1 else 0.0
        momentum_1h = self._pct_change(first_1h, last_1h)
        momentum_24h = self._pct_change(first_24h, last_24h)

        baseline_price = mean(all_prices) if all_prices else 0.0
        baseline_qty = mean(all_qty) if all_qty else 0.0
        base_price_std = pstdev(all_prices) if len(all_prices) > 1 else 0.0
        base_qty_std = pstdev(all_qty) if len(all_qty) > 1 else 0.0

        z_score_price = self._z_score(last_24h or average_price_24h, baseline_price, base_price_std)
        z_score_quantity = self._z_score(qty_24h[-1] if qty_24h else average_quantity_24h, baseline_qty, base_qty_std)

        anomaly_flags: list[str] = []
        if abs(z_score_price) >= 2.5:
            anomaly_flags.append("price_outlier")
        if abs(z_score_quantity) >= 2.5:
            anomaly_flags.append("quantity_outlier")
        if volatility_24h > average_price_24h * 0.15 and average_price_24h > 0:
            anomaly_flags.append("high_volatility")
        if momentum_24h >= 0.10:
            anomaly_flags.append("bullish_breakout")
        if momentum_24h <= -0.10:
            anomaly_flags.append("bearish_breakdown")

        anomaly_score = round(
            min(
                1.0,
                (
                    min(abs(z_score_price) / 4, 0.35)
                    + min(abs(z_score_quantity) / 4, 0.25)
                    + min(abs(momentum_24h), 0.20)
                    + min((volatility_24h / average_price_24h), 0.20) if average_price_24h else 0.0
                ),
            ),
            4,
        )

        return RollingSnapshot(
            average_price_1h=round(average_price_1h, 6),
            average_price_24h=round(average_price_24h, 6),
            average_quantity_1h=round(average_quantity_1h, 6),
            average_quantity_24h=round(average_quantity_24h, 6),
            volatility_1h=round(volatility_1h, 6),
            volatility_24h=round(volatility_24h, 6),
            momentum_1h=round(momentum_1h, 6),
            momentum_24h=round(momentum_24h, 6),
            z_score_price=round(z_score_price, 6),
            z_score_quantity=round(z_score_quantity, 6),
            anomaly_score=anomaly_score,
            anomaly_flags=anomaly_flags,
        )

    async def _upsert_volatility_metric(
        self,
        session: AsyncSession,
        *,
        realm: int,
        product_id: int,
        computed_at: datetime,
        rolling: RollingSnapshot,
    ) -> None:
        metrics_payload = {
            "average_price_1h": rolling.average_price_1h,
            "average_price_24h": rolling.average_price_24h,
            "average_quantity_1h": rolling.average_quantity_1h,
            "average_quantity_24h": rolling.average_quantity_24h,
            "volatility_1h": rolling.volatility_1h,
            "volatility_24h": rolling.volatility_24h,
            "momentum_1h": rolling.momentum_1h,
            "momentum_24h": rolling.momentum_24h,
            "z_score_price": rolling.z_score_price,
            "z_score_quantity": rolling.z_score_quantity,
            "anomaly_score": rolling.anomaly_score,
            "anomaly_flags": rolling.anomaly_flags,
        }

        stmt = pg_insert(VolatilityMetric).values(
            realm=realm,
            product_id=product_id,
            computed_at=computed_at,
            window="24h",
            sigma=Decimal(str(rolling.volatility_24h)),
            coeff_var=Decimal(
                str(round(rolling.volatility_24h / rolling.average_price_24h, 6))
            )
            if rolling.average_price_24h
            else Decimal("0"),
            avg_spread=Decimal(str(abs(rolling.momentum_24h))),
            avg_abs_return=Decimal(str(abs(rolling.momentum_1h))),
            trend_strength=Decimal(str(abs(rolling.momentum_24h))),
            sample_size=max(int(rolling.average_quantity_24h), 1),
            meta=metrics_payload,
        )
        await session.execute(stmt)

    async def _prepare_market_event(
        self,
        session: AsyncSession,
        *,
        realm: int,
        product_id: int,
        rolling: RollingSnapshot,
        now: datetime,
    ) -> None:
        if rolling.anomaly_score < 0.65:
            return

        kind = EventKind.VOLATILITY_SPIKE
        if "bullish_breakout" in rolling.anomaly_flags:
            kind = EventKind.PRICE_SPIKE
        elif "bearish_breakdown" in rolling.anomaly_flags:
            kind = EventKind.PRICE_CRASH
        elif "quantity_outlier" in rolling.anomaly_flags:
            kind = EventKind.SUPPLY_SHOCK

        impact = (
            ImpactLevel.CRITICAL if rolling.anomaly_score >= 0.9 else
            ImpactLevel.HIGH if rolling.anomaly_score >= 0.8 else
            ImpactLevel.MEDIUM
        )

        event = HistoricalMarketEvent(
            realm=realm,
            product_id=product_id,
            kind=kind,
            impact_level=impact,
            started_at=now,
            detected_at=now,
            anomaly_score=Decimal(str(rolling.anomaly_score)),
            headline=f"Prepared anomaly signal for product {product_id}",
            summary="Auto-generated event candidate from historical market engine.",
            features={
                "anomaly_flags": rolling.anomaly_flags,
                "z_score_price": rolling.z_score_price,
                "z_score_quantity": rolling.z_score_quantity,
                "momentum_24h": rolling.momentum_24h,
                "volatility_24h": rolling.volatility_24h,
            },
            source="historical_engine",
        )
        session.add(event)

        if rolling.anomaly_score >= 0.8:
            session.add(
                Alert(
                    realm=realm,
                    product_id=product_id,
                    alert_type=AlertType.VOLATILITY,
                    severity=(
                        AlertSeverity.CRITICAL
                        if rolling.anomaly_score >= 0.9
                        else AlertSeverity.HIGH
                    ),
                    title="Market anomaly detected",
                    message=(
                        f"Prepared anomaly candidate for product {product_id} "
                        f"with score {rolling.anomaly_score:.2f}."
                    ),
                    confidence=Decimal(str(rolling.anomaly_score)),
                    icon="activity",
                    metadata={
                        "anomaly_flags": rolling.anomaly_flags,
                        "momentum_24h": rolling.momentum_24h,
                    },
                )
            )

    async def _refresh_cache_for_points(
        self,
        points: list[NormalizedMarketPoint],
        metric_rows: int,
    ) -> None:
        if not points:
            return

        grouped: dict[tuple[int, int], list[NormalizedMarketPoint]] = defaultdict(list)
        for point in points:
            grouped[(point.realm, point.product_id)].append(point)

        for (realm, product_id), product_points in grouped.items():
            latest = max(product_points, key=lambda item: item.observed_at)
            await self.cache.set(
                self._cache_key_latest(realm, product_id),
                {
                    "realm": realm,
                    "product_id": product_id,
                    "observed_at": latest.observed_at.isoformat(),
                    "price": float(latest.vwap),
                    "quantity": latest.total_supply,
                    "demand_score": float(latest.demand_score),
                },
                ttl=self.CACHE_LATEST_TTL,
            )

        await self.cache.set(
            "market:metrics:last_batch",
            {
                "products_updated": len(grouped),
                "metrics_rows": metric_rows,
                "processed_at": datetime.now(UTC).isoformat(),
            },
            ttl=self.CACHE_ROLLING_TTL,
        )

    async def cleanup_old_data(
        self,
        session: AsyncSession,
        *,
        price_retention_days: int = 90,
        metric_retention_days: int = 30,
        event_retention_days: int = 180,
    ) -> dict[str, int]:
        now = datetime.now(UTC)
        price_cutoff = now - timedelta(days=price_retention_days)
        metric_cutoff = now - timedelta(days=metric_retention_days)
        event_cutoff = now - timedelta(days=event_retention_days)

        deleted_prices = await session.execute(
            delete(MarketPrice).where(MarketPrice.observed_at < price_cutoff)
        )
        deleted_metrics = await session.execute(
            delete(VolatilityMetric).where(VolatilityMetric.computed_at < metric_cutoff)
        )
        deleted_events = await session.execute(
            delete(HistoricalMarketEvent).where(HistoricalMarketEvent.started_at < event_cutoff)
        )

        await session.commit()
        return {
            "market_prices": deleted_prices.rowcount or 0,
            "volatility_metrics": deleted_metrics.rowcount or 0,
            "historical_market_events": deleted_events.rowcount or 0,
        }

    @staticmethod
    def _normalize_timestamp(value: Any) -> datetime:
        if value is None:
            return datetime.now(UTC).replace(second=0, microsecond=0)
        if isinstance(value, datetime):
            dt = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
            return dt.replace(second=0, microsecond=0)
        if isinstance(value, (int, float)):
            if value > 1_000_000_000_000:
                value = value / 1000
            return datetime.fromtimestamp(value, tz=UTC).replace(second=0, microsecond=0)
        if isinstance(value, str):
            normalized = value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized).astimezone(UTC).replace(second=0, microsecond=0)
        raise TypeError(f"Unsupported timestamp value: {value!r}")

    @staticmethod
    def _build_dedupe_hash(
        *,
        realm: int,
        product_id: int,
        observed_at: datetime,
        price: Decimal,
        quantity: int,
    ) -> str:
        payload = f"{realm}:{product_id}:{observed_at.isoformat()}:{price}:{quantity}"
        return hashlib.sha1(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def _pct_change(first: float | None, last: float | None) -> float:
        if first in (None, 0) or last is None:
            return 0.0
        return (last - first) / first

    @staticmethod
    def _z_score(value: float, avg: float, std: float) -> float:
        if std == 0:
            return 0.0
        return (value - avg) / std

    @staticmethod
    def _cache_key_latest(realm: int, product_id: int) -> str:
        return f"market:latest:{realm}:{product_id}"
