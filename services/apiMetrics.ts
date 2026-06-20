/**
 * API Performance Metrics Service
 *
 * Tracks external API call performance including:
 * - Request latency (duration)
 * - Success/failure rates
 * - Status codes
 *
 * Uses IndexedDB for persistence, following the same pattern as searchAnalytics.
 */

import { TimeRange } from "../types";

// =====================================================
// TYPES
// =====================================================

export interface ApiMetricEvent {
  sessionId: string;
  apiName: string; // e.g., "RPC", "Explorer", "Blockscout"
  functionName: string; // e.g., "getLatestBlock", "fetchTokenData"
  duration: number; // milliseconds
  success: boolean;
  statusCode?: number;
  timestamp: number;
}

export interface ApiMetricsStats {
  period: TimeRange;
  apis: {
    performance: Record<string, { avgLatency: number; successRate: number }>;
    status: Record<
      string,
      { status: "operational" | "degraded" | "down"; latency: number; lastCheck: number }
    >;
  };
  cache: {
    entries: number;
    hitRate: number;
  };
  lastUpdated: number;
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

let currentSessionId: string | null = null;

/**
 * Get or create session ID
 */
function getSessionId(): string {
  if (!currentSessionId) {
    // Generate 128-bit random session ID (32 hex chars)
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    currentSessionId = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return currentSessionId;
}

// =====================================================
// TRACKING
// =====================================================

/**
 * Track an API call with performance metrics
 *
 * Wraps an async function and tracks its execution time, success/failure, and status code.
 * Tracking is async/non-blocking and stored in IndexedDB.
 *
 * @param apiName - The API/service name (e.g., "RPC", "Explorer", "Blockscout")
 * @param functionName - The function name (e.g., "getLatestBlock", "fetchTokenData")
 * @param fn - The async function to track
 * @returns The result of the function
 */
export async function trackApiCall<T>(
  apiName: string,
  functionName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  let success = false;
  let statusCode: number | undefined;

  try {
    const result = await fn();
    success = true;
    return result;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null) {
      if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
        statusCode = (error as { status: number }).status;
      } else if (
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
      ) {
        statusCode = (error as { statusCode: number }).statusCode;
      }
    }
    throw error;
  } finally {
    const duration = performance.now() - startTime;

    // Save to IndexedDB (async, non-blocking)
    saveApiMetricLocally({
      sessionId: getSessionId(),
      apiName,
      functionName,
      duration,
      success,
      statusCode,
      timestamp: Date.now(),
    }).catch(() => {
      // Silently fail if tracking fails
    });
  }
}

// =====================================================
// LOCAL STORAGE (IndexedDB)
// =====================================================

/**
 * Save API metric to IndexedDB
 */
async function saveApiMetricLocally(event: ApiMetricEvent): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import("./db");

    // Check if apiMetrics store exists (v20+)
    if ("apiMetrics" in db) {
      await db.apiMetrics.add({
        sessionId: event.sessionId,
        apiName: event.apiName,
        functionName: event.functionName,
        duration: event.duration,
        success: event.success,
        statusCode: event.statusCode,
        timestamp: event.timestamp,
      });
    }
  } catch {
    // Error handled silently
  }
}

// =====================================================
// QUERIES
// =====================================================

/**
 * Get time range bounds for filtering metrics
 */
function getTimeRangeBounds(timeRange: TimeRange): { startTime: number; endTime: number } {
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

/**
 * Get API metrics statistics for a time range
 */
export async function getApiMetricsStats(timeRange: TimeRange): Promise<ApiMetricsStats> {
  const { startTime, endTime } = getTimeRangeBounds(timeRange);

  try {
    const { db } = await import("./db");

    // Check if apiMetrics store exists
    if (!("apiMetrics" in db)) {
      return getEmptyStats(timeRange);
    }

    // Get all metrics in time range
    const metrics = await db.apiMetrics
      .where("timestamp")
      .between(startTime, endTime, true, true)
      .toArray();

    // Group by API and function
    const byApi: Record<string, { durations: number[]; successes: number; total: number }> = {};

    for (const metric of metrics) {
      const key = metric.apiName;
      if (!byApi[key]) {
        byApi[key] = { durations: [], successes: 0, total: 0 };
      }
      byApi[key].durations.push(metric.duration);
      if (metric.success) {
        byApi[key].successes++;
      }
      byApi[key].total++;
    }

    // Calculate performance stats
    const performance: Record<string, { avgLatency: number; successRate: number }> = {};
    const status: Record<
      string,
      { status: "operational" | "degraded" | "down"; latency: number; lastCheck: number }
    > = {};

    for (const [apiName, data] of Object.entries(byApi)) {
      const avgLatency = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;
      const successRate = data.successes / data.total;

      performance[apiName] = {
        avgLatency,
        successRate,
      };

      // Determine health status
      let healthStatus: "operational" | "degraded" | "down";
      if (successRate >= 0.95 && avgLatency < 1000) {
        healthStatus = "operational";
      } else if (successRate >= 0.8 && avgLatency < 5000) {
        healthStatus = "degraded";
      } else {
        healthStatus = "down";
      }

      status[apiName] = {
        status: healthStatus,
        latency: avgLatency,
        lastCheck: endTime,
      };
    }

    // Get cache stats
    const cacheEntries = await getCacheEntryCount();
    const cacheHitRate = await getCacheHitRate();

    return {
      period: timeRange,
      lastUpdated: Date.now(),
      apis: {
        performance,
        status,
      },
      cache: {
        entries: cacheEntries,
        hitRate: cacheHitRate,
      },
    };
  } catch {
    return getEmptyStats(timeRange);
  }
}

/**
 * Get empty stats when no data is available
 */
function getEmptyStats(timeRange: TimeRange): ApiMetricsStats {
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

// =====================================================
// CACHE STATS
// =====================================================

/**
 * Get cache entry count
 */
async function getCacheEntryCount(): Promise<number> {
  try {
    const { db } = await import("./db");
    if ("assetMetadataCache" in db) {
      return await db.assetMetadataCache.count();
    }
  } catch {
    // Error handled silently
  }
  return 0;
}

/**
 * Get cache hit rate from actual search cache tracking.
 *
 * Uses the SearchCache singleton which already tracks hits per entry.
 * The hit rate is calculated as: total_hits / (total_hits + total_entries).
 * Returns 0 if no tracking data is available (never returns a fabricated value).
 */
async function getCacheHitRate(): Promise<number> {
  try {
    // Use the existing searchCache which already tracks hits per entry
    const { searchCache } = await import("./searchCache");
    const stats = searchCache.getStats();

    if (stats.size === 0) {
      return 0; // No data — show 0%, not a fabricated 75%
    }

    // searchCache.getHitRate() returns 0-100 percentage
    const hitRatePercent = searchCache.getHitRate();
    return hitRatePercent / 100; // Convert to 0-1 decimal
  } catch {
    // Error handled silently
  }
  return 0;
}

// =====================================================
// CLEANUP
// =====================================================

/**
 * Clear old API metrics (older than 30 days)
 * Call this periodically to prevent unbounded growth
 */
export async function clearOldApiMetrics(): Promise<void> {
  try {
    const { db } = await import("./db");
    if ("apiMetrics" in db) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      await db.apiMetrics.where("timestamp").below(thirtyDaysAgo).delete();
    }
  } catch {
    // Error handled silently
  }
}

/**
 * Clear all API metrics
 */
export async function clearAllApiMetrics(): Promise<void> {
  try {
    const { db } = await import("./db");
    if ("apiMetrics" in db) {
      await db.apiMetrics.clear();
    }
  } catch {
    // Error handled silently
  }
}
