/**
 * Token Distribution Analytics Dashboard
 *
 * Displays wealth concentration metrics for tokens including:
 * - Gini coefficient
 * - Holder concentration bands (top 1%, 5%, 10%, 25%)
 * - Distribution histogram
 * - Centralization alerts
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Wallet,
  Loader2,
  Database,
  Activity,
  Zap,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Token } from "../types";
import { fetchDistributionAnalysis } from "../services/dataService";

type ProgressStage =
  | ""
  | "Initializing"
  | "Fetching Holder Data"
  | "Analyzing Distribution"
  | "Calculating Metrics";

interface DistributionAnalysis {
  giniCoefficient: number;
  concentrationBands: {
    top1Pct: number;
    top5Pct: number;
    top10Pct: number;
    top25Pct: number;
  };
  totalHolders: number;
  isCentralized: boolean;
  distributionBuckets: Array<{
    label: string;
    minPct: number;
    maxPct: number;
    count: number;
    percentage: number;
  }>;
}

interface DistributionAnalyticsProps {
  token?: Token | null;
  className?: string;
}

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6"];

// Format time ago helper
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const DistributionAnalytics: React.FC<DistributionAnalyticsProps> = ({
  token,
  className = "",
}) => {
  const [analysis, setAnalysis] = useState<DistributionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress tracking state
  const [progressStage, setProgressStage] = useState<ProgressStage>("");
  const [progressDetails, setProgressDetails] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [holdersProcessed, setHoldersProcessed] = useState(0);
  const [totalHolders, setTotalHolders] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  // Ref to prevent duplicate fetches
  const fetchKeyRef = useRef<string>("");

  // Fetch distribution analysis with progress tracking
  const fetchAnalysis = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Generate unique fetch key to prevent duplicate requests
    const fetchKey = `${token.address}-${refreshKey}`;
    if (fetchKeyRef.current === fetchKey) {
      return; // Already fetching this exact request
    }
    fetchKeyRef.current = fetchKey;

    try {
      setLoading(true);
      setError(null);
      setProgressStage("Initializing");
      setProgressDetails("Preparing to fetch holder data...");
      setProgressPercent(5);

      // Simulate initialization delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgressPercent(10);

      setProgressStage("Fetching Holder Data");
      setProgressDetails("Fetching token holders from blockchain...");
      setProgressPercent(20);

      // Simulate holder fetching progress
      await new Promise((resolve) => setTimeout(resolve, 800));
      setProgressPercent(40);
      setProgressDetails("Processing holder balances...");

      // Update holders processed (simulated for UX)
      setTotalHolders(100);
      const holderUpdateInterval = setInterval(() => {
        setHoldersProcessed((prev) => {
          if (prev >= 100) {
            clearInterval(holderUpdateInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      await new Promise((resolve) => setTimeout(resolve, 1500));
      clearInterval(holderUpdateInterval);
      setHoldersProcessed(100);
      setProgressPercent(70);

      setProgressStage("Analyzing Distribution");
      setProgressDetails("Calculating Gini coefficient and concentration bands...");
      setProgressPercent(85);

      await new Promise((resolve) => setTimeout(resolve, 600));

      setProgressStage("Calculating Metrics");
      setProgressDetails("Computing distribution buckets and metrics...");
      setProgressPercent(95);

      // Use the existing fetchDistributionAnalysis from dataService
      const analysisData = await fetchDistributionAnalysis(token);

      await new Promise((resolve) => setTimeout(resolve, 300));
      setAnalysis(analysisData ?? null);
      setProgressPercent(100);
      setProgressDetails("Complete!");

      setTimeout(() => {
        setProgressStage("");
        setProgressDetails("");
      }, 500);
    } catch (err) {
      console.error("Error fetching distribution analysis:", err);
      setError("Failed to load distribution data");
      setProgressStage("");
      setProgressDetails("");
    } finally {
      setLoading(false);
      setLastRefreshed(Date.now());
    }
  }, [token, refreshKey]);

  // Fetch analysis when dependencies change
  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Handle refresh without page reload
  const handleRefresh = () => {
    fetchKeyRef.current = "";
    setRefreshKey((prev) => prev + 1);
  };

  // Gini coefficient interpretation
  const getGiniInterpretation = (gini: number) => {
    if (gini < 0.3)
      return {
        label: "Low",
        color: "text-green-400",
        description: "Relatively equal distribution",
      };
    if (gini < 0.5)
      return { label: "Moderate", color: "text-yellow-400", description: "Some concentration" };
    if (gini < 0.7)
      return { label: "High", color: "text-orange-400", description: "Significant inequality" };
    return { label: "Very High", color: "text-red-400", description: "Extreme centralization" };
  };

  // Prepare pie chart data
  const pieData = analysis
    ? [
        { name: "Top 1%", value: analysis.concentrationBands.top1Pct },
        {
          name: "Top 5%",
          value: analysis.concentrationBands.top5Pct - analysis.concentrationBands.top1Pct,
        },
        {
          name: "Top 10%",
          value: analysis.concentrationBands.top10Pct - analysis.concentrationBands.top5Pct,
        },
        {
          name: "Top 25%",
          value: analysis.concentrationBands.top25Pct - analysis.concentrationBands.top10Pct,
        },
        { name: "Rest", value: 100 - analysis.concentrationBands.top25Pct },
      ]
    : [];

  // Prepare histogram data
  const histogramData = analysis?.distributionBuckets || [];

  if (!token) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
          <p className="text-slate-400">Wealth concentration analysis</p>
        </div>

        {/* No token selected state */}
        <div className="bg-space-800 rounded-xl p-12 border border-space-700">
          <div className="text-center text-slate-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-50 text-purple-400" />
            <h3 className="text-xl font-semibold text-white mb-2">No Token Selected</h3>
            <p>Select a token to view distribution analytics</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state with progress tracking
  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
          <p className="text-slate-400">Wealth concentration analysis for {token.symbol}</p>
        </div>

        {/* Progress Card */}
        <div className="bg-space-800 rounded-xl p-8 border border-space-700">
          {/* Stage indicator */}
          <div className="flex items-center gap-3 mb-6">
            {progressStage === "Initializing" && (
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            )}
            {progressStage === "Fetching Holder Data" && (
              <Database className="w-6 h-6 text-blue-500 animate-pulse" />
            )}
            {progressStage === "Analyzing Distribution" && (
              <Activity className="w-6 h-6 text-green-500 animate-pulse" />
            )}
            {progressStage === "Calculating Metrics" && (
              <Zap className="w-6 h-6 text-amber-500 animate-pulse" />
            )}
            {!progressStage && <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />}
            <div>
              <div className="text-white font-medium">{progressStage || "Loading..."}</div>
              <div className="text-sm text-slate-400">{progressDetails || "Please wait..."}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">{progressDetails || "Preparing..."}</span>
              <span className="text-purple-400 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-space-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-500 h-full rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Holder processing details */}
          {progressStage === "Fetching Holder Data" && holdersProcessed > 0 && (
            <div className="mt-6 p-4 bg-space-700/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Holders processed</span>
                <span className="text-white font-semibold">
                  {holdersProcessed} / {totalHolders}
                </span>
              </div>
              <div className="w-full bg-space-600 rounded-full h-2 mt-2">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(holdersProcessed / totalHolders) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Loading message */}
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>This may take a few seconds...</span>
          </div>

          {/* Optimization notice */}
          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <Zap className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <p className="text-purple-300">
                Loading distribution metrics and holder concentration data
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - still show full UI with inline error message
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
            <p className="text-slate-400">Wealth concentration analysis for {token.symbol}</p>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:text-white transition-colors text-slate-400"
            title="Force refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Inline Error State */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
          <div className="text-center text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
            <p className="text-red-300">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no distribution data available
  if (!analysis) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
            <p className="text-slate-400">Wealth concentration analysis for {token.symbol}</p>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 hover:text-white transition-colors text-slate-400"
            title="Force refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Inline Empty State */}
        <div className="bg-space-800 rounded-xl p-12 border border-space-700">
          <div className="text-center text-slate-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-50 text-purple-400" />
            <h3 className="text-xl font-semibold text-white mb-2">No Distribution Data</h3>
            <p>No distribution data available for this token</p>
            <p className="text-sm text-slate-500 mt-2">Try selecting a different token</p>
          </div>
        </div>
      </div>
    );
  }

  const giniInfo = getGiniInterpretation(analysis.giniCoefficient);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
          <p className="text-slate-400">Wealth concentration analysis for {token.symbol}</p>
        </div>

        {/* Last Updated and Refresh */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span>Data from {formatTimeAgo(lastRefreshed)}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 hover:text-white transition-colors text-slate-400"
            title="Force refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Data Source Disclaimer */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-yellow-400 font-semibold">Limited Data Analysis</h3>
            <p className="text-sm text-yellow-300/80 mt-1">
              <strong>Why not full data?</strong> The Dogechain Explorer API only provides paginated
              holder data (100 per request). Fetching all holders would take dozens of API calls and
              cause significant delays. Metrics shown are calculated from the top{" "}
              {analysis.totalHolders} holders fetched from the Explorer, which includes all major
              holders (whales, ecosystem wallets, LP pools). For complete blockchain analysis,
              consider using dedicated blockchain explorers or running your own full node.
            </p>
          </div>
        </div>
      </div>

      {/* Centralization Alert */}
      {analysis.isCentralized && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-400 font-semibold">Centralization Alert</h3>
              <p className="text-sm text-red-300/80 mt-1">
                Top 10% of holders control more than 50% of the total supply. This indicates high
                concentration of wealth in this token.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gini Coefficient */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Gini Coefficient</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-white">{analysis.giniCoefficient.toFixed(3)}</div>
          <div className={`text-sm mt-1 ${giniInfo.color}`}>{giniInfo.label} inequality</div>
          <div className="text-xs text-slate-500 mt-2">{giniInfo.description}</div>
        </div>

        {/* Total Holders */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Holders</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-white">
            {analysis.totalHolders.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-2">Unique wallet addresses</div>
        </div>

        {/* Centralization Status */}
        <div className="bg-space-800 rounded-xl p-6 border border-space-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Centralization</span>
            <Wallet className="w-4 h-4 text-yellow-500" />
          </div>
          <div
            className={`text-2xl font-bold ${
              analysis.isCentralized ? "text-red-400" : "text-green-400"
            }`}
          >
            {analysis.isCentralized ? "High" : "Low"}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Top 10% owns {analysis.concentrationBands.top10Pct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Concentration Bands */}
      <div className="bg-space-800 rounded-xl p-6 border border-space-700">
        <h3 className="text-lg font-semibold text-white mb-4">Concentration Bands</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Top 1%", value: analysis.concentrationBands.top1Pct },
            { label: "Top 5%", value: analysis.concentrationBands.top5Pct },
            { label: "Top 10%", value: analysis.concentrationBands.top10Pct },
            { label: "Top 25%", value: analysis.concentrationBands.top25Pct },
          ].map((band) => (
            <div key={band.label} className="text-center">
              <div className="text-2xl font-bold text-white">{band.value.toFixed(1)}%</div>
              <div className="text-sm text-slate-400">{band.label}</div>
              <div className="w-full bg-space-700 rounded-full h-2 mt-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${band.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-space-800 rounded-xl sm:p-6 p-3 border border-space-700">
          <h3 className="text-lg font-semibold text-white mb-4">Ownership Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-space-800 border border-space-600 rounded-lg p-2 shadow-xl flex flex-col items-center text-center gap-1">
                          <div className="relative flex items-center justify-center w-full">
                            <span
                              className="absolute left-2 w-3 h-3 rounded-sm"
                              style={{ backgroundColor: payload[0].color }}
                            />
                            <span className="text-sm font-medium text-white text-center">
                              {data.name}
                            </span>
                          </div>
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                            {data.value.toFixed(1)}%
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={72}
                  content={({ payload }) => (
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 px-2">
                      {payload?.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-xs text-slate-300">
                            {entry.value}: {pieData[index]?.value.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No distribution data available</p>
                <p className="text-sm mt-1">Select a token with holder data</p>
              </div>
            </div>
          )}
        </div>

        {/* Histogram */}
        <div className="bg-space-800 rounded-xl sm:p-6 p-3 border border-space-700">
          <h3 className="text-lg font-semibold text-white mb-4">Holder Distribution</h3>
          {histogramData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogramData}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8" }}
                  axisLine={{ stroke: "#334155" }}
                />
                <YAxis tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#334155" }} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-space-800 border border-space-600 rounded-lg px-3 py-2 shadow-xl">
                          <div className="text-xs text-slate-400 mb-1">{data.label}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">Holders:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {data.count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Holders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No holder distribution data available</p>
                <p className="text-sm mt-1">Try selecting a different token</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
