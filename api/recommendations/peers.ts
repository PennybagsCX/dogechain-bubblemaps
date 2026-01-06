/**
 * Vercel Serverless Function: Peer Recommendations
 *
 * Collaborative filtering: Find tokens frequently clicked by users who searched similar queries.
 *
 * Environment Variables Required:
 * - DATABASE_URL: PostgreSQL connection string (Neon PostgreSQL)
 *
 * Algorithm:
 * 1. Find searches with similar queries (using pg_trgm word similarity)
 * 2. Aggregate click events from those searches
 * 3. Rank by frequency and recency
 * 4. Return top N recommendations
 *
 * API Endpoint: GET /api/recommendations/peers?query=doge&type=TOKEN&limit=10
 */

import { NextRequest, NextResponse } from "next/server";
import { getPeerRecommendationsNeon } from "./peersImpl";

interface PeerRecommendationData {
  address: string;
  name: string;
  symbol: string;
  score: number;
  reason: string;
}

/**
 * Get peer recommendations from server using Neon
 */
async function getPeerRecommendationsFromServer(
  query: string,
  type: string,
  limit: number
): Promise<PeerRecommendationData[]> {
  try {
    return await getPeerRecommendationsNeon(query, type, limit);
  } catch (error) {
    console.error("[Peer Recommendations] Failed:", error);
    return [];
  }
}

// GET handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const type = searchParams.get("type") || "TOKEN";
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    // Validate parameters
    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Invalid query (min 2 characters)" }, { status: 400 });
    }

    if (query.length > 500) {
      return NextResponse.json({ error: "Query too long (max 500 characters)" }, { status: 400 });
    }

    if (limit < 1 || limit > 20) {
      return NextResponse.json({ error: "Invalid limit (must be 1-20)" }, { status: 400 });
    }

    if (type !== "TOKEN" && type !== "NFT") {
      return NextResponse.json({ error: "Invalid type (must be TOKEN or NFT)" }, { status: 400 });
    }

    // Get recommendations
    const recommendations = await getPeerRecommendationsFromServer(query, type, limit);

    return NextResponse.json(
      {
        recommendations,
        query,
        type,
        count: recommendations.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Peer Recommendations] GET error:", error);

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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Edge runtime config
export const config = {
  runtime: "nodejs",
};
