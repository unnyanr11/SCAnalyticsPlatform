"""Pydantic schemas for Economy Phase Strategy Engine."""
from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class EconomyPhase(str, Enum):
    BOOM = "boom"
    STABLE = "stable"
    RECESSION = "recession"
    RECOVERY = "recovery"
    UNKNOWN = "unknown"


class PhaseTransition(BaseModel):
    from_phase: EconomyPhase
    to_phase: EconomyPhase
    detected_at: datetime
    confidence: float = Field(..., ge=0.0, le=1.0)
    trigger_signals: List[str] = Field(default_factory=list)


class VolatilityMetrics(BaseModel):
    realm: int = 0
    overall_volatility: float = Field(..., ge=0.0, description="0-1 normalised volatility score")
    price_std_pct: float = Field(..., description="Average price std as % of mean across tracked products")
    volume_variance: float
    spike_count_24h: int = Field(default=0)
    anomaly_score: float = Field(default=0.0, ge=0.0, le=1.0)
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class PhaseSignals(BaseModel):
    """Raw signals fed into phase classification."""
    realm: int = 0
    avg_price_change_pct: float  # rolling 24h avg % price change across market
    avg_volume_change_pct: float
    volatility_score: float      # from VolatilityAnalyzer
    gdp_proxy: float             # sum of all transaction value proxy (0-1 normalised)
    shortage_count: int          # active shortage alerts
    oversaturation_count: int
    trend_strength: float        # 0-1: how directional the overall market is
    sampled_at: datetime = Field(default_factory=datetime.utcnow)


class PhaseDetectionResult(BaseModel):
    phase: EconomyPhase
    confidence: float = Field(..., ge=0.0, le=1.0)
    signals: PhaseSignals
    phase_score: Dict[str, float]  # score per phase label
    transition: Optional[PhaseTransition] = None
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    realm: int = 0


class ProductionPriority(BaseModel):
    category: str
    priority_score: float = Field(..., ge=0.0, le=1.0)
    rationale: str
    risk_multiplier: float = Field(default=1.0)


class RiskAdjustment(BaseModel):
    base_risk: float
    phase_multiplier: float
    adjusted_risk: float
    capped_risk: float  # clipped to [0,1]


class RecommendationAdjustment(BaseModel):
    original: str
    adjusted: str
    override_reason: Optional[str] = None
    confidence_delta: float = 0.0  # positive = boosted, negative = penalised


class PhaseStrategy(BaseModel):
    phase: EconomyPhase
    investment_stance: str          # e.g. "Aggressive", "Conservative"
    risk_tolerance: str             # "High" | "Medium" | "Low" | "Very Low"
    risk_multiplier: float
    confidence_bonus: float         # added to AI confidence when phase aligns
    inventory_recommendation: str
    production_priorities: List[ProductionPriority]
    avoid_categories: List[str]
    key_actions: List[str]
    phase_summary: str


class StrategyAdjustmentResult(BaseModel):
    phase: EconomyPhase
    strategy: PhaseStrategy
    recommendation_adjustment: RecommendationAdjustment
    risk_adjustment: RiskAdjustment
    adjusted_confidence: float
    reasoning_steps: List[Dict[str, str]]


class EconomyPhaseResponse(BaseModel):
    realm: int = 0
    detection: PhaseDetectionResult
    strategy: PhaseStrategy
    volatility: VolatilityMetrics
    last_transition: Optional[PhaseTransition] = None
    cache_hit: bool = False
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class AdjustPredictionRequest(BaseModel):
    realm: int = 0
    product_id: str
    base_recommendation: str  # "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
    base_confidence: float = Field(..., ge=0.0, le=1.0)
    base_risk_score: float = Field(..., ge=0.0, le=1.0)
    base_margin_pct: float
    base_roi_pct: float
    category: Optional[str] = None


class AdjustPredictionResponse(BaseModel):
    product_id: str
    phase: EconomyPhase
    phase_confidence: float
    original_recommendation: str
    adjusted_recommendation: str
    original_confidence: float
    adjusted_confidence: float
    original_risk_score: float
    adjusted_risk_score: float
    original_margin_pct: float
    adjusted_margin_pct: float
    original_roi_pct: float
    adjusted_roi_pct: float
    reasoning_steps: List[Dict[str, str]]
    strategy_summary: str
    adjusted_at: datetime = Field(default_factory=datetime.utcnow)
