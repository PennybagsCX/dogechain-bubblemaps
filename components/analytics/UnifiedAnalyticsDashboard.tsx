/**
 * Unified Analytics Dashboard
 *
 * Main dashboard combining all analytics with tabbed navigation.
 * Includes Overview, User Behavior, Platform Health, and Network Health tabs.
 */

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Server,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Activity,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { UserBehaviorAnalytics } from "./UserBehaviorAnalytics";
import { PlatformHealth } from "./PlatformHealth";
import { NetworkHealth } from "../NetworkHealth";
import { TimeRange, UserBehaviorStats, PlatformHealthStats } from "../../types";
import { getUserBehaviorStats } from "../../services/userBehaviorAnalytics";
import { getPlatformHealthStats } from "../../services/platformHealthService";

interface UnifiedAnalyticsDashboardProps {
  className?: string;
}

type AnalyticsTab = "overview" | "user-behavior" | "platform-health" | "network-health";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

export const UnifiedAnalyticsDashboard: React.FC<UnifiedAnalyticsDashboardProps> = ({
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [globalTimeRange, setGlobalTimeRange] = useState<TimeRange>("7d");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State for overview data
  const [userStats, setUserStats] = useState<UserBehaviorStats | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformHealthStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Fetch overview data when time range changes
  useEffect(() => {
    const loadOverviewData = async () => {
      setOverviewLoading(true);
      try {
        const [userData, platformData] = await Promise.all([
          getUserBehaviorStats(globalTimeRange),
          getPlatformHealthStats(globalTimeRange),
        ]);
        console.log("Fetched user stats:", userData);
        console.log("Fetched platform stats:", platformData);
        setUserStats(userData);
        setPlatformStats(platformData);
      } catch (err) {
        console.error("Error loading overview data:", err);
      } finally {
        setOverviewLoading(false);
      }
    };

    loadOverviewData();
  }, [globalTimeRange]);
  const handleTabChange = (tab: AnalyticsTab) => {
    setActiveTab(tab);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Trigger re-render of child components
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return Math.round(num).toString();
  };

  // Force re-render every minute to update "ago" time
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Render overview tab content
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Overview Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Active Users</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading ? "--" : userStats ? formatNumber(userStats.sessions.active) : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Last {TIME_RANGES.find((r) => r.value === globalTimeRange)?.label}
          </div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Searches</span>
            <Search className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading ? "--" : userStats ? formatNumber(userStats.searches.total) : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Last {TIME_RANGES.find((r) => r.value === globalTimeRange)?.label}
          </div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Search Success</span>
            <Target className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading
              ? "--"
              : userStats
                ? `${(userStats.searches.successRate * 100).toFixed(1)}%`
                : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {overviewLoading
              ? ""
              : userStats && userStats.searches.total > 0
                ? `${formatNumber(Math.round(userStats.searches.total * userStats.searches.successRate))} successful`
                : "No searches"}
          </div>
        </div>
      </div>

      {/* Overview Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Avg Results</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading ? "--" : userStats ? userStats.searches.avgResults.toFixed(1) : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Per search</div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Avg Session</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading
              ? "--"
              : userStats
                ? `${userStats.sessions.avgDuration.toFixed(1)}s`
                : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Average visit duration</div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Data Points</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {overviewLoading
              ? "--"
              : userStats
                ? formatNumber(userStats.sessions.total + userStats.searches.total)
                : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Analytics collected</div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleTabChange("user-behavior")}
          className="p-6 bg-space-800 rounded-xl border border-space-700 hover:border-purple-500/50 transition-all text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-white">User Behavior</div>
            <Users className="text-purple-500" size={20} />
          </div>
          <div className="text-sm text-slate-400">Track sessions, searches, and user flows</div>
          <div className="mt-3 flex items-center text-sm text-purple-400">
            View Details <ArrowRight size={16} />
          </div>
        </button>

        <button
          onClick={() => handleTabChange("platform-health")}
          className="p-6 bg-space-800 rounded-xl border border-space-700 hover:border-green-500/50 transition-all text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-white">Platform Health</div>
            <Server className="text-green-500" size={20} />
          </div>
          <div className="text-sm text-slate-400">Monitor API performance and system status</div>
          <div className="mt-3 flex items-center text-sm text-green-400">
            View Details <ArrowRight size={16} />
          </div>
        </button>

        <button
          onClick={() => handleTabChange("network-health")}
          className="p-6 bg-space-800 rounded-xl border border-space-700 hover:border-blue-500/50 transition-all text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-white">Network Health</div>
            <Activity className="text-blue-500" size={20} />
          </div>
          <div className="text-sm text-slate-400">Real-time Dogechain blockchain metrics</div>
          <div className="mt-3 flex items-center text-sm text-blue-400">
            View Details <ArrowRight size={16} />
          </div>
        </button>
      </div>

      {/* Mini Preview Sections */}
      <div className="bg-space-800 rounded-xl border border-space-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick User Behavior</h3>
        <UserBehaviorAnalytics
          className="border-none p-0"
          externalStats={userStats}
          externalLoading={overviewLoading}
        />
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col items-center gap-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Unified Analytics</h1>
          <p className="text-slate-400">Real-time metrics for user behavior and network health</p>
        </div>

        {/* Action Buttons - Centered for all screen sizes */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Time Range Selector */}
          <div className="inline-flex items-center justify-center gap-1 bg-space-800 rounded-lg p-1 border border-space-700 overflow-x-auto">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setGlobalTimeRange(range.value)}
                className={`flex-none whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  globalTimeRange === range.value
                    ? "bg-purple-500 text-white"
                    : "text-slate-400 hover:text-white hover:bg-space-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-space-800 border border-space-700 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-space-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-space-800 rounded-xl p-1 border border-space-700 overflow-x-auto">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange("overview")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "overview"
                ? "bg-purple-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              <span>Overview</span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange("user-behavior")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "user-behavior"
                ? "bg-purple-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>User Behavior</span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange("platform-health")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "platform-health"
                ? "bg-purple-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Server size={16} />
              <span>Platform Health</span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange("network-health")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "network-health"
                ? "bg-purple-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity size={16} />
              <span>Network Health</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div key={`${activeTab}-${globalTimeRange}-${isRefreshing}`}>
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "user-behavior" && (
          <UserBehaviorAnalytics externalStats={userStats} externalLoading={overviewLoading} />
        )}
        {activeTab === "platform-health" && (
          <PlatformHealth externalStats={platformStats} externalLoading={overviewLoading} />
        )}
        {activeTab === "network-health" && <NetworkHealth />}
      </div>
    </div>
  );
};
