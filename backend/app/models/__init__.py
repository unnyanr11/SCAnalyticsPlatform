"""ORM model registry — import all models so Alembic autogenerate can see them."""

from app.models.product           import Product
from app.models.market            import MarketPrice
from app.models.prediction        import AIPredictionRecord
from app.models.phase             import EconomyPhaseRecord
from app.models.alert             import AlertRecord
from app.models.watchlist         import WatchlistItem
from app.models.volatility        import VolatilityMetric
from app.models.production_chain  import ProductionChain, ProductionChainInput
from app.models.market_event      import HistoricalMarketEvent
from app.models.resource          import Resource

__all__ = [
    "Product",
    "MarketPrice",
    "AIPredictionRecord",
    "EconomyPhaseRecord",
    "AlertRecord",
    "WatchlistItem",
    "VolatilityMetric",
    "ProductionChain",
    "ProductionChainInput",
    "HistoricalMarketEvent",
    "Resource",
]
