"""
XGBoost margin / price regressor.

Trains on the provided history window each call (no persistent model store
needed for per-request inference; the model_registry layer handles caching
for products with enough history).

Produces:
  - predicted next price
  - predicted margin %
  - SHAP-based feature importances
"""
from __future__ import annotations

import logging
from typing import Dict, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    import xgboost as xgb  # type: ignore
    import shap             # type: ignore
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    logger.warning("XGBoost/SHAP not installed; using gradient fallback.")

from .feature_engineering import XGB_FEATURE_COLS


class XGBoostRegressor:
    """
    Fits a booster on the supplied feature DataFrame and predicts
    the next price / margin from the most recent feature row.
    """

    def __init__(self) -> None:
        self.version = "xgboost-2.0"
        self._model: "xgb.Booster | None" = None

    # ------------------------------------------------------------------
    def fit_predict(
        self,
        feat_df: pd.DataFrame,
        production_cost: float | None,
    ) -> Tuple[float, float, Dict[str, float]]:
        """
        Returns:
          predicted_price   — model estimate of next price
          predicted_margin  — margin % relative to production_cost
          importances       — {feature_name: shap_importance_value}
        """
        available_cols = [c for c in XGB_FEATURE_COLS if c in feat_df.columns]
        X = feat_df[available_cols].fillna(0).values.astype(np.float32)
        y = feat_df["price"].values.astype(np.float32)

        if len(X) < 5:
            # Too little data — return simple moving average
            pred = float(np.mean(y))
            return pred, self._margin(pred, production_cost, y), {}

        if not XGB_AVAILABLE:
            return self._stat_fallback(y, production_cost, available_cols)

        # Train on all but the last row; predict the last row
        X_train, y_train = X[:-1], y[1:]   # predict next price from current features
        X_pred            = X[[-1]]         # latest features → predict future price

        if len(X_train) < 3:
            pred = float(np.mean(y))
            return pred, self._margin(pred, production_cost, y), {}

        params = {
            "objective":        "reg:squarederror",
            "max_depth":        4,
            "eta":              0.15,
            "subsample":        0.85,
            "colsample_bytree": 0.85,
            "min_child_weight": 2,
            "gamma":            0.1,
            "seed":             42,
            "nthread":          2,
            "verbosity":        0,
        }
        dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=available_cols)
        dpred  = xgb.DMatrix(X_pred,  feature_names=available_cols)

        booster = xgb.train(
            params, dtrain,
            num_boost_round=120,
            verbose_eval=False,  # type: ignore[arg-type]
            early_stopping_rounds=None,
        )
        self._model = booster

        predicted_price = float(booster.predict(dpred)[0])
        margin_pct      = self._margin(predicted_price, production_cost, y)

        # SHAP importances for the prediction row
        importances: Dict[str, float] = {}
        try:
            explainer = shap.TreeExplainer(booster)
            shap_vals = explainer.shap_values(dpred)  # shape (1, n_features)
            raw = dict(zip(available_cols, np.abs(shap_vals[0]).tolist()))
            total = sum(raw.values()) or 1.0
            importances = {k: round(v / total, 4) for k, v in sorted(
                raw.items(), key=lambda x: x[1], reverse=True
            )}
        except Exception as exc:
            logger.debug("SHAP failed: %s", exc)

        return predicted_price, margin_pct, importances

    # ------------------------------------------------------------------
    @staticmethod
    def _margin(
        predicted_price: float,
        production_cost: float | None,
        prices: np.ndarray,
    ) -> float:
        """Margin % relative to production cost or recent average."""
        if production_cost and production_cost > 0:
            return round((predicted_price - production_cost) / production_cost * 100, 2)
        avg = float(np.mean(prices)) if len(prices) else predicted_price
        return round((predicted_price - avg) / max(avg, 1e-9) * 100, 2)

    # ------------------------------------------------------------------
    @staticmethod
    def _stat_fallback(
        prices: np.ndarray,
        production_cost: float | None,
        features: list[str],
    ) -> Tuple[float, float, Dict[str, float]]:
        """Linear regression fallback when XGBoost is unavailable."""
        x = np.arange(len(prices), dtype=np.float32)
        coeffs = np.polyfit(x, prices, 1)
        pred   = float(np.polyval(coeffs, len(prices)))
        margin = XGBoostRegressor._margin(pred, production_cost, prices)
        return pred, margin, {f: 1.0 / len(features) for f in features}
