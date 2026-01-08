import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper to parse JSON body
async function parseBody(req: Request): Promise<any> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/interactions
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { tokenAddress, interactionType, sessionId, queryText, resultPosition } = body;

    if (!tokenAddress || !interactionType) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Validate interaction type
    if (!["search", "click", "select"].includes(interactionType)) {
      return Response.json({ success: false, error: "Invalid interaction type" }, { status: 400 });
    }

    // Validate and sanitize token address
    const address = String(tokenAddress).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return Response.json({ success: false, error: "Invalid token address" }, { status: 400 });
    }

    // Log interaction
    await sql`
      INSERT INTO token_interactions (
        token_address, interaction_type, session_id,
        query_text, result_position
      )
      VALUES (${address}, ${interactionType}, ${sessionId}, ${queryText}, ${resultPosition})
    `;

    // Update popularity score based on interaction
    const scoreIncrease = interactionType === "click" ? 3 : interactionType === "select" ? 5 : 1;

    await sql`
      UPDATE learned_tokens
      SET popularity_score = LEAST(100, popularity_score + ${scoreIncrease})
      WHERE address = ${address}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to log interaction:", error);
    // Don't fail the request - analytics shouldn't block the UI
    return Response.json({ success: true });
  }
}
