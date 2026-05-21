"""Worker entrypoints for historical market ingestion and cleanup jobs."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.db.session import AsyncSessionLocal
from app.services.cache import CacheService
from app.services.historical_market_engine import HistoricalMarketDataEngine


async def run_historical_ingestion_job(
    *,
    realm: int,
    payloads: list[dict[str, Any]],
    source: str = "worker",
) -> dict[str, int]:
    engine = HistoricalMarketDataEngine(cache_service=CacheService())
    async with AsyncSessionLocal() as session:
        result = await engine.ingest_market_batch(
            session,
            realm=realm,
            payloads=payloads,
            source=source,
        )
        return result


async def run_historical_cleanup_job() -> dict[str, int]:
    engine = HistoricalMarketDataEngine(cache_service=CacheService())
    async with AsyncSessionLocal() as session:
        result = await engine.cleanup_old_data(session)
        await engine.cache.set(
            "market:cleanup:last_run",
            {
                "result": result,
                "ran_at": datetime.now(UTC).isoformat(),
            },
            ttl=3600,
        )
        return result
