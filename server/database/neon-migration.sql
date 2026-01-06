-- ============================================================================
-- Neon PostgreSQL Database Migration Script
-- ============================================================================
-- This script sets up the database schema for the search analytics and
-- learning system on Neon PostgreSQL.
--
-- Prerequisites:
-- 1. Enable pg_trgm extension for text similarity (collaborative filtering)
-- 2. Run this script in your Neon database SQL editor
--
-- Usage:
-- - Copy this entire script to Neon SQL Editor
-- - Execute all commands
-- - Verify tables were created successfully
-- ============================================================================

-- Enable pg_trgm extension for text similarity (required for collaborative filtering)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- TABLE: search_events
-- Stores all search queries with their results for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  query VARCHAR(500) NOT NULL,
  results JSONB NOT NULL,
  result_count INT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for search_events
CREATE INDEX IF NOT EXISTS idx_search_events_session ON search_events(session_id);
CREATE INDEX IF NOT EXISTS idx_search_events_timestamp ON search_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_events_query ON search_events(query);

-- ============================================================================
-- TABLE: click_events
-- Stores click events on search results for popularity scoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS click_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  query VARCHAR(500) NOT NULL,
  clicked_address VARCHAR(42) NOT NULL,
  result_rank INT NOT NULL,
  result_score DECIMAL(5,2),
  time_to_click_ms INT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for click_events
CREATE INDEX IF NOT EXISTS idx_click_events_session ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_address ON click_events(clicked_address);
CREATE INDEX IF NOT EXISTS idx_click_events_timestamp ON click_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_click_events_query ON click_events(query);

