"""Register API routers."""

from fastapi import APIRouter

from app.routers.historical_market import router as historical_market_router

api_router = APIRouter()
api_router.include_router(historical_market_router)
