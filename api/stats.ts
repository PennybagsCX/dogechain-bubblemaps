import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET /api/stats
// Returns aggregated statistics about searches and alerts
export async function GET(_req: Request): Promise<Response> {
  try {
    // Get total searches from token_interactions table
    const searchResult = await sql`
      SELECT COUNT(*) as count
      FROM token_interactions
      WHERE interaction_type = 'search'
    `;
    const totalSearches = parseInt(searchResult[0]?.count || "0");

    // Get total triggered alerts
    const alertResult = await sql`
      SELECT COUNT(*) as count
      FROM triggered_alerts
    `;
    const totalAlerts = parseInt(alertResult[0]?.count || "0");

    // Return statistics with cache headers
    return Response.json(
      { searches: totalSearches, alerts: totalAlerts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    // Return zeros on error (graceful degradation)
    return Response.json(
      { searches: 0, alerts: 0 },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        },
      }
    );
  }
}
