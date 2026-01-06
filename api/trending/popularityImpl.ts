/**
 * Token Popularity API Implementation for Neon PostgreSQL
 */

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

const sql = neon(process.env.DATABASE_URL);

interface TokenPopularityData {
  tokenAddress: string;
  searchCount: number;
  clickCount: number;
  ctr: number;
  lastSearched: number | null;
  lastClicked: number | null;
}

interface PopularityUpdateRequest {
  tokenAddress: string;
  appearedInResults: boolean;
  wasClicked: boolean;
  timestamp: number;
}

/**
 * Get popularity metrics from Neon
 */
async function getTokenPopularityNeon(
  addresses: string[]
): Promise<Record<string, TokenPopularityData>> {
  try {
    // Neon serverless doesn't support IN clause with array directly
    // We need to use `any` type for now
    const results = (await sql`
      SELECT
        token_address,
        search_count,
        click_count,
        COALESCE(ctr, 0) as ctr,
        EXTRACT(EPOCH FROM last_searched) * 1000 as last_searched,
        EXTRACT(EPOCH FROM last_clicked) * 1000 as last_clicked
      FROM token_popularity
      WHERE token_address = ANY(${addresses}::varchar[])
    `) as any[];

    const popularity: Record<string, TokenPopularityData> = {};

    for (const row of results) {
      popularity[row.token_address.toLowerCase()] = {
        tokenAddress: row.token_address,
        searchCount: row.search_count,
        clickCount: row.click_count,
        ctr: parseFloat(row.ctr),
        lastSearched: row.last_searched ? parseInt(row.last_searched) : null,
        lastClicked: row.last_clicked ? parseInt(row.last_clicked) : null,
      };
    }

    return popularity;
  } catch (error) {
    console.error("[Popularity] Neon query failed:", error);
    return {};
  }
}

/**
 * Update popularity metrics in Neon
 */
async function updatePopularityNeon(update: PopularityUpdateRequest): Promise<boolean> {
  try {
    await sql`
      INSERT INTO token_popularity (token_address, search_count, click_count, last_searched, last_clicked, updated_at)
      VALUES (${update.tokenAddress}, ${update.appearedInResults ? 1 : 0}, ${update.wasClicked ? 1 : 0}, to_timestamp(${update.timestamp} / 1000.0), to_timestamp(${update.timestamp} / 1000.0), NOW())
      ON CONFLICT (token_address) DO UPDATE SET
        search_count = token_popularity.search_count + ${update.appearedInResults ? 1 : 0},
        click_count = token_popularity.click_count + ${update.wasClicked ? 1 : 0},
        last_searched = CASE WHEN ${update.appearedInResults} THEN to_timestamp(${update.timestamp} / 1000.0) ELSE token_popularity.last_searched END,
        last_clicked = CASE WHEN ${update.wasClicked} THEN to_timestamp(${update.timestamp} / 1000.0) ELSE token_popularity.last_clicked END,
        updated_at = NOW()
    `;

    console.log("[Popularity] Updated in Neon:", update.tokenAddress);
    return true;
  } catch (error) {
    console.error("[Popularity] Neon update failed:", error);
    return false;
  }
}

// GET handler - Fetch popularity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const addresses = searchParams.getAll("addresses[]");

    if (addresses.length === 0 || addresses.length > 100) {
      return NextResponse.json(
        { error: addresses.length === 0 ? "Missing addresses" : "Too many addresses (max 100)" },
        { status: 400 }
      );
    }

    const popularity = await getTokenPopularityNeon(addresses);

    return NextResponse.json(popularity, { status: 200 });
  } catch (error) {
    console.error("[Popularity] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST handler - Update popularity
export async function POST(request: NextRequest) {
  try {
    const body: PopularityUpdateRequest = await request.json();

    if (!body.tokenAddress || typeof body.timestamp !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updated = await updatePopularityNeon(body);

    return NextResponse.json({ success: true, updated }, { status: 200 });
  } catch (error) {
    console.error("[Popularity] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export const config = {
  runtime: "nodejs",
};
