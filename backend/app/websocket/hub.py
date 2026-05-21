"""WebSocket connection hub — broadcast market updates to all connected clients."""

from __future__ import annotations

import asyncio
import json
from typing import Dict, Set

from fastapi import WebSocket
import structlog

log = structlog.get_logger(__name__)


class ConnectionHub:
    """
    Manages active WebSocket connections grouped by subscription key
    (e.g. "market:0:42" for resource 42 realm 0).

    Broadcast is fire-and-forget: a slow or disconnected client
    is removed from the hub without raising.
    """

    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, room: str) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(room, set()).add(ws)
        log.debug("ws.connected", room=room)

    async def disconnect(self, ws: WebSocket, room: str) -> None:
        async with self._lock:
            sockets = self._rooms.get(room, set())
            sockets.discard(ws)
            if not sockets:
                self._rooms.pop(room, None)
        log.debug("ws.disconnected", room=room)

    async def broadcast(self, room: str, data: dict) -> None:
        """Send *data* JSON to every connection in *room*."""
        sockets = self._rooms.get(room, set()).copy()
        if not sockets:
            return

        payload = json.dumps(data)
        dead: list[WebSocket] = []

        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:  # noqa: BLE001
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws, room)

    async def broadcast_all(self, data: dict) -> None:
        """Broadcast to every connected client across all rooms."""
        for room in list(self._rooms.keys()):
            await self.broadcast(room, data)

    @property
    def connection_count(self) -> int:
        return sum(len(s) for s in self._rooms.values())


hub = ConnectionHub()
