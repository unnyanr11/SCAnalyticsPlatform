"""Economy Phase Detector — classifies current game economy into boom/stable/recession/recovery."""
from __future__ import annotations
import logging
import math
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any

from .schemas import (
    EconomyPhase,
    PhaseSignals,
    PhaseDetectionResult,
    PhaseTransition,
)

logger = logging.getLogger(__name__)

# ─── Phase scoring weights ────────────────────────────────────────────────────
# Each phase is described by a vector of (signal_key, expected_direction, weight).
# direction: +1 = signal being HIGH supports this phase, -1 = signal being LOW supports it
_PHASE_PROFILES: Dict[str, List[Tuple[str, int, float]]] = {
    EconomyPhase.BOOM: [
        ("avg_price_change_pct",   +1, 0.30),
        ("avg_volume_change_pct",  +1, 0.20),
        ("gdp_proxy",              +1, 0.25),
        ("trend_strength",         +1, 0.15),
        ("shortage_count",         +1, 0.10),
    ],
    EconomyPhase.STABLE: [
        ("volatility_score",       -1, 0.30),
        ("avg_price_change_pct",   -1, 0.20),   # near-zero change
        ("trend_strength",         -1, 0.20),
        ("gdp_proxy",              +1, 0.15),
        ("oversaturation_count",   -1, 0.15),
    ],
    EconomyPhase.RECESSION: [
        ("avg_price_change_pct",   -1, 0.30),   # falling prices
        ("avg_volume_change_pct",  -1, 0.20),
        ("oversaturation_count",   +1, 0.25),
        ("gdp_proxy",              -1, 0.15),
        ("shortage_count",         -1, 0.10),
    ],
    EconomyPhase.RECOVERY: [
        ("avg_price_change_pct",   +1, 0.25),
        ("avg_volume_change_pct",  +1, 0.15),
        ("volatility_score",       +1, 0.20),   # recovering = some volatility
        ("shortage_count",         +1, 0.20),
        ("oversaturation_count",   -1, 0.20),
    ],
}

# Normalisation bounds for signals
_SIGNAL_BOUNDS: Dict[str, Tuple[float, float]] = {
    "avg_price_change_pct":  (-15.0, 15.0),
    "avg_volume_change_pct": (-50.0, 50.0),
    "volatility_score":      (0.0, 1.0),
    "gdp_proxy":             (0.0, 1.0),
    "shortage_count":        (0, 20),
    "oversaturation_count":  (0, 20),
    "trend_strength":        (0.0, 1.0),
}


def _normalise(value: float, lo: float, hi: float) -> float:
    """Scale value to [0, 1]. Values outside bounds are clipped."""
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _score_phase(signals: PhaseSignals, profile: List[Tuple[str, int, float]]) -> float:
    """Compute a weighted score [0, 1] for a given phase profile."""
    score = 0.0
    for field, direction, weight in profile:
        raw = getattr(signals, field, 0.0)
        lo, hi = _SIGNAL_BOUNDS.get(field, (0.0, 1.0))
        norm = _normalise(float(raw), lo, hi)  # 0 = low, 1 = high
        # direction +1 → high norm is supportive; -1 → low norm is supportive
        contribution = norm if direction == +1 else (1.0 - norm)
        score += contribution * weight
    return score


