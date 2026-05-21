"""Database initialization script.

Run once after `alembic upgrade head` to:
  1. Verify all tables exist
  2. Load seed data if tables are empty

Usage:
    python -m scripts.init_db
    python -m scripts.init_db --seed          # force re-seed
    python -m scripts.init_db --reset         # drop + recreate + seed (DANGEROUS)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# ---- make sure app/ is on sys.path when run directly --------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config   import settings
from app.db.session    import engine, AsyncSessionLocal
from app.models        import *  # noqa: F401,F403 — register all models
from app.models.base   import Base

# Seed data lives next to this script
SEED_FILE = Path(__file__).parent / "seed_data.json"


ASCII_BANNER = """
 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃  SCAnalyticsPlatform — DB Init    ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
"""


async def verify_tables() -> list[str]:
    """Return list of tables that exist in the DB."""
    async with engine.connect() as conn:
        tables = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).get_table_names()
        )
    return tables


async def seed_database(session: AsyncSession, force: bool = False) -> None:
    """Insert seed records if tables are empty (or force=True)."""

    # --- products -----------------------------------------------------------
    row = await session.execute(text("SELECT COUNT(*) FROM products"))
    count = row.scalar_one()
    if count > 0 and not force:
        print("  [skip] products — already seeded")
    else:
        data = json.loads(SEED_FILE.read_text())
        for p in data["products"]:
            await session.execute(
                text("""
                    INSERT INTO products
                        (realm, sim_id, key, name, category, retail_price,
                         transport_cost, units_per_run, production_time,
                         is_raw_material, is_tradeable)
                    VALUES
                        (:realm, :sim_id, :key, :name, :category, :retail_price,
                         :transport_cost, :units_per_run, :production_time,
                         :is_raw_material, :is_tradeable)
                    ON CONFLICT (realm, sim_id) DO NOTHING
                """),
                p,
            )
        print(f"  [ok]   products — inserted {len(data['products'])} rows")

    # --- economy_phases -----------------------------------------------------
    row = await session.execute(text("SELECT COUNT(*) FROM economy_phases"))
    if row.scalar_one() == 0 or force:
        data = json.loads(SEED_FILE.read_text())
        for ph in data["economy_phases"]:
            await session.execute(
                text("""
                    INSERT INTO economy_phases
                        (realm, phase_code, phase_name, multiplier, source)
                    VALUES
                        (:realm, :phase_code, :phase_name, :multiplier, :source)
                """),
                ph,
            )
        print(f"  [ok]   economy_phases — inserted {len(data['economy_phases'])} rows")
    else:
        print("  [skip] economy_phases — already seeded")

    await session.commit()
    print("\n  ✅ Seed complete.")


async def main(args: argparse.Namespace) -> None:
    print(ASCII_BANNER)
    print(f"  Target: {settings.DATABASE_URL[:50]}...")

    if args.reset:
        print("  ⚠️  --reset: dropping all tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        print("  Tables dropped.")

    # Always ensure schema is up-to-date via Alembic (we don't call create_all here)
    tables = await verify_tables()
    print(f"  Found {len(tables)} tables: {', '.join(tables[:5])}{'...' if len(tables)>5 else ''}")

    expected = {
        "products", "market_prices", "ai_predictions", "economy_phases",
        "alerts", "watchlist_items", "volatility_metrics",
        "production_chains", "production_chain_inputs", "historical_market_events",
    }
    missing = expected - set(tables)
    if missing:
        print(f"  ❌ Missing tables: {missing}")
        print("     Run: alembic upgrade head")
        sys.exit(1)
    print("  ✅ All required tables present.")

    async with AsyncSessionLocal() as session:
        await seed_database(session, force=args.seed or args.reset)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SCAnalyticsPlatform DB init")
    parser.add_argument("--seed",  action="store_true", help="Force re-seed even if data exists")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate all tables (DANGEROUS)")
    asyncio.run(main(parser.parse_args()))
