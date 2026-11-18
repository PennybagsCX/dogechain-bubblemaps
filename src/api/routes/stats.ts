/**
 * GET /api/stats — live Chikyū chain counters plus the tallies this fork actually has.
 *
 * Real: block height (JSON-RPC), chain id (JSON-RPC, asserted to be Chikyū), the
 * blockscout counters for blocks/transactions/addresses, and the number of alert
 * triggers the fork database has recorded.
 *
 * Not real: the "total searches" counter. It came from an analytics table
 * (`token_interactions`) that is not part of this fork's schema, so it is reported as
 * `searches: null` with an explicit `unavailable` entry — the UI renders "—", never "0".
 */

import { Router } from "express";
import { CHAIN_ID } from "../../../lib/chain";
import {
  CACHE_NAMESPACE,
  cacheInfo,
  cacheKey,
  clearCache,
  readCache,
  writeCache,
} from "../lib/cache";
import {
  chainIdentity,
  getBlockNumber,
  getExplorerStats,
  getRpcChainId,
  redact,
  UpstreamError,
  type ExplorerStats,
} from "../lib/chainData";
import { getPrisma, isDatabaseConfigured } from "../lib/db";
import { TESTNET_LABEL, unavailablePayload, type UnavailablePayload } from "../lib/unavailable";

/** Mirrors the client's 10s near-real-time stats TTL (hooks/useStatsCounters.ts). */
const STATS_TTL_MS = 10_000;

export interface StatsPayload {
  chain: typeof chainIdentity;
  blockNumber: number;
  explorer: ExplorerStats;
  /** Triggered-alert rows recorded in the fork database; null when the DB is unavailable. */
  alerts: number | null;
  /** No analytics store on this chain — always null, with the reason in `unavailable`. */
  searches: null;
  unavailable: {
    searches: UnavailablePayload;
    alerts?: UnavailablePayload;
  };
  timestamp: string;
}

async function countTriggeredAlerts(): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    return await getPrisma().triggeredAlert.count();
  } catch {
    // A DB problem must not turn into "0 alerts fired"; the caller reports it unavailable.
    return null;
  }
}

const router = Router();

router.get("/stats", async (req, res) => {
  // `?t=<ts>` (what the client sends on manual refresh) or `?fresh=1` bypasses the read
  // side of the cache; the fresh payload is still stored for the next caller.
  const bypassCache = typeof req.query.t === "string" || req.query.fresh === "1";
  const key = cacheKey("stats");
  const cached = bypassCache ? null : readCache<StatsPayload>(key);
  if (cached) {
    return res.json({
      ...cached.value,
      cache: { hit: true, namespace: CACHE_NAMESPACE, ageMs: cached.ageMs, ttlMs: STATS_TTL_MS },
    });
  }

  try {
    const [blockNumber, rpcChainId, explorer, alerts] = await Promise.all([
      getBlockNumber(),
      getRpcChainId(),
      getExplorerStats(),
      countTriggeredAlerts(),
    ]);

    if (rpcChainId !== CHAIN_ID) {
      throw new UpstreamError(
        chainIdentity.rpc,
        `RPC reports chain id ${rpcChainId}, expected ${CHAIN_ID}`
      );
    }

    const payload: StatsPayload = {
      chain: chainIdentity,
      blockNumber,
      explorer,
      alerts,
      searches: null,
      unavailable: {
        searches: unavailablePayload(
          "search-analytics",
          `token_interactions is not part of the fork schema, so interactions are not recorded on ${TESTNET_LABEL}`
        ),
        ...(alerts === null
          ? {
              alerts: unavailablePayload(
                "alert-store",
                "the fork database is not reachable from the API process"
              ),
            }
          : {}),
      },
      timestamp: new Date().toISOString(),
    };

    writeCache(key, payload, STATS_TTL_MS);
    return res.json({
      ...payload,
      cache: { hit: false, namespace: CACHE_NAMESPACE, ageMs: 0, ttlMs: STATS_TTL_MS },
    });
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    return res.status(503).json({
      ...unavailablePayload("chain-stats", message),
      searches: null,
      alerts: null,
      timestamp: new Date().toISOString(),
    });
  }
});

/** Cache introspection — proves every key carries the chain namespace. */
router.get("/cache", (_req, res) => {
  res.json(cacheInfo());
});

/** Flush the process cache (e.g. after redeploying against a different chain). */
router.delete("/cache", (_req, res) => {
  const cleared = clearCache();
  res.json({ namespace: CACHE_NAMESPACE, cleared });
});

export default router;
