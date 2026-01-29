/**
 * VolumeChart Component
 *
 * Displays OHLCV candlestick chart with volume overlay
 * using Recharts for data visualization.
 */

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Area,
} from "recharts";

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface VolumeChartProps {
  data: OHLCVData[];
  height?: number;
  className?: string;
}

// Custom tooltip - defined outside component to avoid recreation on render
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const date = new Date(data.timestamp * 1000);

  return (
    <div className="bg-space-800 border border-space-700 rounded-lg p-3 shadow-lg">
      <p className="text-white font-medium mb-2">
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </p>
      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">Open:</span>
          <span className="text-white">${data.open?.toFixed(2) || "0.00"}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">High:</span>
          <span className="text-green-400">${data.high?.toFixed(2) || "0.00"}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">Low:</span>
          <span className="text-red-400">${data.low?.toFixed(2) || "0.00"}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">Close:</span>
          <span className="text-white">${data.close?.toFixed(2) || "0.00"}</span>
        </p>
        <p className="flex justify-between gap-4 border-t border-space-700 pt-1 mt-1">
          <span className="text-slate-400">Volume:</span>
          <span className="text-purple-400">${data.volume?.toFixed(2) || "0.00"}</span>
        </p>
      </div>
    </div>
  );
};

export const VolumeChart: React.FC<VolumeChartProps> = ({ data, height = 400, className = "" }) => {
  // Format timestamp to readable time
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Transform data for chart - add candle color
  const chartData = data.map((d) => {
    const isBullish = d.close >= d.open;
    return {
      ...d,
      date: new Date(d.timestamp * 1000).toLocaleDateString(),
      candleColor: isBullish ? "#22c55e" : "#ef4444",
    };
  });

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-space-800 rounded-xl border border-space-700 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <svg
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <p>No chart data available</p>
          <p className="text-sm mt-1">Select a pool to view price charts</p>
        </div>
      </div>
    );
  }

  // Calculate min/max for Y axis
  const allPrices = data.flatMap((d) => [d.low, d.high]);
  const minPrice = Math.min(...allPrices) * 0.99;
  const maxPrice = Math.max(...allPrices) * 1.01;

  return (
    <div className={`bg-space-800 rounded-xl border border-space-700 p-6 ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            tick={{ fill: "#94a3b8" }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            yAxisId="price"
            domain={[minPrice, maxPrice]}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            tick={{ fill: "#94a3b8" }}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}K`}
            tick={{ fill: "#94a3b8" }}
            axisLine={{ stroke: "#334155" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {/* Volume bars */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#8b5cf6"
            opacity={0.3}
            name="Volume"
            barSize={20}
          />
          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            name="Price"
          />
          {/* Area under price line */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            fill="#8b5cf6"
            fillOpacity={0.1}
            stroke="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
