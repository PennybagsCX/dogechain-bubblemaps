/**
 * Platform Health Component
 *
 * Displays platform health metrics including:
 * - API performance
 * - Data source health
 * - System metrics
 * - Cache statistics
 */

import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  Database,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { TimeRange, PlatformHealthStats } from "../../types";
import { getPlatformHealthStats } from "../../services/platformHealthService";

interface PlatformHealthProps {
  className?: string;
  externalStats?: PlatformHealthStats | null;
  externalLoading?: boolean;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "all", label: "All" },
];

export const PlatformHealth: React.FC<PlatformHealthProps> = ({
  className = "",
  externalStats,
  externalLoading,
}) => {
  const [internalStats, setInternalStats] = useState<PlatformHealthStats | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("24h");

  // Use external stats if provided, otherwise use internal
  const stats = externalStats !== undefined ? externalStats : internalStats;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  useEffect(() => {
    loadStats();
  }, [selectedTimeRange]);

  const loadStats = async () => {
    // Skip fetching if external stats are provided
    if (externalStats !== undefined) return;

    try {
      setInternalLoading(true);
      const data = await getPlatformHealthStats(selectedTimeRange);
      setInternalStats(data);
    } catch (err) {
      console.error("Error loading platform health stats:", err);
    } finally {
      setInternalLoading(false);
    }
  };

  const getStatusIcon = (status: "operational" | "degraded" | "down") => {
    switch (status) {
      case "operational":
        return <CheckCircle className="text-green-500" size={20} />;
      case "degraded":
        return <AlertTriangle className="text-yellow-500" size={20} />;
      case "down":
        return <XCircle className="text-red-500" size={20} />;
    }
  };

  const formatLatency = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercent = (decimal: number): string => {
    return `${(decimal * 100).toFixed(1)}%`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-space-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-space-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No platform health data available</p>
          <p className="text-sm mt-2">Check data source connections</p>
        </div>
      </div>
    );
  }

  // Get API entries
  const apiEntries = Object.entries(stats.apis.performance);
  const statusEntries = Object.entries(stats.apis.status);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Platform Health</h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
              Simulated Data
            </span>
          </div>
          <p className="text-sm text-slate-400">API performance and system status</p>
        </div>

        {/* Time Range Selector - only show if no external stats */}
        {externalStats === undefined && (
          <div className="flex flex-1 min-w-0 items-center gap-2 bg-space-800 rounded-lg p-1 border border-space-700 w-full overflow-x-auto">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedTimeRange(range.value)}
                className={`flex-none whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  selectedTimeRange === range.value
                    ? "bg-purple-500 text-white"
                    : "text-slate-400 hover:text-white hover:bg-space-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cache Hit Rate */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Cache Hit Rate</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">{formatPercent(stats.cache.hitRate)}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.cache.entries.toLocaleString()} entries
          </div>
        </div>

        {/* Overall Status */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">System Status</span>
            <Activity className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-400">Healthy</div>
          <div className="text-xs text-slate-500 mt-1">All systems operational</div>
        </div>

        {/* Avg API Latency */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Avg Latency</span>
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {apiEntries.length > 0
              ? formatLatency(
                  apiEntries.reduce((sum, [, data]) => sum + data.avgLatency, 0) / apiEntries.length
                )
              : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Across all APIs</div>
        </div>
      </div>

      {/* API Performance Table */}
      <div className="bg-space-800 rounded-xl p-6 border border-space-700">
        <h4 className="text-lg font-semibold text-white mb-4">API Performance</h4>
        {apiEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-space-700">
                  <th className="text-left p-3 text-slate-400 font-medium">API</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Status</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Latency</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {apiEntries.map(([apiName, perfData]) => {
                  const statusData = statusEntries.find(([name]) => name === apiName)?.[1];
                  return (
                    <tr key={apiName} className="border-b border-space-700 hover:bg-space-700/50">
                      <td className="p-3 font-medium text-white">{apiName}</td>
                      <td className="p-3 text-right">
                        {statusData ? (
                          <div className="flex items-center justify-end gap-2">
                            {getStatusIcon(statusData.status)}
                          </div>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {formatLatency(perfData.avgLatency)}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-medium ${
                            perfData.successRate >= 0.95
                              ? "text-green-400"
                              : perfData.successRate >= 0.8
                                ? "text-yellow-400"
                                : "text-red-400"
                          }`}
                        >
                          {formatPercent(perfData.successRate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-4">No API performance data available</div>
        )}
      </div>

      {/* Cache Statistics */}
      <div className="bg-space-800 rounded-xl p-6 border border-space-700">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-500" size={20} />
          <h4 className="text-lg font-semibold text-white">Cache Statistics</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-slate-400">Total Entries</div>
            <div className="text-xl font-semibold text-white">
              {stats.cache.entries.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Hit Rate</div>
            <div className="text-xl font-semibold text-green-400">
              {formatPercent(stats.cache.hitRate)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Miss Rate</div>
            <div className="text-xl font-semibold text-red-400">
              {formatPercent(1 - stats.cache.hitRate)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Last Updated</div>
            <div className="text-xl font-semibold text-white">
              {formatTimeAgo(stats.lastUpdated)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
