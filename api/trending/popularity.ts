/**
 * Vercel Serverless Function: Token Popularity
 *
 * Returns aggregate popularity metrics for tokens.
 *
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string (Neon PostgreSQL)
 *
 * API Endpoint: GET /api/trending/popularity?addresses[]=0x...
 *              POST /api/trending/popularity (for updates)
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenPopularityNeon, updatePopularityNeon } from "./popularityImpl";

// Types
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

// Get popularity metrics for tokens using Neon
async function getTokenPopularity(
  addresses: string[]
): Promise<Record<string, TokenPopularityData>> {
  try {
    return await getTokenPopularityNeon(addresses);
  } catch (error) {
    console.error("[Popularity] Failed to fetch popularity:", error);
    return {};
  }
}

// Update popularity metrics using Neon
async function updatePopularityMetrics(update: PopularityUpdateRequest): Promise<boolean> {
  try {
    return await updatePopularityNeon(update);
  } catch (error) {
    console.error("[Popularity] Failed to update popularity:", error);
    return false;
  }
}

// GET handler - Fetch popularity metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const addresses = searchParams.getAll("addresses[]");

    if (addresses.length === 0) {
      return NextResponse.json({ error: "Missing addresses parameter" }, { status: 400 });
    }

    if (addresses.length > 100) {
      return NextResponse.json({ error: "Too many addresses (max 100)" }, { status: 400 });
    }

    // Validate addresses
    const addressRegex = /^0x[a-f0-9]{40}$/i;
    for (const address of addresses) {
      if (!addressRegex.test(address)) {
        return NextResponse.json(
          { error: `Invalid Ethereum address: ${address}` },
          { status: 400 }
        );
      }
    }

    // Fetch popularity data
    const popularity = await getTokenPopularity(addresses);

    return NextResponse.json(popularity, { status: 200 });
  } catch (error) {
    console.error("[Popularity] GET error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST handler - Update popularity metrics
export async function POST(request: NextRequest) {
  try {
    const body: PopularityUpdateRequest = await request.json();

    // Validate required fields
    if (!body.tokenAddress || typeof body.timestamp !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: tokenAddress, timestamp" },
        { status: 400 }
      );
    }

    // Validate Ethereum address
    const addressRegex = /^0x[a-f0-9]{40}$/i;
    if (!addressRegex.test(body.tokenAddress)) {
      return NextResponse.json(
        { error: `Invalid Ethereum address: ${body.tokenAddress}` },
        { status: 400 }
      );
    }

    // Update popularity
    const updated = await updatePopularityMetrics(body);

    return NextResponse.json(
      {
        success: true,
        updated,
        message: updated ? "Popularity metrics updated" : "Update logged (database not configured)",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Popularity] POST error:", error);

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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Edge runtime config
export const config = {
  runtime: "nodejs",
};
