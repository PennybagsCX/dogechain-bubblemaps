import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

// Helper to parse JSON body
async function parseBody(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// Consolidated alert API handler
// Routes:
// - GET/DELETE /api/alerts?wallet=xxx&alertId=xxx (fetch/delete user alerts)
// - POST /api/alerts (create/update user alert)
// - POST /api/alerts?action=trigger (log triggered alert event)
// - POST /api/alerts?action=sync (bidirectional sync)
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Check if this is a trigger request
  if (url.pathname.endsWith("/trigger")) {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  // Check if this is a sync request
  if (url.pathname.endsWith("/sync")) {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  // Handle GET /api/alerts (fetch user alerts)
  return handleGetUserAlerts(req, url);
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Get action from query parameter for single-file routing
  const action = url.searchParams.get("action");

  // Route to appropriate handler based on URL path or action parameter
  if (url.pathname.endsWith("/trigger") || action === "trigger") {
    return handleTriggerAlert(req);
  }

  if (url.pathname.endsWith("/sync") || action === "sync") {
    return handleSyncAlerts(req);
  }

  // Handle POST /api/alerts (create/update user alert)
  return handlePostUserAlert(req);
}

export async function DELETE(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Only handle DELETE for user alerts
  if (url.pathname.endsWith("/trigger") || url.pathname.endsWith("/sync")) {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  // Handle DELETE /api/alerts (soft delete user alert)
  return handleDeleteUserAlert(req, url);
}

// Handler functions for each route

async function handleGetUserAlerts(_req: Request, url: URL): Promise<Response> {
  try {
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

async function handlePostUserAlert(req: Request): Promise<Response> {
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

async function handleDeleteUserAlert(_req: Request, url: URL): Promise<Response> {
  try {
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

async function handleTriggerAlert(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { alertId, alertName, walletAddress, tokenAddress, tokenSymbol, transactionCount } =
      body as {
        alertId?: unknown;
        alertName?: unknown;
        walletAddress?: unknown;
        tokenAddress?: unknown;
        tokenSymbol?: unknown;
        transactionCount?: unknown;
      };

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

    return Response.json({ success: true });
  } catch {
    // Don't fail the request - analytics shouldn't block the UI
    return Response.json({ success: true });
  }
}

async function handleSyncAlerts(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { walletAddress, localAlerts } = body as {
      walletAddress?: unknown;
      localAlerts?: unknown;
    };

    // Validate required fields
    if (!walletAddress) {
      return Response.json(
        { success: false, error: "Missing required field: walletAddress" },
        { status: 400 }
      );
    }

    // Validate and sanitize wallet address
    const normalizedWallet = String(walletAddress).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      return Response.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
    }

    // Parse local alerts if provided
    const alerts = Array.isArray(localAlerts) ? localAlerts : [];

    // Fetch server alerts for this user
    const serverAlerts = await sql`
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

    // Convert server alerts to a map for easy lookup
    const serverAlertsMap = new Map<string, (typeof serverAlerts)[0]>();
    for (const alert of serverAlerts) {
      serverAlertsMap.set(alert.alert_id, alert);
    }

    // Track changes
    const toUpload: typeof alerts = [];
    const toDownload: typeof serverAlerts = [];
    const conflicts: Array<{ local: (typeof alerts)[0]; remote: (typeof serverAlerts)[0] }> = [];

    // Process local alerts
    for (const localAlert of alerts) {
      const alert = localAlert as {
        alertId: string;
        name: string;
        walletAddress: string;
        tokenAddress?: string;
        tokenName?: string;
        tokenSymbol?: string;
        initialValue?: number;
        type?: string;
        createdAt: number;
      };

      const serverAlert = serverAlertsMap.get(alert.alertId);

      if (!serverAlert) {
        // Alert doesn't exist on server - upload it
        toUpload.push(alert);
      } else {
        // Alert exists on both - check for conflicts
        const localCreatedAt = Number(alert.createdAt);
        const serverCreatedAt = Number(serverAlert.created_at);

        if (localCreatedAt > serverCreatedAt) {
          // Local version is newer - upload it
          toUpload.push(alert);
        } else if (localCreatedAt < serverCreatedAt) {
          // Server version is newer - download it
          toDownload.push(serverAlert);
        }
        // If timestamps are equal, assume no changes needed
      }
    }

    // Find alerts that exist on server but not locally
    const localAlertIds = new Set(alerts.map((a) => (a as { alertId: string }).alertId));
    for (const serverAlert of serverAlerts) {
      if (!localAlertIds.has(serverAlert.alert_id)) {
        toDownload.push(serverAlert);
      }
    }

    // Upload new/updated local alerts to server
    for (const alert of toUpload) {
      const a = alert as {
        alertId: string;
        name: string;
        walletAddress: string;
        tokenAddress?: string;
        tokenName?: string;
        tokenSymbol?: string;
        initialValue?: number;
        type?: string;
        createdAt: number;
      };

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
          ${normalizedWallet},
          ${String(a.alertId).slice(0, 255)},
          ${String(a.name).slice(0, 255)},
          ${String(a.walletAddress).toLowerCase()},
          ${a.tokenAddress ? String(a.tokenAddress).toLowerCase() : null},
          ${a.tokenName ? String(a.tokenName).slice(0, 255) : null},
          ${a.tokenSymbol ? String(a.tokenSymbol).slice(0, 50) : null},
          ${a.initialValue ? Number(a.initialValue) : null},
          ${a.type && ["WALLET", "TOKEN", "WHALE"].includes(String(a.type)) ? String(a.type) : null},
          ${Number(a.createdAt)},
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
    }

    return Response.json({
      success: true,
      syncTimestamp: Date.now(),
      uploaded: toUpload.length,
      downloaded: toDownload.length,
      conflicts: conflicts.length,
      data: toDownload,
    });
  } catch (error) {
    console.error("[API] Error during sync:", error);
    return Response.json(
      {
        success: false,
        error: "Sync failed",
        data: [],
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
      },
      { status: 500 }
    );
  }
}
