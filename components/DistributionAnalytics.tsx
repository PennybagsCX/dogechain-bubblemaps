/**
 * Token Distribution Analytics Dashboard
 *
 * Displays wealth concentration metrics for tokens including:
 * - Gini coefficient
 * - Holder concentration bands (top 1%, 5%, 10%, 25%)
 * - Distribution histogram
 * - Centralization alerts
 */

import React, { useState, useEffect } from "react";
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
import { AlertTriangle, TrendingUp, Users, Wallet } from "lucide-react";
import { Token } from "../types";
import { fetchDistributionAnalysis } from "../services/dataService";

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

export const DistributionAnalytics: React.FC<DistributionAnalyticsProps> = ({
  token,
  className = "",
}) => {
  const [analysis, setAnalysis] = useState<DistributionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        // Use the existing fetchDistributionAnalysis from dataService
        const analysisData = await fetchDistributionAnalysis(token);
        setAnalysis(analysisData ?? null);
        setError(null);
      } catch (err) {
        console.error("Error fetching distribution analysis:", err);
        setError("Failed to load distribution data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [token]);

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
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a token to view distribution analytics</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-space-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-space-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{error || "Unable to load distribution analytics"}</p>
        </div>
      </div>
    );
  }

  const giniInfo = getGiniInterpretation(analysis.giniCoefficient);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Distribution Analytics</h2>
        <p className="text-slate-400">Wealth concentration analysis for {token.symbol}</p>
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
                  formatter={(value?: number) => [`${value?.toFixed(1) ?? "0"}%`, "Ownership"]}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
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
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
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
