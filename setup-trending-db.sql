-- ============================================
-- Server-Side Trending Database Schema
-- Run this in your Neon SQL Editor
-- ============================================

-- Primary table for asset tracking
CREATE TABLE trending_searches (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  symbol VARCHAR(100),
  name VARCHAR(255),
  search_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT address_unique UNIQUE (address)
);

-- Time-series table for velocity calculation (hourly buckets)
CREATE TABLE trending_search_history (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  hour_bucket TIMESTAMP NOT NULL,
  search_count INTEGER DEFAULT 1,
  CONSTRAINT address_hour_unique UNIQUE (address, hour_bucket)
);

-- Performance indexes
CREATE INDEX idx_searches_address ON trending_searches(address);
CREATE INDEX idx_searches_asset_type ON trending_searches(asset_type);
CREATE INDEX idx_searches_updated_at ON trending_searches(updated_at DESC);
CREATE INDEX idx_searches_search_count ON trending_searches(search_count DESC);
CREATE INDEX idx_history_address ON trending_search_history(address);
CREATE INDEX idx_history_hour_bucket ON trending_search_history(hour_bucket DESC);
CREATE INDEX idx_history_address_hour ON trending_search_history(address, hour_bucket DESC);

-- Success! Tables created.
