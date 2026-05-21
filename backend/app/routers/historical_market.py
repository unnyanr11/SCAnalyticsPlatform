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
from app.services.cache import CacheService
from app.services.historical_market_engine import HistoricalMarketDataEngine

router = APIRouter(prefix="/historical-market", tags=["historical-market"])


def get_historical_engine() -> HistoricalMarketDataEngine:
    return HistoricalMarketDataEngine(cache_service=CacheService())


@router.post("/ingest", response_model=MarketIngestionResponse)
async def ingest_market_data(
    payload: MarketIngestionRequest,
    session: AsyncSession = Depends(get_db),
) -> MarketIngestionResponse:
    engine = get_historical_engine()
    result = await engine.ingest_market_batch(
        session,
        realm=payload.realm,
        payloads=[
            {
                "product_id": item.product_id,
                "observed_at": item.observed_at,
                "lowest_ask": item.lowest_ask,
                "highest_ask": item.highest_ask,
                "vwap": item.vwap,
                "total_supply": item.total_supply,
                "offer_count": item.offer_count,
                "demand_score": item.demand_score,
                "price_volatility": item.price_volatility,
                "momentum_24h": item.momentum_24h,
                **item.meta,
            }
            for item in payload.payloads
        ],
        source=payload.source,
    )
    return MarketIngestionResponse(**result)


@router.post("/cleanup", response_model=CleanupResponse)
async def cleanup_historical_market_data(
    payload: CleanupRequest,
    session: AsyncSession = Depends(get_db),
) -> CleanupResponse:
    engine = get_historical_engine()
    result = await engine.cleanup_old_data(
        session,
        price_retention_days=payload.price_retention_days,
        metric_retention_days=payload.metric_retention_days,
        event_retention_days=payload.event_retention_days,
    )
    return CleanupResponse(**result)
