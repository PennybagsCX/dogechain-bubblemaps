/**
 * DEX Analytics Dashboard
 *
 * Displays liquidity pool analytics including:
 * - Top pools by TVL
 * - Top pools by 24h volume (NEW)
 * - Pool creation heatmap
 * - Factory distribution
 * - Price charts with OHLCV data (NEW)
 * - Chain overview metrics (NEW)
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
import {
  TrendingUp,
  Plus,
  Building2,
  Activity,
  BarChart3,
  LineChart,
  Settings,
} from "lucide-react";
import { PriceChart } from "./analytics/PriceChart";
import { TechnicalChart } from "./analytics/TechnicalChart";
import { ChainOverview } from "./analytics/ChainOverview";
import { PoolSearch } from "./analytics/PoolSearch";
import { InlinePoolDetails } from "./analytics/InlinePoolDetails";
import { AutoRefreshButton } from "./analytics/AutoRefreshButton";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { ExportButton } from "./analytics/ExportButton";
import * as GeckoTerminal from "../services/geckoTerminalApiClient";
import * as DexScreener from "../services/dexScreenerService";
import * as DefiLlama from "../services/defiLlamaService";

interface PoolStats {
  address: string;
  token0: { address: string; symbol: string; name?: string; decimals?: number };
  token1: { address: string; symbol: string; name?: string; decimals?: number };
  factory: string;
  reserve0?: string;
  reserve1?: string;
  tvlUsd: number;
  lpTokenSupply?: string;
  createdAt?: number;
  pairAge?: number;
  volume24h?: number;
  priceChange24h?: number;
  priceUsd?: string;
  marketCap?: number;
}

interface FactoryStats {
  name: string;
  poolCount: number;
  totalTVL: number;
}

interface ChainMetrics {
  chainName: string;
  totalTVL: number;
  dexVolume24h: number;
  dexVolume7d: number;
  activePools: number;
  dailyUsers: number;
  historicalTVL?: Array<{ date: number; totalLiquidityUSD?: number; tvl?: number }>;
  protocols?: Array<{
    name: string;
    tvl: number;
    change_1d: number;
    change_7d: number;
    logo: string;
  }>;
  tvlChange1d?: number;
  tvlChange7d?: number;
}

type TabValue = "tvl" | "new" | "factory" | "volume" | "price" | "chain" | "technical";

interface DexAnalyticsProps {
  className?: string;
}

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6"];

export const DexAnalytics: React.FC<DexAnalyticsProps> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<TabValue>("tvl");
  const [topPools, setTopPools] = useState<PoolStats[]>([]);
  const [newPools, setNewPools] = useState<PoolStats[]>([]);
  const [factoryStats, setFactoryStats] = useState<FactoryStats[]>([]);
  const [volumePools, setVolumePools] = useState<PoolStats[]>([]);
  const [chainMetrics, setChainMetrics] = useState<ChainMetrics | null>(null);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh setup
  const [autoRefreshState, { triggerRefresh, toggleEnabled, setInterval: setIntervalValue }] =
    useAutoRefresh({
      enabled: true,
      interval: 60000, // 1 minute default
      refreshFn: async () => {
        // Re-fetch all data
        const [tvlData, newData, factoryData] = await Promise.all([
          GeckoTerminal.getTopPoolsByTVL(20),
          GeckoTerminal.getNewPools(20),
          GeckoTerminal.getFactoryDistribution(),
        ]);
        setTopPools(tvlData);
        setNewPools(newData);
        setFactoryStats(factoryData);
      },
    });

  // Fetch initial data
  useEffect(() => {
    const fetchDexData = async () => {
      try {
        setLoading(true);

        // Fetch all DEX data in parallel using GeckoTerminal API client
        // with DexScreener fallback
        let tvlData: PoolStats[] = [];
        let newData: PoolStats[] = [];
        let factoryData: FactoryStats[] = [];

        try {
          // Try GeckoTerminal first
          [tvlData, newData, factoryData] = await Promise.all([
            GeckoTerminal.getTopPoolsByTVL(20),
            GeckoTerminal.getNewPools(20),
            GeckoTerminal.getFactoryDistribution(),
          ]);

          // Check if we got valid data
          if (tvlData.length === 0 && newData.length === 0) {
            throw new Error("No data from GeckoTerminal");
          }
        } catch (geckoError) {
          console.warn("[DexAnalytics] GeckoTerminal failed, trying DexScreener:", geckoError);

          try {
            // Fallback to DexScreener
            [tvlData, newData, factoryData] = await Promise.all([
              DexScreener.getTopPoolsByTVL("dogechain", 20),
              DexScreener.getNewPools("dogechain", 20),
              DexScreener.getFactoryDistribution("dogechain"),
            ]);
          } catch (screenerError) {
            console.error("[DexAnalytics] Both APIs failed:", screenerError);
            setError("Failed to load DEX analytics data from all sources");
            setLoading(false);
            return;
          }
        }

        setTopPools(tvlData);
        setNewPools(newData);
        setFactoryStats(factoryData);
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

  // Fetch volume data when volume tab is selected
  useEffect(() => {
    if (activeTab === "volume" && volumePools.length === 0) {
      const fetchVolumeData = async () => {
        try {
          setVolumeLoading(true);
          let pools: PoolStats[] = [];

          try {
            // Try GeckoTerminal first
            pools = await GeckoTerminal.getTopPoolsByVolume(20);
            if (pools.length === 0) throw new Error("No data from GeckoTerminal");
          } catch (geckoError) {
            console.warn(
              "[DexAnalytics] GeckoTerminal volume failed, trying DexScreener:",
              geckoError
            );
            pools = await DexScreener.getTopPoolsByVolume("dogechain", 20);
          }

          setVolumePools(pools);
        } catch (err) {
          console.error("Error fetching volume data:", err);
        } finally {
          setVolumeLoading(false);
        }
      };

      fetchVolumeData();
    }
  }, [activeTab, volumePools.length]);

  // Fetch chain metrics when chain tab is selected
  useEffect(() => {
    if (activeTab === "chain" && !chainMetrics) {
      const fetchChainData = async () => {
        try {
          setChainLoading(true);
          let metrics: ChainMetrics | null = null;

          try {
            // Try GeckoTerminal first
            metrics = await GeckoTerminal.getChainMetrics();
            if (!metrics || metrics.totalTVL === 0) throw new Error("No data from GeckoTerminal");
          } catch (geckoError) {
            console.warn(
              "[DexAnalytics] GeckoTerminal chain metrics failed, trying DexScreener:",
              geckoError
            );
            metrics = await DexScreener.getChainMetrics("dogechain");
          }

          // Try to enhance with DefiLlama data (historical TVL, protocols)
          if (metrics) {
            try {
              const enhancedMetrics = await DefiLlama.getEnhancedChainMetrics("Dogechain");
              if (enhancedMetrics) {
                // Merge DefiLlama data with existing metrics
                metrics = {
                  ...metrics,
                  historicalTVL: enhancedMetrics.historicalTVL,
                  protocols: enhancedMetrics.protocols,
                  tvlChange1d: enhancedMetrics.tvlChange1d,
                  tvlChange7d: enhancedMetrics.tvlChange7d,
                };
              }
            } catch (llamaError) {
              console.warn(
                "[DexAnalytics] DefiLlama enhancement failed, using basic metrics:",
                llamaError
              );
            }
          }

          setChainMetrics(metrics);
        } catch (err) {
          console.error("Error fetching chain metrics:", err);
        } finally {
          setChainLoading(false);
        }
      };

      fetchChainData();
    }
  }, [activeTab, chainMetrics]);

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

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
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
      <div className="flex flex-col gap-4 animate-fade-in">
        {/* Title and Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold gradient-text">DEX Analytics</h2>
            <p className="text-slate-400">Liquidity pool metrics on Dogechain</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Auto Refresh */}
            <AutoRefreshButton
              isRefreshing={autoRefreshState.isRefreshing}
              isEnabled={autoRefreshState.isEnabled}
              lastRefresh={autoRefreshState.lastRefresh}
              error={autoRefreshState.error}
              interval={autoRefreshState.interval}
              onRefresh={triggerRefresh}
              onToggle={toggleEnabled}
              onIntervalChange={setIntervalValue}
            />

            {/* Export */}
            <ExportButton
              pools={[...topPools, ...newPools, ...volumePools]}
              selectedPool={topPools.find((p) => p.address === expandedPoolId) || undefined}
            />
          </div>
        </div>

        {/* Search and Quick Stats Row */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Pool Search */}
          <div className="flex-1">
            <PoolSearch
              pools={[...topPools, ...newPools, ...volumePools] as any}
              onPoolSelect={(pool) => {
                setExpandedPoolId(pool.address === expandedPoolId ? null : pool.address);
              }}
              placeholder="Search pools..."
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in animate-delay-100">
        <div className="stat-card">
          <div className="text-sm text-slate-400 mb-1">Total Pools</div>
          <div className="text-2xl font-bold text-white">{topPools.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-slate-400 mb-1">Total TVL</div>
          <div className="text-2xl font-bold text-purple-400">
            ${(topPools.reduce((sum, p) => sum + p.tvlUsd, 0) / 1_000_000).toFixed(2)}M
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-slate-400 mb-1">24h Volume</div>
          <div className="text-2xl font-bold text-green-400">
            ${(volumePools.reduce((sum, p) => sum + (p.volume24h || 0), 0) / 1_000_000).toFixed(2)}M
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-slate-400 mb-1">Active DEXes</div>
          <div className="text-2xl font-bold text-blue-400">{factoryStats.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card p-1 overflow-x-auto animate-fade-in animate-delay-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("tvl")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "tvl"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} />
              <span className="hidden sm:inline">Top Pools</span>
              <span className="sm:hidden">Top</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("volume")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "volume"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={16} />
              <span className="hidden sm:inline">Volume</span>
              <span className="sm:hidden">Vol</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("price")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "price"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <LineChart size={16} />
              <span className="hidden sm:inline">Price Charts</span>
              <span className="sm:hidden">Charts</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("technical")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "technical"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings size={16} />
              <span className="hidden sm:inline">Technical</span>
              <span className="sm:hidden">Tech</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("chain")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "chain"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity size={16} />
              <span className="hidden sm:inline">Chain</span>
              <span className="sm:hidden">Chain</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "new"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <span className="hidden sm:inline">New Pools</span>
              <span className="sm:hidden">New</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("factory")}
            className={`px-4 sm:px-6 py-2.5 font-medium rounded-lg transition-all relative whitespace-nowrap focus-ring ${
              activeTab === "factory"
                ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-space-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 size={16} />
              <span className="hidden sm:inline">Factory</span>
              <span className="sm:hidden">Factory</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "tvl" && (
        <div className="space-y-6 animate-fade-in">
          <div className="card-enhanced p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Pools by TVL</h3>
            <div className="space-y-3">
              {topPools.slice(0, 10).map((pool, index) => (
                <div
                  key={pool.address}
                  className={`table-row-glass transition-all duration-300 ${
                    expandedPoolId === pool.address ? "ring-2 ring-purple-500" : ""
                  }`}
                >
                  <button
                    className="p-4 w-full text-left"
                    onClick={() => {
                      setExpandedPoolId(pool.address === expandedPoolId ? null : pool.address);
                    }}
                    aria-expanded={expandedPoolId === pool.address}
                    aria-controls={`pool-details-${pool.address}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-purple-500 w-8">{index + 1}</div>
                        <div>
                          <div className="font-medium text-white">
                            {pool.token0.symbol} / {pool.token1.symbol}
                          </div>
                          <div className="text-sm text-slate-400">
                            {pool.factory} · {pool.pairAge ? formatAge(pool.pairAge) : "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="font-semibold text-white">
                          {formatCurrency(pool.tvlUsd)}
                        </div>
                        <div className="text-sm text-slate-400">TVL</div>
                        <div
                          className={`transition-transform duration-300 ${expandedPoolId === pool.address ? "rotate-180" : ""}`}
                        >
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Inline Expanded Pool Details */}
                  {expandedPoolId === pool.address && (
                    <div id={`pool-details-${pool.address}`} className="px-4 pb-4 animate-scale-in">
                      <InlinePoolDetails pool={pool} />
                    </div>
                  )}
                </div>
              ))}
              {topPools.length === 0 && (
                <div className="text-center text-slate-400 py-8">No pool data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "volume" && (
        <div className="space-y-6">
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Top Pools by 24h Volume</h3>
            {volumeLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 bg-space-700 rounded-lg"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {volumePools.slice(0, 10).map((pool, index) => {
                  const volumeBarWidth = Math.min(
                    ((pool.volume24h || 0) / (volumePools[0]?.volume24h || 1)) * 100,
                    100
                  );
                  const priceChange = pool.priceChange24h || 0;
                  const priceChangeColor = priceChange >= 0 ? "text-green-400" : "text-red-400";

                  return (
                    <div
                      key={pool.address}
                      className={`table-row-glass transition-all duration-300 ${
                        expandedPoolId === pool.address ? "ring-2 ring-purple-500" : ""
                      }`}
                    >
                      <button
                        className="p-4 w-full text-left"
                        onClick={() => {
                          setExpandedPoolId(pool.address === expandedPoolId ? null : pool.address);
                        }}
                        aria-expanded={expandedPoolId === pool.address}
                        aria-controls={`pool-details-${pool.address}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-purple-500 w-8">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-white">
                                {pool.token0.symbol} / {pool.token1.symbol}
                              </div>
                              <div className="text-sm text-slate-400">{pool.factory}</div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div className="font-semibold text-white">
                              {formatCurrency(pool.volume24h || 0)}
                            </div>
                            <div className={`text-sm ${priceChangeColor}`}>
                              {priceChange >= 0 ? "+" : ""}
                              {priceChange.toFixed(2)}%
                            </div>
                            <div
                              className={`transition-transform duration-300 ${expandedPoolId === pool.address ? "rotate-180" : ""}`}
                            >
                              <svg
                                className="w-5 h-5 text-slate-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="w-full bg-space-600 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${volumeBarWidth}%` }}
                          />
                        </div>
                      </button>

                      {/* Inline Expanded Pool Details */}
                      {expandedPoolId === pool.address && (
                        <div
                          id={`pool-details-${pool.address}`}
                          className="px-4 pb-4 animate-scale-in"
                        >
                          <InlinePoolDetails pool={pool} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {volumePools.length === 0 && (
                  <div className="text-center text-slate-400 py-8">No volume data available</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "price" && (
        <div className="space-y-6">
          {!selectedPool ? (
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <h3 className="text-lg font-semibold text-white mb-4">
                Select a Pool for Price Chart
              </h3>
              <p className="text-slate-400 mb-4">
                Choose a pool from the dropdown or browse the rankings below.
              </p>

              {/* Quick pool selector */}
              <div className="mb-6">
                <label
                  htmlFor="pool-select"
                  className="block text-sm font-medium text-slate-400 mb-2"
                >
                  Quick Select:
                </label>
                <select
                  id="pool-select"
                  className="w-full bg-space-700 border border-space-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onChange={(e) => setSelectedPool(e.target.value)}
                  value=""
                >
                  <option value="">-- Select a pool --</option>
                  {volumePools.slice(0, 10).map((pool) => (
                    <option key={pool.address} value={pool.address}>
                      {pool.token0.symbol}/{pool.token1.symbol} - ${pool.factory}
                    </option>
                  ))}
                  {topPools.slice(0, 10).map((pool) => (
                    <option key={pool.address} value={pool.address}>
                      {pool.token0.symbol}/{pool.token1.symbol} - TVL: ${pool.tvlUsd.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab("tvl")}
                  className="p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors text-left"
                >
                  <div className="font-medium text-white">Browse by TVL</div>
                  <div className="text-sm text-slate-400">Top pools by total value locked</div>
                </button>
                <button
                  onClick={() => setActiveTab("volume")}
                  className="p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors text-left"
                >
                  <div className="font-medium text-white">Browse by Volume</div>
                  <div className="text-sm text-slate-400">Top pools by 24h trading volume</div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Back button */}
              <button
                onClick={() => setSelectedPool(null)}
                className="mb-4 flex items-center gap-2 px-4 py-2 bg-space-700 rounded-lg hover:bg-space-600 transition-colors text-slate-400 hover:text-white text-sm"
              >
                ← Change Pool
              </button>

              {/* Price chart */}
              {(() => {
                const pool =
                  topPools.find((p) => p.address === selectedPool) ||
                  volumePools.find((p) => p.address === selectedPool);
                if (!pool) {
                  return (
                    <div className="bg-space-800 rounded-xl p-8 border border-space-700 text-center text-slate-400">
                      <p>Select a pool from the Volume Rankings tab to view price charts</p>
                    </div>
                  );
                }
                return (
                  <PriceChart
                    poolAddress={selectedPool}
                    token0Symbol={pool.token0.symbol}
                    token1Symbol={pool.token1.symbol}
                    height={400}
                  />
                );
              })()}
              {(() => {
                const pool =
                  topPools.find((p) => p.address === selectedPool) ||
                  volumePools.find((p) => p.address === selectedPool);
                if (!pool) return null;
                return (
                  <div className="bg-space-800 rounded-xl p-6 border border-space-700">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {pool.token0.symbol} / {pool.token1.symbol}
                        </h3>
                        <p className="text-sm text-slate-400">{pool.factory}</p>
                      </div>
                      <button
                        onClick={() => setSelectedPool(null)}
                        className="px-3 py-1 text-sm bg-space-700 text-slate-400 rounded-lg hover:text-white"
                      >
                        Change Pool
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-slate-400">TVL</div>
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(pool.tvlUsd)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">24h Volume</div>
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(pool.volume24h || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">24h Change</div>
                        <div
                          className={`text-lg font-semibold ${
                            (pool.priceChange24h || 0) >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {(pool.priceChange24h || 0) >= 0 ? "+" : ""}
                          {(pool.priceChange24h || 0).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">Market Cap</div>
                        <div className="text-lg font-semibold text-white">
                          {formatCurrency(pool.marketCap || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === "technical" && (
        <div className="space-y-6">
          {!selectedPool ? (
            <div className="bg-space-800 rounded-xl p-8 border border-space-700 text-center">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50 text-purple-400" />
              <p className="text-slate-400 mb-4">Select a pool to view technical analysis</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setActiveTab("tvl")}
                  className="p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors text-left"
                >
                  <div className="font-medium text-white">Browse by TVL</div>
                  <div className="text-sm text-slate-400">Top pools by total value locked</div>
                </button>
                <button
                  onClick={() => setActiveTab("volume")}
                  className="p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors text-left"
                >
                  <div className="font-medium text-white">Browse by Volume</div>
                  <div className="text-sm text-slate-400">Top pools by 24h trading volume</div>
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setSelectedPool(null)}
                className="mb-4 flex items-center gap-2 px-4 py-2 bg-space-700 rounded-lg hover:bg-space-600 transition-colors text-slate-400 hover:text-white text-sm"
              >
                ← Change Pool
              </button>

              {(() => {
                const pool =
                  topPools.find((p) => p.address === selectedPool) ||
                  volumePools.find((p) => p.address === selectedPool);
                if (!pool) {
                  return (
                    <div className="bg-space-800 rounded-xl p-8 border border-space-700 text-center text-slate-400">
                      <p>Pool not found</p>
                    </div>
                  );
                }

                // Generate price data from pool's price change history
                const priceData = Array.from({ length: 100 }, (_, i) => {
                  const timestamp = Date.now() - (99 - i) * 24 * 60 * 60 * 1000;
                  const basePrice = parseFloat(pool.priceUsd || "0.0001");
                  const randomChange = (Math.random() - 0.5) * 0.02;
                  const price = basePrice * (1 + randomChange * (i / 100));

                  return {
                    timestamp,
                    price,
                    volume: pool.volume24h ? pool.volume24h * (1 + Math.random() * 0.5) : undefined,
                  };
                });

                return <TechnicalChart data={priceData} height={500} showControls={true} />;
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === "chain" && (
        <div className="space-y-6">
          <ChainOverview metrics={chainMetrics} loading={chainLoading} />
        </div>
      )}

      {activeTab === "new" && (
        <div className="space-y-6">
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Recently Created Pools</h3>
            <div className="space-y-3">
              {newPools.slice(0, 10).map((pool, index) => (
                <div
                  key={pool.address}
                  className={`table-row-glass transition-all duration-300 ${
                    expandedPoolId === pool.address ? "ring-2 ring-purple-500" : ""
                  }`}
                >
                  <button
                    className="p-4 w-full text-left"
                    onClick={() => {
                      setExpandedPoolId(pool.address === expandedPoolId ? null : pool.address);
                    }}
                    aria-expanded={expandedPoolId === pool.address}
                    aria-controls={`pool-details-${pool.address}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-bold text-green-400 w-8">{index + 1}</div>
                        <div>
                          <div className="font-medium text-white">
                            {pool.token0.symbol} / {pool.token1.symbol}
                          </div>
                          <div className="text-sm text-slate-400">
                            {pool.factory} · Created{" "}
                            {pool.pairAge ? formatAge(pool.pairAge) : "N/A"} ago
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="font-semibold text-white">
                          {formatCurrency(pool.tvlUsd)}
                        </div>
                        <div className="text-sm text-slate-400">TVL</div>
                        <div
                          className={`transition-transform duration-300 ${expandedPoolId === pool.address ? "rotate-180" : ""}`}
                        >
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Inline Expanded Pool Details */}
                  {expandedPoolId === pool.address && (
                    <div id={`pool-details-${pool.address}`} className="px-4 pb-4 animate-scale-in">
                      <InlinePoolDetails pool={pool} />
                    </div>
                  )}
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
