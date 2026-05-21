# Database Scripts

## init_db.py

Initialises the database after running Alembic migrations.

```bash
# From backend/
python -m scripts.init_db           # verify tables + seed if empty
python -m scripts.init_db --seed    # force re-seed
python -m scripts.init_db --reset   # drop all tables, re-migrate, then seed (DANGEROUS)
```

## supabase_setup.sql

Run this once in the **Supabase SQL Editor** after `alembic upgrade head`:

1. Enables `pg_trgm`, `btree_gin`, `pg_stat_statements`
2. Configures Row Level Security for all tables
3. Creates analytics views:
   - `v_latest_market` — latest snapshot per product
   - `v_latest_predictions` — latest AI prediction per product
   - `v_market_heatmap` — combined market + AI data for the heatmap overlay
   - `v_top_chains` — production chains ranked by `profit_score`
   - `v_active_alerts` — unacknowledged alerts sorted by severity
4. Creates `purge_old_market_prices()` and `purge_old_volatility_metrics()` for data retention
5. (Optional) pg_cron job definitions — uncomment to enable

## seed_data.json

Contains 12 real SimCompanies Alpha realm products + 6 economy phase baseline records.
New seed entities can be added to either array — the init script uses `ON CONFLICT DO NOTHING`
so re-seeding is always safe.

## Makefile commands

```bash
make migrate                      # alembic upgrade head
make migrate-new msg="add column" # alembic revision --autogenerate
cd backend && python -m scripts.init_db --seed
```
