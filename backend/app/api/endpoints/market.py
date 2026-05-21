"""Market price endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, Pagination
from app.models.market     import MarketPrice
from app.schemas.market    import MarketPriceIn, MarketPriceOut
from app.db.redis          import cache_get, cache_set
from app.core.config       import settings

router = APIRouter()


@router.post("/ingest", status_code=201, summary="Ingest a market snapshot from the extension")
async def ingest_snapshot(
    payload: MarketPriceIn,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive a market snapshot from the browser extension and persist it."""
    record = MarketPrice(**payload.model_dump())
    db.add(record)
    # Invalidate cached snapshot for this resource
    await cache_set(
        f"market:snap:{payload.realm}:{payload.resource_id}",
        payload.model_dump(mode="json"),
        ttl=settings.AI_PREDICTION_TTL_SECONDS,
    )
    return {"ok": True, "id": None}  # id assigned after flush


@router.get(
    "/{resource_id}",
    response_model=List[MarketPriceOut],
    summary="Price history for a resource",
)
async def get_price_history(
    resource_id: int  = Path(..., ge=1),
    realm:       int  = Query(default=0, ge=0, le=1),
    limit:       int  = Query(default=60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> List[MarketPriceOut]:
    cache_key = f"market:history:{realm}:{resource_id}:{limit}"
    cached = await cache_get(cache_key)
    if cached:
        return [MarketPriceOut.model_validate(r) for r in cached]

    result = await db.execute(
        select(MarketPrice)
        .where(MarketPrice.resource_id == resource_id, MarketPrice.realm == realm)
        .order_by(MarketPrice.observed_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    data = [MarketPriceOut.model_validate(r) for r in rows]
    await cache_set(cache_key, [d.model_dump(mode="json") for d in data], ttl=30)
    return data
