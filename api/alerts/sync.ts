import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL ?? "");

// Helper to parse JSON body
async function parseBody(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/alerts/sync
// Performs bidirectional synchronization of alerts between client and server
// Handles conflict resolution using "last write wins" strategy based on created_at timestamp
export async function POST(req: Request): Promise<Response> {
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
