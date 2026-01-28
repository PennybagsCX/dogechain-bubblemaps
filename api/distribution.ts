/**
 * Token Distribution Analytics API Endpoint
 *
 * Returns distribution analysis for a token including:
 * - Gini coefficient
 * - Concentration bands (top 1%, 5%, 10%, 25%)
 * - Distribution buckets
 * - Centralization status
 */

import { fetchTokenData } from "../services/dataService";
import { fetchDistributionAnalysis } from "../services/dataService";

// Simple in-memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// GET /api/distribution?address=0x...
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(
      req.url ||
        `https://${req.headers.get("host") || "localhost"}${req.headers.get("x-url") || "/api/distribution"}`
    );
    const tokenAddress = url.searchParams.get("address");

    if (!tokenAddress) {
      return Response.json(
        {
          success: false,
          error: "Token address is required",
        },
        { status: 400 }
      );
    }

    // Check cache
    const cached = cache.get(tokenAddress);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      return Response.json(
        {
          success: true,
          ...cached.data,
          cached: true,
          timestamp: new Date(cached.timestamp).toISOString(),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Fetch token data
    const token = await fetchTokenData(tokenAddress);

    if (!token) {
      return Response.json(
        {
          success: false,
          error: "Failed to fetch token data",
        },
        { status: 404 }
      );
    }

    // Calculate distribution analysis
    const analysis = await fetchDistributionAnalysis(token);

    if (!analysis) {
      return Response.json(
        {
          success: false,
          error: "Failed to calculate distribution analysis",
        },
        { status: 500 }
      );
    }

    // Cache the result
    cache.set(tokenAddress, { data: analysis, timestamp: now });

    return Response.json(
      {
        success: true,
        ...analysis,
        cached: false,
        timestamp: new Date(now).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[Distribution API] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch distribution data",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
