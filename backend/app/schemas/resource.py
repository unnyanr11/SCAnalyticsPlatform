"""Pydantic schemas for resource / encyclopedia data."""

from __future__ import annotations

from typing import Any, List

from pydantic import BaseModel, ConfigDict


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    realm:           int
    key:             str
    name:            str
    category:        str
    retail_price:    float
    units_per_run:   float
    production_time: int
    ingredients:     List[Any]
    quality_tiers:   List[Any]
