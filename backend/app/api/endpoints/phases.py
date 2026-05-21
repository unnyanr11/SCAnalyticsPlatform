"""Economy phase endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.phase      import EconomyPhaseRecord
from app.schemas.phase     import PhaseOut
from app.db.redis          import cache_get, cache_set

router = APIRouter()


@router.get("/current", response_model=PhaseOut, summary="Latest economy phase for a realm")
async def current_phase(
    realm: int = Query(default=0, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
) -> PhaseOut:
    cache_key = f"phase:current:{realm}"
    cached = await cache_get(cache_key)
    if cached:
        return PhaseOut.model_validate(cached)

    result = await db.execute(
        select(EconomyPhaseRecord)
        .where(EconomyPhaseRecord.realm == realm)
        .order_by(EconomyPhaseRecord.observed_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("No phase data available")

    data = PhaseOut.model_validate(row)
    await cache_set(cache_key, data.model_dump(mode="json"), ttl=900)
    return data


@router.get("/history", response_model=List[PhaseOut])
async def phase_history(
    realm:  int = Query(default=0, ge=0, le=1),
    limit:  int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> List[PhaseOut]:
    result = await db.execute(
        select(EconomyPhaseRecord)
        .where(EconomyPhaseRecord.realm == realm)
        .order_by(EconomyPhaseRecord.observed_at.desc())
        .limit(limit)
    )
    return [PhaseOut.model_validate(r) for r in result.scalars().all()]
