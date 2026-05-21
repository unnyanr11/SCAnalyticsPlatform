"""Unified internal response schemas.

Every adapter normalizes its raw API response into one of these Pydantic models.
Downstream services, AI engines, and API routes consume *only* these models —
never raw dicts from external providers.
"""
from __future__ import annotations

from datetime import datetime
from enum import IntEnum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Realm(IntEnum):
    ALPHA = 0
    BETA  = 1


class EconomyPhaseCode(IntEnum):
    STABLE    = 0
    BOOM      = 1
    RECESSION = 2
    RECOVERY  = 3


# ---------------------------------------------------------------------------
# Market offer (single listing on the exchange)
# ---------------------------------------------------------------------------

class MarketOffer(BaseModel):
    """One ask/bid offer row from the SimCompanies exchange."""
    offer_id:   int
    product_id: int
    realm:      int
    quality:    int
    price:      float
    quantity:   int
    seller_id:  Optional[int] = None

    @field_validator("price", "quantity", mode="before")
    @classmethod
    def _coerce_numeric(cls, v: object) -> object:
        if isinstance(v, str):
            return float(v) if "." in v else int(v)
        return v


# ---------------------------------------------------------------------------
# Normalised market snapshot (aggregated per product)
# ---------------------------------------------------------------------------

class MarketSnapshot(BaseModel):
    """Aggregated market data for one product — used to write market_prices rows."""
    product_id:      int
    realm:           int
    quality:         int         = 1
    lowest_ask:      float
    highest_ask:     float
    vwap:            float       = 0.0
    total_supply:    int         = 0
    offer_count:     int         = 0
    demand_score:    float       = 0.0
    price_volatility: float      = 0.0
    momentum_24h:    float       = 0.0
    observed_at:     datetime    = Field(default_factory=datetime.utcnow)
    source:          str         = "simcompanies"


# ---------------------------------------------------------------------------
# Encyclopedia / resource entry
# ---------------------------------------------------------------------------

class ResourceEntry(BaseModel):
    """Product metadata from the SimCompanies encyclopedia."""
    sim_id:           int
    realm:            int
    key:              str
    name:             str
    category:         str
    retail_price:     float       = 0.0
    transport_cost:   float       = 0.0
    units_per_run:    int         = 1
    production_time:  int         = 0    # seconds
    is_raw_material:  bool        = False
    is_tradeable:     bool        = True
    ingredients:      list[dict]  = Field(default_factory=list)

    @field_validator("key", mode="before")
    @classmethod
    def _normalise_key(cls, v: object) -> object:
        if isinstance(v, str):
            return v.lower().replace(" ", "_")
        return v


# ---------------------------------------------------------------------------
# Retail info
# ---------------------------------------------------------------------------

class RetailInfo(BaseModel):
    """Retail channel data — demand, quality multipliers, saturation."""
    product_id:          int
    realm:               int
    quality:             int
    daily_demand:        float
    max_retail_price:    float
    saturation_level:    float   = 0.0
    quality_multiplier:  float   = 1.0


# ---------------------------------------------------------------------------
# Economy phase
# ---------------------------------------------------------------------------

class EconomyPhase(BaseModel):
    """Economy phase snapshot."""
    realm:       int
    phase_code:  int
    phase_name:  str
    multiplier:  float
    started_at:  Optional[datetime] = None
    source:      str = "simcotools"


# ---------------------------------------------------------------------------
# SimcoTools aggregated resource analytics
# ---------------------------------------------------------------------------

class SimcoResource(BaseModel):
    """Enriched resource record from SimcoTools /api/v3/resources."""
    sim_id:           int
    realm:            int
    name:             str
    category:         str
    avg_price:        float   = 0.0
    min_price:        float   = 0.0
    max_price:        float   = 0.0
    price_trend:      float   = 0.0   # % change vs 24h ago
    total_supply:     int     = 0
    demand_index:     float   = 0.0
    volatility_index: float   = 0.0
    updated_at:       Optional[datetime] = None


# ---------------------------------------------------------------------------
# Provider health (used by the registry / fallback logic)
# ---------------------------------------------------------------------------

class ProviderStatus(BaseModel):
    name:         str
    healthy:      bool
    last_checked: datetime = Field(default_factory=datetime.utcnow)
    error:        Optional[str] = None
