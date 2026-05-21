"""
SC Analytics Platform — Market Router

Read-only analytics endpoints. No game automation.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.market import MarketIngestRequest, MarketPriceRead

router = APIRouter(prefix="/market", tags=["market"])


@router.post(
    "/ingest",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest intercepted market data from the extension",
)
async def ingest_market_data(
    payload: MarketIngestRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Accepts raw market data forwarded by the browser extension
    content script. Data is stored for AI analysis.

    This endpoint never triggers any game actions.
    """
    # TODO: persist to market_prices table via SQLAlchemy model
    return {"status": "queued", "url": payload.url, "timestamp": payload.timestamp}


@router.get(
    "/{item_id}",
    response_model=list[MarketPriceRead],
    summary="Get cached market prices for an item",
)
async def get_market_prices(
    item_id: int,
    realm: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[MarketPriceRead]:
    """
    Returns the latest cached market prices for a given item.
    Data is sourced from passive observation only.
    """
    # TODO: query market_prices table
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Market price storage not yet implemented",
    )
