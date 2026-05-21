"""Response validation layer.

Every raw JSON dict from an external API passes through validate_*() before
being handed to a normalizer. This isolates schema-drift handling in one place.
"""
from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require(data: dict, key: str, default: Any = None) -> Any:
    """Return data[key] or default; log a debug warning on miss."""
    val = data.get(key, default)
    if val is None and default is None:
        log.debug("Missing required field '%s' in payload: %s", key, list(data.keys()))
    return val


def _is_list(raw: Any, context: str) -> bool:
    if not isinstance(raw, list):
        log.warning("%s expected a list, got %s", context, type(raw).__name__)
        return False
    return True


def _is_dict(raw: Any, context: str) -> bool:
    if not isinstance(raw, dict):
        log.warning("%s expected a dict, got %s", context, type(raw).__name__)
        return False
    return True


# ---------------------------------------------------------------------------
# SimCompanies market offers  —  /api/v2/market/{item_id}
# Expected: list of offer dicts
# ---------------------------------------------------------------------------

def validate_market_offers(raw: Any) -> list[dict]:
    """Validate raw SimCompanies market response; return list of offer dicts."""
    # Some endpoints wrap in {"results": [...]}
    if _is_dict(raw, "validate_market_offers"):
        raw = raw.get("results", raw.get("offers", []))

    if not _is_list(raw, "validate_market_offers"):
        return []

    valid: list[dict] = []
    for i, item in enumerate(raw):
        if not _is_dict(item, f"validate_market_offers[{i}]"):
            continue
        # Mandatory fields
        if "id" not in item and "offer_id" not in item:
            log.debug("Skipping offer without id at index %d", i)
            continue
        if "price" not in item and "unitCost" not in item:
            log.debug("Skipping offer without price at index %d", i)
            continue
        valid.append(item)

    log.debug("validate_market_offers: %d/%d valid", len(valid), len(raw))
    return valid


# ---------------------------------------------------------------------------
# SimCompanies encyclopedia resources  —  /api/v4/pt/{realm}/encyclopedia/resources/
# Expected: list of resource dicts
# ---------------------------------------------------------------------------

def validate_encyclopedia_resources(raw: Any) -> list[dict]:
    if _is_dict(raw, "validate_encyclopedia"):
        # Possible wrapper keys
        for k in ("results", "resources", "data"):
            if k in raw:
                raw = raw[k]
                break

    if not _is_list(raw, "validate_encyclopedia"):
        return []

    valid = []
    for i, item in enumerate(raw):
        if not _is_dict(item, f"validate_encyclopedia[{i}]"):
            continue
        # Requires at minimum: id (or dbLetter) + name
        has_id   = "id" in item or "dbLetter" in item or "kind" in item
        has_name = "name" in item
        if not (has_id and has_name):
            log.debug("Skipping resource entry missing id or name at index %d", i)
            continue
        valid.append(item)

    log.debug("validate_encyclopedia: %d/%d valid", len(valid), len(raw))
    return valid


# ---------------------------------------------------------------------------
# Retail info  —  /api/v4/{realm}/resources-retail-info/
# Expected: list or dict-keyed-by-id
# ---------------------------------------------------------------------------

def validate_retail_info(raw: Any) -> list[dict]:
    # The endpoint sometimes returns a dict {"1": {...}, "2": {...}}
    if _is_dict(raw, "validate_retail_info"):
        raw = list(raw.values())

    if not _is_list(raw, "validate_retail_info"):
        return []

    valid = []
    for i, item in enumerate(raw):
        if not _is_dict(item, f"validate_retail_info[{i}]"):
            continue
        valid.append(item)

    return valid


# ---------------------------------------------------------------------------
# Economy phase  —  SimcoTools /api/v1/realms/{realm}/phases
# Expected: dict with {"phase": int, "name": str, "multiplier": float}
# ---------------------------------------------------------------------------

def validate_economy_phase(raw: Any) -> dict | None:
    if not _is_dict(raw, "validate_economy_phase"):
        return None

    # Accept both flat and wrapped formats
    data = raw.get("data", raw)
    if not _is_dict(data, "validate_economy_phase.data"):
        return None

    phase_code = data.get("phase", data.get("phase_code"))
    if phase_code is None:
        log.warning("Economy phase response missing 'phase' key: %s", list(data.keys()))
        return None

    return data


# ---------------------------------------------------------------------------
# SimcoTools resources  —  simcotools.app/api/v3/resources
# Expected: list of enriched resource records
# ---------------------------------------------------------------------------

def validate_simcotools_resources(raw: Any) -> list[dict]:
    if _is_dict(raw, "validate_simcotools_resources"):
        for k in ("resources", "data", "results"):
            if k in raw:
                raw = raw[k]
                break

    if not _is_list(raw, "validate_simcotools_resources"):
        return []

    valid = []
    for i, item in enumerate(raw):
        if not _is_dict(item, f"validate_simcotools[{i}]"):
            continue
        if "id" not in item and "sim_id" not in item:
            continue
        valid.append(item)

    return valid
