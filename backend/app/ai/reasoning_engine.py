"""
Natural-language reasoning engine.

Converts model outputs + SHAP feature importances into human-readable
explanation bullets and a summary sentence.
"""
from __future__ import annotations

from typing import Dict, List

from .ensemble import EnsembleResult
from .schemas import EconomyPhase, ReasoningStep, Recommendation, TrendDirection


# ---------------------------------------------------------------------------
# Feature → human label map
# ---------------------------------------------------------------------------

_FEAT_LABELS: dict[str, str] = {
    "price_pct_1":          "short-term price momentum",
    "price_pct_6":          "6-hour price trend",
    "price_pct_24":         "24-hour price shift",
    "roll_mean_24":         "24-hour average price",
    "roll_std_24":          "recent price variability",
    "volatility":           "market volatility",
    "supply_demand_ratio":  "supply/demand balance",
    "qty_roll_mean_12":     "trading volume trend",
    "bb_position":          "Bollinger Band position",
    "rsi":                  "RSI momentum indicator",
    "economy_phase":        "current economy phase",
    "lag_1":                "last-tick price",
    "lag_6":                "price 6 ticks ago",
    "lag_24":               "price 24 ticks ago",
}

_PHASE_TEXTS: dict[str, str] = {
    EconomyPhase.BOOM:      "a boom phase — high consumer demand favours profitable products",
    EconomyPhase.STABLE:    "a stable economy — predictable margins, moderate risk",
    EconomyPhase.RECOVERY:  "a recovery phase — demand increasing, opportunity window opening",
    EconomyPhase.RECESSION: "a recession — suppressed demand and elevated risk across sectors",
}

_REC_SUMMARIES: dict[str, str] = {
    Recommendation.STRONG_BUY:  "Market conditions are highly favourable. Strong margin growth expected.",
    Recommendation.BUY:         "Conditions support a buy. Positive momentum with manageable risk.",
    Recommendation.HOLD:        "Mixed signals. Hold current positions and monitor closely.",
    Recommendation.SELL:        "Declining momentum. Consider reducing exposure.",
    Recommendation.STRONG_SELL: "Adverse conditions detected. High risk of loss — exit recommended.",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_reasoning(
    product_name:    str,
    result:          EnsembleResult,
    importances:     Dict[str, float],
    economy_phase:   EconomyPhase,
    prophet_trend:   float,
    n_history:       int,
) -> tuple[str, List[ReasoningStep]]:
    """
    Returns (summary_sentence, list_of_reasoning_steps).
    """
    steps: List[ReasoningStep] = []

    # 1. Trend step
    trend_dir = "rising" if prophet_trend >= 2 else ("falling" if prophet_trend <= -2 else "flat")
    trend_impact = (
        "positive" if prophet_trend >= 2 else
        "negative" if prophet_trend <= -2 else
        "neutral"
    )
    steps.append(ReasoningStep(
        factor="Price Forecast (Prophet)",
        impact=trend_impact,
        description=(
            f"{product_name} price is {trend_dir} over the forecast horizon "
            f"({prophet_trend:+.1f}% trend). "
            f"Prophet model weight: {result.prophet_weight:.0%}."
        ),
        weight=round(result.prophet_weight, 2),
    ))

    # 2. XGBoost step
    xgb_dir    = "above" if result.predicted_margin_pct >= 0 else "below"
    xgb_impact = "positive" if result.predicted_margin_pct >= 0 else "negative"
    steps.append(ReasoningStep(
        factor="Profitability Model (XGBoost)",
        impact=xgb_impact,
        description=(
            f"XGBoost predicts price {xgb_dir} production cost — "
            f"estimated margin: {result.predicted_margin_pct:+.1f}%. "
            f"Model weight: {result.xgb_weight:.0%}."
        ),
        weight=round(result.xgb_weight, 2),
    ))

    # 3. Top SHAP features
    top_feats = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:4]
    for feat_key, imp in top_feats:
        label = _FEAT_LABELS.get(feat_key, feat_key.replace("_", " "))
        impact = "positive" if imp > 0.15 else "neutral"
        steps.append(ReasoningStep(
            factor=f"Feature: {label}",
            impact=impact,
            description=f"'{label}' contributed {imp:.1%} of model confidence.",
            weight=round(imp, 3),
        ))

    # 4. Volatility
    vol_level = (
        "high" if result.volatility_score >= 0.6 else
        "moderate" if result.volatility_score >= 0.3 else
        "low"
    )
    vol_impact = "negative" if result.volatility_score >= 0.6 else "neutral"
    steps.append(ReasoningStep(
        factor="Volatility",
        impact=vol_impact,
        description=(
            f"{vol_level.capitalize()} market volatility ({result.volatility_score:.1%}). "
            + ("Elevated risk of sudden price swings." if vol_level == "high" else "Stable price environment.")
        ),
        weight=round(result.volatility_score, 3),
    ))

    # 5. Shortage / oversat
    if result.shortage_risk >= 0.5:
        steps.append(ReasoningStep(
            factor="Supply Shortage Risk",
            impact="positive",
            description=(
                f"Shortage risk at {result.shortage_risk:.1%}. Inventory may tighten, "
                "pushing prices higher — favourable for producers."
            ),
            weight=round(result.shortage_risk, 3),
        ))
    if result.oversat_risk >= 0.5:
        steps.append(ReasoningStep(
            factor="Oversaturation Risk",
            impact="negative",
            description=(
                f"Oversat risk at {result.oversat_risk:.1%}. High supply relative to demand "
                "may compress margins."
            ),
            weight=round(result.oversat_risk, 3),
        ))

    # 6. Economy phase
    phase_text = _PHASE_TEXTS.get(economy_phase, "an unknown economy phase")
    steps.append(ReasoningStep(
        factor="Economy Phase",
        impact="neutral",
        description=f"The game economy is in {phase_text}.",
        weight=0.15,
    ))

    # 7. Data quality note
    data_quality = "limited" if n_history < 24 else ("good" if n_history < 96 else "rich")
    steps.append(ReasoningStep(
        factor="Data Quality",
        impact="neutral",
        description=(
            f"{n_history} historical data points available — {data_quality} quality. "
            + ("Confidence is reduced; more history improves accuracy." if data_quality == "limited" else "Sufficient history for reliable prediction.")
        ),
        weight=min(1.0, n_history / 100),
    ))

    # Summary sentence
    summary = (
        f"{product_name}: {_REC_SUMMARIES.get(result.recommendation, '')} "
        f"Expected {horizon_label(result.expected_roi_pct)} ROI "
        f"with {result.confidence:.0%} confidence."
    )

    return summary, steps


def horizon_label(roi: float) -> str:
    if roi >= 10:  return f"+{roi:.1f}%"
    if roi >= 0:   return f"+{roi:.1f}%"
    return f"{roi:.1f}%"
