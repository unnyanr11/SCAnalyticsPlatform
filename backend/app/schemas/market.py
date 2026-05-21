"""
app/schemas/market.py
Pydantic v2 request/response schemas for all market-related endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Shared config
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductSchema(_Base):
    id: int
    name: str
    category: Optional[str] = None
    image_url: Optional[str] = None
    retail_price: Optional[float] = None
    production_cost: Optional[float] = None
    realm: int = 0


# ---------------------------------------------------------------------------
# Market price
# ---------------------------------------------------------------------------

class MarketPriceSchema(_Base):
    id: int
    product_id: int
    price: float
    quantity: int
    realm: int = 0
    source: Optional[str] = None
    recorded_at: datetime


class MarketPriceCreate(BaseModel):
    product_id: int
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    realm: int = 0
    source: Optional[str] = None


# ---------------------------------------------------------------------------
# AI Prediction
# ---------------------------------------------------------------------------

class AIPredictionSchema(_Base):
    id: uuid.UUID
    product_id: int
    model_type: str
    predicted_price: Optional[float] = None
    predicted_margin_pct: Optional[float] = None
    confidence: Optional[float] = None          # 0.0 – 1.0
    direction: Optional[Literal["up", "down", "stable"]] = None
    reasoning: Optional[str] = None
    shortage_prob: Optional[float] = None
    oversaturation_risk: Optional[float] = None
    horizon_hours: int = 24
    created_at: datetime


# ---------------------------------------------------------------------------
# Economy phase
# ---------------------------------------------------------------------------

class EconomyPhaseSchema(_Base):
    id: int
    realm: int
    phase: Literal["boom", "stable", "recession", "recovery"]
    recorded_at: datetime


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------

class AlertSchema(_Base):
    id: uuid.UUID
    product_id: Optional[int] = None
    alert_type: str
    severity: Literal["info", "warning", "critical"] = "info"
    message: str
    confidence: Optional[float] = None
    is_read: bool = False
    created_at: datetime


class AlertMarkRead(BaseModel):
    alert_id: uuid.UUID


# ---------------------------------------------------------------------------
# Scored item (returned by analytics engine to extension)
# ---------------------------------------------------------------------------

class ScoreBreakdown(BaseModel):
    profitability: int = Field(..., ge=0, le=100)
    volatility: int = Field(..., ge=0, le=100)
    price_direction: Literal["up", "down", "stable"]
    demand_trend: Literal["rising", "falling", "stable"]
    shortage: int = Field(..., ge=0, le=100)
    oversaturation: int = Field(..., ge=0, le=100)
    confidence: int = Field(..., ge=0, le=100)


class BadgeLabel(BaseModel):
    icon: str
    text: str
    type: Literal["bullish", "bearish", "warning", "danger", "volatile", "neutral"]


class ScoredItemSchema(BaseModel):
    id: int
    name: str
    price: Optional[float] = None
    quantity: Optional[int] = None
    scores: ScoreBreakdown
    label: BadgeLabel
    economy_phase: Optional[str] = None
    source: Optional[str] = None
    timestamp: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Paginated responses
# ---------------------------------------------------------------------------

class PaginatedPrices(BaseModel):
    items: list[MarketPriceSchema]
    total: int
    page: int
    page_size: int


class PaginatedAlerts(BaseModel):
    items: list[AlertSchema]
    total: int
    unread: int
