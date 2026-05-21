"""Pydantic schemas for the historical market data engine."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class MarketIngestionPayload(BaseModel):
    product_id: int = Field(..., gt=0)
    observed_at: datetime | int | float | str | None = None
    lowest_ask: Decimal | None = Field(default=None, ge=0)
    highest_ask: Decimal | None = Field(default=None, ge=0)
    vwap: Decimal | None = Field(default=None, ge=0)
    total_supply: int | None = Field(default=None, ge=0)
    offer_count: int | None = Field(default=None, ge=0)
    demand_score: Decimal | None = Field(default=None)
    price_volatility: Decimal | None = Field(default=None, ge=0)
    momentum_24h: Decimal | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class MarketIngestionRequest(BaseModel):
    realm: int = Field(default=0, ge=0)
    source: str = Field(default="api", min_length=2, max_length=50)
    payloads: list[MarketIngestionPayload] = Field(default_factory=list, min_length=1)


class MarketIngestionResponse(BaseModel):
    received: int
    inserted: int
    duplicates: int
    metrics: int


class CleanupRequest(BaseModel):
    price_retention_days: int = Field(default=90, ge=7, le=730)
    metric_retention_days: int = Field(default=30, ge=7, le=365)
    event_retention_days: int = Field(default=180, ge=30, le=1095)


class CleanupResponse(BaseModel):
    market_prices: int
    volatility_metrics: int
    historical_market_events: int