class PhaseDetector:
    """Classifies economy phase from market signals and optional API phase hint."""

    def __init__(self):
        self._last_result: Optional[PhaseDetectionResult] = None

    def detect(
        self,
        signals: PhaseSignals,
        api_phase_hint: Optional[str] = None,
    ) -> PhaseDetectionResult:
        """
        Run phase classification.

        Args:
            signals:        Aggregated market signals.
            api_phase_hint: Raw phase name returned by SimcoTools API (optional).
                            If provided, it gets a 0.35 blending weight.
        """
        # ── Score each phase ──────────────────────────────────────────────────
        phase_scores: Dict[str, float] = {}
        for phase in [EconomyPhase.BOOM, EconomyPhase.STABLE,
                      EconomyPhase.RECESSION, EconomyPhase.RECOVERY]:
            phase_scores[phase] = _score_phase(signals, _PHASE_PROFILES[phase])

        # ── Blend API hint if available ───────────────────────────────────────
        api_hint_phase: Optional[EconomyPhase] = None
        if api_phase_hint:
            hint_norm = api_phase_hint.strip().lower()
            phase_map = {
                "boom": EconomyPhase.BOOM,
                "expansion": EconomyPhase.BOOM,
                "growth": EconomyPhase.BOOM,
                "stable": EconomyPhase.STABLE,
                "normal": EconomyPhase.STABLE,
                "recession": EconomyPhase.RECESSION,
                "contraction": EconomyPhase.RECESSION,
                "downturn": EconomyPhase.RECESSION,
                "recovery": EconomyPhase.RECOVERY,
                "rebound": EconomyPhase.RECOVERY,
            }
            api_hint_phase = phase_map.get(hint_norm)
            if api_hint_phase:
                phase_scores[api_hint_phase] = (
                    phase_scores[api_hint_phase] * 0.65 + 1.0 * 0.35
                )
                logger.debug("API hint '%s' blended into %s", api_phase_hint, api_hint_phase)

        # ── Pick winner ───────────────────────────────────────────────────────
        best_phase = max(phase_scores, key=phase_scores.get)
        best_score = phase_scores[best_phase]

        # ── Confidence: gap between top-2 scores normalised ───────────────────
        sorted_scores = sorted(phase_scores.values(), reverse=True)
        gap = sorted_scores[0] - sorted_scores[1] if len(sorted_scores) > 1 else 0.5
        confidence = min(0.97, 0.40 + gap * 1.2 + best_score * 0.20)

        # ── Detect transition ─────────────────────────────────────────────────
        transition: Optional[PhaseTransition] = None
        if self._last_result and self._last_result.phase != best_phase:
            trigger_signals = self._build_trigger_signals(signals, best_phase)
            transition = PhaseTransition(
                from_phase=self._last_result.phase,
                to_phase=best_phase,
                detected_at=datetime.utcnow(),
                confidence=confidence,
                trigger_signals=trigger_signals,
            )
            logger.info(
                "Phase transition: %s → %s (confidence=%.2f)",
                transition.from_phase, transition.to_phase, confidence
            )

        result = PhaseDetectionResult(
            phase=best_phase,
            confidence=round(confidence, 4),
            signals=signals,
            phase_score={k: round(v, 4) for k, v in phase_scores.items()},
            transition=transition,
            realm=signals.realm,
        )
        self._last_result = result
        return result

    def _build_trigger_signals(self, signals: PhaseSignals, phase: EconomyPhase) -> List[str]:
        triggers = []
        if phase == EconomyPhase.BOOM:
            if signals.avg_price_change_pct > 5:
                triggers.append(f"Prices rising +{signals.avg_price_change_pct:.1f}%")
            if signals.shortage_count > 3:
                triggers.append(f"{signals.shortage_count} active shortages")
            if signals.gdp_proxy > 0.7:
                triggers.append("High market transaction volume")
        elif phase == EconomyPhase.RECESSION:
            if signals.avg_price_change_pct < -5:
                triggers.append(f"Prices falling {signals.avg_price_change_pct:.1f}%")
            if signals.oversaturation_count > 3:
                triggers.append(f"{signals.oversaturation_count} oversaturated products")
            if signals.gdp_proxy < 0.3:
                triggers.append("Low transaction volume")
        elif phase == EconomyPhase.RECOVERY:
            if signals.avg_price_change_pct > 2:
                triggers.append("Prices beginning to recover")
            if signals.volatility_score > 0.5:
                triggers.append("Increased market activity")
        elif phase == EconomyPhase.STABLE:
            triggers.append("Low volatility across market")
            triggers.append("Balanced supply and demand")
        return triggers or [f"Phase signals aligned with {phase}"]
