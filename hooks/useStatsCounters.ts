import { useState, useEffect, useRef, useCallback } from "react";
import { getApiUrl } from "../utils/api";

const CACHE_KEY = "doge_stats_cache";
const CACHE_TTL = 10 * 1000; // 10 seconds for near real-time counter updates

interface StatsData {
  searches: number;
  alerts: number;
  timestamp: number;
}

interface StatsCounters {
  totalSearches: number;
  totalAlerts: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage stats counters (total searches and alerts)
 * Implements 5-minute caching with localStorage backup
 * Auto-refreshes every 5 minutes
 */
export function useStatsCounters(): StatsCounters {
  const [stats, setStats] = useState<StatsData>({ searches: 0, alerts: 0, timestamp: 0 });
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
        console.log("[useStatsCounters] Fetching stats:", { bypassCache, url });

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const newStats: StatsData = {
          searches: data.searches || 0,
          alerts: data.alerts || 0,
          timestamp: Date.now(),
        };

        console.log("[useStatsCounters] Stats received:", newStats);
        setStats(newStats);

        // Save to localStorage as backup
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
   * Get cached stats from localStorage
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
    console.log("[useStatsCounters] Manual refresh - bypassing cache");
    await fetchStats(true, true);
  };

  // Initial fetch with cache check
  useEffect(() => {
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
