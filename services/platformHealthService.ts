/**
 * Platform Health Service
 *
 * Monitors platform health metrics including:
 * - API performance
 * - Data source status
 * - Cache statistics
 */

import { PlatformHealthStats, TimeRange } from "../types";

// =====================================================
// PLATFORM HEALTH STATS
// =====================================================

/**
 * Get platform health statistics for a time range
 *
 * NOTE: This returns simulated data for demonstration purposes.
 * In production, this would aggregate real metrics from monitoring systems.
 * The platform does not currently track API performance metrics.
 */
export async function getPlatformHealthStats(timeRange: TimeRange): Promise<PlatformHealthStats> {
  const now = Date.now();

  // Return realistic simulated data for demonstration
  // In a production environment, this would query actual monitoring systems
  const multiplier = getTimeRangeMultiplier(timeRange);

  return {
    period: timeRange,
    lastUpdated: now,
    apis: {
      performance: {
        GeckoTerminal: {
          avgLatency: 350 + Math.random() * 200,
          successRate: 0.95 + Math.random() * 0.04,
        },
        DexScreener: {
          avgLatency: 280 + Math.random() * 150,
          successRate: 0.96 + Math.random() * 0.03,
        },
        Blockscout: {
          avgLatency: 450 + Math.random() * 300,
          successRate: 0.92 + Math.random() * 0.06,
        },
        DogechainRPC: {
          avgLatency: 150 + Math.random() * 100,
          successRate: 0.98 + Math.random() * 0.01,
        },
      },
      status: {
        GeckoTerminal: {
          status: "operational",
          latency: 350,
          lastCheck: now,
        },
        DexScreener: {
          status: "operational",
          latency: 280,
          lastCheck: now,
        },
        Blockscout: {
          status: "operational",
          latency: 450,
          lastCheck: now,
        },
        DogechainRPC: {
          status: "operational",
          latency: 150,
          lastCheck: now,
        },
      },
    },
    cache: {
      entries: Math.floor(1500 * multiplier),
      hitRate: 0.75 + Math.random() * 0.15,
    },
  };
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Get multiplier for stub data based on time range
 */
function getTimeRangeMultiplier(timeRange: TimeRange): number {
  switch (timeRange) {
    case "1h":
      return 0.1;
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "all":
      return 90;
  }
}
