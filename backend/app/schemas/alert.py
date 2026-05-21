"""Pydantic schemas for alert data."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:           int
    resource_id:  int
    realm:        int
    severity:     str
    message:      str
    triggered_at: datetime
    acknowledged: bool
