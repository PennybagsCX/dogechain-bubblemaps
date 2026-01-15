/**
 * Setup User Alerts Table
 *
 * Run this script to create the user_alerts table in PostgreSQL
 * Usage: node scripts/setup-user-alerts-table.js
 */

import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupUserAlertsTable() {
  console.log("[Setup] Creating user_alerts table for cross-device sync...");

  try {
    // Read and execute the migration SQL
    const migrationPath = join(
      __dirname,
      "../prisma/migrations/20260115090244_add_user_alerts_table/migration.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        await sql.unsafe(statement);
      }
    }

    console.log("[Setup] ✓ user_alerts table created");
    console.log("[Setup] ✓ Indexes created");
    console.log("[Setup] ✅ Setup complete!");
    console.log("\n[Setup] Table: user_alerts");
    console.log("[Setup] Purpose: Cross-device alert synchronization");
    console.log("[Setup] Storage: Neon PostgreSQL (free tier)");
  } catch (error) {
    console.error("[Setup] ❌ Error:", error);
    console.error(
      "\n[Setup] Hint: Make sure DATABASE_URL is set in .env.local"
    );
    process.exit(1);
  }
}

setupUserAlertsTable();
