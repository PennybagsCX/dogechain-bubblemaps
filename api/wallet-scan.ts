import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper to parse JSON body
async function parseBody(req: Request): Promise<any> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

// POST /api/wallet-scan
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await parseBody(req);
    const { walletAddress, tokens, nfts } = body;

    if (!walletAddress || (!tokens && !nfts)) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Validate and sanitize wallet address
    const wallet = String(walletAddress).toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return Response.json({ success: false, error: "Invalid wallet address" }, { status: 400 });
    }

    // Combine tokens and NFTs
    const allAssets = [
      ...(tokens || []).map((t: any) => ({ ...t, type: "TOKEN" })),
      ...(nfts || []).map((n: any) => ({ ...n, type: "NFT" })),
    ];

    if (allAssets.length === 0) {
      return Response.json({
        success: true,
        message: "No assets to submit",
      });
    }

    let processedCount = 0;

    for (const asset of allAssets) {
      const address = asset.address?.toLowerCase();
      if (!address) continue;

      // Skip if address is invalid
      if (!/^0x[a-f0-9]{40}$/.test(address)) {
        continue;
      }

      const name = asset.name ? String(asset.name).slice(0, 255) : null;
      const symbol = asset.symbol ? String(asset.symbol).slice(0, 50) : null;
      const decimals = asset.decimals ? parseInt(asset.decimals) : 18;
      const type = asset.type === "NFT" ? "NFT" : "TOKEN";

      // Check if token exists
      const existing = await sql`SELECT id FROM learned_tokens WHERE address = ${address}`;

      if (existing.length > 0) {
        // Update existing token
        await sql`
          UPDATE learned_tokens
          SET
            name = COALESCE(${name}, learned_tokens.name),
            symbol = COALESCE(${symbol}, learned_tokens.symbol),
            decimals = COALESCE(${decimals}, learned_tokens.decimals),
            scan_frequency = learned_tokens.scan_frequency + 1,
            last_seen_at = NOW(),
            popularity_score = LEAST(100, learned_tokens.popularity_score + 2)
          WHERE address = ${address}
        `;
      } else {
        // Insert new token
        await sql`
          INSERT INTO learned_tokens (
            address, name, symbol, decimals, type, source,
            discovery_timestamp, last_seen_at, scan_frequency
          )
          VALUES (${address}, ${name}, ${symbol}, ${decimals}, ${type}, 'wallet_scan', NOW(), NOW(), 1)
        `;
      }

      // Record wallet contribution (skip if already exists)
      try {
        await sql`
          INSERT INTO wallet_scan_contributions (wallet_address, token_address)
          VALUES (${wallet}, ${address})
          ON CONFLICT (wallet_address, token_address) DO NOTHING
        `;
      } catch (error) {
        // Foreign key or unique constraint error - ignore
      }

      processedCount++;
    }

    return Response.json({
      success: true,
      processed: processedCount,
      wallet: wallet,
    });
  } catch (error) {
    return Response.json({ success: false, error: "Failed to submit scan" }, { status: 500 });
  }
}
