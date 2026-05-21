"""
Feature engineering pipeline.
Transforms raw PricePoint history into a DataFrame ready for XGBoost.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import List

from .schemas import EconomyPhase, PricePoint


# Economy phase ordinal encoding
PHASE_ORD: dict[str, float] = {
    EconomyPhase.RECESSION: 0.0,
    EconomyPhase.STABLE:    0.33,
    EconomyPhase.RECOVERY:  0.67,
    EconomyPhase.BOOM:      1.0,
}


def build_feature_df(
    history: List[PricePoint],
    economy_phase: EconomyPhase,
) -> pd.DataFrame:
    """
    Returns a feature DataFrame (one row per observation).
    The last row is the "current" state used for inference.
    """
    df = pd.DataFrame([p.model_dump() for p in history])
    df["ds"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.sort_values("ds").reset_index(drop=True)

    # ── Price features ──────────────────────────────────────────────────────
    df["price_log"]    = np.log1p(df["price"])
    df["price_pct_1"]  = df["price"].pct_change(1).fillna(0)
    df["price_pct_6"]  = df["price"].pct_change(6).fillna(0)
    df["price_pct_24"] = df["price"].pct_change(24).fillna(0)

    # ── Rolling statistics ───────────────────────────────────────────────────
    for w in [6, 12, 24, 48]:
        df[f"roll_mean_{w}"] = df["price"].rolling(w, min_periods=1).mean()
        df[f"roll_std_{w}"]  = df["price"].rolling(w, min_periods=1).std().fillna(0)
        df[f"roll_min_{w}"]  = df["price"].rolling(w, min_periods=1).min()
        df[f"roll_max_{w}"]  = df["price"].rolling(w, min_periods=1).max()

    # ── Lag features ─────────────────────────────────────────────────────────
    for lag in [1, 2, 3, 6, 12, 24]:
        df[f"lag_{lag}"] = df["price"].shift(lag).fillna(df["price"].iloc[0])

    # ── Volatility (normalised std over 12 ticks) ────────────────────────────
    df["volatility"] = (df["roll_std_12"] / df["roll_mean_12"].replace(0, 1)).clip(0, 1)

    # ── Supply / demand ratio ────────────────────────────────────────────────
    df["supply_demand_ratio"] = (
        df["supply"] / (df["demand"].replace(0, 1))
    ).clip(0, 100)

    df["qty_roll_mean_12"] = df["quantity"].rolling(12, min_periods=1).mean()

    # ── Time features ────────────────────────────────────────────────────────
    df["hour_sin"]  = np.sin(2 * np.pi * df["ds"].dt.hour / 24)
    df["hour_cos"]  = np.cos(2 * np.pi * df["ds"].dt.hour / 24)
    df["dow_sin"]   = np.sin(2 * np.pi * df["ds"].dt.dayofweek / 7)
    df["dow_cos"]   = np.cos(2 * np.pi * df["ds"].dt.dayofweek / 7)

    # ── Economy phase ────────────────────────────────────────────────────────
    df["economy_phase"] = PHASE_ORD.get(economy_phase, 0.33)

    # ── Bollinger band position (0 = at lower, 1 = at upper) ─────────────────
    upper = df["roll_mean_24"] + 2 * df["roll_std_24"]
    lower = df["roll_mean_24"] - 2 * df["roll_std_24"]
    band_range = (upper - lower).replace(0, 1)
    df["bb_position"] = ((df["price"] - lower) / band_range).clip(0, 1)

    # ── RSI-proxy (14-period) ─────────────────────────────────────────────────
    delta  = df["price"].diff().fillna(0)
    gain   = delta.clip(lower=0).rolling(14, min_periods=1).mean()
    loss   = (-delta).clip(lower=0).rolling(14, min_periods=1).mean()
    rs     = gain / (loss.replace(0, 1e-9))
    df["rsi"] = (100 - 100 / (1 + rs)).fillna(50) / 100  # normalised 0-1

    return df


XGB_FEATURE_COLS: list[str] = [
    "price_log", "price_pct_1", "price_pct_6", "price_pct_24",
    "roll_mean_6", "roll_mean_12", "roll_mean_24", "roll_mean_48",
    "roll_std_6",  "roll_std_12",  "roll_std_24",
    "roll_min_24", "roll_max_24",
    "lag_1", "lag_2", "lag_3", "lag_6", "lag_12", "lag_24",
    "volatility",
    "supply_demand_ratio", "qty_roll_mean_12",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "economy_phase",
    "bb_position", "rsi",
]
