"""
Prophet-based price forecaster.

Produces:
  - hourly price forecasts over the requested horizon
  - decomposed trend percentage
  - uncertainty intervals (yhat_lower / yhat_upper)
"""
from __future__ import annotations

import logging
from typing import List, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    from prophet import Prophet  # type: ignore
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("Prophet not installed; using linear fallback.")


class ProphetForecaster:
    """
    Thin wrapper around Facebook Prophet.
    Falls back to a simple linear trend if Prophet is not installed.
    """

    def __init__(self) -> None:
        self.version = "prophet-1.1"

    # ------------------------------------------------------------------
    def forecast(
        self,
        history: pd.DataFrame,       # must have columns: ds (datetime), y (price)
        horizon_hours: int = 24,
        economy_phase_val: float = 0.33,
    ) -> Tuple[pd.DataFrame, float]:
        """
        Returns:
          forecast_df  — columns: ds, yhat, yhat_lower, yhat_upper
          trend_pct    — net % change from current to end of horizon
        """
        df = history[["ds", "price"]].rename(columns={"price": "y"}).copy()
        df["ds"] = pd.to_datetime(df["ds"]).dt.tz_localize(None)  # Prophet needs naive UTC

        if PROPHET_AVAILABLE and len(df) >= 10:
            return self._prophet_forecast(df, horizon_hours, economy_phase_val)
        return self._linear_fallback(df, horizon_hours)

    # ------------------------------------------------------------------
    def _prophet_forecast(
        self, df: pd.DataFrame, horizon_hours: int, phase: float
    ) -> Tuple[pd.DataFrame, float]:
        model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=True,
            daily_seasonality=True,
            changepoint_prior_scale=0.08,
            seasonality_prior_scale=5.0,
            interval_width=0.80,
            uncertainty_samples=200,
        )

        # Extra regressor: economy phase (constant across horizon)
        model.add_regressor("economy_phase")
        df["economy_phase"] = phase

        model.fit(df, iter=300)  # type: ignore[arg-type]

        future = model.make_future_dataframe(periods=horizon_hours, freq="h")
        future["economy_phase"] = phase
        forecast = model.predict(future)

        result = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(
            horizon_hours
        ).copy()

        current_price = float(df["y"].iloc[-1])
        end_price     = float(result["yhat"].iloc[-1])
        trend_pct     = ((end_price - current_price) / max(current_price, 1e-9)) * 100

        return result, round(trend_pct, 4)

    # ------------------------------------------------------------------
    def _linear_fallback(
        self, df: pd.DataFrame, horizon_hours: int
    ) -> Tuple[pd.DataFrame, float]:
        """Simple OLS trend extrapolation."""
        y = df["y"].values
        x = np.arange(len(y))
        coeffs = np.polyfit(x, y, 1)
        slope, intercept = coeffs

        future_x  = np.arange(len(y), len(y) + horizon_hours)
        yhat      = slope * future_x + intercept
        std_y     = float(np.std(y)) if len(y) > 1 else float(y.mean() * 0.05)

        last_ts   = pd.to_datetime(df["ds"].iloc[-1])
        timestamps = [last_ts + pd.Timedelta(hours=i + 1) for i in range(horizon_hours)]

        result = pd.DataFrame({
            "ds":          timestamps,
            "yhat":        yhat,
            "yhat_lower":  yhat - 1.28 * std_y,
            "yhat_upper":  yhat + 1.28 * std_y,
        })

        current = float(y[-1])
        end     = float(yhat[-1])
        trend_pct = ((end - current) / max(current, 1e-9)) * 100
        return result, round(trend_pct, 4)
