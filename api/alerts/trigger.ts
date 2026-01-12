import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper to parse JSON body
async function parseBody(req: Request): Promise<any> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/alerts/trigger
// Logs a triggered alert event to the database
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { alertId, alertName, walletAddress, tokenAddress, tokenSymbol, transactionCount } = body;

    // Validate required fields
    if (!alertId || !alertName || !walletAddress) {
      return Response.json(
        { success: false, error: "Missing required fields: alertId, alertName, walletAddress" },
        { status: 400 }
      );
    }

    // Validate and sanitize wallet address
    const normalizedWallet = String(walletAddress).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      return Response.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
    }

    // Validate and sanitize alert ID
    const sanitizedAlertId = String(alertId).slice(0, 255);

    // Sanitize alert name
    const sanitizedName = String(alertName).slice(0, 255);

    // Validate and sanitize optional token address
    let normalizedTokenAddress = null;
    if (tokenAddress) {
      normalizedTokenAddress = String(tokenAddress).toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(normalizedTokenAddress)) {
        return Response.json({ success: false, error: "Invalid token address" }, { status: 400 });
      }
    }

    // Sanitize optional token symbol
    const sanitizedSymbol = tokenSymbol ? String(tokenSymbol).slice(0, 50) : null;

    // Sanitize transaction count
    const sanitizedTxCount = Math.max(1, parseInt(String(transactionCount)) || 1);

    // Get session ID from header if available
    const sessionId = req.headers.get("x-session-id") || null;

    // Insert triggered alert event
    await sql`
      INSERT INTO triggered_alerts (
        alert_id, alert_name, wallet_address, token_address, token_symbol,
        transaction_count, session_id, triggered_at, created_at
      )
      VALUES (
        ${sanitizedAlertId}, ${sanitizedName}, ${normalizedWallet},
        ${normalizedTokenAddress}, ${sanitizedSymbol}, ${sanitizedTxCount},
        ${sessionId}, NOW(), NOW()
      )
    `;

    console.log("[API /alerts/trigger] ✓ Logged triggered alert:", {
      alertId: sanitizedAlertId,
      alertName: sanitizedName,
      walletAddress: normalizedWallet,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API /alerts/trigger] Failed to log triggered alert:", error);
    // Don't fail the request - analytics shouldn't block the UI
    return Response.json({ success: true });
  }
}
