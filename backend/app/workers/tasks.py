"""Background task definitions (run via FastAPI BackgroundTasks or asyncio)."""

from __future__ import annotations

import asyncio
import structlog

from app.db.redis       import cache_set
from app.websocket.hub  import hub

log = structlog.get_logger(__name__)


async def broadcast_market_update(
    realm: int,
    resource_id: int,
    snapshot: dict,
) -> None:
    """
    Push a fresh market snapshot to all WebSocket subscribers for this resource.
    Also refreshes the Redis short-term cache.
    """
    room = f"market:{realm}:{resource_id}"
    payload = {
        "type":        "market_update",
        "realm":       realm,
        "resource_id": resource_id,
        "snapshot":    snapshot,
    }
    await cache_set(f"market:snap:{realm}:{resource_id}", snapshot, ttl=60)
    await hub.broadcast(room, payload)
    log.debug("task.market_update", room=room)


async def broadcast_alert(alert: dict) -> None:
    """Push a new alert to all subscribed clients."""
    payload = {"type": "alert", **alert}
    await hub.broadcast("alerts:global", payload)
    log.debug("task.alert_broadcast", severity=alert.get("severity"))


async def broadcast_phase_update(phase: dict) -> None:
    """Push an economy phase change to all clients."""
    payload = {"type": "phase_update", **phase}
    await hub.broadcast_all(payload)
    log.debug("task.phase_update", phase=phase.get("name"))


async def run_periodic_eviction(interval_seconds: int = 300) -> None:
    """
    Long-running coroutine: periodically evicts stale Redis keys.
    Start with asyncio.create_task() from on_startup().
    """
    while True:
        await asyncio.sleep(interval_seconds)
        log.debug("task.eviction", msg="Redis eviction pass (TTL-based, handled by Redis natively)")
