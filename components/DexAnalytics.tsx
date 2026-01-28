/**
 * DEX Analytics Dashboard
 *
 * Displays liquidity pool analytics including:
 * - Top pools by TVL
 * - Pool creation heatmap
 * - Factory distribution
 * - Active pools (24h volume)
 */

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Plus, Building2, Activity } from "lucide-react";

interface PoolStats {
  address: string;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  factory: string;
  reserve0: string;
  reserve1: string;
  tvlUsd: number;
  lpTokenSupply: string;
  createdAt: number;
  pairAge: number;
}

interface FactoryStats {
  name: string;
  poolCount: number;
  totalTVL: number;
}

type TabValue = "tvl" | "new" | "factory";

interface DexAnalyticsProps {
  className?: string;
}

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6"];

export const DexAnalytics: React.FC<DexAnalyticsProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<TabValue>("tvl");
  const [topPools, setTopPools] = useState<PoolStats[]>([]);
  const [newPools, setNewPools] = useState<PoolStats[]>([]);
  const [factoryStats, setFactoryStats] = useState<FactoryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDexData = async () => {
      try {
        setLoading(true);

        // Fetch all DEX data in parallel
        const [tvlRes, newRes, factoryRes] = await Promise.all([
          fetch("/api/dex-analytics?type=tvl"),
          fetch("/api/dex-analytics?type=new"),
          fetch("/api/dex-analytics?type=factory"),
        ]);

        if (!tvlRes.ok || !newRes.ok || !factoryRes.ok) {
          throw new Error("Failed to fetch DEX analytics");
        }

        const [tvlData, newData, factoryData] = await Promise.all([
          tvlRes.json(),
          newRes.json(),
          factoryRes.json(),
        ]);

        setTopPools(tvlData.pools || []);
        setNewPools(newData.pools || []);
        setFactoryStats(factoryData.factories || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching DEX analytics:", err);
        setError("Failed to load DEX analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchDexData();
  }, []);

  // Format age to human-readable
  const formatAge = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  // Prepare factory chart data
  const factoryChartData = factoryStats.map((f) => ({
    name: f.name,
    pools: f.poolCount,
    tvl: f.totalTVL,
  }));

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-space-700 rounded w-1/3"></div>
          <div className="h-96 bg-space-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">DEX Analytics</h2>
        <p className="text-slate-400">Liquidity pool metrics on Dogechain</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-space-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab("tvl")}
          className={`px-3 sm:px-4 md:px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${
            activeTab === "tvl" ? "text-purple-400" : "text-slate-400 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} />
            <span className="hidden sm:inline">Top Pools</span>
            <span className="sm:hidden">Top</span>
          </div>
          {activeTab === "tvl" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`px-3 sm:px-4 md:px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${
            activeTab === "new" ? "text-purple-400" : "text-slate-400 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus size={16} />
            <span className="hidden sm:inline">New Pools</span>
            <span className="sm:hidden">New</span>
          </div>
          {activeTab === "new" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("factory")}
          className={`px-3 sm:px-4 md:px-6 py-3 font-medium transition-colors relative whitespace-nowrap ${
            activeTab === "factory" ? "text-purple-400" : "text-slate-400 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 size={16} />
            <span className="hidden sm:inline">Factory</span>
            <span className="sm:hidden">Factory</span>
          </div>
          {activeTab === "factory" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "tvl" && (
        <div className="space-y-6">
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Top Pools by TVL</h3>
            <div className="space-y-3">
              {topPools.slice(0, 10).map((pool, index) => (
                <div
                  key={pool.address}
                  className="flex items-center justify-between p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-purple-500 w-8">{index + 1}</div>
                    <div>
                      <div className="font-medium text-white">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </div>
                      <div className="text-sm text-slate-400">
                        {pool.factory} · {formatAge(pool.pairAge)} old
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">${pool.tvlUsd.toLocaleString()}</div>
                    <div className="text-sm text-slate-400">TVL</div>
                  </div>
                </div>
              ))}
              {topPools.length === 0 && (
                <div className="text-center text-slate-400 py-8">No pool data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "new" && (
        <div className="space-y-6">
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Recently Created Pools</h3>
            <div className="space-y-3">
              {newPools.slice(0, 10).map((pool) => (
                <div
                  key={pool.address}
                  className="flex items-center justify-between p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors"
                >
                  <div>
                    <div className="font-medium text-white">
                      {pool.token0.symbol} / {pool.token1.symbol}
                    </div>
                    <div className="text-sm text-slate-400">
                      {pool.factory} · Created {formatAge(pool.pairAge)} ago
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">${pool.tvlUsd.toLocaleString()}</div>
                    <div className="text-sm text-slate-400">TVL</div>
                  </div>
                </div>
              ))}
              {newPools.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  No new pools in the last 24 hours
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "factory" && (
        <div className="space-y-6">
          {factoryStats.length === 0 ? (
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <div className="text-center text-slate-400 py-12">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No DEX factory data available</p>
                <p className="text-sm mt-2">
                  Try again later or check if DEXs are active on Dogechain
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pool Count Chart */}
              <div className="bg-space-800 rounded-xl p-6 border border-space-700">
                <h3 className="text-lg font-semibold text-white mb-4">Pools per DEX</h3>
                {factoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={factoryChartData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#94a3b8" }}
                        axisLine={{ stroke: "#334155" }}
                      />
                      <YAxis tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#334155" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="pools" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Distribution Pie Chart */}
              <div className="bg-space-800 rounded-xl p-6 border border-space-700">
                <h3 className="text-lg font-semibold text-white mb-4">Factory Distribution</h3>
                {factoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={factoryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${(entry as any).name}: ${(entry as any).pools}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="pools"
                      >
                        {factoryChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    No chart data available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Factory Stats Table */}
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Factory Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {factoryStats.map((factory) => (
                <div key={factory.name} className="p-4 bg-space-700/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-1">{factory.name}</div>
                  <div className="text-2xl font-bold text-white">{factory.poolCount}</div>
                  <div className="text-xs text-slate-500">active pools</div>
                </div>
              ))}
              {factoryStats.length === 0 && (
                <div className="text-center text-slate-400 py-4 col-span-3">
                  No factory data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
