"""0002 – add updated_at auto-triggers for time-series tables

Revision ID: 0002_add_updated_at_triggers
Revises: 0001_initial_schema
Create Date: 2026-05-21

PostgreSQL function + triggers that automatically update
updated_at on market_prices and volatility_metrics.
"""

from alembic import op

revision = "0002_add_updated_at_triggers"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
"""


def _make_trigger(table: str) -> str:
    return (
        f"CREATE TRIGGER trg_{table}_updated_at "
        f"BEFORE UPDATE ON {table} "
        f"FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )


def upgrade() -> None:
    op.execute(_TRIGGER_FN)
    for table in ("products", "production_chains"):
        op.execute(_make_trigger(table))


def downgrade() -> None:
    for table in ("products", "production_chains"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
