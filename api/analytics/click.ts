/**
 * Vercel Serverless Function: Click Analytics
 *
 * Collects click events on search results for popularity scoring.
 *
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string (Neon PostgreSQL)
 *
 * API Endpoint: POST /api/analytics/click
 */

import { NextRequest, NextResponse } from "next/server";
import { insertClickEventNeon } from "./clickImpl";

// Types
interface ClickEventRequest {
  sessionId: string;
  query: string;
  clickedAddress: string;
  resultRank: number;
  resultScore: number;
  timeToClickMs: number;
  timestamp: number;
}

// PostgreSQL connection using Neon serverless driver
async function insertClickEvent(event: ClickEventRequest): Promise<boolean> {
  try {
    return await insertClickEventNeon(event);
  } catch (error) {
    console.error("[Analytics] Failed to insert click event:", error);
    return false;
  }
}

// Vercel serverless function handler
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ClickEventRequest = await request.json();

    // Validate required fields
    if (
      !body.sessionId ||
      !body.query ||
      !body.clickedAddress ||
      typeof body.resultRank !== "number" ||
      typeof body.timestamp !== "number"
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields: sessionId, query, clickedAddress, resultRank, timestamp",
        },
        { status: 400 }
      );
    }

    // Validate session ID format
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

    // Validate Ethereum address
    const addressRegex = /^0x[a-f0-9]{40}$/i;
    if (!addressRegex.test(body.clickedAddress)) {
      return NextResponse.json(
        { error: `Invalid Ethereum address: ${body.clickedAddress}` },
        { status: 400 }
      );
    }

    // Validate result rank
    if (body.resultRank < 0 || body.resultRank > 99) {
      return NextResponse.json({ error: "Invalid resultRank (must be 0-99)" }, { status: 400 });
    }

    // Validate result score
    if (typeof body.resultScore === "number" && (body.resultScore < 0 || body.resultScore > 100)) {
      return NextResponse.json({ error: "Invalid resultScore (must be 0-100)" }, { status: 400 });
    }

    // Validate time to click
    if (
      typeof body.timeToClickMs === "number" &&
      (body.timeToClickMs < 0 || body.timeToClickMs > 60000)
    ) {
      return NextResponse.json(
        { error: "Invalid timeToClickMs (must be 0-60000ms)" },
        { status: 400 }
      );
    }

    // Insert into database (async, non-blocking)
    const inserted = await insertClickEvent(body);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        saved: inserted,
        message: inserted ? "Click event recorded" : "Click event logged (database not configured)",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Analytics] Click API error:", error);

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
