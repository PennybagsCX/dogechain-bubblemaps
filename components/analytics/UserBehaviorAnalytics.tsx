/**
 * User Behavior Analytics Component
 *
 * Displays user behavior metrics including:
 * - Session statistics
 * - Search behavior
 * - Token analysis patterns
 */

import React, { useState, useEffect } from "react";
import { Users, Search, BarChart3, TrendingUp, Clock, Target } from "lucide-react";
import { TimeRange, UserBehaviorStats } from "../../types";
import { getUserBehaviorStats } from "../../services/userBehaviorAnalytics";

interface UserBehaviorAnalyticsProps {
  className?: string;
  externalStats?: UserBehaviorStats | null;
  externalLoading?: boolean;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export const UserBehaviorAnalytics: React.FC<UserBehaviorAnalyticsProps> = ({
  className = "",
  externalStats,
  externalLoading,
}) => {
  const [internalStats, setInternalStats] = useState<UserBehaviorStats | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("7d");

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
      const data = await getUserBehaviorStats(selectedTimeRange);
      setInternalStats(data);
    } catch (err) {
      console.error("Error loading user behavior stats:", err);
    } finally {
      setInternalLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return Math.round(num).toString();
  };

  const formatPercent = (decimal: number): string => {
    return `${(decimal * 100).toFixed(1)}%`;
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
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No behavior data available</p>
          <p className="text-sm mt-2">Start using the app to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">User Behavior</h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
              Local Data
            </span>
          </div>
          <p className="text-sm text-slate-400">Track sessions, searches, and user flows</p>
        </div>

        {/* Time Range Selector - only show if no external stats */}
        {externalStats === undefined && (
          <div className="flex items-center gap-2 bg-space-800 rounded-lg p-1 border border-space-700 w-full overflow-x-auto">
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
        {/* Total Sessions */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Sessions</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">{formatNumber(stats.sessions.total)}</div>
          <div className="text-xs text-slate-500 mt-1">
            {formatNumber(stats.sessions.active)} active
          </div>
        </div>

        {/* Avg Session Duration */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Avg Duration</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.sessions.avgDuration}m</div>
          <div className="text-xs text-slate-500 mt-1">Per session</div>
        </div>

        {/* Search Success Rate */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Search Success</span>
            <Target className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {formatPercent(stats.searches.successRate)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatNumber(stats.searches.total)} searches
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Behavior */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center gap-3 mb-4">
            <Search className="text-purple-500" size={20} />
            <h4 className="text-lg font-semibold text-white">Search Behavior</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Searches</span>
              <span className="text-white font-medium">{formatNumber(stats.searches.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Success Rate</span>
              <span className="text-green-400 font-medium">
                {formatPercent(stats.searches.successRate)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Avg Results</span>
              <span className="text-white font-medium">{stats.searches.avgResults.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Session Metrics */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center gap-3 mb-4">
            <Users className="text-blue-500" size={20} />
            <h4 className="text-lg font-semibold text-white">Session Metrics</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Sessions</span>
              <span className="text-white font-medium">{formatNumber(stats.sessions.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Active Sessions</span>
              <span className="text-purple-400 font-medium">
                {formatNumber(stats.sessions.active)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Avg Duration</span>
              <span className="text-white font-medium">{stats.sessions.avgDuration} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight Card */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-500/20">
        <div className="flex items-start gap-4">
          <TrendingUp className="text-purple-500 shrink-0" size={24} />
          <div>
            <h4 className="text-lg font-semibold text-white mb-1">Behavior Insights</h4>
            <p className="text-sm text-slate-400">
              Users are finding results successfully in {formatPercent(stats.searches.successRate)}{" "}
              of searches, with an average of {stats.searches.avgResults.toFixed(1)} results per
              query. Session engagement shows {stats.sessions.avgDuration} minutes average duration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
