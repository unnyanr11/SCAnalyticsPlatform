"""0001 – initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-21

Creates all 9 core tables with optimised indexes:
  products, market_prices, ai_predictions, economy_phases,
  alerts, watchlist_items, volatility_metrics,
  production_chains, production_chain_inputs,
  historical_market_events, resources
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # EXTENSIONS (safe to re-run)
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gin;")

    # ------------------------------------------------------------------
    # products
    # ------------------------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id",                sa.BigInteger,  primary_key=True, autoincrement=True),
        sa.Column("realm",             sa.Integer,     nullable=False, server_default="0"),
        sa.Column("sim_id",            sa.Integer,     nullable=False),
        sa.Column("key",               sa.String(120), nullable=False),
        sa.Column("name",              sa.String(200), nullable=False),
        sa.Column("category",          sa.String(80),  nullable=False),
        sa.Column("image_url",         sa.Text,        nullable=True),
        sa.Column("retail_price",      sa.Float,       nullable=False, server_default="0"),
        sa.Column("transport_cost",    sa.Float,       nullable=False, server_default="0"),
        sa.Column("units_per_run",     sa.Float,       nullable=False, server_default="1"),
        sa.Column("production_time",   sa.Integer,     nullable=False, server_default="0"),
        sa.Column("quality_min",       sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("quality_max",       sa.SmallInteger, nullable=False, server_default="5"),
        sa.Column("is_raw_material",   sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("is_tradeable",      sa.Boolean,     nullable=False, server_default="true"),
        sa.Column("is_researchable",   sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("ingredients",       postgresql.JSONB, nullable=True),
        sa.Column("quality_tiers",     postgresql.JSONB, nullable=True),
        sa.Column("extra_data",        postgresql.JSONB, nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.func.now(),
                  onupdate=sa.func.now()),
        sa.UniqueConstraint("realm", "sim_id", name="uq_products_realm_sim_id"),
    )
    op.create_index("ix_products_category_realm", "products", ["category", "realm"])
    op.create_index("ix_products_sim_id",         "products", ["sim_id"])
    op.create_index("ix_products_realm",          "products", ["realm"])
    # GIN index on JSONB for ingredient look-ups
    op.execute("CREATE INDEX ix_products_ingredients_gin ON products USING gin(ingredients);")

    # ------------------------------------------------------------------
    # market_prices  (primary time-series table)
    # ------------------------------------------------------------------
    op.create_table(
        "market_prices",
        sa.Column("id",               sa.BigInteger,   primary_key=True, autoincrement=True),
        sa.Column("product_id",       sa.Integer,      nullable=False),
        sa.Column("realm",            sa.Integer,      nullable=False, server_default="0"),
        sa.Column("quality",          sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("observed_at",      sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("lowest_ask",       sa.Float,        nullable=False),
        sa.Column("highest_ask",      sa.Float,        nullable=False),
        sa.Column("vwap",             sa.Float,        nullable=False),
        sa.Column("price_24h_ago",    sa.Float,        nullable=True),
        sa.Column("price_7d_ago",     sa.Float,        nullable=True),
        sa.Column("total_supply",     sa.Float,        nullable=False, server_default="0"),
        sa.Column("offer_count",      sa.Integer,      nullable=False, server_default="0"),
        sa.Column("sold_last_1h",     sa.Float,        nullable=True),
        sa.Column("sold_last_24h",    sa.Float,        nullable=True),
        sa.Column("demand_score",     sa.Float,        nullable=False, server_default="0"),
        sa.Column("price_volatility", sa.Float,        nullable=False, server_default="0"),
        sa.Column("spread_pct",       sa.Float,        nullable=True),
        sa.Column("momentum_1h",      sa.Float,        nullable=True),
        sa.Column("momentum_24h",     sa.Float,        nullable=True),
        sa.Column("source",           sa.String(40),   nullable=False, server_default="'extension'"),
    )
    op.create_index("ix_mp_product_realm_time", "market_prices", ["product_id", "realm", "observed_at"])
    op.create_index("ix_mp_realm_time",          "market_prices", ["realm", "observed_at"])
    op.create_index("ix_mp_product_id",          "market_prices", ["product_id"])
    op.execute(
        "CREATE INDEX ix_mp_observed_brin ON market_prices USING brin(observed_at "
        "WITH STORAGE_PARAMETERS (pages_per_range=32));"
    )

    # ------------------------------------------------------------------
    # ai_predictions
    # ------------------------------------------------------------------
    op.create_table(
        "ai_predictions",
        sa.Column("id",                  sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id",          sa.Integer,    nullable=False),
        sa.Column("realm",               sa.Integer,    nullable=False, server_default="0"),
        sa.Column("generated_at",        sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("expires_at",          sa.DateTime(timezone=True), nullable=True),
        sa.Column("signal",              sa.String(30), nullable=False),
        sa.Column("confidence_score",    sa.Float,      nullable=False),
        sa.Column("predicted_margin",    sa.Float,      nullable=False, server_default="0"),
        sa.Column("price_target_low",    sa.Float,      nullable=False, server_default="0"),
        sa.Column("price_target_high",   sa.Float,      nullable=False, server_default="0"),
        sa.Column("predicted_roi",       sa.Float,      nullable=True),
        sa.Column("shortage_risk",       sa.Float,      nullable=False, server_default="0"),
        sa.Column("oversat_risk",        sa.Float,      nullable=False, server_default="0"),
        sa.Column("volatility",          sa.Float,      nullable=False, server_default="0"),
        sa.Column("reasoning",           sa.Text,       nullable=False, server_default="''"),
        sa.Column("feature_importances", postgresql.JSONB, nullable=True),
        sa.Column("model_inputs",        postgresql.JSONB, nullable=True),
        sa.Column("model_version",       sa.String(40), nullable=False, server_default="'v1.0.0'"),
        sa.Column("model_type",          sa.String(40), nullable=False, server_default="'xgboost'"),
    )
    op.create_index("ix_pred_product_realm_time", "ai_predictions",
                    ["product_id", "realm", "generated_at"])
    op.create_index("ix_pred_signal",     "ai_predictions", ["signal",           "realm"])
    op.create_index("ix_pred_confidence", "ai_predictions", ["confidence_score"])
    op.execute("CREATE INDEX ix_pred_generated_brin ON ai_predictions USING brin(generated_at);")

    # ------------------------------------------------------------------
    # economy_phases
    # ------------------------------------------------------------------
    op.create_table(
        "economy_phases",
        sa.Column("id",             sa.BigInteger,   primary_key=True, autoincrement=True),
        sa.Column("realm",          sa.Integer,      nullable=False, server_default="0"),
        sa.Column("observed_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("ends_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("phase_code",     sa.SmallInteger, nullable=False),
        sa.Column("phase_name",     sa.String(40),   nullable=False),
        sa.Column("multiplier",     sa.Float,        nullable=False, server_default="1"),
        sa.Column("duration_hrs",   sa.Integer,      nullable=True),
        sa.Column("strategy_hints", postgresql.JSONB, nullable=True),
        sa.Column("source",         sa.String(40),   nullable=False, server_default="'simcotools'"),
    )
    op.create_index("ix_phase_realm_time", "economy_phases", ["realm", "observed_at"])
    op.create_index("ix_phase_code",       "economy_phases", ["phase_code"])

    # ------------------------------------------------------------------
    # alerts
    # ------------------------------------------------------------------
    op.create_table(
        "alerts",
        sa.Column("id",                   sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id",           sa.Integer,    nullable=True),
        sa.Column("realm",                sa.Integer,    nullable=False, server_default="0"),
        sa.Column("triggered_at",         sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("expires_at",           sa.DateTime(timezone=True), nullable=True),
        sa.Column("alert_type",           sa.String(40), nullable=False),
        sa.Column("severity",             sa.String(20), nullable=False, server_default="'MEDIUM'"),
        sa.Column("confidence",           sa.Float,      nullable=False, server_default="0"),
        sa.Column("title",                sa.String(200), nullable=False),
        sa.Column("message",              sa.Text,        nullable=False),
        sa.Column("icon",                 sa.String(10),  nullable=False, server_default="'⚠'"),
        sa.Column("acknowledged",         sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("acknowledged_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("metrics",              postgresql.JSONB, nullable=True),
        sa.Column("affected_product_ids", postgresql.JSONB, nullable=True),
    )
    op.create_index("ix_alert_product_realm",  "alerts", ["product_id", "realm"])
    op.create_index("ix_alert_type_severity",  "alerts", ["alert_type", "severity"])
    op.create_index("ix_alert_acknowledged",   "alerts", ["acknowledged"])
    op.execute("CREATE INDEX ix_alert_triggered_brin ON alerts USING brin(triggered_at);")

    # ------------------------------------------------------------------
    # watchlist_items
    # ------------------------------------------------------------------
    op.create_table(
        "watchlist_items",
        sa.Column("id",                    sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_key",              sa.String(128), nullable=False),
        sa.Column("product_id",            sa.Integer,     nullable=False),
        sa.Column("realm",                 sa.Integer,     nullable=False, server_default="0"),
        sa.Column("added_at",              sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("alert_on_shortage",     sa.Boolean, nullable=False, server_default="true"),
        sa.Column("alert_on_oversat",      sa.Boolean, nullable=False, server_default="true"),
        sa.Column("alert_on_price_spike",  sa.Boolean, nullable=False, server_default="true"),
        sa.Column("price_alert_threshold", sa.Float,   nullable=True),
        sa.Column("note",                  sa.Text,    nullable=True),
        sa.UniqueConstraint("user_key", "product_id", "realm",
                            name="uq_watchlist_user_product_realm"),
    )
    op.create_index("ix_watchlist_user_key", "watchlist_items", ["user_key"])
    op.create_index("ix_watchlist_product",  "watchlist_items", ["product_id", "realm"])

    # ------------------------------------------------------------------
    # volatility_metrics
    # ------------------------------------------------------------------
    op.create_table(
        "volatility_metrics",
        sa.Column("id",               sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id",       sa.Integer,    nullable=False),
        sa.Column("realm",            sa.Integer,    nullable=False, server_default="0"),
        sa.Column("computed_at",      sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("window",           sa.String(10), nullable=False),
        sa.Column("volatility_score", sa.Float,      nullable=False, server_default="0"),
        sa.Column("std_dev",          sa.Float,      nullable=False, server_default="0"),
        sa.Column("coeff_variation",  sa.Float,      nullable=False, server_default="0"),
        sa.Column("price_range_pct",  sa.Float,      nullable=False, server_default="0"),
        sa.Column("mean_price",       sa.Float,      nullable=False, server_default="0"),
        sa.Column("price_change",     sa.Float,      nullable=False, server_default="0"),
        sa.Column("trend_slope",      sa.Float,      nullable=True),
        sa.Column("momentum_rsi",     sa.Float,      nullable=True),
        sa.Column("avg_supply",       sa.Float,      nullable=True),
        sa.Column("supply_change",    sa.Float,      nullable=True),
        sa.Column("avg_offer_count",  sa.Float,      nullable=True),
        sa.Column("demand_trend",     sa.Float,      nullable=True),
    )
    op.create_index("ix_vol_product_window_time", "volatility_metrics",
                    ["product_id", "window", "computed_at"])
    op.create_index("ix_vol_score", "volatility_metrics", ["volatility_score"])
    op.execute("CREATE INDEX ix_vol_computed_brin ON volatility_metrics USING brin(computed_at);")

    # ------------------------------------------------------------------
    # production_chains
    # ------------------------------------------------------------------
    op.create_table(
        "production_chains",
        sa.Column("id",                  sa.BigInteger,  primary_key=True, autoincrement=True),
        sa.Column("product_id",          sa.Integer,     nullable=False),
        sa.Column("realm",               sa.Integer,     nullable=False, server_default="0"),
        sa.Column("name",                sa.String(200), nullable=False),
        sa.Column("output_category",     sa.String(80),  nullable=False),
        sa.Column("description",         sa.Text,        nullable=True),
        sa.Column("version",             sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("production_time_sec", sa.Integer,     nullable=False, server_default="0"),
        sa.Column("units_per_run",       sa.Float,       nullable=False, server_default="1"),
        sa.Column("estimated_cost",      sa.Float,       nullable=False, server_default="0"),
        sa.Column("estimated_revenue",   sa.Float,       nullable=False, server_default="0"),
        sa.Column("estimated_profit",    sa.Float,       nullable=False, server_default="0"),
        sa.Column("profit_per_hour",     sa.Float,       nullable=False, server_default="0"),
        sa.Column("profit_score",        sa.Float,       nullable=False, server_default="0"),
        sa.Column("roi_pct",             sa.Float,       nullable=False, server_default="0"),
        sa.Column("min_building_level",  sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("buildings_required",  postgresql.JSONB, nullable=True),
        sa.Column("is_active",           sa.Boolean,     nullable=False, server_default="true"),
        sa.Column("is_ai_recommended",   sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("saturation_risk",     sa.Float,       nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",          sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("product_id", "realm", "version",
                            name="uq_chain_product_realm_version"),
    )
    op.create_index("ix_chain_product_realm", "production_chains", ["product_id", "realm"])
    op.create_index("ix_chain_category",      "production_chains", ["output_category"])
    op.create_index("ix_chain_profit_score",  "production_chains", ["profit_score"])

    # ------------------------------------------------------------------
    # production_chain_inputs
    # ------------------------------------------------------------------
    op.create_table(
        "production_chain_inputs",
        sa.Column("id",               sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("chain_id",         sa.Integer,    nullable=False),
        sa.Column("input_product_id", sa.Integer,    nullable=False),
        sa.Column("realm",            sa.Integer,    nullable=False, server_default="0"),
        sa.Column("quantity",         sa.Float,      nullable=False, server_default="1"),
        sa.Column("estimated_cost",   sa.Float,      nullable=False, server_default="0"),
        sa.Column("is_market_sourced",sa.Boolean,    nullable=False, server_default="true"),
        sa.ForeignKeyConstraint(["chain_id"], ["production_chains.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_pci_chain",      "production_chain_inputs", ["chain_id"])
    op.create_index("ix_pci_input_prod", "production_chain_inputs", ["input_product_id"])

    # ------------------------------------------------------------------
    # historical_market_events
    # ------------------------------------------------------------------
    op.create_table(
        "historical_market_events",
        sa.Column("id",               sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id",       sa.Integer,    nullable=True),
        sa.Column("realm",            sa.Integer,    nullable=False, server_default="0"),
        sa.Column("started_at",       sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("ended_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer,    nullable=True),
        sa.Column("event_type",       sa.String(50), nullable=False),
        sa.Column("severity",         sa.String(20), nullable=False, server_default="'MEDIUM'"),
        sa.Column("description",      sa.Text,       nullable=False, server_default="''"),
        sa.Column("magnitude",        sa.Float,      nullable=False, server_default="0"),
        sa.Column("price_at_start",   sa.Float,      nullable=True),
        sa.Column("price_at_end",     sa.Float,      nullable=True),
        sa.Column("price_change_pct", sa.Float,      nullable=True),
        sa.Column("supply_at_start",  sa.Float,      nullable=True),
        sa.Column("supply_at_end",    sa.Float,      nullable=True),
        sa.Column("phase_code",       sa.Integer,    nullable=True),
        sa.Column("is_ai_labeled",    sa.Boolean,    nullable=False, server_default="true"),
        sa.Column("ai_predicted",     sa.Boolean,    nullable=False, server_default="false"),
        sa.Column("prediction_id",    sa.Integer,    nullable=True),
        sa.Column("raw_metrics",      postgresql.JSONB, nullable=True),
    )
    op.create_index("ix_hme_product_realm", "historical_market_events", ["product_id", "realm"])
    op.create_index("ix_hme_event_type",    "historical_market_events", ["event_type"])
    op.create_index("ix_hme_ai_label",      "historical_market_events", ["is_ai_labeled"])
    op.execute(
        "CREATE INDEX ix_hme_started_brin "
        "ON historical_market_events USING brin(started_at);"
    )

    # ------------------------------------------------------------------
    # resources (legacy, kept for backward compat)
    # ------------------------------------------------------------------
    op.create_table(
        "resources",
        sa.Column("id",              sa.BigInteger,  primary_key=True, autoincrement=True),
        sa.Column("realm",           sa.Integer,     nullable=False, server_default="0"),
        sa.Column("key",             sa.String(120), nullable=False),
        sa.Column("name",            sa.String(200), nullable=False),
        sa.Column("category",        sa.String(80),  nullable=False),
        sa.Column("retail_price",    sa.Float,       nullable=False, server_default="0"),
        sa.Column("units_per_run",   sa.Float,       nullable=False, server_default="1"),
        sa.Column("production_time", sa.Integer,     nullable=False, server_default="0"),
        sa.Column("ingredients",     postgresql.JSONB, nullable=True),
        sa.Column("quality_tiers",   postgresql.JSONB, nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_resources_category", "resources", ["category"])
    op.create_index("ix_resources_realm",    "resources", ["realm"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("production_chain_inputs")
    op.drop_table("production_chains")
    op.drop_table("historical_market_events")
    op.drop_table("volatility_metrics")
    op.drop_table("watchlist_items")
    op.drop_table("alerts")
    op.drop_table("economy_phases")
    op.drop_table("ai_predictions")
    op.drop_table("market_prices")
    op.drop_table("resources")
    op.drop_table("products")
