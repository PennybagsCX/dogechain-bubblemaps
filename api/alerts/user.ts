import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

// Helper to parse JSON body
async function parseBody(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// GET /api/alerts/user
// Fetches all alerts for a specific user wallet address
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");

    // Validate wallet address parameter
    if (!walletAddress) {
      return Response.json(
        { success: false, error: "Missing required parameter: wallet" },
        { status: 400 }
      );
    }

    // Validate and sanitize wallet address
    const normalizedWallet = walletAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      return Response.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
    }

    // Fetch all active alerts for this user
    const alerts = await sql`
      SELECT
        id,
        user_wallet_address,
        alert_id,
        name,
        wallet_address,
        token_address,
        token_name,
        token_symbol,
        initial_value,
        type,
        created_at,
        updated_at,
        is_active
      FROM user_alerts
      WHERE user_wallet_address = ${normalizedWallet}
        AND is_active = true
      ORDER BY created_at DESC
    `;

    return Response.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("[API] Error fetching user alerts:", error);
    return Response.json(
      { success: false, error: "Failed to fetch alerts", data: [] },
      { status: 500 }
    );
  }
}

// POST /api/alerts/user
// Creates or updates an alert for a user
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const {
      walletAddress,
      alertId,
      name,
      monitoredWallet,
      tokenAddress,
      tokenName,
      tokenSymbol,
      initialValue,
      type,
      createdAt,
    } = body as {
      walletAddress?: unknown;
      alertId?: unknown;
      name?: unknown;
      monitoredWallet?: unknown;
      tokenAddress?: unknown;
      tokenName?: unknown;
      tokenSymbol?: unknown;
      initialValue?: unknown;
      type?: unknown;
      createdAt?: unknown;
    };

    // Validate required fields
    if (!walletAddress || !alertId || !name || !monitoredWallet) {
      return Response.json(
        {
          success: false,
          error: "Missing required fields: walletAddress, alertId, name, monitoredWallet",
        },
        { status: 400 }
      );
    }

    // Validate and sanitize user wallet address
    const normalizedUserWallet = String(walletAddress).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedUserWallet)) {
      return Response.json(
        { success: false, error: "Invalid user wallet address" },
        { status: 400 }
      );
    }

    // Validate and sanitize monitored wallet address
    const normalizedMonitoredWallet = String(monitoredWallet).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedMonitoredWallet)) {
      return Response.json(
        { success: false, error: "Invalid monitored wallet address" },
        { status: 400 }
      );
    }

    // Sanitize alert ID
    const sanitizedAlertId = String(alertId).slice(0, 255);

    // Sanitize name
    const sanitizedName = String(name).slice(0, 255);

    // Validate and sanitize optional token address
    let normalizedTokenAddress = null;
    if (tokenAddress) {
      normalizedTokenAddress = String(tokenAddress).toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(normalizedTokenAddress)) {
        return Response.json({ success: false, error: "Invalid token address" }, { status: 400 });
      }
    }

    // Sanitize optional fields
    const sanitisedTokenName = tokenName ? String(tokenName).slice(0, 255) : null;
    const sanitisedTokenSymbol = tokenSymbol ? String(tokenSymbol).slice(0, 50) : null;
    const sanitisedInitialValue = initialValue ? Number(initialValue) : null;

    // Validate type if provided
    const validTypes = ["WALLET", "TOKEN", "WHALE"];
    const sanitisedType = type && validTypes.includes(String(type)) ? String(type) : null;

    // Sanitize created_at timestamp
    const sanitisedCreatedAt = createdAt ? Number(createdAt) : Date.now();

    // Upsert the alert (insert or update if exists)
    await sql`
      INSERT INTO user_alerts (
        user_wallet_address,
        alert_id,
        name,
        wallet_address,
        token_address,
        token_name,
        token_symbol,
        initial_value,
        type,
        created_at,
        updated_at,
        is_active
      )
      VALUES (
        ${normalizedUserWallet},
        ${sanitizedAlertId},
        ${sanitizedName},
        ${normalizedMonitoredWallet},
        ${normalizedTokenAddress},
        ${sanitisedTokenName},
        ${sanitisedTokenSymbol},
        ${sanitisedInitialValue},
        ${sanitisedType},
        ${sanitisedCreatedAt},
        NOW(),
        true
      )
      ON CONFLICT (user_wallet_address, alert_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        wallet_address = EXCLUDED.wallet_address,
        token_address = EXCLUDED.token_address,
        token_name = EXCLUDED.token_name,
        token_symbol = EXCLUDED.token_symbol,
        initial_value = EXCLUDED.initial_value,
        type = EXCLUDED.type,
        updated_at = NOW(),
        is_active = true
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Error creating/updating alert:", error);
    return Response.json({ success: false, error: "Failed to save alert" }, { status: 500 });
  }
}

// DELETE /api/alerts/user
// Soft deletes an alert for a user (sets is_active to false)
export async function DELETE(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");
    const alertId = url.searchParams.get("alertId");

    // Validate required parameters
    if (!walletAddress || !alertId) {
      return Response.json(
        { success: false, error: "Missing required parameters: wallet, alertId" },
        { status: 400 }
      );
    }

    // Validate and sanitize wallet address
    const normalizedWallet = walletAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      return Response.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
    }

    // Sanitize alert ID
    const sanitizedAlertId = String(alertId).slice(0, 255);

    // Soft delete the alert
    await sql`
      UPDATE user_alerts
      SET is_active = false, updated_at = NOW()
      WHERE user_wallet_address = ${normalizedWallet}
        AND alert_id = ${sanitizedAlertId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting alert:", error);
    return Response.json({ success: false, error: "Failed to delete alert" }, { status: 500 });
  }
}
