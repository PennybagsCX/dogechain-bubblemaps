/**
 * One-time purge of chain-derived browser caches when the chain identity changes.
 *
 * The fork keeps its IndexedDB caches in a database created before the retarget
 * (`DogeOSBubbleMapsDB`), so wallet scans, transfer rows, token metadata and search
 * indexes written while the app pointed at another chain would otherwise still be
 * served after the switch. Renaming the database would also drop the user's local
 * alerts, so instead this module clears only the cache tables, once per chain id, and
 * records a marker.
 *
 * User-owned tables are deliberately NOT cleared: `alerts`, `alertStatuses`,
 * `triggeredEvents`, `recentSearches`, `walletForcedContracts`, `searchAliases`,
 * `searchAnalytics`, `apiMetrics`.
 */

import { CHAIN_ID } from "../lib/chain";
import { db } from "./db";

const MARKER_KEY = `dogeos_cache_namespace:${CHAIN_ID}`;

/** Tables holding rows derived from chain reads (never user data). */
const CHAIN_CACHE_TABLES = [
  "walletScanCache",
  "assetMetadataCache",
  "discoveredContracts",
  "lpPairs",
  "scanCheckpoints",
  "discoveredFactories",
  "tokenSearchIndex",
  "abbreviationCache",
  "invertedIndex",
  "phoneticIndex",
  "trendingAssets",
  "tokenPopularity",
  "walletTransactionCache",
  "allTransactionsCache",
  "walletActivityCache",
  "analyticsStateCache",
] as const;

export interface CacheNamespaceResult {
  chainId: number;
  status: "already-scoped" | "purged";
  purged: string[];
  failed: string[];
}

/**
 * Idempotent: the first call for a given chain id clears the cache tables and writes the
 * marker; later calls are no-ops. Safe to fire-and-forget from app startup.
 */
export async function ensureChainScopedCaches(): Promise<CacheNamespaceResult> {
  const alreadyScoped = (() => {
    try {
      return localStorage.getItem(MARKER_KEY) === "1";
    } catch {
      return false;
    }
  })();

  if (alreadyScoped) {
    return { chainId: CHAIN_ID, status: "already-scoped", purged: [], failed: [] };
  }

  const purged: string[] = [];
  const failed: string[] = [];

  for (const tableName of CHAIN_CACHE_TABLES) {
    try {
      const table = db.table(tableName);
      await table.clear();
      purged.push(tableName);
    } catch {
      failed.push(tableName);
    }
  }

  if (failed.length === 0) {
    try {
      localStorage.setItem(MARKER_KEY, "1");
    } catch {
      // Storage unavailable: the purge still happened, it will just repeat next load.
    }
  }

  return { chainId: CHAIN_ID, status: "purged", purged, failed };
}

/** Test/diagnostic helper: forget the marker so the next call purges again. */
export function resetChainCacheNamespaceMarker(): void {
  try {
    localStorage.removeItem(MARKER_KEY);
  } catch {
    // ignore
  }
}
