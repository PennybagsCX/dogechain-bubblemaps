import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClient } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { address, assetType, symbol, name } = req.body;

    // Validation
    if (!address || !assetType) {
      return res.status(400).json({ error: "Missing required fields: address and assetType" });
    }

    if (assetType !== "TOKEN" && assetType !== "NFT") {
      return res.status(400).json({ error: "assetType must be either TOKEN or NFT" });
    }

    const normalizedAddress = address.toLowerCase();
    const client = getClient();

    // Log to main table (trending_searches)
    await client.sql`
      INSERT INTO trending_searches (address, asset_type, symbol, name)
      VALUES (${normalizedAddress}, ${assetType}, ${symbol || null}, ${name || null})
      ON CONFLICT (address)
      DO UPDATE SET
        search_count = trending_searches.search_count + 1,
        updated_at = NOW(),
        symbol = COALESCE(EXCLUDED.symbol, trending_searches.symbol),
        name = COALESCE(EXCLUDED.name, trending_searches.name)
    `;

    // Log to time-series table (trending_search_history) with hour buckets
    await client.sql`
      INSERT INTO trending_search_history (address, hour_bucket, search_count)
      VALUES (
        ${normalizedAddress},
        date_trunc('hour', NOW()),
        1
      )
      ON CONFLICT (address, hour_bucket)
      DO UPDATE SET
        search_count = trending_search_history.search_count + 1
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Trending Log] Error:", error);
    return res
      .status(500)
      .json({
        error: "Failed to log search",
        details: error instanceof Error ? error.message : "Unknown error",
      });
  }
}
