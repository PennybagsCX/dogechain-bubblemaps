-- User Alerts Schema for Dogechain Bubblemaps
-- This file sets up the tables needed for alert synchronization

-- Create user_alerts table
CREATE TABLE IF NOT EXISTS user_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_wallet_address TEXT NOT NULL,
    alert_id TEXT NOT NULL,
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    token_address TEXT,
    token_name TEXT,
    token_symbol TEXT,
    initial_value NUMERIC,
    type TEXT,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT user_alerts_unique UNIQUE (user_wallet_address, alert_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_alerts_wallet ON user_alerts(user_wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active);

-- Create triggered_alerts table for analytics
CREATE TABLE IF NOT EXISTS triggered_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_id TEXT NOT NULL,
    alert_name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    token_address TEXT,
    token_symbol TEXT,
    transaction_count INTEGER DEFAULT 1,
    session_id TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for triggered alerts
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_alert_id ON triggered_alerts(alert_id);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_session_id ON triggered_alerts(session_id);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_triggered_at ON triggered_alerts(triggerd_at);
