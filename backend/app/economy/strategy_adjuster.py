"""Strategy Adjuster — maps economy phases to actionable trading strategies
and adjusts AI predictions (risk, confidence, recommendation) accordingly."""
from __future__ import annotations
import logging
from typing import Dict, Optional

from .schemas import (
    EconomyPhase,
    PhaseStrategy,
    ProductionPriority,
    RiskAdjustment,
    RecommendationAdjustment,
    StrategyAdjustmentResult,
    AdjustPredictionRequest,
    AdjustPredictionResponse,
    PhaseDetectionResult,
)

logger = logging.getLogger(__name__)

# ─── Recommendation ladder ────────────────────────────────────────────────────
_REC_LADDER = ["strong_buy", "buy", "hold", "sell", "strong_sell"]


def _shift_recommendation(rec: str, steps: int) -> str:
    """Move recommendation up (steps<0) or down (steps>0) the ladder."""
    idx = _REC_LADDER.index(rec) if rec in _REC_LADDER else 2
    new_idx = max(0, min(len(_REC_LADDER) - 1, idx + steps))
    return _REC_LADDER[new_idx]


# ─── Phase strategy catalogue ─────────────────────────────────────────────────
_PHASE_STRATEGIES: Dict[EconomyPhase, PhaseStrategy] = {
    EconomyPhase.BOOM: PhaseStrategy(
        phase=EconomyPhase.BOOM,
        investment_stance="Aggressive",
        risk_tolerance="High",
        risk_multiplier=0.80,   # boom reduces effective risk weight
        confidence_bonus=0.05,
        inventory_recommendation="Build inventory. Prices rising — stock up before shortage.",
        production_priorities=[
            ProductionPriority(category="Electronics",    priority_score=0.95, rationale="Peak demand during boom",        risk_multiplier=0.85),
            ProductionPriority(category="Aerospace",      priority_score=0.90, rationale="High-margin luxury sector thrives", risk_multiplier=0.90),
            ProductionPriority(category="Automotive",     priority_score=0.88, rationale="Consumer spending elevated",       risk_multiplier=0.87),
            ProductionPriority(category="Research",       priority_score=0.85, rationale="Investment in R&D peaks in boom",   risk_multiplier=0.80),
            ProductionPriority(category="Chemicals",      priority_score=0.75, rationale="Industrial demand strong",          risk_multiplier=0.88),
        ],
        avoid_categories=["Agriculture"],  # lower margins in boom
        key_actions=[
            "Increase production of high-margin goods",
            "Stock critical raw materials before prices peak",
            "Expand into premium product lines",
            "Raise sell prices gradually — market will absorb",
            "Monitor for saturation signals early",
        ],
        phase_summary="Economy booming. Aggressive production and strategic inventory building recommended.",
    ),
    EconomyPhase.STABLE: PhaseStrategy(
        phase=EconomyPhase.STABLE,
        investment_stance="Balanced",
        risk_tolerance="Medium",
        risk_multiplier=1.00,
        confidence_bonus=0.02,
        inventory_recommendation="Maintain normal inventory levels. No urgency to stockpile.",
        production_priorities=[
            ProductionPriority(category="Agriculture",    priority_score=0.85, rationale="Steady demand, reliable margins",  risk_multiplier=0.90),
            ProductionPriority(category="Chemicals",      priority_score=0.82, rationale="Consistent industrial need",       risk_multiplier=0.92),
            ProductionPriority(category="Electronics",    priority_score=0.80, rationale="Stable consumer market",           risk_multiplier=0.88),
            ProductionPriority(category="Retail",         priority_score=0.78, rationale="Predictable consumer goods",       risk_multiplier=0.90),
            ProductionPriority(category="Automotive",     priority_score=0.72, rationale="Moderate demand",                  risk_multiplier=0.92),
        ],
        avoid_categories=[],
        key_actions=[
            "Optimise production efficiency",
            "Focus on cost reduction",
            "Diversify product portfolio",
            "Maintain competitive pricing",
            "Monitor for early boom or recession signals",
        ],
        phase_summary="Economy stable. Focus on efficiency and gradual portfolio optimisation.",
    ),
    EconomyPhase.RECESSION: PhaseStrategy(
        phase=EconomyPhase.RECESSION,
        investment_stance="Conservative",
        risk_tolerance="Very Low",
        risk_multiplier=1.45,   # recession inflates risk significantly
        confidence_bonus=-0.08,
        inventory_recommendation="Reduce inventory. Cash preservation over stockpiling.",
        production_priorities=[
            ProductionPriority(category="Agriculture",    priority_score=0.90, rationale="Food demand remains in recessions", risk_multiplier=0.75),
            ProductionPriority(category="Retail",         priority_score=0.82, rationale="Essential consumer goods stable",   risk_multiplier=0.80),
            ProductionPriority(category="Chemicals",      priority_score=0.70, rationale="Basic industrial needs persist",    risk_multiplier=0.85),
        ],
        avoid_categories=["Aerospace", "Automotive", "Research"],
        key_actions=[
            "Cut production of luxury and high-cost goods",
            "Preserve capital — avoid large investments",
            "Focus on essential, high-turnover products",
            "Reduce workforce in non-essential factories",
            "Prepare buy list for recovery phase bargains",
        ],
        phase_summary="Economy in recession. Defensive posture — preserve capital and focus on essentials.",
    ),
    EconomyPhase.RECOVERY: PhaseStrategy(
        phase=EconomyPhase.RECOVERY,
        investment_stance="Cautiously Optimistic",
        risk_tolerance="Low",
        risk_multiplier=1.10,
        confidence_bonus=0.0,
        inventory_recommendation="Begin restocking selectively. Early movers gain advantage as prices rise.",
        production_priorities=[
            ProductionPriority(category="Electronics",    priority_score=0.88, rationale="Tech recovers early",             risk_multiplier=0.92),
            ProductionPriority(category="Automotive",     priority_score=0.82, rationale="Pent-up consumer demand",         risk_multiplier=0.90),
            ProductionPriority(category="Agriculture",    priority_score=0.80, rationale="Reliable demand throughout",      risk_multiplier=0.85),
            ProductionPriority(category="Construction",   priority_score=0.75, rationale="Infrastructure investment rises",  risk_multiplier=0.88),
            ProductionPriority(category="Chemicals",      priority_score=0.72, rationale="Industrial restart demand",       risk_multiplier=0.90),
        ],
        avoid_categories=["Aerospace"],  # last sector to recover
        key_actions=[
            "Gradually increase production capacity",
            "Target undervalued products before they reprice",
            "Monitor for transition to boom phase",
            "Reinvest profits into expansion",
            "Focus on early-cycle recovery sectors",
        ],
        phase_summary="Economy recovering. Selective investment in early-cycle sectors with gradual capacity expansion.",
    ),
    EconomyPhase.UNKNOWN: PhaseStrategy(
        phase=EconomyPhase.UNKNOWN,
        investment_stance="Neutral",
        risk_tolerance="Medium",
        risk_multiplier=1.10,
        confidence_bonus=-0.05,
        inventory_recommendation="Hold current inventory. Await clearer signals before major decisions.",
        production_priorities=[
            ProductionPriority(category="Agriculture",    priority_score=0.75, rationale="Defensive stable choice", risk_multiplier=0.95),
            ProductionPriority(category="Retail",         priority_score=0.70, rationale="Consistent demand",       risk_multiplier=0.95),
        ],
        avoid_categories=[],
        key_actions=[
            "Await more data before committing capital",
            "Maintain diversified, low-risk portfolio",
        ],
        phase_summary="Phase uncertain. Maintain neutral stance and monitor signals.",
    ),
}


