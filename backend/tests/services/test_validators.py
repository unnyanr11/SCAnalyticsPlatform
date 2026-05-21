"""Unit tests for validators — no network required."""
from __future__ import annotations

import pytest
from app.services.validators import (
    validate_economy_phase,
    validate_encyclopedia_resources,
    validate_market_offers,
    validate_retail_info,
    validate_simcotools_resources,
)


# ---------------------------------------------------------------------------
# Market offers
# ---------------------------------------------------------------------------

def test_validate_market_offers_list():
    raw = [
        {"id": 1, "price": 10.0, "quantity": 100},
        {"id": 2, "price": 12.0, "quantity": 200},
    ]
    result = validate_market_offers(raw)
    assert len(result) == 2


def test_validate_market_offers_wrapped():
    raw = {"results": [{"id": 1, "price": 5.0, "quantity": 50}]}
    result = validate_market_offers(raw)
    assert len(result) == 1


def test_validate_market_offers_missing_price_skipped():
    raw = [
        {"id": 1, "quantity": 100},   # no price → skip
        {"id": 2, "price": 8.0, "quantity": 50},
    ]
    result = validate_market_offers(raw)
    assert len(result) == 1


def test_validate_market_offers_non_list():
    result = validate_market_offers("not a list")
    assert result == []


# ---------------------------------------------------------------------------
# Encyclopedia
# ---------------------------------------------------------------------------

def test_validate_encyclopedia_resources():
    raw = [
        {"id": 5, "name": "Electronics"},
        {"name": "Nameless"},       # missing id → skip
        {"id": 6},                  # missing name → skip
    ]
    result = validate_encyclopedia_resources(raw)
    assert len(result) == 1


def test_validate_encyclopedia_wrapped():
    raw = {"resources": [{"id": 1, "name": "Water"}]}
    result = validate_encyclopedia_resources(raw)
    assert len(result) == 1


# ---------------------------------------------------------------------------
# Retail info
# ---------------------------------------------------------------------------

def test_validate_retail_info_dict_form():
    raw = {"1": {"id": 1, "dailyDemand": 100}, "2": {"id": 2, "dailyDemand": 200}}
    result = validate_retail_info(raw)
    assert len(result) == 2


def test_validate_retail_info_list():
    raw = [{"id": 1}, {"id": 2}]
    result = validate_retail_info(raw)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# Economy phase
# ---------------------------------------------------------------------------

def test_validate_economy_phase_valid():
    raw = {"phase": 1, "name": "Boom", "multiplier": 1.25}
    result = validate_economy_phase(raw)
    assert result is not None
    assert result["phase"] == 1


def test_validate_economy_phase_missing_phase():
    raw = {"name": "Boom", "multiplier": 1.25}
    result = validate_economy_phase(raw)
    assert result is None


def test_validate_economy_phase_non_dict():
    result = validate_economy_phase([1, 2, 3])
    assert result is None


# ---------------------------------------------------------------------------
# SimcoTools resources
# ---------------------------------------------------------------------------

def test_validate_simcotools_resources():
    raw = [
        {"id": 5, "name": "Electronics", "avgPrice": 45.0},
        {"name": "NoId"},  # no id → skip
    ]
    result = validate_simcotools_resources(raw)
    assert len(result) == 1


def test_validate_simcotools_wrapped():
    raw = {"data": [{"sim_id": 6, "name": "Processors"}]}
    result = validate_simcotools_resources(raw)
    assert len(result) == 1
