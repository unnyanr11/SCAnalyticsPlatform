"""
tests/test_health.py
Baseline tests: health endpoint + data normalizer correctness.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.data_normalizer import (
    normalize_market_item,
    normalize_product,
    normalize_economy_phase,
)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_returns_ok() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


# ---------------------------------------------------------------------------
# Data normalizer — market item
# ---------------------------------------------------------------------------

def test_normalize_market_item_simco_schema() -> None:
    raw = {"kind": 3, "name": "Steel", "price": 12.5, "quantity": 1000}
    item = normalize_market_item(raw, source="simco")
    assert item is not None
    assert item["id"] == 3
    assert item["price"] == 12.5
    assert item["quantity"] == 1000
    assert item["source"] == "simco"


def test_normalize_market_item_simcotools_schema() -> None:
    raw = {"id": 10, "label": "Processors", "marketPrice": 250.0, "qty": 50}
    item = normalize_market_item(raw, source="simcotools")
    assert item is not None
    assert item["id"] == 10
    assert item["name"] == "Processors"
    assert item["price"] == 250.0


def test_normalize_market_item_missing_price_returns_none() -> None:
    raw = {"id": 5, "name": "Iron"}
    assert normalize_market_item(raw) is None


def test_normalize_market_item_missing_id_returns_none() -> None:
    raw = {"price": 5.0, "quantity": 100}
    assert normalize_market_item(raw) is None


# ---------------------------------------------------------------------------
# Data normalizer — product
# ---------------------------------------------------------------------------

def test_normalize_product_basic() -> None:
    raw = {"id": 1, "name": "Iron Ore", "category": "mining", "retailPrice": 3.0}
    product = normalize_product(raw)
    assert product is not None
    assert product["id"] == 1
    assert product["retail_price"] == 3.0


def test_normalize_product_no_id_returns_none() -> None:
    raw = {"name": "Unknown resource"}
    assert normalize_product(raw) is None


# ---------------------------------------------------------------------------
# Data normalizer — economy phase
# ---------------------------------------------------------------------------

def test_normalize_economy_phase_boom() -> None:
    raw = {"phase": "boom", "realm": 0}
    result = normalize_economy_phase(raw)
    assert result is not None
    assert result["phase"] == "boom"


def test_normalize_economy_phase_alias() -> None:
    raw = {"economyPhase": "contraction", "realm": 0}
    result = normalize_economy_phase(raw)
    assert result is not None
    assert result["phase"] == "recession"


def test_normalize_economy_phase_unknown_returns_stable() -> None:
    raw = {"phase": "weird_unknown_value"}
    result = normalize_economy_phase(raw)
    assert result is not None
    assert result["phase"] == "stable"


def test_normalize_economy_phase_no_phase_returns_none() -> None:
    raw = {"realm": 0, "some_other_key": "value"}
    assert normalize_economy_phase(raw) is None
