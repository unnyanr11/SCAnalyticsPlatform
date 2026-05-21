"""WebSocket router — mounts all WS endpoints."""

from fastapi import APIRouter
from app.websocket.endpoints import market_ws

ws_router = APIRouter()
ws_router.include_router(market_ws.router)
