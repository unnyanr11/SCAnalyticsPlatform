"""Pydantic schemas for watchlist."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WatchlistItemIn(BaseModel):
    resource_id: int = Field(ge=1)
    realm:       int = Field(default=0, ge=0, le=1)


class WatchlistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          int
    resource_id: int
    realm:       int
