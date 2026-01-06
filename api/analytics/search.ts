/**
 * Vercel Serverless Function: Search Analytics
 *
 * Collects search query events from all users for aggregate learning.
 *
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string (Neon PostgreSQL)
 *
 * API Endpoint: POST /api/analytics/search
 */

import { NextRequest, NextResponse } from "next/server";
import { insertSearchEventNeon } from "./searchImpl";

// Types
interface SearchEventRequest {
  sessionId: string;
  query: string;
  results: string[]; // Token addresses
  resultCount: number;
  timestamp: number;
}

// PostgreSQL connection using Neon serverless driver
async function insertSearchEvent(event: SearchEventRequest): Promise<boolean> {
  try {
    return await insertSearchEventNeon(event);
  } catch (error) {
    console.error("[Analytics] Failed to insert search event:", error);
    return false;
  }
}

// Vercel serverless function handler
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SearchEventRequest = await request.json();

    // Validate required fields
    if (!body.sessionId || !body.query || !body.results || !body.timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, query, results, timestamp" },
        { status: 400 }
      );
    }

    // Validate session ID format (64-char hex)
    if (!/^[a-f0-9]{64}$/i.test(body.sessionId)) {
      return NextResponse.json(
        { error: "Invalid sessionId format (expected 64-char hex)" },
        { status: 400 }
      );
    }

    // Validate query length
    if (body.query.length > 500) {
      return NextResponse.json({ error: "Query too long (max 500 characters)" }, { status: 400 });
    }

    // Validate results array
    if (!Array.isArray(body.results) || body.results.length > 100) {
      return NextResponse.json(
        { error: "Invalid results array (max 100 addresses)" },
        { status: 400 }
      );
    }

    // Validate Ethereum addresses
    const addressRegex = /^0x[a-f0-9]{40}$/i;
    for (const address of body.results) {
      if (!addressRegex.test(address)) {
        return NextResponse.json(
          { error: `Invalid Ethereum address: ${address}` },
          { status: 400 }
        );
      }
    }

    // Insert into database (async, non-blocking)
    const inserted = await insertSearchEvent(body);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        saved: inserted,
        message: inserted
          ? "Search event recorded"
          : "Search event logged (database not configured)",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Analytics] Search API error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
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

// Edge runtime config (optional)
export const config = {
  runtime: "nodejs", // or "edge" for edge runtime
};
