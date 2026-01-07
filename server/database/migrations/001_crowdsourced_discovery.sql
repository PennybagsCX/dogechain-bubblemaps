-- Migration 001: Crowdsourced Discovery System
-- This migration adds tables for the learning search system that aggregates
-- wallet scanner data from all users to improve token/NFT discovery globally.

-- =====================================================
-- 1. Pending Validations Queue
-- =====================================================
-- Stores token discoveries pending validation against Blockscout API
CREATE TABLE IF NOT EXISTS pending_validations (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL UNIQUE,
  source VARCHAR(20) NOT NULL, -- 'wallet_scan' | 'user_submission' | 'whale_transfer' | 'lp_detection'
  metadata JSONB,
  priority INT DEFAULT 0, -- 0-10, higher = validate first
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validation_attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'validating' | 'validated' | 'rejected'
  contributor_hash VARCHAR(64) -- Anonymous contributor identifier (SHA-256)
);

-- Index for queue processing (priority + submitted_at)
CREATE INDEX IF NOT EXISTS idx_pending_validations_priority
  ON pending_validations(priority DESC, submitted_at ASC);

-- Index for status checks
CREATE INDEX IF NOT EXISTS idx_pending_validations_status
  ON pending_validations(status);

-- Index for contributor rate limiting
CREATE INDEX IF NOT EXISTS idx_pending_validations_contributor
  ON pending_validations(contributor_hash, submitted_at);

-- =====================================================
-- 2. Token Merge History (Audit Trail)
-- =====================================================
-- Tracks all token merges for transparency and debugging
CREATE TABLE IF NOT EXISTS token_merge_history (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  source VARCHAR(20) NOT NULL,
  source_metadata JSONB,
  merged_metadata JSONB,
  merged_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confidence_score DECIMAL(3,2), -- 0-1, indicates merge quality
  contributor_hash VARCHAR(64)
);

-- Index for token history lookup
CREATE INDEX IF NOT EXISTS idx_merge_history_address
  ON token_merge_history(token_address, merged_at DESC);

-- Index for contributor tracking
CREATE INDEX IF NOT EXISTS idx_merge_history_contributor
  ON token_merge_history(contributor_hash, merged_at DESC);

-- =====================================================
-- 3. Source Priority Weights
-- =====================================================
-- Defines trust weights for different data sources
CREATE TABLE IF NOT EXISTS source_weights (
  source_name VARCHAR(50) PRIMARY KEY,
  weight INT NOT NULL DEFAULT 1, -- 1-100, higher = more trusted
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Initialize default source weights
INSERT INTO source_weights (source_name, weight) VALUES
  ('verified_contract', 100),
  ('whale_transfer', 80),
  ('lp_pair', 70),
  ('wallet_scan', 50),
  ('user_submission', 30),
  ('blockscout_api', 40)
ON CONFLICT (source_name) DO NOTHING;

-- =====================================================
-- 4. Crowdsourced Token Index
-- =====================================================
-- Main index for crowdsourced and validated tokens
CREATE TABLE IF NOT EXISTS crowdsourced_token_index (
  token_address VARCHAR(42) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  decimals INT NOT NULL,
  type VARCHAR(10) NOT NULL, -- 'TOKEN' | 'NFT'
  source VARCHAR(50) NOT NULL,
  holder_count INT,
  is_verified BOOLEAN DEFAULT FALSE,
  confidence_score DECIMAL(3,2), -- 0-1
  discovery_count INT DEFAULT 1, -- How many times discovered by different users
  first_discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_crowdsourced_tokens_type
  ON crowdsourced_token_index(type);

-- Index for symbol search
CREATE INDEX IF NOT EXISTS idx_crowdsourced_tokens_symbol
  ON crowdsourced_token_index(LOWER(symbol));

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_crowdsourced_tokens_name
  ON crowdsourced_token_index(LOWER(name));

-- Compound index for popular tokens
CREATE INDEX IF NOT EXISTS idx_crowdsourced_tokens_popularity
  ON crowdsourced_token_index(type, discovery_count DESC, confidence_score DESC);

-- =====================================================
-- 5. Discovery Submission Log
-- =====================================================
-- Logs all discovery submissions for analytics and rate limiting
CREATE TABLE IF NOT EXISTS discovery_submission_log (
  id SERIAL PRIMARY KEY,
  contributor_hash VARCHAR(64) NOT NULL,
  submission_count INT NOT NULL,
  token_addresses TEXT[] NOT NULL, -- Array of submitted token addresses
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Index for rate limiting
CREATE INDEX IF NOT EXISTS idx_discovery_log_contributor_time
  ON discovery_submission_log(contributor_hash, submitted_at DESC);

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE pending_validations IS 'Queue for token discoveries awaiting validation';
COMMENT ON TABLE token_merge_history IS 'Audit trail of all token merges for transparency';
COMMENT ON TABLE source_weights IS 'Trust weights for different data sources (higher = more trusted)';
COMMENT ON TABLE crowdsourced_token_index IS 'Main index of validated crowdsourced tokens';
COMMENT ON TABLE discovery_submission_log IS 'Log of all discovery submissions for analytics and rate limiting';

COMMENT ON COLUMN pending_validations.priority IS 'Validation priority 0-10 (higher = validate first)';
COMMENT ON COLUMN pending_validations.contributor_hash IS 'Anonymous contributor identifier (SHA-256)';
COMMENT ON COLUMN token_merge_history.confidence_score IS 'Merge confidence 0-1 (higher = better quality)';
COMMENT ON COLUMN crowdsourced_token_index.discovery_count IS 'Number of times discovered by different users';
COMMENT ON COLUMN crowdsourced_token_index.confidence_score IS 'Overall confidence 0-1 based on source and discovery count';

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to update token discovery count
CREATE OR REPLACE FUNCTION increment_discovery_count(p_token_address VARCHAR(42))
RETURNS void AS $$
BEGIN
  INSERT INTO crowdsourced_token_index (
    token_address,
    name,
    symbol,
    decimals,
    type,
    source,
    confidence_score,
    first_discovered_at,
    last_discovered_at
  )
  VALUES (
    p_token_address,
    'Unknown Token',
    'TOKEN',
    18,
    'TOKEN',
    'pending',
    0.1,
    NOW(),
    NOW()
  )
  ON CONFLICT (token_address) DO UPDATE SET
    discovery_count = crowdsourced_token_index.discovery_count + 1,
    last_discovered_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_validation_queue_stats()
RETURNS TABLE (
  pending_count BIGINT,
  validating_count BIGINT,
  avg_priority DECIMAL,
  oldest_pending TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'validating')::BIGINT,
    AVG(priority) FILTER (WHERE status = 'pending'),
    MIN(submitted_at) FILTER (WHERE status = 'pending')
  FROM pending_validations;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Migration Complete
-- =====================================================
-- This migration should be applied to the database using:
-- psql -U your_user -d your_database -f 001_crowdsourced_discovery.sql
