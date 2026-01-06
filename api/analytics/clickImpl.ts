/**
 * Click Analytics API Implementation for Neon PostgreSQL
 */

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL);

interface ClickEventRequest {
  sessionId: string;
  query: string;
  clickedAddress: string;
  resultRank: number;
  resultScore: number;
  timeToClickMs: number;
  timestamp: number;
}

/**
 * Insert click event into Neon PostgreSQL
 */
async function insertClickEventNeon(event: ClickEventRequest): Promise<boolean> {
  try {
    await sql`
      INSERT INTO click_events (session_id, query, clicked_address, result_rank, result_score, time_to_click_ms, timestamp)
      VALUES (${event.sessionId}, ${event.query}, ${event.clickedAddress}, ${event.resultRank}, ${event.resultScore}, ${event.timeToClickMs}, to_timestamp(${event.timestamp} / 1000.0))
    `;

    console.log("[Analytics] Click event saved to Neon:", event.clickedAddress);
    return true;
  } catch (error) {
    console.error("[Analytics] Neon insert failed:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ClickEventRequest = await request.json();

    // Validate
    if (!body.sessionId || !body.query || !body.clickedAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const saved = await insertClickEventNeon(body);

    return NextResponse.json({ success: true, saved }, { status: 200 });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
