"""Response normalizers — raw API dicts → unified Pydantic models.

Each `normalize_*` function accepts a *validated* raw dict and returns
the appropriate unified schema model.  Validation (field existence checks)
happens in validators.py; normalization (field mapping, type coercion,
defaults) happens here.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.services.schemas import (
    EconomyPhase,
    MarketOffer,
    MarketSnapshot,
    ResourceEntry,
    RetailInfo,
    SimcoResource,
)

log = logging.getLogger(__name__)

_PHASE_NAMES = {0: "Stable", 1: "Boom", 2: "Recession", 3: "Recovery"}
_PHASE_MULTIPLIERS = {0: 1.0, 1: 1.25, 2: 0.80, 3: 0.95}


# ---------------------------------------------------------------------------
# Market offers
# ---------------------------------------------------------------------------

def normalize_market_offer(raw: dict, product_id: int, realm: int) -> MarketOffer:
    """Map a single raw offer dict to MarketOffer.

    SimCompanies API uses camelCase; some community scrapers use snake_case.
    We handle both.
    """
    return MarketOffer(
        offer_id   = int(raw.get("id") or raw.get("offer_id", 0)),
        product_id = int(raw.get("kind", raw.get("product_id", product_id))),
        realm      = int(raw.get("realm", realm)),
        quality    = int(raw.get("quality", 1)),
        price      = float(raw.get("price") or raw.get("unitCost", 0)),
        quantity   = int(raw.get("quantity") or raw.get("amount", 0)),
        seller_id  = raw.get("company") or raw.get("seller_id"),
    )


def normalize_market_snapshot(
    offers: list[MarketOffer],
    product_id: int,
    realm: int,
    quality: int = 1,
) -> MarketSnapshot:
    """Aggregate a list of offers into one MarketSnapshot."""
    filtered = [o for o in offers if o.quality == quality]

    if not filtered:
        return MarketSnapshot(
            product_id=product_id,
            realm=realm,
            quality=quality,
            lowest_ask=0.0,
            highest_ask=0.0,
        )

    prices    = [o.price for o in filtered]
    quantities = [o.quantity for o in filtered]
    total_qty  = sum(quantities)

    vwap = (
        sum(p * q for p, q in zip(prices, quantities)) / total_qty
        if total_qty else 0.0
    )

    if len(prices) > 1:
        avg   = sum(prices) / len(prices)
        variance  = sum((p - avg) ** 2 for p in prices) / len(prices)
        volatility = (variance ** 0.5) / avg if avg else 0.0
    else:
        volatility = 0.0

    return MarketSnapshot(
        product_id      = product_id,
        realm           = realm,
        quality         = quality,
        lowest_ask      = min(prices),
        highest_ask     = max(prices),
        vwap            = round(vwap, 6),
        total_supply    = total_qty,
        offer_count     = len(filtered),
        demand_score    = min(1.0, total_qty / 1000),  # heuristic; enriched later
        price_volatility = round(volatility, 6),
        source          = "simcompanies",
    )


# ---------------------------------------------------------------------------
# Encyclopedia / resource entries
# ---------------------------------------------------------------------------

# Category mapping: SimCompanies numeric kind → string category
_CATEGORY_MAP: dict[int, str] = {
    0: "agriculture",   1: "agriculture",  2: "agriculture",
    10: "mining",       11: "mining",
    20: "manufacturing",21: "manufacturing",
    30: "electronics",  31: "electronics",
    40: "chemicals",    41: "chemicals",
    50: "automotive",   51: "automotive",
    60: "aerospace",    61: "aerospace",
    70: "food",         71: "food",
    80: "retail",       81: "retail",
    90: "research",
    100: "real_estate",
}


def normalize_resource_entry(raw: dict, realm: int) -> ResourceEntry:
    """Map a raw encyclopedia resource dict to ResourceEntry."""
    kind_id = int(raw.get("id") or raw.get("kind", 0))
    category_raw = raw.get("category", "")
    if isinstance(category_raw, int):
        category = _CATEGORY_MAP.get(category_raw, "other")
    else:
        category = str(category_raw).lower() if category_raw else _CATEGORY_MAP.get(kind_id // 10 * 10, "other")

    ingredients_raw = raw.get("ingredients") or raw.get("recipe") or []
    if isinstance(ingredients_raw, dict):
        ingredients = [{"product_id": k, "quantity": v} for k, v in ingredients_raw.items()]
    else:
        ingredients = ingredients_raw

    return ResourceEntry(
        sim_id           = kind_id,
        realm            = realm,
        key              = raw.get("db_letter") or raw.get("key") or raw.get("name", ""),
        name             = raw.get("name", ""),
        category         = category,
        retail_price     = float(raw.get("retailPrice") or raw.get("retail_price") or 0),
        transport_cost   = float(raw.get("transportCost") or raw.get("transport_cost") or 0),
        units_per_run    = int(raw.get("unitsPerRun") or raw.get("units_per_run") or 1),
        production_time  = int(raw.get("productionTime") or raw.get("production_time") or 0),
        is_raw_material  = bool(raw.get("isRawMaterial") or raw.get("is_raw_material") or False),
        is_tradeable     = bool(raw.get("isTradeable") if "isTradeable" in raw else raw.get("is_tradeable", True)),
        ingredients      = ingredients,
    )


# ---------------------------------------------------------------------------
# Retail info
# ---------------------------------------------------------------------------

def normalize_retail_info(raw: dict, realm: int) -> RetailInfo:
    product_id = int(raw.get("id") or raw.get("resource") or raw.get("product_id", 0))
    quality    = int(raw.get("quality", 1))
    return RetailInfo(
        product_id          = product_id,
        realm               = realm,
        quality             = quality,
        daily_demand        = float(raw.get("dailyDemand") or raw.get("daily_demand") or 0),
        max_retail_price    = float(raw.get("maxRetailPrice") or raw.get("max_retail_price") or 0),
        saturation_level    = float(raw.get("saturationLevel") or raw.get("saturation_level") or 0),
        quality_multiplier  = float(raw.get("qualityMultiplier") or raw.get("quality_multiplier") or 1.0),
    )


# ---------------------------------------------------------------------------
# Economy phase
# ---------------------------------------------------------------------------

def normalize_economy_phase(raw: dict, realm: int) -> EconomyPhase:
    data = raw.get("data", raw)
    code = int(data.get("phase") or data.get("phase_code") or 0)
    name = data.get("name") or data.get("phase_name") or _PHASE_NAMES.get(code, "Unknown")
    mult = float(data.get("multiplier") or _PHASE_MULTIPLIERS.get(code, 1.0))

    started_raw = data.get("startedAt") or data.get("started_at")
    started_at: datetime | None = None
    if started_raw:
        try:
            started_at = datetime.fromisoformat(str(started_raw).replace("Z", "+00:00"))
        except ValueError:
            pass

    return EconomyPhase(
        realm      = realm,
        phase_code = code,
        phase_name = name,
        multiplier = mult,
        started_at = started_at,
        source     = data.get("source", "simcotools"),
    )


# ---------------------------------------------------------------------------
# SimcoTools enriched resources
# ---------------------------------------------------------------------------

def normalize_simco_resource(raw: dict, realm: int) -> SimcoResource:
    sim_id   = int(raw.get("id") or raw.get("sim_id") or 0)
    updated_raw = raw.get("updatedAt") or raw.get("updated_at")
    updated_at: datetime | None = None
    if updated_raw:
        try:
            updated_at = datetime.fromisoformat(str(updated_raw).replace("Z", "+00:00"))
        except ValueError:
            pass

    return SimcoResource(
        sim_id           = sim_id,
        realm            = realm,
        name             = raw.get("name", ""),
        category         = str(raw.get("category", "other")).lower(),
        avg_price        = float(raw.get("avgPrice") or raw.get("avg_price") or 0),
        min_price        = float(raw.get("minPrice") or raw.get("min_price") or 0),
        max_price        = float(raw.get("maxPrice") or raw.get("max_price") or 0),
        price_trend      = float(raw.get("priceTrend") or raw.get("price_trend") or 0),
        total_supply     = int(raw.get("totalSupply") or raw.get("total_supply") or 0),
        demand_index     = float(raw.get("demandIndex") or raw.get("demand_index") or 0),
        volatility_index = float(raw.get("volatilityIndex") or raw.get("volatility_index") or 0),
        updated_at       = updated_at,
    )
