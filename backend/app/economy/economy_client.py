"""HTTP client for SimcoTools economy phase + market APIs with caching and fallback."""
from __future__ import annotations
import asyncio
import logging
import time
from typing import Optional, Dict, Any, List

try:
    import httpx
    _HTTPX = True
except ImportError:
    _HTTPX = False

logger = logging.getLogger(__name__)

# ─── Endpoint catalogue ───────────────────────────────────────────────────────
SIMCO_BASE = "https://www.simcompanies.com/api"
SIMCOTOOLS_BASE = "https://api.simcotools.com"
SIMCOTOOLS_APP = "https://simcotools.app/api"

_ENDPOINTS: Dict[str, str] = {
    "phases":            f"{SIMCOTOOLS_BASE}/v1/realms/{{realm}}/phases",
    "resources":         f"{SIMCOTOOLS_APP}/v3/resources",
    "market_resource":   f"{SIMCO_BASE}/v2/market/{{resource_id}}",
    "encyclopedia":      f"{SIMCO_BASE}/v4/pt/{{realm}}/encyclopedia/resources/",
    "retail_info":       f"{SIMCO_BASE}/v4/{{realm}}/resources-retail-info/",
    "market_all":        f"{SIMCOTOOLS_APP}/v3/market",
}

_CACHE_TTL = 300   # 5 min for phase data
_MARKET_TTL = 60   # 1 min for market snapshots
_cache: Dict[str, tuple] = {}   # key → (data, expires_at)


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and time.time() < entry[1]:
        return entry[0]
    return None


def _cache_set(key: str, data: Any, ttl: int) -> None:
    _cache[key] = (data, time.time() + ttl)


# ─── Synthetic fallbacks (used when APIs are unreachable) ─────────────────────
_SYNTHETIC_PHASES: List[Dict[str, Any]] = [
    {"id": 1, "name": "boom",      "startedAt": None, "realm": 0},
]

_SYNTHETIC_MARKET: List[Dict[str, Any]] = [
    {"id": 1,  "name": "Processors",    "price": 3200.0, "quantity": 420,  "kind": 3},
    {"id": 2,  "name": "Steel",         "price": 180.0,  "quantity": 1100, "kind": 1},
    {"id": 3,  "name": "Electronics",   "price": 880.0,  "quantity": 300,  "kind": 3},
    {"id": 4,  "name": "Chemicals",     "price": 95.0,   "quantity": 750,  "kind": 2},
    {"id": 5,  "name": "Automobiles",   "price": 12500.0,"quantity": 55,   "kind": 4},
]


class EconomyAPIClient:
    """Async HTTP client wrapping SimcoTools + SimCompanies market endpoints."""

    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout
        self._client: Optional[Any] = None

    async def _get(self, url: str, params: Optional[Dict] = None) -> Optional[Any]:
        if not _HTTPX:
            return None
        try:
            if self._client is None:
                self._client = httpx.AsyncClient(timeout=self.timeout)
            r = await self._client.get(url, params=params)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            logger.debug("EconomyAPIClient GET %s failed: %s", url, exc)
            return None

    # ── Economy phases ────────────────────────────────────────────────────────
    async def fetch_phases(self, realm: int = 0) -> List[Dict[str, Any]]:
        key = f"phases:{realm}"
        cached = _cache_get(key)
        if cached is not None:
            return cached

        url = _ENDPOINTS["phases"].format(realm=realm)
        data = await self._get(url)
        if not data or not isinstance(data, list):
            # second attempt on realm 1
            url2 = _ENDPOINTS["phases"].format(realm=1)
            data = await self._get(url2)
        if not data or not isinstance(data, list):
            logger.warning("Phase API unreachable — using synthetic fallback")
            data = _SYNTHETIC_PHASES

        _cache_set(key, data, _CACHE_TTL)
        return data

    # ── Market snapshot ───────────────────────────────────────────────────────
    async def fetch_market_snapshot(self, realm: int = 0) -> List[Dict[str, Any]]:
        key = f"market_snapshot:{realm}"
        cached = _cache_get(key)
        if cached is not None:
            return cached

        data = await self._get(_ENDPOINTS["market_all"])
        if not data or not isinstance(data, list):
            data = await self._get(_ENDPOINTS["resources"])
        if not data or not isinstance(data, list):
            logger.warning("Market API unreachable — using synthetic fallback")
            data = _SYNTHETIC_MARKET

        _cache_set(key, data, _MARKET_TTL)
        return data

    # ── Single resource market ────────────────────────────────────────────────
    async def fetch_resource_market(self, resource_id: int) -> Optional[Dict[str, Any]]:
        key = f"resource_market:{resource_id}"
        cached = _cache_get(key)
        if cached is not None:
            return cached
        url = _ENDPOINTS["market_resource"].format(resource_id=resource_id)
        data = await self._get(url)
        if data:
            _cache_set(key, data, _MARKET_TTL)
        return data

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def clear_cache(self) -> None:
        _cache.clear()
