"""ORM models package. Import all models here so Alembic can detect them."""

from app.models.market import (
    Alert,
    AIPrediction,
    EconomyPhase,
    MarketPrice,
    Product,
    VolatilityMetric,
    WatchlistEntry,
)

__all__ = [
    "Alert",
    "AIPrediction",
    "EconomyPhase",
    "MarketPrice",
    "Product",
    "VolatilityMetric",
    "WatchlistEntry",
]
