"""
app/services/api_provider.py
Fetches market data from SimCompanies and SimcoTools APIs.

Design principles:
  - Primary provider: SimcoTools (richer aggregated data)
  - Fallback provider: SimCompanies direct API
  - Dynamic response validation (schema changes handled gracefully)
  - Rate-limit aware: honours MAX_REQUESTS_PER_MINUTE
  - Redis cache layer to minimise unnecessary requests
  - Read-only: NEVER modifies game state
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limiter (token bucket, in-process)
# ---------------------------------------------------------------------------

class _RateLimiter:
    """Simple in-process token bucket rate limiter."""

    def __init__(self, rpm: int) -> None:
        self._interval = 60.0 / rpm
        self._last_call = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = self._interval - (now - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()


_limiter = _RateLimiter(settings.MAX_REQUESTS_PER_MINUTE)


# ---------------------------------------------------------------------------
# HTTP client factory
# ---------------------------------------------------------------------------

def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        headers={"Accept": "application/json", "User-Agent": "SCAnalyticsPlatform/1.0 (analytics-only)"},
        follow_redirects=True,
    )


# ---------------------------------------------------------------------------
# Endpoint registry — easy to update when APIs change
# ---------------------------------------------------------------------------

REALM = settings.SIMCO_REALM

ENDPOINTS = {
    # SimcoTools
    "simcotools_resources": f"{settings.SIMCOTOOLS_API_BASE}/api/v3/resources",
    "simcotools_phases":    f"{settings.SIMCOTOOLS_ALT_API_BASE}/v1/realms/{REALM}/phases",
    # SimCompanies direct
    "simco_market":        f"{settings.SIMCO_API_BASE}/api/v2/market",
    "simco_encyclopedia":  f"{settings.SIMCO_API_BASE}/api/v4/pt/{REALM}/encyclopedia/resources",
    "simco_retail_info":   f"{settings.SIMCO_API_BASE}/api/v4/{REALM}/resources-retail-info/",
}


# ---------------------------------------------------------------------------
# Core fetch with cache + fallback
# ---------------------------------------------------------------------------

async def _fetch(url: str, cache_key: str, ttl: int = 60) -> Optional[Any]:
    """Fetch URL with Redis cache. Returns None on failure."""
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    await _limiter.acquire()
    try:
        async with _client() as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            await cache_set(cache_key, data, ttl=ttl)
            return data
    except httpx.HTTPStatusError as e:
        logger.warning("HTTP error fetching %s: %s", url, e.response.status_code)
    except httpx.RequestError as e:
        logger.warning("Request error fetching %s: %s", url, e)
    except Exception as e:
        logger.error("Unexpected error fetching %s: %s", url, e)
    return None


# ---------------------------------------------------------------------------
# Public API methods
# ---------------------------------------------------------------------------

async def get_all_resources(realm: int = REALM) -> Optional[list[dict]]:
    """
    Fetch full resource/product catalogue.
    Primary: SimcoTools v3 resources.
    Fallback: SimCompanies encyclopedia.
    """
    data = await _fetch(
        ENDPOINTS["simcotools_resources"],
        cache_key=f"resources:realm:{realm}",
        ttl=300,  # 5 min — catalogue changes rarely
    )
    if data is not None:
        return data if isinstance(data, list) else data.get("resources") or data.get("data")

    # Fallback
    logger.info("SimcoTools resources unavailable, falling back to SimCompanies encyclopedia")
    data = await _fetch(
        ENDPOINTS["simco_encyclopedia"],
        cache_key=f"encyclopedia:realm:{realm}",
        ttl=300,
    )
    return data if isinstance(data, list) else None


async def get_market_item(item_id: int, realm: int = REALM) -> Optional[dict]:
    """
    Fetch market data for a single item.
    Primary: SimCompanies /api/v2/market/{itemId}.
    """
    url = f"{ENDPOINTS['simco_market']}/{item_id}"
    return await _fetch(url, cache_key=f"market:{realm}:{item_id}", ttl=30)


async def get_retail_info(realm: int = REALM) -> Optional[list[dict]]:
    """Fetch retail price info for all resources."""
    return await _fetch(
        ENDPOINTS["simco_retail_info"],
        cache_key=f"retail_info:{realm}",
        ttl=120,
    )


async def get_economy_phase(realm: int = REALM) -> Optional[dict]:
    """
    Fetch current economy phase.
    Primary: SimcoTools phases API.
    """
    data = await _fetch(
        ENDPOINTS["simcotools_phases"],
        cache_key=f"phase:{realm}",
        ttl=60,
    )
    if data is not None:
        return data
    logger.warning("Economy phase endpoint unavailable for realm %d", realm)
    return None
