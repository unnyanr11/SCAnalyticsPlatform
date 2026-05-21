"""Alert endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.alert      import AlertRecord
from app.schemas.alert     import AlertOut

router = APIRouter()


@router.get("/", response_model=List[AlertOut])
async def list_alerts(
    realm:        int  = Query(default=0, ge=0, le=1),
    acknowledged: bool = Query(default=False),
    limit:        int  = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> List[AlertOut]:
    result = await db.execute(
        select(AlertRecord)
        .where(
            AlertRecord.realm        == realm,
            AlertRecord.acknowledged == acknowledged,
        )
        .order_by(AlertRecord.triggered_at.desc())
        .limit(limit)
    )
    return [AlertOut.model_validate(r) for r in result.scalars().all()]


@router.patch("/{alert_id}/acknowledge", summary="Acknowledge an alert")
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        update(AlertRecord)
        .where(AlertRecord.id == alert_id)
        .values(acknowledged=True)
    )
    return {"ok": True}
