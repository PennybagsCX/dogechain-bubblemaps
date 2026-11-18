/**
 * GET /api/explorer-proxy — CORS-safe pass-through to the Chikyū blockscout API.
 *
 * Upstream shipped this as a chain-named proxy path bound to its own explorer host
 * (the rename is recorded in `docs/api-layer.md`). This fork forwards to the host in
 * `lib/chain.ts` (blockscout.testnet.dogeos.com) and keeps a strict module allow-list:
 * the host is fixed, so a caller can pick the query string but cannot turn this into a
 * generic fetcher.
 *
 * Cached for 60s under the chain namespace, so a redeploy against another chain cannot
 * serve a stale body from these keys.
 */

import { Router, type Request, type Response } from "express";
import { CACHE_NAMESPACE, cacheKey, readCache, writeCache } from "../lib/cache";
import { explorerProxy, redact } from "../lib/chainData";
import { unavailablePayload } from "../lib/unavailable";

const PROXY_TTL_MS = 60_000;

/** Etherscan-compatible modules the blockscout instance serves; everything else is rejected. */
const ALLOWED_MODULES = new Set([
  "account",
  "block",
  "contract",
  "logs",
  "nft",
  "proxy",
  "stats",
  "token",
  "transaction",
]);

function flattenQuery(query: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") params.append(key, item);
      }
    }
  }
  return params;
}

const router = Router();

router.get("/explorer-proxy", async (req: Request, res: Response) => {
  const params = flattenQuery(req.query as Record<string, unknown>);
  const moduleName = params.get("module");
  if (!moduleName) {
    res.status(400).json({ success: false, error: "module query parameter is required" });
    return;
  }
  if (!ALLOWED_MODULES.has(moduleName)) {
    res.status(400).json({
      success: false,
      error: `Unsupported module: ${moduleName}`,
      allowed: [...ALLOWED_MODULES].sort(),
    });
    return;
  }

  const query = params.toString();
  const key = cacheKey("explorer-proxy", { query });
  res.setHeader("x-cache-namespace", CACHE_NAMESPACE);

  const cached = readCache<unknown>(key);
  if (cached) {
    res.setHeader("x-cache", "hit");
    res.json(cached.value);
    return;
  }

  try {
    const result = await explorerProxy(query);
    writeCache(key, result.body, PROXY_TTL_MS);
    res.setHeader("x-cache", "miss");
    res.json(result.body);
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    res.status(502).json({ success: false, ...unavailablePayload("explorer-upstream", message) });
  }
});

export default router;
