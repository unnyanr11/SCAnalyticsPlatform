"""Background worker entrypoints for historical market ingestion and cleanup.

Wire these into APScheduler, Celery, or a cron trigger:

    from app.workers.historical_market_worker import (
        run_historical_ingestion_job,
        run_historical_cleanup_job,
    )
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.db.session import AsyncSessionLocal
from app.services.cache import cache as _cache_singleton
from app.services.historical_market_engine import HistoricalMarketDataEngine

_engine = HistoricalMarketDataEngine()


async def run_historical_ingestion_job(
    *,
    realm: int,
    payloads: list[dict[str, Any]],
    source: str = "worker",
) -> dict[str, int]:
    """Ingest a batch of market payloads in a standalone async context."""
    async with AsyncSessionLocal() as session:
        return await _engine.ingest_market_batch(
            session,
            realm=realm,
            payloads=payloads,
            source=source,
        )


async def run_historical_cleanup_job(
    *,
    price_retention_days: int = 90,
    metric_retention_days: int = 30,
    event_retention_days: int = 180,
) -> dict[str, int]:
    """Purge aged rows and record result in Redis cache."""
    async with AsyncSessionLocal() as session:
        result = await _engine.cleanup_old_data(
            session,
            price_retention_days=price_retention_days,
            metric_retention_days=metric_retention_days,
            event_retention_days=event_retention_days,
        )
    await _cache_singleton.set(
        "market:cleanup:last_run",
        {"result": result, "ran_at": datetime.now(UTC).isoformat()},
        ttl=3600,
    )
    return result
