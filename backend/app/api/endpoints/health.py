"""Health-check endpoints — liveness, readiness, detailed status."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies import get_db, get_redis
from app.db.session        import get_engine

router = APIRouter()

_start_time = time.time()


class HealthResponse(BaseModel):
    status:   str
    uptime_s: float
    db:       str
    redis:    str


@router.get("/", summary="Liveness probe")
async def liveness() -> dict:
    """Always returns 200 when the process is running."""
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe", response_model=HealthResponse)
async def readiness(
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> HealthResponse:
    """Returns 200 only when DB and Redis are reachable."""
    db_status    = "ok"
    redis_status = "ok"

    try:
        await db.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_status = f"error: {exc}"

    try:
        await redis.ping()
    except Exception as exc:  # noqa: BLE001
        redis_status = f"error: {exc}"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"

    return HealthResponse(
        status=overall,
        uptime_s=round(time.time() - _start_time, 1),
        db=db_status,
        redis=redis_status,
    )
