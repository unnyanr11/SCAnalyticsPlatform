"""
Ensemble combiner.

Merges Prophet and XGBoost outputs into a single calibrated prediction.
Also computes the risk score and overall confidence.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List

import numpy as np

from .schemas import EconomyPhase, Recommendation, TrendDirection


# Phase-based risk adjustments
_PHASE_RISK: dict[str, float] = {
    EconomyPhase.BOOM:      0.10,
    EconomyPhase.STABLE:    0.00,
    EconomyPhase.RECOVERY:  0.05,
    EconomyPhase.RECESSION: 0.20,
}


@dataclass
class EnsembleResult:
    predicted_price:      float
    predicted_margin_pct: float
    expected_roi_pct:     float
    risk_score:           float          # 0-1
    confidence:           float          # 0-1
    volatility_score:     float          # 0-1
    shortage_risk:        float          # 0-1
    oversat_risk:         float          # 0-1
    recommendation:       Recommendation
    trend_direction:      TrendDirection
    prophet_weight:       float
    xgb_weight:           float


def combine(
    prophet_trend_pct:  float,
    xgb_price:          float,
    current_price:      float,
    margin_pct:         float,
    importances:        Dict[str, float],
    history_prices:     List[float],
    economy_phase:      EconomyPhase,
    production_cost:    float | None,
    horizon_hours:      int,
) -> EnsembleResult:
    """
    Weights:
      - Short history (<24 pts): favour XGBoost (60/40)
      - Long history (>=48 pts): favour Prophet   (55/45)
    """
    n = len(history_prices)
    if n < 24:
        pw, xw = 0.40, 0.60
    elif n < 48:
        pw, xw = 0.50, 0.50
    else:
        pw, xw = 0.55, 0.45

    # Blended price estimate
    prophet_price      = current_price * (1 + prophet_trend_pct / 100)
    blended_price      = pw * prophet_price + xw * xgb_price
    blended_trend_pct  = ((blended_price - current_price) / max(current_price, 1e-9)) * 100

    # Volatility from recent prices
    arr = np.array(history_prices, dtype=float)
    recent = arr[-24:] if len(arr) >= 24 else arr
    pct_changes = np.diff(recent) / np.maximum(recent[:-1], 1e-9)
    volatility  = float(np.std(pct_changes)) * math.sqrt(24)  # annualised to 24h
    volatility  = min(volatility, 1.0)

    # Supply/demand proxies via price momentum
    momentum_short = float((arr[-1] - arr[-6])  / max(arr[-6],  1e-9)) if len(arr) >= 6  else 0.0
    momentum_long  = float((arr[-1] - arr[-24]) / max(arr[-24], 1e-9)) if len(arr) >= 24 else 0.0

    # Shortage risk: rapid decline in supply (price dropping with demand)
    shortage_risk = max(0.0, -momentum_long * 2.5)  # price rising = supply tightening
    shortage_risk = max(0.0, blended_trend_pct / 50) if blended_trend_pct > 0 else shortage_risk
    shortage_risk = min(shortage_risk, 1.0)

    # Oversaturation risk: high supply, falling price
    oversat_risk  = max(0.0, -blended_trend_pct / 50)
    oversat_risk  = min(oversat_risk, 1.0)

    # ROI: relative to current price, annualised to horizon
    roi_raw  = blended_trend_pct
    roi_pct  = round(roi_raw * (24 / max(horizon_hours, 1)), 2)  # normalise to 24h base

    # Risk score
    phase_risk = _PHASE_RISK.get(economy_phase, 0.0)
    risk_score = (
        0.35 * volatility +
        0.25 * max(oversat_risk, shortage_risk) +
        0.25 * phase_risk +
        0.15 * (1 - min(n / 100, 1.0))   # data sparsity penalty
    )
    risk_score = round(min(risk_score, 1.0), 4)

    # Confidence: penalised by risk, rewarded by data richness
    raw_conf   = max(0.0, 1.0 - risk_score * 0.7) * min(1.0, n / 48)
    confidence = round(max(0.05, min(0.98, raw_conf)), 4)

    # Trend direction
    if blended_trend_pct >= 8:
        direction = TrendDirection.STRONG_UP
    elif blended_trend_pct >= 2:
        direction = TrendDirection.UP
    elif blended_trend_pct <= -8:
        direction = TrendDirection.STRONG_DOWN
    elif blended_trend_pct <= -2:
        direction = TrendDirection.DOWN
    else:
        direction = TrendDirection.NEUTRAL

    # Recommendation
    score = margin_pct * 0.5 + blended_trend_pct * 0.3 - risk_score * 30
    if   score >= 15:  rec = Recommendation.STRONG_BUY
    elif score >= 5:   rec = Recommendation.BUY
    elif score <= -15: rec = Recommendation.STRONG_SELL
    elif score <= -5:  rec = Recommendation.SELL
    else:              rec = Recommendation.HOLD

    return EnsembleResult(
        predicted_price      = round(blended_price, 4),
        predicted_margin_pct = round(margin_pct, 2),
        expected_roi_pct     = roi_pct,
        risk_score           = risk_score,
        confidence           = confidence,
        volatility_score     = round(volatility, 4),
        shortage_risk        = round(shortage_risk, 4),
        oversat_risk         = round(oversat_risk, 4),
        recommendation       = rec,
        trend_direction      = direction,
        prophet_weight       = pw,
        xgb_weight           = xw,
    )
