"""
SC Analytics Platform — Redis Client

Provides a shared async Redis connection pool.
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.core.settings import settings

_redis_pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """FastAPI dependency that returns a Redis client."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_pool


async def close_redis() -> None:
    """Gracefully close the Redis connection pool."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
