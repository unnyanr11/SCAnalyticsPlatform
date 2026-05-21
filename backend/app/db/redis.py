"""Redis async client (redis-py 5.x)."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

_client: aioredis.Redis | None = None  # type: ignore[type-arg]


async def init_redis() -> None:
    global _client  # noqa: PLW0603
    _client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )
    await _client.ping()


async def close_redis() -> None:
    if _client:
        await _client.aclose()


def get_redis_client() -> aioredis.Redis:  # type: ignore[type-arg]
    if _client is None:
        raise RuntimeError("Redis not initialised — call init_redis() first")
    return _client


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

async def cache_set(key: str, value: Any, ttl: int) -> None:
    """JSON-serialise *value* and store with a TTL (seconds)."""
    await get_redis_client().set(key, json.dumps(value), ex=ttl)


async def cache_get(key: str) -> Any | None:
    """Return deserialised value or None on miss."""
    raw = await get_redis_client().get(key)
    return json.loads(raw) if raw is not None else None


async def cache_delete(key: str) -> None:
    await get_redis_client().delete(key)


async def cache_exists(key: str) -> bool:
    return bool(await get_redis_client().exists(key))
