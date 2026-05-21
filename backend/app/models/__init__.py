# Import all models so Alembic autogenerate picks them up.
from app.models.market    import MarketPrice       # noqa: F401
from app.models.resource  import Resource          # noqa: F401
from app.models.phase     import EconomyPhaseRecord  # noqa: F401
from app.models.prediction import AIPredictionRecord  # noqa: F401
from app.models.alert     import AlertRecord       # noqa: F401
from app.models.watchlist import WatchlistItem     # noqa: F401
