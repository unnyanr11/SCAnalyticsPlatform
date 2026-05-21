"""Pydantic schemas for market price data."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MarketPriceIn(BaseModel):
    """Payload sent by the browser extension when ingesting a snapshot."""
    resource_id:      int
    realm:            int = Field(default=0, ge=0, le=1)
    observed_at:      datetime
    lowest_ask:       float = Field(ge=0)
    highest_ask:      float = Field(ge=0)
    vwap:             float = Field(ge=0)
    total_supply:     float = Field(ge=0)
    offer_count:      int   = Field(ge=0)
    demand_score:     float = Field(default=0.0, ge=0.0, le=1.0)
    price_volatility: float = Field(default=0.0, ge=0.0)


class MarketPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    resource_id:      int
    realm:            int
    observed_at:      datetime
    lowest_ask:       float
    highest_ask:      float
    vwap:             float
    total_supply:     float
    offer_count:      int
    demand_score:     float
    price_volatility: float
