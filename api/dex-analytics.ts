/**
 * DEX Analytics API Endpoint
 *
 * Returns DEX liquidity pool analytics including:
 * - Top pools by TVL
 * - New pools (recently created)
 * - Factory distribution
 */

import {
  getTopPoolsByTVL,
  getNewPools,
  getFactoryDistribution,
  PoolStats,
  FactoryStats,
} from "../services/lpDetection";

// Simple in-memory cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedTVL: PoolStats[] = [];
let cachedNew: PoolStats[] = [];
let cachedFactory: FactoryStats[] = [];
let cacheTimestamp = 0;

// GET /api/dex-analytics?type=tvl|new|factory
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(
      req.url ||
        `https://${req.headers.get("host") || "localhost"}${req.headers.get("x-url") || "/api/dex-analytics"}`
    );
    const type = url.searchParams.get("type") || "tvl";

    const now = Date.now();
    const needsRefresh = now - cacheTimestamp > CACHE_TTL;

    if (needsRefresh) {
      // Fetch fresh data
      const [tvl, newPools, factory] = await Promise.all([
        getTopPoolsByTVL(50),
        getNewPools(24 * 60 * 60 * 1000), // Last 24 hours
        getFactoryDistribution(),
      ]);

      cachedTVL = tvl;
      cachedNew = newPools;
      cachedFactory = factory;
      cacheTimestamp = now;
    }

    let data;
    switch (type) {
      case "tvl":
        data = { pools: cachedTVL };
        break;
      case "new":
        data = { pools: cachedNew };
        break;
      case "factory":
        data = { factories: cachedFactory };
        break;
      default:
        return Response.json(
          {
            success: false,
            error: "Invalid type. Must be one of: tvl, new, factory",
          },
          { status: 400 }
        );
    }

    return Response.json(
      {
        success: true,
        ...data,
        cached: !needsRefresh,
        timestamp: new Date(cacheTimestamp).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[DEX Analytics API] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch DEX analytics data",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
