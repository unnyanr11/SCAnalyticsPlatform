"""
ProfitPredictor — top-level orchestrator.

Usage:
    predictor = ProfitPredictor()
    result = await predictor.predict(request)
"""
from __future__ import annotations

import time
import logging
from typing import List

import pandas as pd

from .schemas import (
    EconomyPhase, ForecastPoint, PredictionRequest, PredictionResult,
)
from .feature_engineering import build_feature_df
from .prophet_forecaster   import ProphetForecaster
from .xgboost_regressor    import XGBoostRegressor
from .ensemble             import combine
from .reasoning_engine     import generate_reasoning

logger = logging.getLogger(__name__)


class ProfitPredictor:

    def __init__(self) -> None:
        self._prophet = ProphetForecaster()
        self._xgb     = XGBoostRegressor()

    # ------------------------------------------------------------------
    async def predict(self, req: PredictionRequest) -> PredictionResult:
        """Main async entry point."""
        logger.info(
            "[ProfitPredictor] product=%d '%s' n_history=%d horizon=%dh",
            req.product_id, req.product_name, len(req.history), req.horizon_hours,
        )

        # 1. Feature engineering
        feat_df = build_feature_df(req.history, req.economy_phase)
        current_price = float(feat_df["price"].iloc[-1])

        # 2. Prophet forecast
        phase_val = {
            EconomyPhase.RECESSION: 0.0,
            EconomyPhase.STABLE:    0.33,
            EconomyPhase.RECOVERY:  0.67,
            EconomyPhase.BOOM:      1.0,
        }.get(req.economy_phase, 0.33)

        forecast_df, prophet_trend_pct = self._prophet.forecast(
            history       = feat_df,
            horizon_hours = req.horizon_hours,
            economy_phase_val = phase_val,
        )

        # 3. XGBoost prediction
        xgb_price, margin_pct, importances = self._xgb.fit_predict(
            feat_df, req.production_cost
        )

        # 4. Ensemble
        history_prices = feat_df["price"].tolist()
        ens = combine(
            prophet_trend_pct = prophet_trend_pct,
            xgb_price         = xgb_price,
            current_price     = current_price,
            margin_pct        = margin_pct,
            importances       = importances,
            history_prices    = history_prices,
            economy_phase     = req.economy_phase,
            production_cost   = req.production_cost,
            horizon_hours     = req.horizon_hours,
        )

        # 5. Reasoning
        summary, steps = generate_reasoning(
            product_name  = req.product_name,
            result        = ens,
            importances   = importances,
            economy_phase = req.economy_phase,
            prophet_trend = prophet_trend_pct,
            n_history     = len(req.history),
        )

        # 6. Serialise forecast points
        price_forecast = self._serialise_forecast(forecast_df)

        return PredictionResult(
            product_id            = req.product_id,
            product_name          = req.product_name,
            realm                 = req.realm,
            predicted_margin_pct  = ens.predicted_margin_pct,
            expected_roi_pct      = ens.expected_roi_pct,
            risk_score            = ens.risk_score,
            confidence            = ens.confidence,
            recommendation        = ens.recommendation,
            trend_direction       = ens.trend_direction,
            price_forecast        = price_forecast,
            prophet_trend_pct     = prophet_trend_pct,
            xgb_predicted_price   = round(xgb_price, 4),
            volatility_score      = ens.volatility_score,
            shortage_risk         = ens.shortage_risk,
            oversat_risk          = ens.oversat_risk,
            reasoning_summary     = summary,
            reasoning_steps       = steps,
            model_versions        = {
                "prophet": self._prophet.version,
                "xgboost": self._xgb.version,
                "ensemble": "1.0",
            },
            generated_at          = int(time.time() * 1000),
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _serialise_forecast(df: pd.DataFrame) -> List[ForecastPoint]:
        points = []
        for _, row in df.iterrows():
            ts = int(pd.Timestamp(row["ds"]).timestamp() * 1000)
            points.append(ForecastPoint(
                timestamp   = ts,
                price       = round(float(row["yhat"]), 4),
                lower_bound = round(float(row["yhat_lower"]), 4),
                upper_bound = round(float(row["yhat_upper"]), 4),
            ))
        return points
