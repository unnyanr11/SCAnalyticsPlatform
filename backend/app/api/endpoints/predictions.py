"""AI prediction endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, Path, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.prediction  import AIPredictionRecord
from app.schemas.prediction  import PredictionOut
from app.db.redis            import cache_get, cache_set
from app.core.config         import settings

router = APIRouter()


@router.get(
    "/{resource_id}",
    response_model=PredictionOut,
    summary="Latest AI prediction for a resource",
)
async def get_prediction(
    resource_id:       int = Path(..., ge=1),
    realm:             int = Query(default=0, ge=0, le=1),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
) -> PredictionOut:
    cache_key = f"pred:{realm}:{resource_id}"
    cached = await cache_get(cache_key)
    if cached:
        return PredictionOut.model_validate(cached)

    result = await db.execute(
        select(AIPredictionRecord)
        .where(
            AIPredictionRecord.resource_id == resource_id,
            AIPredictionRecord.realm       == realm,
        )
        .order_by(AIPredictionRecord.generated_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"No prediction for resource {resource_id}")

    data = PredictionOut.model_validate(row)
    await cache_set(cache_key, data.model_dump(mode="json"), ttl=settings.AI_PREDICTION_TTL_SECONDS)
    return data


@router.get("/top", response_model=List[PredictionOut], summary="Top N opportunities")
async def top_predictions(
    realm:     int = Query(default=0, ge=0, le=1),
    limit:     int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> List[PredictionOut]:
    result = await db.execute(
        select(AIPredictionRecord)
        .where(AIPredictionRecord.realm == realm)
        .order_by(AIPredictionRecord.confidence_score.desc())
        .limit(limit)
    )
    return [PredictionOut.model_validate(r) for r in result.scalars().all()]
