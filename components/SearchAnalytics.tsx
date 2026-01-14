/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Search Analytics Dashboard
 *
 * Displays search behavior metrics including:
 * - Total searches tracked
 * - Click-through rate (CTR)
 * - Average time to click
 * - Top searched tokens
 * - Recent search activity
 *
 * Data sources: IndexedDB (local) + optional server aggregation
 */

import { useState, useEffect } from "react";
import { BarChart3, Search, MousePointerClick, Clock, TrendingUp, Activity, X } from "lucide-react";
import { getRecentSearches, getTopQueries, getSessionStats } from "../services/searchAnalytics";

interface AnalyticsStats {
  totalSearches: number;
  totalClicks: number;
  uniqueQueries: number;
  avgResultsPerSearch: number;
  topQueries: Array<{ query: string; count: number }>;
  recentActivity: Array<{
    query: string;
    resultCount: number;
    timestamp: number;
  }>;
}

export function SearchAnalytics({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get recent searches from local IndexedDB
      const recentSearches = await getRecentSearches(100);
      const topQueries = await getTopQueries(20);
      const session = getSessionStats();

      // Calculate stats
      const totalSearches = recentSearches.length;
      const totalClicks = recentSearches.filter((s: any) => s.clickedAddress).length;
      const uniqueQueries = new Set(recentSearches.map((s) => s.query.toLowerCase())).size;
      const avgResultsPerSearch =
        totalSearches > 0
          ? recentSearches.reduce((sum, s) => sum + s.resultCount, 0) / totalSearches
          : 0;

      setStats({
        totalSearches,
        totalClicks,
        uniqueQueries,
        avgResultsPerSearch: Math.round(avgResultsPerSearch * 10) / 10,
        topQueries,
        recentActivity: recentSearches.slice(0, 10).map((s) => ({
          query: s.query,
          resultCount: s.resultCount,
          timestamp: s.timestamp,
        })),
      });

      setSessionStats(session);
    } catch {
      // Error handled silently - analytics fetch failed
    } finally {
      setLoading(false);
    }
  };

  const calculateCTR = () => {
    if (!stats || stats.totalSearches === 0) return 0;
    return Math.round((stats.totalClicks / stats.totalSearches) * 100);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-space-800 rounded-lg p-8 max-w-md w-full mx-4 border border-space-700">
          <div className="flex items-center justify-center gap-3">
            <Activity className="animate-pulse text-purple-500" size={24} />
            <p className="text-slate-300">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-space-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-space-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-space-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-purple-500" size={24} />
              Search Analytics
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Local search behavior metrics (last 7 days)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-space-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {stats && (
            <div className="space-y-6">
              {/* Session Info */}
              {sessionStats && (
                <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                  <h3 className="text-sm font-semibold text-slate-400 mb-2">Current Session</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Session ID</p>
                      <p className="text-xs font-mono text-purple-400 truncate">
                        {sessionStats.sessionId.slice(0, 16)}...
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Searches</p>
                      <p className="text-lg font-semibold text-white">{sessionStats.searchCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Clicks</p>
                      <p className="text-lg font-semibold text-white">{sessionStats.clickCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Session CTR</p>
                      <p className="text-lg font-semibold text-white">
                        {sessionStats.searchCount > 0
                          ? Math.round((sessionStats.clickCount / sessionStats.searchCount) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="text-blue-500" size={18} />
                    <p className="text-xs text-slate-400">Total Searches</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.totalSearches}</p>
                </div>

                <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointerClick className="text-green-500" size={18} />
                    <p className="text-xs text-slate-400">Total Clicks</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.totalClicks}</p>
                </div>

                <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-purple-500" size={18} />
                    <p className="text-xs text-slate-400">Click-Through Rate</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{calculateCTR()}%</p>
                </div>

                <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-orange-500" size={18} />
                    <p className="text-xs text-slate-400">Unique Queries</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.uniqueQueries}</p>
                </div>
              </div>

              {/* Top Queries */}
              <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <TrendingUp className="text-purple-500" size={16} />
                  Top Search Queries (Last 7 Days)
                </h3>
                {stats.topQueries.length > 0 ? (
                  <div className="space-y-2">
                    {stats.topQueries.slice(0, 10).map((item, index) => (
                      <div
                        key={item.query}
                        className="flex items-center justify-between p-2 bg-space-800 rounded hover:bg-space-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-slate-500 w-6">#{index + 1}</span>
                          <span className="text-sm text-slate-300 font-medium truncate max-w-[200px]">
                            {item.query}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-purple-400">
                          {item.count} searches
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No search data yet</p>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-space-900 rounded-lg p-4 border border-space-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Clock className="text-blue-500" size={16} />
                  Recent Search Activity
                </h3>
                {stats.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentActivity.map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-space-800 rounded hover:bg-space-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Search className="text-slate-500 shrink-0" size={14} />
                          <span className="text-sm text-slate-300 truncate">{activity.query}</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs text-slate-500">
                            {activity.resultCount} results
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatTimestamp(activity.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
                )}
              </div>
            </div>
          )}

          {!stats && (
            <div className="text-center py-12">
              <Activity className="mx-auto text-slate-600 mb-3" size={48} />
              <p className="text-slate-400">No analytics data available yet</p>
              <p className="text-sm text-slate-500 mt-1">Start searching to see metrics</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-space-700 bg-space-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Data stored locally in IndexedDB</span>
            <button
              onClick={loadAnalytics}
              className="px-3 py-1 bg-space-700 hover:bg-space-600 rounded text-slate-300 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
