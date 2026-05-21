"""
app/core/redis.py
Asynchronous Redis client using the redis-py library.
"""

import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------

_pool: Optional[aioredis.ConnectionPool] = None


def get_pool() -> aioredis.ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _pool


def get_redis() -> aioredis.Redis:
    """Returns a Redis client using the shared connection pool."""
    return aioredis.Redis(connection_pool=get_pool())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def cache_get(key: str) -> Optional[Any]:
    """Fetch a JSON-encoded value from Redis. Returns None on miss."""
    client = get_redis()
    raw = await client.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


async def cache_set(
    key: str,
    value: Any,
    ttl: int = settings.REDIS_CACHE_TTL_SECONDS,
) -> None:
    """Store a JSON-encoded value in Redis with optional TTL."""
    client = get_redis()
    await client.set(key, json.dumps(value), ex=ttl)


async def cache_delete(key: str) -> None:
    """Remove a key from Redis."""
    client = get_redis()
    await client.delete(key)


async def close_pool() -> None:
    """Gracefully close the connection pool on shutdown."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
