"""WebSocket endpoint — realtime market updates stream."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.hub import hub

router = APIRouter()


@router.websocket("/market/{realm}/{resource_id}")
async def market_stream(
    ws:          WebSocket,
    realm:       int,
    resource_id: int,
) -> None:
    """
    Subscribe to live market updates for a specific resource.
    The server pushes a JSON payload whenever a new snapshot is ingested.

    Room key: "market:{realm}:{resource_id}"
    """
    room = f"market:{realm}:{resource_id}"
    await hub.connect(ws, room)
    try:
        while True:
            # Keep connection alive; client may send ping frames
            await ws.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(ws, room)


@router.websocket("/alerts")
async def alerts_stream(ws: WebSocket) -> None:
    """Subscribe to live shortage/opportunity alerts (all resources)."""
    room = "alerts:global"
    await hub.connect(ws, room)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(ws, room)
