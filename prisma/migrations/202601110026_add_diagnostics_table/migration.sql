-- Create diagnostics table for remote diagnostic logging
CREATE TABLE IF NOT EXISTS "diagnostic_logs" (
    "id" SERIAL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "user_agent" TEXT,
    "platform" TEXT,
    "vendor" TEXT,
    "is_arc_mobile" BOOLEAN DEFAULT FALSE,
    "is_arc" BOOLEAN DEFAULT FALSE,
    "is_mobile" BOOLEAN DEFAULT FALSE,
    "console_logs" JSONB,
    "token_searches" JSONB,
    "token_holder_fetches" JSONB,
    "errors" JSONB,
    "screen_resolution" TEXT,
    "viewport" TEXT,
    "network_status" TEXT,
    "language" TEXT,
    "url" TEXT,
    "received_at" TIMESTAMP DEFAULT NOW(),
    "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_diagnostic_logs_session_id" ON "diagnostic_logs"("session_id");

-- Create index on timestamp for retrieving recent logs
CREATE INDEX IF NOT EXISTS "idx_diagnostic_logs_timestamp" ON "diagnostic_logs"("timestamp" DESC);

-- Create index on received_at for cleanup queries
CREATE INDEX IF NOT EXISTS "idx_diagnostic_logs_received_at" ON "diagnostic_logs"("received_at");

-- Add comment
COMMENT ON TABLE "diagnostic_logs" IS 'Stores remote diagnostic logs from client applications for debugging';