class StrategyAdjuster:
    """Applies phase-aware strategy adjustments to AI profit predictor outputs."""

    def get_strategy(self, phase: EconomyPhase) -> PhaseStrategy:
        return _PHASE_STRATEGIES.get(phase, _PHASE_STRATEGIES[EconomyPhase.UNKNOWN])

    def adjust_prediction(
        self,
        request: AdjustPredictionRequest,
        detection: PhaseDetectionResult,
    ) -> AdjustPredictionResponse:
        phase = detection.phase
        strategy = self.get_strategy(phase)
        reasoning_steps = []

        # ── Risk adjustment ───────────────────────────────────────────────────
        phase_mult = strategy.risk_multiplier
        adjusted_risk = request.base_risk_score * phase_mult
        capped_risk = max(0.0, min(1.0, adjusted_risk))
        risk_adj = RiskAdjustment(
            base_risk=request.base_risk_score,
            phase_multiplier=phase_mult,
            adjusted_risk=round(adjusted_risk, 4),
            capped_risk=round(capped_risk, 4),
        )
        reasoning_steps.append({
            "factor": "Economy Phase Risk",
            "impact": "negative" if phase_mult > 1.0 else "positive",
            "description": (
                f"{phase.value.title()} phase applies {phase_mult:.2f}× risk multiplier — "
                f"risk adjusted from {request.base_risk_score:.2f} to {capped_risk:.2f}"
            ),
            "weight": f"{abs(phase_mult - 1.0) * 100:.0f}%",
        })

        # ── Confidence adjustment ─────────────────────────────────────────────
        conf_delta = strategy.confidence_bonus + (detection.confidence - 0.5) * 0.05
        adjusted_confidence = max(0.05, min(0.97, request.base_confidence + conf_delta))
        reasoning_steps.append({
            "factor": "Phase Confidence",
            "impact": "positive" if conf_delta >= 0 else "negative",
            "description": (
                f"Phase detection confidence {detection.confidence:.0%}. "
                f"Confidence adjusted by {conf_delta:+.3f} → {adjusted_confidence:.2f}"
            ),
            "weight": f"{abs(conf_delta) * 100:.0f}%",
        })

        # ── Recommendation adjustment ─────────────────────────────────────────
        rec_shift = 0
        override_reason = None

        if phase == EconomyPhase.RECESSION:
            # Always demote buy signals in recession
            if request.base_recommendation in ("strong_buy", "buy"):
                rec_shift = +2
                override_reason = "Recession overrides buy signal — capital preservation priority"
            elif request.base_recommendation == "hold":
                rec_shift = +1
                override_reason = "Recession shifts hold toward sell"
        elif phase == EconomyPhase.BOOM:
            # Promote hold signals in boom
            if request.base_recommendation == "hold" and request.base_margin_pct > 5:
                rec_shift = -1
                override_reason = "Boom phase — strong margin in boom upgraded to buy"
            elif request.base_recommendation == "sell" and request.base_margin_pct > 10:
                rec_shift = -2
                override_reason = "High margin in boom — sell downgraded to hold/buy"
        elif phase == EconomyPhase.RECOVERY:
            if request.base_recommendation in ("sell", "strong_sell") and request.base_margin_pct > 0:
                rec_shift = -1
                override_reason = "Recovery phase — recovering margins suggest holding"

        # Category-specific overrides
        if request.category:
            if request.category in strategy.avoid_categories:
                rec_shift = max(rec_shift, +1)
                override_reason = f"{request.category} is in avoid list for {phase.value} phase"
            prio_cats = [p.category for p in strategy.production_priorities]
            if request.category in prio_cats and phase == EconomyPhase.BOOM:
                rec_shift = min(rec_shift, -1)

        adjusted_rec = _shift_recommendation(request.base_recommendation, rec_shift)
        rec_adj = RecommendationAdjustment(
            original=request.base_recommendation,
            adjusted=adjusted_rec,
            override_reason=override_reason,
            confidence_delta=round(conf_delta, 4),
        )
        if override_reason:
            reasoning_steps.append({
                "factor": "Recommendation Override",
                "impact": "positive" if rec_shift < 0 else "negative",
                "description": override_reason,
                "weight": "High",
            })

        # ── Margin / ROI phase scaling ─────────────────────────────────────────
        phase_margin_scales: Dict[EconomyPhase, float] = {
            EconomyPhase.BOOM:      1.12,
          