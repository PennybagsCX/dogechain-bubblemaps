/**
 * Enhanced Price Chart Component
 *
 * Displays price trends using DexScreener data when OHLCV is unavailable
 * Shows price changes over multiple timeframes with line chart visualization
 */

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import * as DexScreener from "../../services/dexScreenerService";

interface PriceDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

interface PriceChartProps {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  height?: number;
  className?: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  poolAddress,
  token0Symbol,
  token1Symbol,
  height = 400,
  className = "",
}) => {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"1h" | "6h" | "1d">("1d");

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch pair data from DexScreener
        const pair = await DexScreener.getPairData("dogechain", poolAddress);

        if (!pair) {
          throw new Error("Pool data not found");
        }

        // Create price data points based on available price change data
        const currentPrice = parseFloat(pair.priceUsd || "0");
        const priceChange1h = pair.priceChange1h || 0;
        const priceChange6h = pair.priceChange6h || 0;
        const priceChange24h = pair.priceChange24h || 0;

        // Calculate historical prices based on current price and changes
        const now = Date.now();
        const dataPoints: PriceDataPoint[] = [];

        // Generate data points based on selected timeframe
        const intervals =
          timeframe === "1h"
            ? 12 // 5-minute intervals for 1 hour
            : timeframe === "6h"
              ? 24 // 15-minute intervals for 6 hours
              : 24; // 1-hour intervals for 1 day

        const intervalMs =
          timeframe === "1h" ? 5 * 60 * 1000 : timeframe === "6h" ? 15 * 60 * 1000 : 60 * 60 * 1000;

        const totalChange =
          timeframe === "1h" ? priceChange1h : timeframe === "6h" ? priceChange6h : priceChange24h;

        for (let i = intervals; i >= 0; i--) {
          const timestamp = now - i * intervalMs;
          // Simple price calculation based on linear change
          const changePercent = (totalChange / intervals) * (intervals - i);
          const price = currentPrice * (1 + changePercent / 100);

          dataPoints.push({
            timestamp,
            price,
            volume: i === 0 ? pair.volume24h || 0 : undefined,
          });
        }

        setPriceData(dataPoints);
      } catch (err) {
        console.error("[PriceChart] Failed to fetch price data:", err);
        setError("Unable to load price data");
      } finally {
        setLoading(false);
      }
    };

    fetchPriceData();
  }, [poolAddress, timeframe]);

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatYAxis = (value: number) => {
    return value > 0.0001 ? `$${value.toFixed(6)}` : `$${value.toExponential(2)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;
    const date = new Date(data.timestamp);

    return (
      <div className="bg-space-800 border border-space-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium mb-2">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </p>
        <div className="space-y-1 text-sm">
          <p className="flex justify-between gap-4">
            <span className="text-slate-400">Price:</span>
            <span className="text-white">{formatYAxis(data.price)}</span>
          </p>
          {data.volume && (
            <p className="flex justify-between gap-4">
              <span className="text-slate-400">24h Volume:</span>
              <span className="text-purple-400">${data.volume.toFixed(2)}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-space-800 rounded-xl border border-space-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <div className="w-8 h-8 mx-auto mb-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p>Loading price data...</p>
        </div>
      </div>
    );
  }

  if (error || priceData.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-space-800 rounded-xl border border-space-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium mb-1">No price data available</p>
          <p className="text-sm">Price chart data is not available for this pool</p>
          <p className="text-xs mt-2 text-slate-500">
            Try selecting a different pool or check back later
          </p>
        </div>
      </div>
    );
  }

  const priceChange =
    priceData.length > 1 && priceData[0]?.price
      ? (((priceData[priceData.length - 1]?.price ?? priceData[0].price) - priceData[0].price) /
          priceData[0].price) *
        100
      : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className={`bg-space-800 rounded-xl border border-space-700 p-6 ${className}`}>
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {token0Symbol} / {token1Symbol} Price Chart
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span
              className={`text-sm font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Timeframe buttons */}
        <div className="flex gap-2">
          {(["1h", "6h", "1d"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                timeframe === tf
                  ? "bg-purple-500 text-white"
                  : "bg-space-700 text-slate-400 hover:text-white"
              }`}
            >
              {tf === "1h" ? "1H" : tf === "6h" ? "6H" : "1D"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <LineChart data={priceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            axisLine={{ stroke: "#334155" }}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price"
            stroke={isPositive ? "#22c55e" : "#ef4444"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Current price display */}
      {priceData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-space-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Current Price:</span>
            <span className="text-white font-semibold text-lg">
              {formatYAxis(priceData[priceData.length - 1]?.price ?? 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
