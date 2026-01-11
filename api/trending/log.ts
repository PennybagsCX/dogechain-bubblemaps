import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper to parse JSON body
async function parseBody(req: Request): Promise<any> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/trending/log
// Logs a search query and updates token popularity score
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { address, assetType, symbol, name } = body;

    // Validate required fields
    if (!address || !assetType) {
      return Response.json(
        { success: false, error: "Missing required fields: address, assetType" },
        { status: 400 }
      );
    }

    // Validate and sanitize token address
    const normalizedAddress = String(address).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return Response.json({ success: false, error: "Invalid token address" }, { status: 400 });
    }

    // Validate asset type
    const type = assetType === "NFT" ? "NFT" : "TOKEN";

    // Sanitize optional fields
    const sanitizedName = name ? String(name).slice(0, 255) : null;
    const sanitizedSymbol = symbol ? String(symbol).slice(0, 50) : null;

    // Check if token exists
    const existing = await sql`
      SELECT id, popularity_score FROM learned_tokens WHERE address = ${normalizedAddress}
    `;

    if (existing.length > 0) {
      // Update existing token: increment popularity score
      await sql`
        UPDATE learned_tokens
        SET
          name = COALESCE(${sanitizedName}, learned_tokens.name),
          symbol = COALESCE(${sanitizedSymbol}, learned_tokens.symbol),
          scan_frequency = learned_tokens.scan_frequency + 1,
          last_seen_at = NOW(),
          popularity_score = LEAST(100, learned_tokens.popularity_score + 2)
        WHERE address = ${normalizedAddress}
      `;
    } else {
      // Insert new token with initial popularity score
      await sql`
        INSERT INTO learned_tokens (
          address, name, symbol, type, source,
          discovery_timestamp, last_seen_at, scan_frequency, popularity_score
        )
        VALUES (
          ${normalizedAddress}, ${sanitizedName}, ${sanitizedSymbol}, ${type}, 'user_search',
          NOW(), NOW(), 1, 5
        )
      `;
    }

    // Also log to token_interactions for detailed analytics
    const sessionId = req.headers.get("x-session-id") || null;
    await sql`
      INSERT INTO token_interactions (
        token_address, interaction_type, session_id, created_at
      )
      VALUES (${normalizedAddress}, 'search', ${sessionId}, NOW())
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to log trending search:", error);
    // Don't fail the request - analytics shouldn't block the UI
    return Response.json({ success: true });
  }
}
