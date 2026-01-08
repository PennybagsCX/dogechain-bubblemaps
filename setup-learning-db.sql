-- Learning Search System Database Schema
-- Run this script in Vercel Postgres to set up the learning search system

-- Core learned tokens table
CREATE TABLE IF NOT EXISTS learned_tokens (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(255),
  symbol VARCHAR(50),
  decimals INTEGER DEFAULT 18,
  type VARCHAR(10) NOT NULL CHECK (type IN ('TOKEN', 'NFT')),

  -- Analytics metrics
  scan_frequency INTEGER DEFAULT 1,
  holder_count INTEGER DEFAULT 1,
  discovery_timestamp TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  popularity_score DECIMAL(5,2) DEFAULT 1.00,

  -- Metadata
  source VARCHAR(50) DEFAULT 'wallet_scan',
  is_verified BOOLEAN DEFAULT FALSE,

  CONSTRAINT valid_address CHECK (address ~ '^0x[a-f0-9]{40}$')
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_learned_tokens_address ON learned_tokens(address);
CREATE INDEX IF NOT EXISTS idx_learned_tokens_type ON learned_tokens(type);
CREATE INDEX IF NOT EXISTS idx_learned_tokens_popularity ON learned_tokens(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_learned_tokens_symbol ON learned_tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_learned_tokens_name ON learned_tokens(name);

-- Token search interactions (for click-through rate)
CREATE TABLE IF NOT EXISTS token_interactions (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('search', 'click', 'select')),
  session_id VARCHAR(64),
  query_text VARCHAR(255),
  result_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_token_address
    FOREIGN KEY (token_address)
    REFERENCES learned_tokens(address)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_interactions_token ON token_interactions(token_address);
CREATE INDEX IF NOT EXISTS idx_token_interactions_type ON token_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_token_interactions_created ON token_interactions(created_at DESC);

-- Wallet scan contributions (tracks which wallets contributed which tokens)
CREATE TABLE IF NOT EXISTS wallet_scan_contributions (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_wallet_token_address
    FOREIGN KEY (token_address)
    REFERENCES learned_tokens(address)
    ON DELETE CASCADE,

  UNIQUE(wallet_address, token_address)
);

CREATE INDEX IF NOT EXISTS idx_wallet_scan_wallet ON wallet_scan_contributions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_scan_token ON wallet_scan_contributions(token_address);

-- Materialized view for trending tokens (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_tokens AS
SELECT
  lt.address,
  lt.symbol,
  lt.name,
  lt.type,
  lt.popularity_score,
  COUNT(DISTINCT wsc.wallet_address) as unique_holders,
  COUNT(ti.id) FILTER (WHERE ti.interaction_type = 'search') as search_count,
  COUNT(ti.id) FILTER (WHERE ti.interaction_type = 'click') as click_count,
  ROUND(
    100.0 * (
      COUNT(ti.id) FILTER (WHERE ti.interaction_type = 'click')::NUMERIC /
      NULLIF(COUNT(ti.id) FILTER (WHERE ti.interaction_type = 'search'), 0)
    ), 2
  ) as click_through_rate,
  lt.last_seen_at
FROM learned_tokens lt
LEFT JOIN wallet_scan_contributions wsc ON lt.address = wsc.token_address
LEFT JOIN token_interactions ti ON lt.address = ti.token_address
  AND ti.created_at > NOW() - INTERVAL '7 days'
GROUP BY lt.address, lt.symbol, lt.name, lt.type, lt.popularity_score, lt.last_seen_at
ORDER BY lt.popularity_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_tokens_address ON trending_tokens(address);

-- Function to refresh trending tokens
CREATE OR REPLACE FUNCTION refresh_trending_tokens()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_tokens;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_vercel_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_vercel_user;
