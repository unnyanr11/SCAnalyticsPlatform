"""Central API router — aggregates all feature routers."""

from fastapi import APIRouter

from app.routers.historical_market import router as historical_market_router

api_router = APIRouter()
api_router.include_router(historical_market_router)

# Additional routers registered here as features are built out:
# from app.routers.predictions import router as predictions_router
# from app.routers.alerts       import router as alerts_router
# from app.routers.portfolio    import router as portfolio_router
# api_router.include_router(predictions_router)
# api_router.include_router(alerts_router)
# api_router.include_router(portfolio_router)
