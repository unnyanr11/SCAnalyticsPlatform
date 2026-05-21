"""Computes aggregate volatility metrics from a market snapshot."""
from __future__ import annotations
import logging
import math
import statistics
from datetime import datetime
from typing import List, Dict, Any

from .schemas import VolatilityMetrics, PhaseSignals

logger = logging.getLogger(__name__)


class VolatilityAnalyzer:
    """Derives volatility and phase signal inputs from raw market data."""

    # Products historically correlated with economy phases
    _LEADING_INDICATORS = {
        "boom":      {"Processors", "Electronics", "Computers", "Semiconductors"},
        "recession": {"Basic Materials", "Steel", "Chemicals"},
        "recovery":  {"Automobiles", "Appliances", "Construction Materials"},
    }

    def compute_volatility(self, market_data: List[Dict[str, Any]], realm: int = 0) -> VolatilityMetrics:
        """
        Compute volatility metrics from a market snapshot list.
        Each item expected: {id, name, price, quantity, kind, ...}
        """
        if not market_data:
            return VolatilityMetrics(
                realm=realm,
                overall_volatility=0.5,
                price_std_pct=0.0,
                volume_variance=0.0,
            )

        prices = [float(r.get("price", 0) or 0) for r in market_data if r.get("price")]
        quantities = [float(r.get("quantity", 0) or 0) for r in market_data if r.get("quantity")]

        price_std_pct = 0.0
        if len(prices) >= 2:
            mean_p = statistics.mean(prices)
            std_p = statistics.stdev(prices)
            price_std_pct = (std_p / mean_p * 100) if mean_p > 0 else 0.0

        volume_variance = statistics.variance(quantities) if len(quantities) >= 2 else 0.0

        # Normalise volatility: price_std_pct > 50 → near 1.0
        overall_volatility = min(1.0, price_std_pct / 50.0)

        # Spike detection: items whose price deviates > 2 sigma from mean
        spike_count = 0
        if len(prices) >= 4:
            mean_p = statistics.mean(prices)
            std_p = statistics.stdev(prices)
            spike_count = sum(1 for p in prices if abs(p - mean_p) > 2 * std_p)

        anomaly_score = min(1.0, spike_count / max(1, len(prices) * 0.2))

        return VolatilityMetrics(
            realm=realm,
            overall_volatility=round(overall_volatility, 4),
            price_std_pct=round(price_std_pct, 4),
            volume_variance=round(volume_variance, 2),
            spike_count_24h=spike_count,
            anomaly_score=round(anomaly_score, 4),
        )

    def build_phase_signals(
        self,
        market_data: List[Dict[str, Any]],
        volatility: VolatilityMetrics,
        shortage_count: int = 0,
        oversaturation_count: int = 0,
        realm: int = 0,
    ) -> PhaseSignals:
        """
        Derive PhaseSignals from a market snapshot + external shortage/oversat counters.
        """
        prices = [float(r.get("price", 0) or 0) for r in market_data if r.get("price")]
        quantities = [float(r.get("quantity", 0) or 0) for r in market_data if r.get("quantity")]

        # Approximate price change % as normalised std (no true time-series here)
        avg_price_change_pct = 0.0
        if len(prices) >= 2:
            mean_p = statistics.mean(prices)
            std_p = statistics.stdev(prices)
            # Map dispersion → directional proxy using skewness direction
            skew = 0.0
            if std_p > 0:
                skew = sum((p - mean_p) ** 3 for p in prices) / (len(prices) * std_p ** 3)
            avg_price_change_pct = max(-15.0, min(15.0, skew * 5.0))

        avg_volume_change_pct = 0.0
        if len(quantities) >= 2:
            mean_q = statistics.mean(quantities)
            std_q = statistics.stdev(quantities)
            if mean_q > 0:
                avg_volume_change_pct = max(-50.0, min(50.0, (std_q / mean_q) * 30.0))

        # GDP proxy: normalise total market value to [0,1]
        total_value = sum(
            float(r.get("price", 0) or 0) * float(r.get("quantity", 0) or 0)
            for r in market_data
        )
        # Rough upper bound: 100 items @ avg $1000 each @ avg 500 qty
        gdp_proxy = min(1.0, total_value / 50_000_000)

        trend_strength = min(1.0, abs(avg_price_change_pct) / 15.0 * 0.5 +
                                   volatility.overall_volatility * 0.5)

        return PhaseSignals(
            realm=realm,
            avg_price_change_pct=round(avg_price_change_pct, 4),
            avg_volume_change_pct=round(avg_volume_change_pct, 4),
            volatility_score=volatility.overall_volatility,
            gdp_proxy=round(gdp_proxy, 4),
            shortage_count=shortage_count,
            oversaturation_count=oversaturation_count,
            trend_strength=round(trend_strength, 4),
        )
