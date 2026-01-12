-- Migration: Create triggered_alerts table for server-side alert tracking
-- Created: 2026-01-12
-- Purpose: Track all triggered alert events across all users for aggregate statistics

-- Create triggered_alerts table
CREATE TABLE IF NOT EXISTS triggered_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255) NOT NULL,
  alert_name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42),
  token_symbol VARCHAR(50),
  transaction_count INTEGER NOT NULL DEFAULT 1,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  session_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_created_at ON triggered_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_wallet ON triggered_alerts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_alert_id ON triggered_alerts(alert_id);

-- Add comments for documentation
COMMENT ON TABLE triggered_alerts IS 'Stores all triggered alert events across all users for aggregate statistics and analytics';
COMMENT ON COLUMN triggered_alerts.alert_id IS 'Unique identifier for the alert configuration';
COMMENT ON COLUMN triggered_alerts.alert_name IS 'User-defined name for the alert';
COMMENT ON COLUMN triggered_alerts.wallet_address IS 'Monitored wallet address that triggered the alert';
COMMENT ON COLUMN triggered_alerts.token_address IS 'Optional specific token being monitored';
COMMENT ON COLUMN triggered_alerts.token_symbol IS 'Optional token symbol for display';
COMMENT ON COLUMN triggered_alerts.transaction_count IS 'Number of transactions in this triggered event';
COMMENT ON COLUMN triggered_alerts.triggered_at IS 'When the alert was triggered';
COMMENT ON COLUMN triggered_alerts.session_id IS 'Optional session identifier for analytics';
