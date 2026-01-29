/**
 * Auto Refresh Button Component
 */

import React, { useState } from "react";
import { RefreshCw, Clock, X, Check, AlertCircle } from "lucide-react";

interface AutoRefreshButtonProps {
  isRefreshing: boolean;
  isEnabled: boolean;
  lastRefresh: Date | null;
  error: Error | null;
  interval: number;
  onRefresh: () => void;
  onToggle: () => void;
  onIntervalChange: (interval: number) => void;
  className?: string;
}

const INTERVAL_OPTIONS = [
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
  { value: 60000, label: "1m" },
  { value: 120000, label: "2m" },
  { value: 300000, label: "5m" },
];

export const AutoRefreshButton: React.FC<AutoRefreshButtonProps> = ({
  isRefreshing,
  isEnabled,
  lastRefresh,
  error,
  interval,
  onRefresh,
  onToggle,
  onIntervalChange,
  className = "",
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const formatLastRefresh = (): string => {
    if (!lastRefresh) return "Never";

    const now = new Date();
    const diff = now.getTime() - lastRefresh.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (isRefreshing) return <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />;
    if (isEnabled) return <Check className="w-4 h-4 text-green-400" />;
    return <X className="w-4 h-4 text-slate-400" />;
  };

  const getStatusText = () => {
    if (error) return "Error";
    if (isRefreshing) return "Refreshing...";
    if (isEnabled) return "Auto-refresh on";
    return "Auto-refresh off";
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 bg-space-700 rounded-lg text-sm ${
            error ? "border border-red-500/50" : ""
          }`}
        >
          {getStatusIcon()}
          <span className="text-slate-300">{getStatusText()}</span>
          {lastRefresh && !error && <span className="text-slate-500">· {formatLastRefresh()}</span>}
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isEnabled
              ? "bg-purple-500 text-white hover:bg-purple-600"
              : "bg-space-700 text-slate-400 hover:text-white"
          }`}
        >
          {isEnabled ? "On" : "Off"}
        </button>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`p-2 rounded-lg transition-colors ${
            isRefreshing
              ? "bg-space-700 text-slate-500"
              : "bg-space-700 hover:bg-space-600 text-white"
          }`}
          title="Refresh now"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {/* Interval Selector */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-3 py-1.5 bg-space-700 hover:bg-space-600 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            <span>{INTERVAL_OPTIONS.find((o) => o.value === interval)?.label || "Custom"}</span>
          </button>

          {showMenu && (
            <>
              <button
                className="fixed inset-0 z-10 bg-transparent"
                onClick={() => setShowMenu(false)}
                aria-label="Close menu"
              />
              <div className="absolute z-20 top-full right-0 mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                {INTERVAL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onIntervalChange(option.value);
                      setShowMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-space-700 transition-colors ${
                      interval === option.value
                        ? "text-purple-400 bg-space-700/50"
                        : "text-slate-300"
                    }`}
                  >
                    Every {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Connection Status Component
 */

export interface ConnectionStatusProps {
  connected: boolean;
  latency?: number;
  lastUpdate?: Date;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connected,
  latency,
  lastUpdate,
  className = "",
}) => {
  const getLatencyColor = () => {
    if (!latency) return "text-slate-400";
    if (latency < 100) return "text-green-400";
    if (latency < 500) return "text-yellow-400";
    return "text-red-400";
  };

  const getConnectionIcon = () => {
    if (!connected) return <div className="w-2 h-2 rounded-full bg-red-400" />;
    if (!latency || latency < 500)
      return <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />;
    return <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
  };

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {getConnectionIcon()}
      <span className="text-slate-400">{connected ? "Connected" : "Disconnected"}</span>
      {latency && <span className={getLatencyColor()}>{latency}ms</span>}
      {lastUpdate && <span className="text-slate-500">· {formatLastUpdate(lastUpdate)}</span>}
    </div>
  );
};

function formatLastUpdate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
