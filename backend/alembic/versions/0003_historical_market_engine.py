"""Historical market engine migration.

Adds a unique dedupe index aligned with the ingestion engine and a helper
index to speed recent-series aggregation by product / realm / timestamp.
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_historical_market_engine"
down_revision = "0002_add_updated_at_triggers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_market_prices_meta_dedupe_hash",
        "market_prices",
        [sa.text("(meta->>'dedupe_hash')")],
        unique=True,
        postgresql_using="btree",
    )
    op.create_index(
        "ix_market_prices_realm_product_recent",
        "market_prices",
        ["realm", "product_id", "observed_at"],
        unique=False,
    )
    op.create_index(
        "ix_historical_market_events_source_detected",
        "historical_market_events",
        ["source", "detected_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_historical_market_events_source_detected", table_name="historical_market_events")
    op.drop_index("ix_market_prices_realm_product_recent", table_name="market_prices")
    op.drop_index("ix_market_prices_meta_dedupe_hash", table_name="market_prices")
