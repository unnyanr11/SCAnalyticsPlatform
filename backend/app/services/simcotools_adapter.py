"""SimcoTools API adapter.

Covers:
  - Enriched resource analytics  GET https://simcotools.app/api/v3/resources
  - Economy phases               GET https://api.simcotools.com/v1/realms/{realm}/phases
  - Single resource analytics    GET https://simcotools.app/api/v3/resources/{id}
  - Price history (if available) GET https://simcotools.app/api/v3/resources/{id}/history

All methods cache, validate, and normalize identically to SimCompaniesAdapter.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings
from app.services.cache import cache
from app.services.http_client import build_client
from app.services.normalizers import (
    normalize_economy_phase,
    normalize_simco_resource,
)
from app.services.schemas import (
    EconomyPhase,
    SimcoResource,
)
from app.services.validators import (
    validate_economy_phase,
    validate_simcotools_resources,
)

log = logging.getLogger(__name__)

_BASE_APP  = "https://simcotools.app"
_BASE_API  = "https://api.simcotools.com"

_TTL_RESOURCES = getattr(settings, "CACHE_TTL_SIMCO_RESOURCES", 120)
_TTL_PHASE     = getattr(settings, "CACHE_TTL_PHASE",             60)
_TTL_HISTORY   = getattr(settings, "CACHE_TTL_HISTORY",          600)


class SimcoToolsAdapter:
    """Async adapter for SimcoTools APIs."""

    def __init__(self) -> None:
        self._app_client = build_client(_BASE_APP)
        self._api_client = build_client(_BASE_API)

    # ------------------------------------------------------------------
    # Enriched resource analytics
    # ------------------------------------------------------------------

    async def get_all_resources(self, realm: int = 0) -> list[SimcoResource]:
        """Fetch SimcoTools enriched analytics for all resources."""
        cache_key = f"sct:resources:{realm}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return [SimcoResource(**r) for r in cached]

        url = "/api/v3/resources"
        async with self._app_client as c:
            raw = await c.get(url, params={"realm": realm})

        valid   = validate_simcotools_resources(raw)
        entries = [normalize_simco_resource(r, realm) for r in valid]

        await cache.set(cache_key, [e.model_dump() for e in entries], ttl=_TTL_RESOURCES)
        log.info("SimcoTools resources: %d entries for realm %d", len(entries), realm)
        return entries

    async def get_resource(
        self, product_id: int, realm: int = 0
    ) -> Optional[SimcoResource]:
        """Fetch SimcoTools analytics for a single resource."""
        cache_key = f"sct:resource:{realm}:{product_id}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return SimcoResource(**cached)

        url = f"/api/v3/resources/{product_id}"
        try:
            async with self._app_client as c:
                raw = await c.get(url, params={"realm": realm})
        except Exception as exc:
            log.warning("SimcoTools resource %d failed: %s", product_id, exc)
            return None

        valid = validate_simcotools_resources([raw] if isinstance(raw, dict) else raw)
        if not valid:
            return None

        entry = normalize_simco_resource(valid[0], realm)
        await cache.set(cache_key, entry.model_dump(), ttl=_TTL_RESOURCES)
        return entry

    async def get_price_history(
        self, product_id: int, realm: int = 0
    ) -> list[dict]:
        """Fetch price history for a resource (raw — AI engine consumes directly)."""
        cache_key = f"sct:history:{realm}:{product_id}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        url = f"/api/v3/resources/{product_id}/history"
        try:
            async with self._app_client as c:
                raw = await c.get(url, params={"realm": realm})
        except Exception as exc:
            log.warning("SimcoTools history %d failed: %s", product_id, exc)
            return []

        history: list[dict] = raw if isinstance(raw, list) else raw.get("history", [])
        await cache.set(cache_key, history, ttl=_TTL_HISTORY)
        return history

    # ------------------------------------------------------------------
    # Economy phases
    # ------------------------------------------------------------------

    async def get_economy_phase(self, realm: int = 0) -> Optional[EconomyPhase]:
        """Fetch current economy phase from SimcoTools."""
        cache_key = f"sct:phase:{realm}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return EconomyPhase(**cached)

        url = f"/v1/realms/{realm}/phases"
        try:
            async with self._api_client as c:
                raw = await c.get(url)
        except Exception as exc:
            log.warning("SimcoTools phase realm %d failed: %s", realm, exc)
            return None

        data = validate_economy_phase(raw)
        if data is None:
            return None

        phase = normalize_economy_phase(data, realm)
        await cache.set(cache_key, phase.model_dump(), ttl=_TTL_PHASE)
        return phase


# Module-level default instance
sct_adapter = SimcoToolsAdapter()
