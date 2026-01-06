-- Dogechain Bubblemaps - Search Analytics Database Schema
-- PostgreSQL/Supabase
-- Version 1.0

-- =====================================================
-- SEARCH EVENTS TABLE
-- Stores all search queries and results shown
-- =====================================================

CREATE TABLE IF NOT EXISTS search_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  query VARCHAR(500) NOT NULL,
  results JSONB NOT NULL,  -- Array of token addresses
  result_count INT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_events_session ON search_events(session_id);
CREATE INDEX IF NOT EXISTS idx_search_events_timestamp ON search_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_events_query ON search_events(query);

-- =====================================================
-- CLICK EVENTS TABLE
-- Stores user clicks on search results
-- =====================================================

CREATE TABLE IF NOT EXISTS click_events (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  query VARCHAR(500) NOT NULL,
  clicked_address VARCHAR(42) NOT NULL,
  result_rank INT NOT NULL,  -- Position in results (0-indexed)
  result_score DECIMAL(5,2),  -- Relevance score
  time_to_click_ms INT,  -- Time from search to click (milliseconds)
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_click_events_session ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_timestamp ON click_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_click_events_address ON click_events(clicked_address);
CREATE INDEX IF NOT EXISTS idx_click_events_query ON click_events(query);

-- =====================================================
-- TOKEN POPULARITY TABLE
-- Aggregate statistics for each token
-- Updated hourly by aggregation job
-- =====================================================

CREATE TABLE IF NOT EXISTS token_popularity (
  token_address VARCHAR(42) PRIMARY KEY,
  search_count INT DEFAULT 0,  -- Times appeared in search results
  click_count INT DEFAULT 0,   -- Times users clicked
  ctr DECIMAL(4,3),           -- Click-through rate (0-1)
  last_searched TIMESTAMP,    -- Most recent appearance in results
  last_clicked TIMESTAMP,     -- Most recent click
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_token_popularity_updated ON token_popularity(updated_at);

-- =====================================================
-- USER CONTRIBUTIONS TABLE
-- Stores community-submitted tokens and metadata
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contributions (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL UNIQUE,
  contributor_id VARCHAR(64) NOT NULL,  -- Anonymous contributor hash
  contribution_type VARCHAR(20) NOT NULL,  -- 'add_token' | 'fix_metadata' | 'add_alias'
  metadata JSONB,  -- Token name, symbol, decimals, etc.
  votes INT DEFAULT 0,  -- Upvotes for approval
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  reviewed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_contributions_address ON user_contributions(token_address);
CREATE INDEX IF NOT EXISTS idx_user_contributions_status ON user_contributions(status);
CREATE INDEX IF NOT EXISTS idx_user_contributions_type ON user_contributions(contribution_type);

-- =====================================================
-- ANALYTICS SUMMARY TABLE
-- Pre-computed daily statistics for dashboard
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_searches INT DEFAULT 0,
  total_clicks INT DEFAULT 0,
  unique_sessions INT DEFAULT 0,
  avg_ctr DECIMAL(4,3),
  top_queries JSONB,  -- Top 100 queries for the day
  top_tokens JSONB,  -- Top 100 clicked tokens
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_summary_date ON analytics_summary(date);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function: Update token popularity on click
CREATE OR REPLACE FUNCTION update_token_popularity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO token_popularity (token_address, click_count, last_clicked, updated_at)
  VALUES (NEW.clicked_address, 1, NEW.timestamp, NOW())
  ON CONFLICT (token_address)
  DO UPDATE SET
    click_count = token_popularity.click_count + 1,
    last_clicked = NEW.timestamp,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update popularity on new clicks
DROP TRIGGER IF EXISTS trigger_update_popularity ON click_events;
CREATE TRIGGER trigger_update_popularity
AFTER INSERT ON click_events
FOR EACH ROW
EXECUTE FUNCTION update_token_popularity();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Recent search activity
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
  se.session_id,
  se.query,
  se.result_count,
  COUNT(ce.id) as clicks,
  MAX(se.timestamp) as last_searched
FROM search_events se
LEFT JOIN click_events ce ON se.session_id = ce.session_id AND se.query = ce.query
WHERE se.timestamp > NOW() - INTERVAL '7 days'
GROUP BY se.session_id, se.query, se.result_count
ORDER BY last_searched DESC
LIMIT 1000;

-- View: Token popularity with rankings
CREATE OR REPLACE VIEW v_token_rankings AS
SELECT
  token_address,
  search_count,
  click_count,
  COALESCE(ctr, 0) as ctr,
  RANK() OVER (ORDER BY COALESCE(ctr, 0) DESC) as ctr_rank,
  RANK() OVER (ORDER BY click_count DESC) as click_rank,
  last_searched,
  last_clicked
FROM token_popularity
WHERE click_count > 0
ORDER BY ctr DESC;

-- =====================================================
-- CLEANUP JOBS (Manual or via cron)
-- =====================================================

-- Delete search/click events older than 90 days
-- Run this weekly via cron job:
-- DELETE FROM search_events WHERE timestamp < NOW() - INTERVAL '90 days';
-- DELETE FROM click_events WHERE timestamp < NOW() - INTERVAL '90 days';

-- =====================================================
-- GRANT PERMISSIONS (Adjust for your user)
-- =====================================================

-- Grant permissions to your application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample analytics summary (today)
INSERT INTO analytics_summary (date, total_searches, total_clicks, unique_sessions, avg_ctr)
VALUES (
  CURRENT_DATE,
  0,
  0,
  0,
  0.0
)
ON CONFLICT (date) DO NOTHING;

-- =====================================================
-- END OF SCHEMA
-- =====================================================

COMMENT ON TABLE search_events IS 'Stores all search queries and results shown to users';
COMMENT ON TABLE click_events IS 'Stores user clicks on search results';
COMMENT ON TABLE token_popularity IS 'Aggregate popularity metrics for each token (updated hourly)';
COMMENT ON TABLE user_contributions IS 'Community-submitted tokens and metadata corrections';
COMMENT ON TABLE analytics_summary IS 'Pre-computed daily statistics for analytics dashboard';

COMMENT ON COLUMN search_events.session_id IS 'Anonymous session identifier (64-char hex)';
COMMENT ON COLUMN click_events.time_to_click_ms IS 'Time from search display to user click (milliseconds)';
COMMENT ON COLUMN token_popularity.ctr IS 'Click-through rate: clicks / impressions';
COMMENT ON COLUMN user_contributions.contributor_id IS 'One-way hash of user identifier (anonymized)';
