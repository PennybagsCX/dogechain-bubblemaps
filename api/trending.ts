import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/trending?type=TOKEN&limit=20
export async function GET(req: Request): Promise<Response> {
  try {
    // Handle Edge runtime where req.url might be empty
    const url = new URL(
      req.url ||
        `https://${req.headers.get("host") || "localhost"}${req.headers.get("x-url") || "/api/trending"}`
    );
    const type = url.searchParams.get("type") || "ALL";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

    let assets;

    if (type === "ALL") {
      assets = await sql`
        SELECT
          address,
          symbol,
          name,
          type,
          COALESCE(popularity_score, 0) as velocity_score,
          holder_count,
          source
        FROM learned_tokens
        ORDER BY popularity_score DESC NULLS LAST, last_seen_at DESC
        LIMIT ${limit.toString()}
      `;
    } else {
      assets = await sql`
        SELECT
          address,
          symbol,
          name,
          type,
          COALESCE(popularity_score, 0) as velocity_score,
          holder_count,
          source
        FROM learned_tokens
        WHERE type = ${type}
        ORDER BY popularity_score DESC NULLS LAST, last_seen_at DESC
        LIMIT ${limit.toString()}
      `;
    }

    return Response.json(
      {
        success: true,
        assets: assets,
        cached: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    // Return empty results instead of error
    return Response.json({
      success: true,
      assets: [],
      cached: false,
      timestamp: new Date().toISOString(),
    });
  }
}
