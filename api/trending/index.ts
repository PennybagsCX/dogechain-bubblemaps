import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClient } from "@vercel/postgres";

// In-memory cache
let cachedTrending: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function calculateVelocityScore(recent: number, previous: number, allTime: number): number {
  const recentWeight = 0.6;
  const accelerationWeight = 0.3;
  const allTimeWeight = 0.1;

  // Calculate acceleration (growth rate)
  const acceleration = previous > 0 ? (recent - previous) / previous : recent > 0 ? 1 : 0;

  // Velocity score formula:
  // - Recent activity: 60%
  // - Acceleration: 30%
  // - All-time: 10%
  return (
    recent * recentWeight +
    acceleration * 100 * accelerationWeight +
    Math.log10(allTime + 1) * 10 * allTimeWeight
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const type = (req.query.type as string)?.toUpperCase() || "ALL";
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

    // Validate type parameter
    if (type !== "TOKEN" && type !== "NFT" && type !== "ALL") {
      return res.status(400).json({ error: "type must be TOKEN, NFT, or ALL" });
    }

    // Check cache
    const now = Date.now();
    if (cachedTrending && now - cacheTimestamp < CACHE_TTL) {
      const filtered =
        type === "ALL" ? cachedTrending : cachedTrending.filter((a) => a.asset_type === type);

      return res.status(200).json({
        assets: filtered.slice(0, limit),
        cached: true,
        timestamp: new Date(cacheTimestamp).toISOString(),
      });
    }

    const client = getClient();

    // Calculate time buckets for velocity calculation
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);

    // Fetch recent search data with velocity calculation
    const result = await client.sql`
      WITH recent_counts AS (
        SELECT
          address,
          COALESCE(SUM(search_count), 0) as recent_searches
        FROM trending_search_history
        WHERE hour_bucket >= ${threeHoursAgo}
        GROUP BY address
      ),
      previous_counts AS (
        SELECT
          address,
          COALESCE(SUM(search_count), 0) as previous_searches
        FROM trending_search_history
        WHERE hour_bucket >= ${sixHoursAgo} AND hour_bucket < ${threeHoursAgo}
        GROUP BY address
      )
      SELECT
        s.address,
        s.asset_type,
        s.symbol,
        s.name,
        s.search_count as total_searches,
        COALESCE(rc.recent_searches, 0) as recent_searches,
        COALESCE(pc.previous_searches, 0) as previous_searches
      FROM trending_searches s
      LEFT JOIN recent_counts rc ON s.address = rc.address
      LEFT JOIN previous_counts pc ON s.address = pc.address
      WHERE s.updated_at >= NOW() - INTERVAL '7 days'
      ORDER BY s.updated_at DESC
    `;

    // Calculate velocity scores and rank
    const assets = result.rows.map((row) => ({
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      type: row.asset_type,
      totalSearches: row.total_searches,
      recentSearches: row.recent_searches,
      previousSearches: row.previous_searches,
      velocityScore: calculateVelocityScore(
        row.recent_searches,
        row.previous_searches,
        row.total_searches
      ),
    }));

    // Sort by velocity score (descending) and assign ranks
    assets.sort((a, b) => b.velocityScore - a.velocityScore);
    assets.forEach((asset, index) => {
      (asset as any).rank = index + 1;
    });

    // Update cache
    cachedTrending = assets;
    cacheTimestamp = now;

    // Filter by type if requested
    const filtered = type === "ALL" ? assets : assets.filter((a) => a.type === type);

    return res.status(200).json({
      assets: filtered.slice(0, limit),
      cached: false,
      timestamp: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error("[Trending Get] Error:", error);

    // Return stale cache if available on error
    if (cachedTrending) {
      const type = (req.query.type as string)?.toUpperCase() || "ALL";
      const filtered =
        type === "ALL" ? cachedTrending : cachedTrending.filter((a) => a.asset_type === type);

      return res.status(200).json({
        assets: filtered.slice(0, 20),
        cached: true,
        stale: true,
        timestamp: new Date(cacheTimestamp).toISOString(),
      });
    }

    return res.status(500).json({
      error: "Failed to fetch trending",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
