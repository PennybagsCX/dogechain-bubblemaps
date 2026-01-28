/**
 * Network Health API Endpoint
 *
 * Returns real-time Dogechain network metrics including:
 * - Block time and number
 * - Gas price
 * - TPS (transactions per second)
 * - Network congestion level
 * - Historical block data for charts
 */

import { DogechainRPCClient } from "../services/dogechainRPC";

// Simple in-memory cache
const CACHE_TTL = 10 * 1000; // 10 seconds
let cachedStats: any = null;
let cachedHistory: any = null;
let cacheTimestamp = 0;

// GET /api/network-health?history=100
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(
      req.url ||
        `https://${req.headers.get("host") || "localhost"}${req.headers.get("x-url") || "/api/network-health"}`
    );
    const historyCount = parseInt(url.searchParams.get("history") || "0");

    const now = Date.now();
    const needsRefresh = !cachedStats || now - cacheTimestamp > CACHE_TTL;

    const rpcClient = new DogechainRPCClient();

    if (needsRefresh) {
      // Fetch fresh data
      const [stats, history] = await Promise.all([
        rpcClient.getNetworkStats(),
        historyCount > 0 ? rpcClient.getHistoricalBlockData(Math.min(historyCount, 500)) : [],
      ]);

      cachedStats = stats;
      cachedHistory = history;
      cacheTimestamp = now;
    }

    // Return history if requested
    if (historyCount > 0) {
      return Response.json(
        {
          success: true,
          stats: cachedStats,
          history: cachedHistory,
          cached: !needsRefresh,
          timestamp: new Date(cacheTimestamp).toISOString(),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
          },
        }
      );
    }

    // Return stats only
    return Response.json(
      {
        success: true,
        ...cachedStats,
        cached: !needsRefresh,
        timestamp: new Date(cacheTimestamp).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
        },
      }
    );
  } catch (error) {
    console.error("[Network Health API] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch network health data",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
