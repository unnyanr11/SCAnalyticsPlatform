"""Unit tests for normalizers — no network required."""
from __future__ import annotations

import pytest
from app.services.normalizers import (
    normalize_economy_phase,
    normalize_market_offer,
    normalize_market_snapshot,
    normalize_resource_entry,
    normalize_retail_info,
    normalize_simco_resource,
)
from app.services.schemas import EconomyPhaseCode


# ---------------------------------------------------------------------------
# Market offers
# ---------------------------------------------------------------------------

def test_normalize_market_offer_camelcase():
    raw = {"id": 101, "kind": 5, "realm": 0, "quality": 1, "price": 42.5, "quantity": 100}
    offer = normalize_market_offer(raw, product_id=5, realm=0)
    assert offer.offer_id == 101
    assert offer.price    == 42.5
    assert offer.quantity == 100


def test_normalize_market_offer_snake_case():
    raw = {"offer_id": 202, "product_id": 3, "realm": 1, "quality": 2,
           "unitCost": "18.99", "amount": 50}
    offer = normalize_market_offer(raw, product_id=3, realm=1)
    assert offer.price    == 18.99
    assert offer.quantity == 50


def test_normalize_market_snapshot_aggregation():
    from app.services.schemas import MarketOffer
    offers = [
        MarketOffer(offer_id=1, product_id=5, realm=0, quality=1, price=10.0, quantity=100),
        MarketOffer(offer_id=2, product_id=5, realm=0, quality=1, price=12.0, quantity=200),
        MarketOffer(offer_id=3, product_id=5, realm=0, quality=2, price=20.0, quantity=50),  # diff quality
    ]
    snap = normalize_market_snapshot(offers, product_id=5, realm=0, quality=1)
    assert snap.lowest_ask  == 10.0
    assert snap.highest_ask == 12.0
    assert snap.offer_count == 2
    assert snap.total_supply == 300
    # VWAP: (10*100 + 12*200) / 300 = 3400/300 ≈ 11.333
    assert abs(snap.vwap - 11.333) < 0.01


def test_normalize_market_snapshot_empty():
    snap = normalize_market_snapshot([], product_id=1, realm=0)
    assert snap.lowest_ask == 0.0
    assert snap.offer_count == 0


# ---------------------------------------------------------------------------
# Encyclopedia
# ---------------------------------------------------------------------------

def test_normalize_resource_entry_camelcase():
    raw = {
        "id": 5, "name": "Electronics", "category": 30,
        "retailPrice": 45.0, "transportCost": 0.8,
        "unitsPerRun": 20, "productionTime": 1800,
        "isRawMaterial": False, "isTradeable": True,
        "ingredients": [{"product_id": 3, "quantity": 5}],
    }
    entry = normalize_resource_entry(raw, realm=0)
    assert entry.sim_id   == 5
    assert entry.category == "electronics"
    assert entry.retail_price == 45.0
    assert len(entry.ingredients) == 1


def test_normalize_resource_entry_dict_ingredients():
    raw = {
        "id": 4, "name": "Steel", "category": "manufacturing",
        "retailPrice": 8.5, "transportCost": 0.2,
        "ingredients": {"3": 2, "12": 4},  # dict format
    }
    entry = normalize_resource_entry(raw, realm=0)
    assert len(entry.ingredients) == 2
    assert entry.ingredients[0]["product_id"] == "3"


# ---------------------------------------------------------------------------
# Retail info
# ---------------------------------------------------------------------------

def test_normalize_retail_info():
    raw = {"id": 7, "quality": 1, "dailyDemand": 500.0,
           "maxRetailPrice": 80.0, "saturationLevel": 0.35,
           "qualityMultiplier": 1.2}
    info = normalize_retail_info(raw, realm=0)
    assert info.product_id       == 7
    assert info.daily_demand     == 500.0
    assert info.saturation_level == 0.35


# ---------------------------------------------------------------------------
# Economy phase
# ---------------------------------------------------------------------------

def test_normalize_economy_phase_flat():
    raw = {"phase": 1, "name": "Boom", "multiplier": 1.25}
    phase = normalize_economy_phase(raw, realm=0)
    assert phase.phase_code == EconomyPhaseCode.BOOM
    assert phase.multiplier == 1.25


def test_normalize_economy_phase_wrapped():
    raw = {"data": {"phase_code": 2, "phase_name": "Recession", "multiplier": 0.80}}
    phase = normalize_economy_phase(raw, realm=1)
    assert phase.phase_code == EconomyPhaseCode.RECESSION
    assert phase.realm      == 1


def test_normalize_economy_phase_fallback_multiplier():
    # Missing multiplier — should default from _PHASE_MULTIPLIERS
    raw = {"phase": 3}
    phase = normalize_economy_phase(raw, realm=0)
    assert phase.multiplier == 0.95  # Recovery


# ---------------------------------------------------------------------------
# SimcoTools resource
# ---------------------------------------------------------------------------

def test_normalize_simco_resource():
    raw = {
        "id": 6, "name": "Processors", "category": "electronics",
        "avgPrice": 118.5, "minPrice": 110.0, "maxPrice": 130.0,
        "priceTrend": 3.2, "totalSupply": 500,
        "demandIndex": 0.85, "volatilityIndex": 0.12,
    }
    res = normalize_simco_resource(raw, realm=0)
    assert res.sim_id    == 6
    assert res.avg_price == 118.5
    assert res.price_trend == 3.2
