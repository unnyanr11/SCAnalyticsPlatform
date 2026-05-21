"""
SC Analytics Platform — Ingest Schemas

Pydantic models for data ingestion from the extension.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MarketIngestRequest(BaseModel):
    """Payload forwarded by the content script from intercepted API calls."""

    url: str = Field(..., description="The intercepted API endpoint URL")
    data: Any = Field(..., description="Raw JSON data from the API response")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")

    model_config = {"json_schema_extra": {"example": {
        "url": "https://www.simcompanies.com/api/v2/market/37",
        "data": [{"price": 5.12, "quantity": 1000}],
        "timestamp": 1716300000000,
    }}}
