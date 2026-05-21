"""
app/services/data_normalizer.py
Normalizes raw API responses from different providers into a
unified internal format used throughout the analytics pipeline.

Handles schema differences between:
  - SimCompanies market API
  - SimcoTools resources API
  - Encyclopedia endpoints

This module is strictly read-only transformation — no side effects.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalized types
# ---------------------------------------------------------------------------

class NormalizedProduct(dict):
    """
    Unified product/resource representation:
      id, name, category, image_url, retail_price,
      production_cost, production_time, realm
    """


class NormalizedMarketItem(dict):
    """
    Unified market snapshot:
      id, name, price, quantity, retail_price,
      production_cost, realm, source, timestamp
    """


# ---------------------------------------------------------------------------
# Field name aliases across providers
# ---------------------------------------------------------------------------

_PRICE_KEYS   = ("price", "marketPrice", "market_price", "avg_price", "avgPrice")
_QTY_KEYS     = ("quantity", "qty", "amount", "available", "totalQty", "total_qty")
_NAME_KEYS    = ("name", "label", "resource_name", "resourceName", "title")
_ID_KEYS      = ("id", "kind", "resource_id", "resourceId", "item_id", "itemId")
_RETAIL_KEYS  = ("retailPrice", "retail_price", "db3Price", "npcPrice")
_COST_KEYS    = ("productionCost", "production_cost", "cost", "mpc")
_CAT_KEYS     = ("category", "cat", "type", "resourceType", "resource_type")


def _first(d: dict, keys: tuple, default: Any = None) -> Any:
    """Return the first matching key value from a dict."""
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return default


# ---------------------------------------------------------------------------
# Normalizers
# ---------------------------------------------------------------------------

def normalize_product(raw: dict, realm: int = 0) -> Optional[NormalizedProduct]:
    """
    Normalize a single product/resource record from any provider.
    Returns None if the record cannot be parsed (logs a warning).
    """
    try:
        item_id = _first(raw, _ID_KEYS)
        name    = _first(raw, _NAME_KEYS, "Unknown")
        if item_id is None:
            logger.debug("normalize_product: skipping record with no id: %s", list(raw.keys())[:5])
            return None
        return NormalizedProduct({
            "id":              int(item_id),
            "name":            str(name),
            "category":        _first(raw, _CAT_KEYS),
            "image_url":       raw.get("image") or raw.get("imageUrl") or raw.get("icon"),
            "retail_price":    _safe_float(_first(raw, _RETAIL_KEYS)),
            "production_cost": _safe_float(_first(raw, _COST_KEYS)),
            "production_time": _safe_float(raw.get("productionTime") or raw.get("production_time")),
            "realm":           realm,
        })
    except Exception as e:
        logger.warning("normalize_product error: %s | raw keys: %s", e, list(raw.keys())[:8])
        return None


def normalize_market_item(raw: dict, realm: int = 0, source: str = "unknown") -> Optional[NormalizedMarketItem]:
    """
    Normalize a single market listing record.
    Returns None if price or id cannot be parsed.
    """
    try:
        item_id = _first(raw, _ID_KEYS)
        price   = _safe_float(_first(raw, _PRICE_KEYS))
        qty     = _safe_int(_first(raw, _QTY_KEYS, 0))
        if item_id is None or price is None:
            return None
        return NormalizedMarketItem({
            "id":              int(item_id),
            "name":            str(_first(raw, _NAME_KEYS, "Unknown")),
            "price":           price,
            "quantity":        qty,
            "retail_price":    _safe_float(_first(raw, _RETAIL_KEYS)),
            "production_cost": _safe_float(_first(raw, _COST_KEYS)),
            "realm":           realm,
            "source":          source,
            "timestamp":       raw.get("timestamp") or raw.get("updatedAt") or raw.get("updated_at"),
        })
    except Exception as e:
        logger.warning("normalize_market_item error: %s", e)
        return None


def normalize_resource_list(
    raw_list: list[dict],
    realm: int = 0,
    source: str = "simcotools",
) -> list[NormalizedMarketItem]:
    """
    Normalize a list of resource/market records.
    Skips invalid records and returns only successfully parsed items.
    """
    results = []
    for raw in raw_list:
        if not isinstance(raw, dict):
            continue
        item = normalize_market_item(raw, realm=realm, source=source)
        if item is not None:
            results.append(item)
    logger.debug(
        "normalize_resource_list: %d/%d records normalized from %s",
        len(results), len(raw_list), source,
    )
    return results


def normalize_economy_phase(raw: dict) -> Optional[dict]:
    """
    Normalize economy phase response.
    Maps various provider field names to: { phase, realm, raw_data }
    """
    if not isinstance(raw, dict):
        return None
    phase = (
        raw.get("phase")
        or raw.get("economyPhase")
        or raw.get("economy_phase")
        or raw.get("state")
        or raw.get("status")
    )
    if not phase:
        # Try to extract from nested structure
        for key in ("data", "result", "payload"):
            nested = raw.get(key)
            if isinstance(nested, dict):
                phase = nested.get("phase") or nested.get("economyPhase")
                if phase:
                    break
    if not phase:
        logger.warning("normalize_economy_phase: could not detect phase from: %s", list(raw.keys()))
        return None

    # Normalise phase name
    phase_str = str(phase).lower().strip()
    phase_map = {
        "boom": "boom",
        "expansion": "boom",
        "growth": "boom",
        "stable": "stable",
        "normal": "stable",
        "recession": "recession",
        "contraction": "recession",
        "decline": "recession",
        "recovery": "recovery",
        "rebound": "recovery",
    }
    normalized_phase = phase_map.get(phase_str, "stable")

    return {
        "phase":    normalized_phase,
        "realm":    raw.get("realm", 0),
        "raw_data": str(raw),
    }


# ---------------------------------------------------------------------------
# Type coercion helpers
# ---------------------------------------------------------------------------

def _safe_float(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (ValueError, TypeError):
        return None


def _safe_int(v: Any) -> Optional[int]:
    try:
        return int(float(v)) if v is not None else None
    except (ValueError, TypeError):
        return None
