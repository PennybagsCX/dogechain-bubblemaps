/**
 * Merged Token Index Endpoint
 *
 * Vercel serverless function for fetching the crowdsourced token index.
 * Returns validated tokens from multiple sources with smart merging.
 *
 * GET /api/merged/tokens?type=TOKEN&since=1234567890
 */

import { NextRequest, NextResponse } from "next/server";
import { MergedTokensResponse } from "../lib/types";

// =====================================================
// REQUEST HANDLER
// =====================================================

/**
 * GET handler for fetching merged token index
 *
 * Query parameters:
 * - type: TOKEN or NFT (required)
 * - since: Timestamp for incremental updates (optional)
 * - limit: Max tokens to return (optional, default: 1000)
 *
 * @param request - HTTP request
 * @returns HTTP response
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "TOKEN";
    const since = searchParams.get("since");
    const limit = parseInt(searchParams.get("limit") || "1000", 10);

    // Validate type
    if (type !== "TOKEN" && type !== "NFT") {
      return NextResponse.json(
        {
          error: "Invalid type parameter. Must be TOKEN or NFT",
        },
        { status: 400 }
      );
    }

    // Validate limit
    if (limit < 1 || limit > 5000) {
      return NextResponse.json(
        {
          error: "Invalid limit parameter. Must be between 1 and 5000",
        },
        { status: 400 }
      );
    }

    // Get database connection
    const db = await getDatabaseConnection();

    // Build query
    let query = db`
      SELECT
        token_address as "tokenAddress",
        name,
        symbol,
        decimals,
        type,
        source,
        holder_count as "holderCount",
        is_verified as "isVerified",
        confidence_score as "confidenceScore",
        discovery_count as "discoveryCount",
        first_discovered_at as "firstDiscoveredAt",
        last_discovered_at as "lastDiscoveredAt",
        indexed_at as "indexedAt"
      FROM crowdsourced_token_index
      WHERE type = ${type}
    `;

    // Add since filter if provided
    if (since) {
      const sinceDate = new Date(parseInt(since, 10));
      query = db`${query} AND indexed_at > ${sinceDate}`;
    }

    // Add ordering and limit
    query = db`
      ${query}
      ORDER BY discovery_count DESC, confidence_score DESC, indexed_at DESC
      LIMIT ${limit}
    `;

    // Execute query
    const tokens = await query;

    // Build response
    const response: MergedTokensResponse = {
      tokens: tokens.map((t: any) => ({
        tokenAddress: t.tokenAddress,
        name: t.name,
        symbol: t.symbol,
        decimals: t.decimals,
        type: t.type,
        source: t.source,
        holderCount: t.holderCount,
        isVerified: t.isVerified,
        confidenceScore: parseFloat(t.confidenceScore),
        discoveryCount: t.discoveryCount,
        firstDiscoveredAt: t.firstDiscoveredAt,
        lastDiscoveredAt: t.lastDiscoveredAt,
        indexedAt: t.indexedAt,
      })),
      count: tokens.length,
      timestamp: new Date().toISOString(),
    };

    // Cache headers (5 minutes)
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "CDN-Cache-Control": "public, s-maxage=300",
    });

    return NextResponse.json(response, { status: 200, headers });
  } catch (error) {
    console.error("[Merged] Failed to fetch tokens:", error);

    // Return empty response on error (graceful degradation)
    const response: MergedTokensResponse = {
      tokens: [],
      count: 0,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  }
}

// =====================================================
// DATABASE CONNECTION
// =====================================================

/**
 * Get database connection
 * Implementation depends on your database setup
 *
 * @returns Database connection
 */
async function getDatabaseConnection() {
  // Example for Neon PostgreSQL:
  // const { neon } = await import('@neondatabase/serverless');
  // return neon(process.env.DATABASE_URL);

  // Placeholder - implement based on your setup
  throw new Error("Database connection not implemented");
}

// =====================================================
// EXPORTS
// =====================================================

// For Next.js App Router:
export { GET };

// For Vite/Vercel (as default export):
// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   if (req.method === 'GET') {
//     const request = req as any;
//     const response = await GET(request);
//     return res.status(response.status).json(response.body);
//   }
//   return res.status(405).json({ error: 'Method not allowed' });
// }
