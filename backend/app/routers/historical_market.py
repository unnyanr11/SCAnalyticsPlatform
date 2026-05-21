"""API routes for the historical market data engine."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.historical_market import (
    CleanupRequest,
    CleanupResponse,
    MarketIngestionRequest,
    MarketIngestionResponse,
)
from app.services.historical_market_engine import HistoricalMarketDataEngine

router = APIRouter(prefix="/historical-market", tags=["historical-market"])

_engine = HistoricalMarketDataEngine()


@router.post("/ingest", response_model=MarketIngestionResponse)
async def ingest_market_data(
    body: MarketIngestionRequest,
    session: AsyncSession = Depends(get_db),
) -> MarketIngestionResponse:
    """Ingest a batch of raw market payloads from the extension or workers."""
    result = await _engine.ingest_market_batch(
        session,
        realm=body.realm,
        payloads=[
            {
                "product_id": item.product_id,
                "observed_at": item.observed_at,
                "lowest_ask":  item.lowest_ask,
                "highest_ask": item.highest_ask,
                "vwap":        item.vwap,
                "total_supply": item.total_supply,
                "offer_count": item.offer_count,
                "demand_score": item.demand_score,
                "price_volatility": item.price_volatility,
                "momentum_24h": item.momentum_24h,
                **item.meta,
            }
            for item in body.payloads
        ],
        source=body.source,
    )
    return MarketIngestionResponse(**result)


@router.post("/cleanup", response_model=CleanupResponse)
async def cleanup_historical_data(
    body: CleanupRequest,
    session: AsyncSession = Depends(get_db),
) -> CleanupResponse:
    """Purge aged rows from market_prices, volatility_metrics, historical_market_events."""
    result = await _engine.cleanup_old_data(
        session,
        price_retention_days=body.price_retention_days,
        metric_retention_days=body.metric_retention_days,
        event_retention_days=body.event_retention_days,
    )
    return CleanupResponse(**result)
