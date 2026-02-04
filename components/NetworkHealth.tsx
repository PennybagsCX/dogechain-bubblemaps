/**
 * Network Health Dashboard Component
 *
 * Displays real-time Dogechain network metrics including:
 * - Block time monitoring
 * - Gas price trends
 * - Transaction throughput (TPS)
 * - Network congestion indicator
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Zap, Clock, TrendingUp } from "lucide-react";
import { DogechainRPCClient } from "@/services/dogechainRPC";

interface NetworkStats {
  currentBlockNumber: number;
  blockTime: number;
  averageBlockTime: number;
  gasPrice: string;
  tps: number;
  congestion: "low" | "medium" | "high";
}

interface NetworkHealthProps {
  className?: string;
}

// Create RPC client outside component to avoid re-creation on every render
const rpcClient = new DogechainRPCClient();

export const NetworkHealth: React.FC<NetworkHealthProps> = ({ className = "" }) => {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch network stats
  const fetchNetworkStats = useCallback(async () => {
    try {
      const data = await rpcClient.getNetworkStats();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching network stats:", err);
      // Don't set error during polling, only on initial load
      setError("Failed to load network data");
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - rpcClient is now defined outside component

  // Initial fetch and polling
  useEffect(() => {
    fetchNetworkStats();

    // Poll network stats every 10 seconds
    pollingRef.current = setInterval(() => {
      fetchNetworkStats();
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchNetworkStats]);

  // Congestion badge color
  const getCongestionColor = (congestion: string) => {
    switch (congestion) {
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-space-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-space-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{error || "Unable to load network health data"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">Network Health</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
              Live Data
            </span>
          </div>
          <p className="text-slate-400">Real-time Dogechain metrics</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border ${getCongestionColor(stats.congestion)}`}>
          <span className="font-medium capitalize">{stats.congestion}</span> Congestion
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Block */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Current Block</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            #{stats.currentBlockNumber.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Target: ~2.5s block time</div>
        </div>

        {/* Block Time */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Block Time</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {(stats.blockTime / 1000).toFixed(2)}s
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Avg: {(stats.averageBlockTime / 1000).toFixed(2)}s
          </div>
        </div>

        {/* Gas Price */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Gas Price</span>
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {(Number(stats.gasPrice) / 1e9).toFixed(2)} Gwei
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.congestion === "low" && "Low gas fees"}
            {stats.congestion === "medium" && "Moderate fees"}
            {stats.congestion === "high" && "High fees"}
          </div>
        </div>

        {/* TPS */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Throughput</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-white">{stats.tps.toFixed(1)} TPS</div>
          <div className="text-xs text-slate-500 mt-1">Transactions per second</div>
        </div>
      </div>

      {/* Block Time Distribution - Simple visualization */}
      <div className="bg-space-800 rounded-xl p-6 border border-space-700">
        <h3 className="text-lg font-semibold text-white mb-4">Block Time Distribution</h3>

        {/* Block time progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Current Block Time</span>
            <span className="text-sm text-white font-medium">
              {(stats.blockTime / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((stats.blockTime / 5000) * 100, 100)}%`,
                backgroundColor:
                  stats.blockTime < 3000
                    ? "#22c55e"
                    : stats.blockTime < 5000
                      ? "#eab308"
                      : "#ef4444",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0s</span>
            <span>5s</span>
          </div>
        </div>

        {/* Block time status */}
        <div className="flex items-center gap-2 text-sm">
          <Clock
            className={`w-4 h-4 ${stats.blockTime < 3000 ? "text-green-500" : stats.blockTime < 5000 ? "text-yellow-500" : "text-red-500"}`}
          />
          <span
            className={
              stats.blockTime < 3000
                ? "text-green-400"
                : stats.blockTime < 5000
                  ? "text-yellow-400"
                  : "text-red-400"
            }
          >
            {stats.blockTime < 3000 ? "Excellent" : stats.blockTime < 5000 ? "Good" : "Slow"}{" "}
            performance
          </span>
          <span className="text-slate-500">• Target: ~2.5s</span>
        </div>
      </div>

      {/* Network Status */}
      <div className="bg-space-800 rounded-xl p-6 border border-space-700">
        <h3 className="text-lg font-semibold text-white mb-4">Network Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                stats.blockTime < 3000
                  ? "bg-green-500"
                  : stats.blockTime < 5000
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <div>
              <div className="text-white font-medium">Block Production</div>
              <div className="text-sm text-slate-400">
                {stats.blockTime < 3000
                  ? "Healthy"
                  : stats.blockTime < 5000
                    ? "Slower than usual"
                    : "Slow"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                Number(stats.gasPrice) < 5e9
                  ? "bg-green-500"
                  : Number(stats.gasPrice) < 20e9
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <div>
              <div className="text-white font-medium">Gas Fees</div>
              <div className="text-sm text-slate-400">
                {Number(stats.gasPrice) < 5e9
                  ? "Low"
                  : Number(stats.gasPrice) < 20e9
                    ? "Moderate"
                    : "High"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                stats.tps > 5 ? "bg-green-500" : stats.tps > 2 ? "bg-yellow-500" : "bg-red-500"
              }`}
            />
            <div>
              <div className="text-white font-medium">Transaction Volume</div>
              <div className="text-sm text-slate-400">
                {stats.tps > 5
                  ? "High activity"
                  : stats.tps > 2
                    ? "Normal activity"
                    : "Low activity"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
