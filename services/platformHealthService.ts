/**
 * Platform Health Service
 *
 * Monitors platform health metrics including:
 * - API performance (latency, success rates)
 * - Data source health
 * - Cache statistics
 *
 * Now uses real metrics from the apiMetrics service instead of simulated data.
 */

import { PlatformHealthStats, TimeRange } from "../types";
import { getApiMetricsStats } from "./apiMetrics";

// =====================================================
// PLATFORM HEALTH STATS
// =====================================================

/**
 * Get platform health statistics for a time range
 *
 * This now returns REAL metrics from the apiMetrics service:
 * - API latencies are actual measured values from IndexedDB
 * - Success rates are calculated from tracked API calls
 * - Cache statistics are from actual IndexedDB tables
 *
 * If no metrics have been collected yet (e.g., first time using the app),
 * returns empty/zero values rather than fake data.
 */
export async function getPlatformHealthStats(timeRange: TimeRange): Promise<PlatformHealthStats> {
  try {
    // Get real metrics from IndexedDB
    const metrics = await getApiMetricsStats(timeRange);

    return {
      period: timeRange,
      lastUpdated: metrics.lastUpdated,
      apis: {
        performance: metrics.apis.performance,
        status: metrics.apis.status,
      },
      cache: {
        entries: metrics.cache.entries,
        hitRate: metrics.cache.hitRate,
      },
    };
  } catch (error) {
    console.error("Error fetching platform health stats:", error);
    // Return empty stats on error rather than fake data
    return {
      period: timeRange,
      lastUpdated: Date.now(),
      apis: {
        performance: {},
        status: {},
      },
      cache: {
        entries: 0,
        hitRate: 0,
      },
    };
  }
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Get time range bounds for filtering
 * (No longer needed - kept for potential future use)
 */
export function getTimeRangeBounds(timeRange: TimeRange): { startTime: number; endTime: number } {
  const now = Date.now();

  switch (timeRange) {
    case "1h":
      return { startTime: now - 60 * 60 * 1000, endTime: now };
    case "24h":
      return { startTime: now - 24 * 60 * 60 * 1000, endTime: now };
    case "7d":
      return { startTime: now - 7 * 24 * 60 * 60 * 1000, endTime: now };
    case "30d":
      return { startTime: now - 30 * 24 * 60 * 60 * 1000, endTime: now };
    case "all":
      return { startTime: 0, endTime: now };
  }
}
