-- =============================================================================
-- SCAnalyticsPlatform — Supabase / PostgreSQL Setup Script
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- after running `alembic upgrade head` from your local machine.
-- This script:
--   1. Enables required PostgreSQL extensions
--   2. Configures Row Level Security (RLS) policies
--   3. Creates helper views for common analytics queries
--   4. Sets up pg_cron jobs for maintenance (requires pg_cron extension)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy text search on product names
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- GIN on scalar columns
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- query performance

-- ---------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- market_prices, predictions, phases, events are read-only for anon

ALTER TABLE market_prices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE economy_phases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_market_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items           ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can do everything
CREATE POLICY "service_all_market_prices"
  ON market_prices FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_ai_predictions"
  ON ai_predictions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_economy_phases"
  ON economy_phases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_alerts"
  ON alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_watchlist"
  ON watchlist_items FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_events"
  ON historical_market_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Anon / authenticated can SELECT public tables
CREATE POLICY "anon_read_market_prices"
  ON market_prices FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_predictions"
  ON ai_predictions FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_phases"
  ON economy_phases FOR SELECT TO anon USING (true);

-- Watchlist is keyed by user_key (extension sends it as a header/bearer);
-- we don't have native auth rows here, so full access via service_role only.

-- ---------------------------------------------------------------------------
-- 3. ANALYTICS VIEWS
-- ---------------------------------------------------------------------------

-- Latest market snapshot per product per realm
CREATE OR REPLACE VIEW v_latest_market AS
SELECT DISTINCT ON (product_id, realm)
    mp.product_id,
    mp.realm,
    p.name          AS product_name,
    p.category,
    mp.vwap,
    mp.lowest_ask,
    mp.highest_ask,
    mp.total_supply,
    mp.offer_count,
    mp.demand_score,
    mp.price_volatility,
    mp.momentum_24h,
    mp.observed_at
FROM  market_prices mp
JOIN  products p ON p.sim_id = mp.product_id AND p.realm = mp.realm
ORDER BY mp.product_id, mp.realm, mp.observed_at DESC;

-- Latest AI prediction per product per realm
CREATE OR REPLACE VIEW v_latest_predictions AS
SELECT DISTINCT ON (product_id, realm)
    pr.product_id,
    pr.realm,
    p.name           AS product_name,
    p.category,
    pr.signal,
    pr.confidence_score,
    pr.predicted_margin,
    pr.shortage_risk,
    pr.oversat_risk,
    pr.reasoning,
    pr.generated_at
FROM  ai_predictions pr
JOIN  products p ON p.sim_id = pr.product_id AND p.realm = pr.realm
ORDER BY pr.product_id, pr.realm, pr.generated_at DESC;

-- Market heatmap: latest market + latest prediction joined
CREATE OR REPLACE VIEW v_market_heatmap AS
SELECT
    m.product_id,
    m.realm,
    m.product_name,
    m.category,
    m.vwap,
    m.demand_score,
    m.price_volatility,
    m.momentum_24h,
    m.total_supply,
    m.observed_at          AS price_updated_at,
    pr.signal,
    pr.confidence_score,
    pr.predicted_margin,
    pr.shortage_risk,
    pr.oversat_risk
FROM  v_latest_market m
LEFT JOIN v_latest_predictions pr
    ON pr.product_id = m.product_id AND pr.realm = m.realm;

-- Top production chains by profit score
CREATE OR REPLACE VIEW v_top_chains AS
SELECT
    pc.id,
    pc.realm,
    pc.name,
    pc.output_category,
    pc.profit_per_hour,
    pc.profit_score,
    pc.roi_pct,
    pc.saturation_risk,
    pc.is_ai_recommended,
    p.name AS product_name
FROM  production_chains pc
JOIN  products p ON p.id = pc.product_id
WHERE pc.is_active = true
ORDER BY pc.profit_score DESC;

-- Unacknowledged alerts ordered by severity
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
    a.id,
    a.realm,
    a.alert_type,
    a.severity,
    a.title,
    a.message,
    a.icon,
    a.confidence,
    a.triggered_at,
    p.name AS product_name
FROM  alerts a
LEFT JOIN products p ON p.sim_id = a.product_id AND p.realm = a.realm
WHERE a.acknowledged = false
  AND (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY
    CASE a.severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH'     THEN 2
        WHEN 'MEDIUM'   THEN 3
        ELSE 4
    END,
    a.triggered_at DESC;

-- ---------------------------------------------------------------------------
-- 4. HELPER FUNCTION: purge old market_prices (call via pg_cron)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_old_market_prices(retain_days INT DEFAULT 90)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM market_prices
  WHERE observed_at < NOW() - (retain_days || ' days')::INTERVAL;
END;
$$;

CREATE OR REPLACE FUNCTION purge_old_volatility_metrics(retain_days INT DEFAULT 30)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM volatility_metrics
  WHERE computed_at < NOW() - (retain_days || ' days')::INTERVAL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. pg_cron JOBS  (requires pg_cron extension — enable in Supabase Dashboard)
-- ---------------------------------------------------------------------------
-- SELECT cron.schedule('purge-market-prices',  '0 2 * * *',  $$SELECT purge_old_market_prices(90)$$);
-- SELECT cron.schedule('purge-vol-metrics',    '30 2 * * *', $$SELECT purge_old_volatility_metrics(30)$$);

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
SELECT 'SCAnalyticsPlatform Supabase setup complete ✅' AS status;
