"""Top-level API router — mounts all versioned sub-routers."""

from fastapi import APIRouter

from app.api.endpoints import (
    health,
    market,
    resources,
    phases,
    predictions,
    alerts,
    watchlist,
)

api_router = APIRouter()

api_router.include_router(health.router,      prefix="/health",      tags=["health"])
api_router.include_router(market.router,      prefix="/market",      tags=["market"])
api_router.include_router(resources.router,   prefix="/resources",   tags=["resources"])
api_router.include_router(phases.router,      prefix="/phases",      tags=["economy"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["ai"])
api_router.include_router(alerts.router,      prefix="/alerts",      tags=["alerts"])
api_router.include_router(watchlist.router,   prefix="/watchlist",   tags=["watchlist"])
