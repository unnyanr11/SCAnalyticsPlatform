"""
Pydantic schemas for the AI Profit Predictor.
All monetary values are in the game's currency unit (SC$).
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EconomyPhase(str, Enum):
    BOOM      = "boom"
    STABLE    = "stable"
    RECESSION = "recession"
    RECOVERY  = "recovery"


class Recommendation(str, Enum):
    STRONG_BUY  = "strong_buy"
    BUY         = "buy"
    HOLD        = "hold"
    SELL        = "sell"
    STRONG_SELL = "strong_sell"


class TrendDirection(str, Enum):
    STRONG_UP   = "strong_up"
    UP          = "up"
    NEUTRAL     = "neutral"
    DOWN        = "down"
    STRONG_DOWN = "strong_down"


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

class PricePoint(BaseModel):
    """Single historical price observation."""
    timestamp: int   = Field(..., description="Unix ms timestamp")
    price:     float = Field(..., gt=0)
    quantity:  float = Field(default=0.0, ge=0)
    supply:    float = Field(default=0.0, ge=0)
    demand:    float = Field(default=0.0, ge=0)


class PredictionRequest(BaseModel):
    product_id:     int              = Field(..., gt=0)
    product_name:   str              = Field(default="Unknown")
    realm:          int              = Field(default=0, ge=0)
    history:        List[PricePoint] = Field(..., min_length=5)
    economy_phase:  EconomyPhase     = Field(default=EconomyPhase.STABLE)
    production_cost: Optional[float] = Field(default=None, ge=0)
    horizon_hours:  int              = Field(default=24, ge=1, le=168)


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

class ReasoningStep(BaseModel):
    """One bullet point of the AI explanation."""
    factor:      str
    impact:      str          # "positive" | "negative" | "neutral"
    description: str
    weight:      float        # 0-1 importance


class ForecastPoint(BaseModel):
    """Single future price forecast tick."""
    timestamp:   int
    price:       float
    lower_bound: float
    upper_bound: float


class PredictionResult(BaseModel):
    product_id:       int
    product_name:     str
    realm:            int

    # Core outputs
    predicted_margin_pct:  float = Field(description="Expected profit margin %")
    expected_roi_pct:      float = Field(description="Expected ROI over horizon")
    risk_score:            float = Field(ge=0, le=1, description="0=safe 1=high risk")
    confidence:            float = Field(ge=0, le=1)
    recommendation:        Recommendation
    trend_direction:       TrendDirection

    # Forecasts
    price_forecast:        List[ForecastPoint]
    prophet_trend_pct:     float   # pure trend component
    xgb_predicted_price:   float

    # Risk breakdown
    volatility_score:      float = Field(ge=0, le=1)
    shortage_risk:         float = Field(ge=0, le=1)
    oversat_risk:          float = Field(ge=0, le=1)

    # Explanation
    reasoning_summary:     str
    reasoning_steps:       List[ReasoningStep]
    model_versions:        dict

    generated_at:          int   = Field(description="Unix ms")
