-- Migration: Create user_alerts table for cross-device alert synchronization
-- Created: 2026-01-15
-- Purpose: Store user alert configurations on the server for cross-device sync and backup

-- Create user_alerts table
CREATE TABLE IF NOT EXISTS user_alerts (
  id SERIAL PRIMARY KEY,
  user_wallet_address VARCHAR(42) NOT NULL,
  alert_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42),
  token_name VARCHAR(255),
  token_symbol VARCHAR(50),
  initial_value NUMERIC,
  type VARCHAR(20) CHECK (type IN ('WALLET', 'TOKEN', 'WHALE')),
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_wallet_address, alert_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_alerts_wallet ON user_alerts(user_wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(user_wallet_address, is_active);
CREATE INDEX IF NOT EXISTS idx_user_alerts_alert_id ON user_alerts(alert_id);

-- Add comments for documentation
COMMENT ON TABLE user_alerts IS 'Stores user alert configurations for cross-device synchronization and backup';
COMMENT ON COLUMN user_alerts.id IS 'Primary key';
COMMENT ON COLUMN user_alerts.user_wallet_address IS 'Wallet address of the user who owns this alert';
COMMENT ON COLUMN user_alerts.alert_id IS 'Unique identifier for the alert configuration';
COMMENT ON COLUMN user_alerts.name IS 'User-defined name for the alert';
COMMENT ON COLUMN user_alerts.wallet_address IS 'Monitored wallet address';
COMMENT ON COLUMN user_alerts.token_address IS 'Optional specific token being monitored';
COMMENT ON COLUMN user_alerts.token_name IS 'Optional token name for display';
COMMENT ON COLUMN user_alerts.token_symbol IS 'Optional token symbol for display';
COMMENT ON COLUMN user_alerts.initial_value IS 'Initial balance/value for threshold calculations';
COMMENT ON COLUMN user_alerts.type IS 'Alert type: WALLET, TOKEN, or WHALE';
COMMENT ON COLUMN user_alerts.created_at IS 'Timestamp when alert was created (milliseconds since epoch)';
COMMENT ON COLUMN user_alerts.updated_at IS 'Timestamp of last update to this alert';
COMMENT ON COLUMN user_alerts.is_active IS 'Whether this alert is currently active';
