"""Pydantic schemas for economy phase data."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PhaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          int
    realm:       int
    name:        str
    code:        int
    multiplier:  float
    observed_at: datetime
    ends_at:     Optional[datetime] = None
