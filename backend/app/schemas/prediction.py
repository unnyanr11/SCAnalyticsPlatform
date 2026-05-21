"""Pydantic schemas for AI prediction data."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                int
    resource_id:       int
    realm:             int
    signal:            str
    confidence_score:  float
    predicted_margin:  float
    shortage_risk:     float
    oversat_risk:      float
    price_target_low:  float
    price_target_high: float
    reasoning:         str
    model_version:     str
    generated_at:      datetime