-- ============================================================================
-- TABLE: token_popularity
-- Stores aggregate popularity metrics for tokens (computed from events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_popularity (
  token_address VARCHAR(42) PRIMARY KEY,
  search_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  ctr DECIMAL(4,3), -- Click-through rate (0.000 to 1.000)
  last_searched TIMESTAMP,
  last_clicked TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for token_popularity lookups
CREATE INDEX IF NOT EXISTS idx_token_popularity_updated ON token_popularity(updated_at);

-- ============================================================================
-- TABLE: user_contributions
-- Stores community-submitted tokens and metadata corrections
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_contributions (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42),
  contributor_id VARCHAR(64) NOT NULL, -- Anonymous contributor hash
  contribution_type VARCHAR(50) NOT NULL, -- 'add_token', 'fix_metadata', 'add_alias'
  contribution_data JSONB NOT NULL, -- Token metadata, corrections, etc.
  approved BOOLEAN DEFAULT FALSE,
  approval_count INT DEFAULT 0,
  rejection_count INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP
);

-- Indexes for user_contributions
CREATE INDEX IF NOT EXISTS idx_contributions_address ON user_contributions(token_address);
CREATE INDEX IF NOT EXISTS idx_contributions_type ON user_contributions(contribution_type);
CREATE INDEX IF NOT EXISTS idx_contributions_approved ON user_contributions(approved);
CREATE INDEX IF NOT EXISTS idx_contributions_created ON user_contributions(created_at);

-- ============================================================================
-- TABLE: analytics_summary
-- Stores aggregated analytics statistics (computed hourly/daily)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  hour INT, -- NULL for daily summaries
  total_searches INT DEFAULT 0,
  total_clicks INT DEFAULT 0,
  unique_sessions INT DEFAULT 0,
  avg_ctr DECIMAL(4,3),
  top_queries JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique constraint on date + hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_summary_date_hour
  ON analytics_summary(date, hour);

-- ============================================================================
-- TABLE: whale_wallets
-- Registry of high-volume wallets for token discovery
-- ============================================================================
CREATE TABLE IF NOT EXISTS whale_wallets (
  wallet_address VARCHAR(42) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  volume_level VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
  total_transactions INT DEFAULT 0,
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

-- Index for whale wallet lookups
CREATE INDEX IF NOT EXISTS idx_whale_wallets_active ON whale_wallets(active);

-- ============================================================================
-- TABLE: discovered_factories
-- Registry of discovered DEX factories for pair scanning
-- ============================================================================
CREATE TABLE IF NOT EXISTS discovered_factories (
  factory_address VARCHAR(42) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  dex_name VARCHAR(100) NOT NULL,
  version VARCHAR(50),
  verified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  pairs_discovered INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- Index for factory lookups
CREATE INDEX IF NOT EXISTS idx_factories_active ON discovered_factories(active);

-- ============================================================================
-- MATERIALIZED VIEW: token_search_index
-- Indexed search data for token discovery and metadata
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS token_search_index AS
SELECT DISTINCT
  address,
  name,
  symbol,
  type,
  LOWER(name) as name_lower,
  LOWER(symbol) as symbol_lower
FROM (
  -- Union of all token sources (you can add more sources here)
  SELECT
    contract_address as address,
    token_name as name,
    token_symbol as symbol,
    'TOKEN' as type
  FROM tokens
  WHERE contract_address IS NOT NULL

  UNION ALL

  SELECT
    address,
    name,
    symbol,
    'NFT' as type
  FROM nfts
  WHERE address IS NOT NULL
) AS all_tokens
WHERE address IS NOT NULL
WITH DATA;

-- Create indexes on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_search_index_address
  ON token_search_index(address);
CREATE INDEX IF NOT EXISTS idx_token_search_index_name_lower
  ON token_search_index(name_lower);
CREATE INDEX IF NOT EXISTS idx_token_search_index_symbol_lower
  ON token_search_index(symbol_lower);
CREATE INDEX IF NOT EXISTS idx_token_search_index_type
  ON token_search_index(type);

-- ============================================================================
-- FUNCTIONS: Refresh materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_token_search_index()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY token_search_index;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Aggregate popularity metrics (run hourly via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION aggregate_popularity_metrics()
RETURNS void AS $$
BEGIN
  -- Update token_popularity table from click_events and search_events
  INSERT INTO token_popularity (token_address, search_count, click_count, ctr, last_searched, last_clicked, updated_at)
  SELECT
    ce.clicked_address,
    (SELECT COUNT(*) FROM search_events se
     WHERE se.results @> JSONB_BUILD_ARRAY(ce.clicked_address)
     AND se.timestamp > NOW() - INTERVAL '30 days'),
    (SELECT COUNT(*) FROM click_events ce2
     WHERE ce2.clicked_address = ce.clicked_address
     AND ce2.timestamp > NOW() - INTERVAL '30 days'),
    -- Calculate CTR
    CASE
      WHEN (SELECT COUNT(*) FROM search_events se
            WHERE se.results @> JSONB_BUILD_ARRAY(ce.clicked_address)
            AND se.timestamp > NOW() - INTERVAL '30 days') > 0
      THEN (SELECT COUNT(*)::FLOAT / (SELECT COUNT(*) FROM search_events se
            WHERE se.results @> JSONB_BUILD_ARRAY(ce.clicked_address)
            AND se.timestamp > NOW() - INTERVAL '30 days'))
      ELSE 0
    END,
    (SELECT MAX(se.timestamp) FROM search_events se
     WHERE se.results @> JSONB_BUILD_ARRAY(ce.clicked_address)),
    (SELECT MAX(ce2.timestamp) FROM click_events ce2
     WHERE ce2.clicked_address = ce.clicked_address),
    NOW()
  FROM click_events ce
  WHERE ce.timestamp > NOW() - INTERVAL '30 days'
  GROUP BY ce.clicked_address

  ON CONFLICT (token_address) DO UPDATE SET
    search_count = EXCLUDED.search_count,
    click_count = EXCLUDED.click_count,
    ctr = EXCLUDED.ctr,
    last_searched = EXCLUDED.last_searched,
    last_clicked = EXCLUDED.last_clicked,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Generate analytics summary (run daily via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_analytics_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  -- Hourly summaries
  INSERT INTO analytics_summary (date, hour, total_searches, total_clicks, unique_sessions, avg_ctr)
  SELECT
    target_date,
    EXTRACT(HOUR FROM timestamp),
    COUNT(*) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 hour'),
    (SELECT COUNT(*) FROM click_events ce
     WHERE ce.timestamp >= target_date AND ce.timestamp < target_date + INTERVAL '1 hour'),
    COUNT(DISTINCT session_id) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 hour'),
    -- Calculate average CTR
    CASE
      WHEN COUNT(*) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 hour') > 0
      THEN (SELECT COUNT(*)::FLOAT / COUNT(*))
      ELSE 0
    END
  FROM search_events
  WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 day'
  GROUP BY EXTRACT(HOUR FROM timestamp)

  ON CONFLICT (date, hour) DO UPDATE SET
    total_searches = EXCLUDED.total_searches,
    total_clicks = EXCLUDED.total_clicks,
    unique_sessions = EXCLUDED.unique_sessions,
    avg_ctr = EXCLUDED.avg_ctr;

  -- Daily summary
  INSERT INTO analytics_summary (date, hour, total_searches, total_clicks, unique_sessions, avg_ctr)
  SELECT
    target_date,
    NULL, -- NULL hour indicates daily summary
    COUNT(*) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 day'),
    (SELECT COUNT(*) FROM click_events ce
     WHERE ce.timestamp >= target_date AND ce.timestamp < target_date + INTERVAL '1 day'),
    COUNT(DISTINCT session_id) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 day'),
    -- Calculate average CTR
    CASE
      WHEN COUNT(*) FILTER (WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 day') > 0
      THEN (SELECT COUNT(*)::FLOAT / COUNT(*))
      ELSE 0
    END
  FROM search_events
  WHERE timestamp >= target_date AND timestamp < target_date + INTERVAL '1 day'

  ON CONFLICT (date, hour) DO UPDATE SET
    total_searches = EXCLUDED.total_searches,
    total_clicks = EXCLUDED.total_clicks,
    unique_sessions = EXCLUDED.unique_sessions,
    avg_ctr = EXCLUDED.avg_ctr;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS: Cleanup old events (run weekly via cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_events(days_to_keep INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_searches INT;
  deleted_clicks INT;
BEGIN
  -- Delete old search events
  DELETE FROM search_events
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS deleted_searches = ROW_COUNT;

  -- Delete old click events
  DELETE FROM click_events
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS deleted_clicks = ROW_COUNT;

  -- Return total deleted
  RETURN deleted_searches + deleted_clicks;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA: Seed whale wallets
-- ============================================================================
-- These are the known high-volume wallets for token discovery
INSERT INTO whale_wallets (wallet_address, name, volume_level, total_transactions)
VALUES
  ('0xb3D93631496285C4E0bE2D58F5e39E5CaaebF3D7', 'Dogechain Bridge', 'high', 50000),
  ('0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', 'Token Contract', 'high', 30000),
  ('0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3', 'Multisig Wallet', 'medium', 15000)
ON CONFLICT (wallet_address) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'search_events',
    'click_events',
    'token_popularity',
    'user_contributions',
    'analytics_summary',
    'whale_wallets',
    'discovered_factories'
  )
ORDER BY table_name;

-- Verify indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'search_events',
    'click_events',
    'token_popularity',
    'user_contributions',
    'analytics_summary',
    'whale_wallets',
    'discovered_factories'
  )
ORDER BY tablename, indexname;

-- Verify functions were created
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'refresh_token_search_index',
    'aggregate_popularity_metrics',
    'generate_analytics_summary',
    'cleanup_old_events'
  )
ORDER BY routine_name;

-- ============================================================================
-- GRANT PERMISSIONS (if using specific database user)
-- ============================================================================
-- Uncomment and modify if you're using a specific database user

-- GRANT SELECT, INSERT ON search_events TO your_app_user;
-- GRANT SELECT, INSERT ON click_events TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON token_popularity TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON user_contributions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_summary TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON whale_wallets TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON discovered_factories TO your_app_user;
-- GRANT SELECT ON token_search_index TO your_app_user;
-- GRANT EXECUTE ON FUNCTION refresh_token_search_index() TO your_app_user;
-- GRANT EXECUTE ON FUNCTION aggregate_popularity_metrics() TO your_app_user;
-- GRANT EXECUTE ON FUNCTION generate_analytics_summary(DATE) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_events(INT) TO your_app_user;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Your Neon database is now ready for the search analytics and learning system!
--
-- Next Steps:
-- 1. Verify environment variables are set in Vercel:
--    - DATABASE_URL (your Neon connection string)
-- 2. Deploy the API endpoints to Vercel
-- 3. Set up cron jobs for:
--    - Hourly popularity aggregation
--    - Daily analytics summary
--    - Weekly cleanup of old events
-- 4. Test the endpoints:
--    - POST /api/analytics/search
--    - POST /api/analytics/click
--    - GET /api/trending/popularity
--    - GET /api/recommendations/peers
-- ============================================================================
