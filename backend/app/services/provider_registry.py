"""Provider registry and fallback orchestrator.

The registry wraps both SimCompanies and SimcoTools adapters and exposes
high-level methods that automatically:

  1. Try the primary provider
  2. Fall back to the secondary provider on failure
  3. Mark providers healthy / unhealthy
  4. Return cached data if all providers fail

Usage::

    from app.services.provider_registry import registry

    snapshot  = await registry.get_market_snapshot(product_id=5, realm=0)
    resources = await registry.get_all_resources(realm=0)
    phase     = await registry.get_economy_phase(realm=0)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Callable, Optional, TypeVar

from app.services.schemas import (
    EconomyPhase,
    MarketSnapshot,
    ProviderStatus,
    ResourceEntry,
    RetailInfo,
    SimcoResource,
)
from app.services.simcompanies_adapter import SimCompaniesAdapter
from app.services.simcotools_adapter   import SimcoToolsAdapter

log = logging.getLogger(__name__)

T = TypeVar("T")

_UNHEALTHY_COOLDOWN = timedelta(seconds=120)  # don't retry a broken provider for 2 min


class ProviderRegistry:
    """High-level facade with automatic provider fallback."""

    def __init__(
        self,
        primary: SimCompaniesAdapter,
        secondary: SimcoToolsAdapter,
    ) -> None:
        self._primary   = primary
        self._secondary = secondary
        self._status: dict[str, ProviderStatus] = {
            "simcompanies": ProviderStatus(name="simcompanies", healthy=True),
            "simcotools":   ProviderStatus(name="simcotools",   healthy=True),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _is_healthy(self, name: str) -> bool:
        s = self._status[name]
        if s.healthy:
            return True
        # auto-recover after cooldown
        if datetime.utcnow() - s.last_checked > _UNHEALTHY_COOLDOWN:
            log.info("Provider %s cooldown expired — marking healthy again", name)
            s.healthy = True
        return s.healthy

    def _mark_unhealthy(self, name: str, error: str) -> None:
        s = self._status[name]
        s.healthy      = False
        s.last_checked = datetime.utcnow()
        s.error        = error
        log.warning("Provider %s marked unhealthy: %s", name, error)

    def _mark_healthy(self, name: str) -> None:
        s = self._status[name]
        s.healthy      = True
        s.last_checked = datetime.utcnow()
        s.error        = None

    async def _with_fallback(
        self,
        primary_fn:   Callable[[], Any],
        secondary_fn: Callable[[], Any],
        primary_name:   str = "simcompanies",
        secondary_name: str = "simcotools",
    ) -> Any:
        """Try primary; on error try secondary; raise if both fail."""
        if self._is_healthy(primary_name):
            try:
                result = await primary_fn()
                self._mark_healthy(primary_name)
                return result
            except Exception as exc:
                self._mark_unhealthy(primary_name, str(exc))
                log.warning("Primary provider %s failed: %s — trying fallback", primary_name, exc)

        if self._is_healthy(secondary_name):
            try:
                result = await secondary_fn()
                self._mark_healthy(secondary_name)
                return result
            except Exception as exc:
                self._mark_unhealthy(secondary_name, str(exc))
                log.error("Fallback provider %s also failed: %s", secondary_name, exc)

        raise RuntimeError(
            f"All providers failed ({primary_name}, {secondary_name})"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_market_snapshot(
        self, product_id: int, realm: int = 0, quality: int = 1
    ) -> MarketSnapshot:
        """Market snapshot — primary: SimCompanies; no SimcoTools fallback for live offers."""
        return await self._primary.get_market_snapshot(product_id, realm, quality)

    async def get_market_snapshots_bulk(
        self, product_ids: list[int], realm: int = 0, quality: int = 1
    ) -> list[MarketSnapshot]:
        return await self._primary.get_market_snapshots_bulk(product_ids, realm, quality)

    async def get_all_resources(
        self, realm: int = 0
    ) -> tuple[list[ResourceEntry], list[SimcoResource]]:
        """Return (encyclopedia entries, simcotools enriched) — both fetched concurrently."""
        sc_task  = asyncio.create_task(self._primary.get_all_resources(realm))
        sct_task = asyncio.create_task(self._secondary.get_all_resources(realm))

        sc_result:  list[ResourceEntry]  = []
        sct_result: list[SimcoResource]  = []

        try:
            sc_result = await sc_task
        except Exception as exc:
            log.warning("get_all_resources SimCompanies failed: %s", exc)

        try:
            sct_result = await sct_task
        except Exception as exc:
            log.warning("get_all_resources SimcoTools failed: %s", exc)

        return sc_result, sct_result

    async def get_retail_info(
        self, realm: int = 0
    ) -> list[RetailInfo]:
        return await self._primary.get_retail_info(realm)

    async def get_economy_phase(
        self, realm: int = 0
    ) -> Optional[EconomyPhase]:
        """Economy phase — SimcoTools is primary (more reliable); SimCompanies as fallback."""
        return await self._with_fallback(
            primary_fn   = lambda: self._secondary.get_economy_phase(realm),
            secondary_fn = lambda: self._primary.get_economy_phase(realm),
            primary_name   = "simcotools",
            secondary_name = "simcompanies",
        )

    async def get_price_history(
        self, product_id: int, realm: int = 0
    ) -> list[dict]:
        return await self._secondary.get_price_history(product_id, realm)

    def provider_statuses(self) -> dict[str, ProviderStatus]:
        return dict(self._status)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

from app.services.simcompanies_adapter import sc_adapter  # noqa: E402
from app.services.simcotools_adapter   import sct_adapter  # noqa: E402

registry = ProviderRegistry(primary=sc_adapter, secondary=sct_adapter)
