import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/trending?type=TOKEN&limit=20
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "ALL";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

    let assets;

    if (type === "ALL") {
      assets = await sql`
        SELECT * FROM trending_tokens
        ORDER BY popularity_score DESC
        LIMIT ${limit.toString()}
      `;
    } else {
      assets = await sql`
        SELECT * FROM trending_tokens
        WHERE type = ${type}
        ORDER BY popularity_score DESC
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
    console.error("[API] Failed to fetch trending:", error);

    // Return empty results instead of error
    return Response.json({
      success: true,
      assets: [],
      cached: false,
      timestamp: new Date().toISOString(),
    });
  }
}
