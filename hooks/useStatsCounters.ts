import { useState, useEffect, useRef, useCallback } from "react";
import { getApiUrl } from "../utils/api";
import { CHAIN_ID } from "../lib/chain";

/**
 * Stats counters hook.
 *
 * Two honesty rules from the API retarget:
 *  1. The cache key is namespaced by chain id, so a stats payload cached against the
 *     Dogechain backend (or any other chain) can never be read back here. The legacy
 *     un-namespaced keys are deleted on first read.
 *  2. `searches` has no source on DogeOS Chikyū testnet (`/api/stats` returns
 *     `searches: null` + an explicit `unavailable` entry), so the value stays `null` and
 *     callers render "—" instead of a fabricated 0.
 */

const CACHE_KEY = `dogeos_stats_cache:${CHAIN_ID}`;
/** Pre-fork keys: dropped on read so Dogechain-era counters never surface. */
const LEGACY_CACHE_KEYS = ["doge_stats_cache", "dogeos_stats_cache"];
const CACHE_TTL = 10 * 1000; // 10 seconds for near real-time counter updates

interface StatsData {
  /** null = no analytics source on this chain (rendered as "—"), never 0-as-data. */
  searches: number | null;
  /** null = the alert store was unreachable for this response. */
  alerts: number | null;
  timestamp: number;
}

interface StatsResponse {
  searches?: number | null;
  alerts?: number | null;
  unavailable?: { searches?: { reason?: string } };
}

interface StatsCounters {
  totalSearches: number | null;
  totalAlerts: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function purgeLegacyCache(): void {
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable (private mode) — nothing to purge
    }
  }
}

/**
 * Hook to fetch and manage stats counters (total searches and alert triggers).
 * 10s localStorage backup, auto-refresh every 10s.
 */
export function useStatsCounters(): StatsCounters {
  const [stats, setStats] = useState<StatsData>({ searches: null, alerts: null, timestamp: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch stats from API
   */
  const fetchStats = useCallback(
    async (showLoading = false, bypassCache = false): Promise<void> => {
      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError(null);

        // Add cache-busting parameter when bypassing cache
        const url = bypassCache
          ? getApiUrl("/api/stats") + "?t=" + Date.now()
          : getApiUrl("/api/stats");

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as StatsResponse;
        const newStats: StatsData = {
          // Never coerce a missing counter to 0: `null` renders as "—".
          searches: typeof data.searches === "number" ? data.searches : null,
          alerts: typeof data.alerts === "number" ? data.alerts : null,
          timestamp: Date.now(),
        };

        setStats(newStats);

        // Save to localStorage as backup (chain-namespaced key)
        localStorage.setItem(CACHE_KEY, JSON.stringify(newStats));
      } catch (err) {
        console.error("[useStatsCounters] Failed to fetch stats:", err);
        setError(err instanceof Error ? err.message : "Unknown error");

        // Try to load from cache on error
        const cached = getCachedStats();
        if (cached) {
          setStats(cached);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get cached stats from localStorage (this chain's namespace only)
   */
  const getCachedStats = (): StatsData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsed = JSON.parse(cached) as StatsData;
      const isExpired = Date.now() - parsed.timestamp > CACHE_TTL;

      if (isExpired) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };

  /**
   * Manual refresh function (bypasses cache)
   */
  const refresh = async () => {
    await fetchStats(true, true);
  };

  // Initial fetch with cache check
  useEffect(() => {
    purgeLegacyCache();

    const cached = getCachedStats();
    if (cached) {
      setStats(cached);
      setIsLoading(false);
    }

    // Fetch fresh data (background refresh if cache hit)
    fetchStats(!cached);

    // Setup auto-refresh interval
    refreshIntervalRef.current = setInterval(() => {
      fetchStats(false);
    }, CACHE_TTL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchStats]);

  return {
    totalSearches: stats.searches,
    totalAlerts: stats.alerts,
    isLoading,
    error,
    refresh,
  };
}
