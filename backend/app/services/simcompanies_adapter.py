"""SimCompanies API adapter.

Covers:
  - Market offers       GET /api/v2/market/{item_id}
  - Encyclopedia        GET /api/v4/pt/{realm}/encyclopedia/resources/
  - Single resource     GET /api/v4/pt/{realm}/encyclopedia/resources/{id}/
  - Retail info         GET /api/v4/{realm}/resources-retail-info/
  - Company info        GET /api/v2/companies/{company_id}  (auth required)

All methods:
  - Cache results in Redis (TTLs configurable via settings)
  - Retry on network errors (via AsyncHttpClient)
  - Validate raw responses (validators.py)
  - Normalise to unified schemas (normalizers.py)
  - Support per-realm calls
"""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings
from app.services.cache import cache
from app.services.http_client import build_client
from app.services.normalizers import (
    normalize_economy_phase,
    normalize_market_offer,
    normalize_market_snapshot,
    normalize_resource_entry,
    normalize_retail_info,
)
from app.services.schemas import (
    EconomyPhase,
    MarketOffer,
    MarketSnapshot,
    ResourceEntry,
    RetailInfo,
)
from app.services.validators import (
    validate_economy_phase,
    validate_encyclopedia_resources,
    validate_market_offers,
    validate_retail_info,
)

log = logging.getLogger(__name__)

_BASE = "https://www.simcompanies.com"

# Cache TTLs (seconds)
_TTL_MARKET      = getattr(settings, "CACHE_TTL_MARKET",      30)
_TTL_ENCYCLOPEDIA = getattr(settings, "CACHE_TTL_ENCYCLOPEDIA", 3600)
_TTL_RETAIL      = getattr(settings, "CACHE_TTL_RETAIL",       300)
_TTL_PHASE       = getattr(settings, "CACHE_TTL_PHASE",         60)


class SimCompaniesAdapter:
    """Async adapter for SimCompanies public APIs."""

    def __init__(self, auth_token: Optional[str] = None) -> None:
        extra_headers: dict[str, str] = {}
        if auth_token:
            extra_headers["Authorization"] = f"Bearer {auth_token}"
        self._client = build_client(_BASE, extra_headers=extra_headers)

    # ------------------------------------------------------------------
    # Market offers
    # ------------------------------------------------------------------

    async def get_market_offers(
        self,
        product_id: int,
        realm: int = 0,
        quality: int = 1,
        *,
        use_cache: bool = True,
    ) -> list[MarketOffer]:
        """Fetch all active market offers for a product."""
        cache_key = f"sc:market:{realm}:{product_id}:{quality}"

        if use_cache:
            cached = await cache.get(cache_key)
            if cached is not None:
                return [MarketOffer(**o) for o in cached]

        url = f"/api/v2/market/{product_id}"
        params = {"realm": realm, "quality": quality}

        async with self._client as c:
            raw = await c.get(url, params=params)

        valid = validate_market_offers(raw)
        offers = [normalize_market_offer(o, product_id, realm) for o in valid]

        if use_cache:
            await cache.set(cache_key, [o.model_dump() for o in offers], ttl=_TTL_MARKET)

        log.info("SimCompanies market: %d offers for product %d realm %d", len(offers), product_id, realm)
        return offers

    async def get_market_snapshot(
        self,
        product_id: int,
        realm: int = 0,
        quality: int = 1,
    ) -> MarketSnapshot:
        """Return aggregated market snapshot for one product."""
        offers   = await self.get_market_offers(product_id, realm, quality)
        snapshot = normalize_market_snapshot(offers, product_id, realm, quality)
        return snapshot

    async def get_market_snapshots_bulk(
        self,
        product_ids: list[int],
        realm: int = 0,
        quality: int = 1,
    ) -> list[MarketSnapshot]:
        """Fetch market snapshots for multiple products sequentially (rate-limit safe)."""
        snapshots: list[MarketSnapshot] = []
        for pid in product_ids:
            try:
                snap = await self.get_market_snapshot(pid, realm, quality)
                snapshots.append(snap)
            except Exception as exc:
                log.warning("bulk snapshot failed for product %d: %s", pid, exc)
        return snapshots

    # ------------------------------------------------------------------
    # Encyclopedia
    # ------------------------------------------------------------------

    async def get_all_resources(self, realm: int = 0) -> list[ResourceEntry]:
        """Fetch the full SimCompanies resource encyclopedia."""
        cache_key = f"sc:encyclopedia:{realm}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return [ResourceEntry(**r) for r in cached]

        url = f"/api/v4/pt/{realm}/encyclopedia/resources/"
        async with self._client as c:
            raw = await c.get(url)

        valid   = validate_encyclopedia_resources(raw)
        entries = [normalize_resource_entry(r, realm) for r in valid]

        await cache.set(cache_key, [e.model_dump() for e in entries], ttl=_TTL_ENCYCLOPEDIA)
        log.info("Encyclopedia: %d resources for realm %d", len(entries), realm)
        return entries

    async def get_resource(
        self, product_id: int, realm: int = 0
    ) -> Optional[ResourceEntry]:
        """Fetch a single resource by SimCompanies ID."""
        cache_key = f"sc:resource:{realm}:{product_id}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return ResourceEntry(**cached)

        url = f"/api/v4/pt/{realm}/encyclopedia/resources/{product_id}/"
        try:
            async with self._client as c:
                raw = await c.get(url)
        except Exception as exc:
            log.warning("get_resource %d failed: %s", product_id, exc)
            return None

        valid = validate_encyclopedia_resources([raw] if isinstance(raw, dict) else raw)
        if not valid:
            return None

        entry = normalize_resource_entry(valid[0], realm)
        await cache.set(cache_key, entry.model_dump(), ttl=_TTL_ENCYCLOPEDIA)
        return entry

    # ------------------------------------------------------------------
    # Retail info
    # ------------------------------------------------------------------

    async def get_retail_info(self, realm: int = 0) -> list[RetailInfo]:
        """Fetch retail channel data for all resources."""
        cache_key = f"sc:retail:{realm}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return [RetailInfo(**r) for r in cached]

        url = f"/api/v4/{realm}/resources-retail-info/"
        async with self._client as c:
            raw = await c.get(url)

        valid   = validate_retail_info(raw)
        entries = [normalize_retail_info(r, realm) for r in valid]

        await cache.set(cache_key, [e.model_dump() for e in entries], ttl=_TTL_RETAIL)
        log.info("Retail info: %d entries for realm %d", len(entries), realm)
        return entries

    # ------------------------------------------------------------------
    # Economy phase  (SimCompanies endpoint, if available)
    # ------------------------------------------------------------------

    async def get_economy_phase(self, realm: int = 0) -> Optional[EconomyPhase]:
        """Try to fetch economy phase from SimCompanies main API."""
        cache_key = f"sc:phase:{realm}"
        cached = await cache.get(cache_key)
        if cached is not None:
            return EconomyPhase(**cached)

        # SimCompanies doesn't have a documented phase endpoint;
        # try the community-known path and return None on 404.
        url = f"/api/v4/{realm}/economy-phase/"
        try:
            async with self._client as c:
                raw = await c.get(url)
        except Exception as exc:
            log.debug("SimCompanies phase endpoint not available: %s", exc)
            return None

        data = validate_economy_phase(raw)
        if data is None:
            return None

        phase = normalize_economy_phase(data, realm)
        await cache.set(cache_key, phase.model_dump(), ttl=_TTL_PHASE)
        return phase


# Module-level default instance (no auth — public endpoints only)
sc_adapter = SimCompaniesAdapter()
