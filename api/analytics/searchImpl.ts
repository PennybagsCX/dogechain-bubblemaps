/**
 * Analytics API Implementation for Neon PostgreSQL
 *
 * This file contains the actual database queries for Neon.
 * Copy the SQL queries to your Neon database console to create tables.
 */

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

// Initialize Neon with environment variable
const sql = neon(process.env.DATABASE_URL);

// Types
interface SearchEventRequest {
  sessionId: string;
  query: string;
  results: string[];
  resultCount: number;
  timestamp: number;
}

/**
 * Insert search event into Neon PostgreSQL
 */
async function insertSearchEventNeon(event: SearchEventRequest): Promise<boolean> {
  try {
    await sql`
      INSERT INTO search_events (session_id, query, results, result_count, timestamp)
      VALUES (${event.sessionId}, ${event.query}, ${JSON.stringify(event.results)}::jsonb, ${event.resultCount}, to_timestamp(${event.timestamp} / 1000.0))
    `;

    console.log("[Analytics] Search event saved to Neon:", event.query);
    return true;
  } catch (error) {
    console.error("[Analytics] Neon insert failed:", error);
    return false;
  }
}

// Vercel serverless function handler
export async function POST(request: NextRequest) {
  try {
    const body: SearchEventRequest = await request.json();

    // Validate
    if (!body.sessionId || !body.query || !body.results || !body.timestamp) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Insert into Neon
    const saved = await insertSearchEventNeon(body);

    return NextResponse.json({ success: true, saved }, { status: 200 });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export const config = {
  runtime: "nodejs",
};
