/**
 * Unified Analytics Dashboard
 *
 * Main dashboard combining all analytics with tabbed navigation.
 * Includes Overview, User Behavior, Platform Health, and Network Health tabs.
 */

import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Server,
  ArrowRight,
  Clock,
  RefreshCw,
  BarChart3,
  Activity,
} from "lucide-react";
import { UserBehaviorAnalytics } from "./UserBehaviorAnalytics";
import { PlatformHealth } from "./PlatformHealth";
import { NetworkHealth } from "../NetworkHealth";
import { TimeRange } from "../../types";

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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(new Date());

  // Handle tab change
  const handleTabChange = (tab: AnalyticsTab) => {
    setActiveTab(tab);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastRefresh(new Date());
    // Trigger re-render of child components
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Render overview tab content
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Active Users</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-slate-500 mt-1">
            Last {TIME_RANGES.find((r) => r.value === globalTimeRange)?.label}
          </div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">System Status</span>
            <Server className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-400">Healthy</div>
          <div className="text-xs text-slate-500 mt-1">All services operational</div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Data Points</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">--</div>
          <div className="text-xs text-slate-500 mt-1">Analytics collected</div>
        </div>

        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Last Refresh</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {lastRefresh ? lastRefresh.toLocaleTimeString() : "--"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Just now</div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Mini Preview Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-space-800 rounded-xl border border-space-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick User Behavior</h3>
          <UserBehaviorAnalytics className="border-none p-0" />
        </div>

        <div className="bg-space-800 rounded-xl border border-space-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Platform Health</h3>
          <PlatformHealth className="border-none p-0" />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Unified Analytics</h1>
          <p className="text-slate-400">
            Comprehensive dashboard for user behavior and platform health
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Time Range Selector */}
          <div className="flex flex-1 min-w-0 items-center gap-1 bg-space-800 rounded-lg p-1 border border-space-700 overflow-x-auto w-full max-w-full">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setGlobalTimeRange(range.value)}
                className={`flex-none whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
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
            className="flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 bg-space-800 border border-space-700 rounded-lg text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-space-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
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
        {activeTab === "user-behavior" && <UserBehaviorAnalytics />}
        {activeTab === "platform-health" && <PlatformHealth />}
        {activeTab === "network-health" && <NetworkHealth />}
      </div>
    </div>
  );
};
