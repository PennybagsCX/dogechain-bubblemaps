/**
 * Setup Diagnostics Table
 *
 * Run this script to create the diagnostic_logs table in PostgreSQL
 * Usage: node scripts/setup-diagnostics-table.js
 */

import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

// Load environment variables
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

async function setupDiagnosticsTable() {
  console.log("[Setup] Creating diagnostic_logs table...");

  try {
    // Create the diagnostics table
    await sql`
      CREATE TABLE IF NOT EXISTS diagnostic_logs (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        user_agent TEXT,
        platform TEXT,
        vendor TEXT,
        is_arc_mobile BOOLEAN DEFAULT FALSE,
        is_arc BOOLEAN DEFAULT FALSE,
        is_mobile BOOLEAN DEFAULT FALSE,
        console_logs JSONB,
        token_searches JSONB,
        token_holder_fetches JSONB,
        errors JSONB,
        screen_resolution TEXT,
        viewport TEXT,
        network_status TEXT,
        language TEXT,
        url TEXT,
        received_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log("[Setup] ✓ Table created");

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_diagnostic_logs_session_id
      ON diagnostic_logs(session_id)
    `;
    console.log("[Setup] ✓ Index on session_id created");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_diagnostic_logs_timestamp
      ON diagnostic_logs(timestamp DESC)
    `;
    console.log("[Setup] ✓ Index on timestamp created");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_diagnostic_logs_received_at
      ON diagnostic_logs(received_at)
    `;
    console.log("[Setup] ✓ Index on received_at created");

    console.log("[Setup] ✅ Setup complete!");
  } catch (error) {
    console.error("[Setup] ❌ Error:", error);
    process.exit(1);
  }
}

setupDiagnosticsTable();
