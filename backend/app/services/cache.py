"""Async Redis cache with in-memory fallback.

Usage::

    from app.services.cache import cache

    data = await cache.get("key")
    await cache.set("key", data, ttl=300)
    await cache.delete("key")
    await cache.clear_prefix("market:")
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

from app.core.config import settings

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory fallback cache
# ---------------------------------------------------------------------------

class _MemoryCache:
    """Simple TTL-aware in-memory dict cache."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock  = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at and time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        async with self._lock:
            expires_at = time.monotonic() + ttl if ttl else 0
            self._store[key] = (value, expires_at)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def clear_prefix(self, prefix: str) -> int:
        async with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)


# ---------------------------------------------------------------------------
# Redis-backed cache (preferred)
# ---------------------------------------------------------------------------

class _RedisCache:
    def __init__(self, url: str) -> None:
        self._url = url
        self._r: Any = None  # redis.asyncio.Redis

    async def _conn(self) -> Any:
        if self._r is None:
            self._r = aioredis.from_url(
                self._url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
            )
        return self._r

    async def get(self, key: str) -> Any | None:
        try:
            r = await self._conn()
            raw = await r.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception as exc:
            log.warning("Redis GET failed (%s) — returning None", exc)
            return None

    async def set(self, key: str, value: Any, ttl: int = 60) -> None:
        try:
            r = await self._conn()
            await r.set(key, json.dumps(value), ex=ttl)
        except Exception as exc:
            log.warning("Redis SET failed (%s) — skipping cache", exc)

    async def delete(self, key: str) -> None:
        try:
            r = await self._conn()
            await r.delete(key)
        except Exception as exc:
            log.warning("Redis DELETE failed (%s)", exc)

    async def clear_prefix(self, prefix: str) -> int:
        try:
            r = await self._conn()
            keys: list[str] = []
            async for k in r.scan_iter(f"{prefix}*"):
                keys.append(k)
            if keys:
                await r.delete(*keys)
            return len(keys)
        except Exception as exc:
            log.warning("Redis CLEAR_PREFIX failed (%s)", exc)
            return 0


# ---------------------------------------------------------------------------
# Cache singleton (auto-selects backend)
# ---------------------------------------------------------------------------

def _build_cache() -> _MemoryCache | _RedisCache:
    redis_url = getattr(settings, "REDIS_URL", None)
    if redis_url and _REDIS_AVAILABLE:
        log.info("Cache backend: Redis (%s)", redis_url[:30])
        return _RedisCache(redis_url)
    log.info("Cache backend: in-memory (Redis unavailable or not configured)")
    return _MemoryCache()


cache: _MemoryCache | _RedisCache = _build_cache()
