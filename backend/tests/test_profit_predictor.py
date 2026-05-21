"""
Unit tests for the AI Profit Predictor subsystem.
Run with: pytest backend/tests/test_profit_predictor.py -v
"""
from __future__ import annotations

import math
import time
from typing import List

import pytest

from app.ai.schemas import EconomyPhase, PredictionRequest, PricePoint, Recommendation
from app.ai.feature_engineering import build_feature_df, XGB_FEATURE_COLS
from app.ai.ensemble import combine
from app.ai.profit_predictor import ProfitPredictor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_history(n: int = 48, base: float = 100.0, noise: float = 5.0) -> List[PricePoint]:
    import random
    random.seed(42)
    now = int(time.time() * 1000)
    pts = []
    price = base
    for i in range(n):
        price += random.gauss(0, noise) * 0.5
        price  = max(price, 1.0)
        pts.append(PricePoint(
            timestamp = now - (n - i) * 3_600_000,
            price     = round(price, 2),
            quantity  = random.uniform(100, 500),
            supply    = random.uniform(5000, 20000),
            demand    = random.uniform(0.4, 0.9),
        ))
    return pts


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def test_feature_df_shape() -> None:
    history = _make_history(48)
    df = build_feature_df(history, EconomyPhase.STABLE)
    assert len(df) == 48
    for col in ["price_log", "rsi", "bb_position", "volatility", "economy_phase"]:
        assert col in df.columns, f"Missing column: {col}"


def test_feature_df_no_nulls_in_key_cols() -> None:
    history = _make_history(20)
    df = build_feature_df(history, EconomyPhase.BOOM)
    key_cols = [c for c in XGB_FEATURE_COLS if c in df.columns]
    nulls = df[key_cols].isnull().sum().sum()
    assert nulls == 0, f"Found {nulls} nulls in feature columns"


def test_economy_phase_encoding() -> None:
    for phase, expected in [
        (EconomyPhase.RECESSION, 0.0),
        (EconomyPhase.STABLE,    0.33),
        (EconomyPhase.RECOVERY,  0.67),
        (EconomyPhase.BOOM,      1.0),
    ]:
        df = build_feature_df(_make_history(10), phase)
        assert df["economy_phase"].iloc[-1] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Ensemble
# ---------------------------------------------------------------------------

def test_ensemble_recommendation_range() -> None:
    history = _make_history(48)
    prices  = [p.price for p in history]
    result  = combine(
        prophet_trend_pct = 5.0,
        xgb_price         = 105.0,
        current_price     = 100.0,
        margin_pct        = 8.0,
        importances       = {"rsi": 0.3, "volatility": 0.2},
        history_prices    = prices,
        economy_phase     = EconomyPhase.STABLE,
        production_cost   = 90.0,
        horizon_hours     = 24,
    )
    assert result.recommendation in list(Recommendation)
    assert 0.0 <= result.risk_score <= 1.0
    assert 0.0 <= result.confidence <= 1.0


def test_ensemble_recession_higher_risk() -> None:
    base = dict(
        prophet_trend_pct=0.0, xgb_price=100.0, current_price=100.0,
        margin_pct=0.0, importances={}, history_prices=[100.0] * 48,
        production_cost=None, horizon_hours=24,
    )
    boom_r = combine(**base, economy_phase=EconomyPhase.BOOM)
    rec_r  = combine(**base, economy_phase=EconomyPhase.RECESSION)
    assert rec_r.risk_score >= boom_r.risk_score


# ---------------------------------------------------------------------------
# Integration (no network)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_profit_predictor_returns_result() -> None:
    req = PredictionRequest(
        product_id      = 42,
        product_name    = "Test Widget",
        realm           = 0,
        history         = _make_history(60),
        economy_phase   = EconomyPhase.STABLE,
        production_cost = 80.0,
        horizon_hours   = 12,
    )
    predictor = ProfitPredictor()
    result = await predictor.predict(req)

    assert result.product_id == 42
    assert isinstance(result.predicted_margin_pct, float)
    assert 0.0 <= result.risk_score  <= 1.0
    assert 0.0 <= result.confidence  <= 1.0
    assert len(result.price_forecast) > 0
    assert len(result.reasoning_steps) >= 4
    assert result.reasoning_summary
    assert not math.isnan(result.expected_roi_pct)
