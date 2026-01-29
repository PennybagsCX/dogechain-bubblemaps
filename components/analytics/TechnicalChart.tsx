/**
 * Technical Analysis Chart Component
 *
 * Interactive price chart with technical indicators:
 * - SMA/EMA overlays
 * - RSI indicator
 * - MACD indicator
 * - Bollinger Bands
 * - Volume profile
 */

import React, { useState, useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Layers, BarChart3 } from "lucide-react";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVolumeProfile,
  generateTradingSignals,
  type PriceDataPoint,
} from "../../utils/technicalIndicators";

interface TechnicalChartProps {
  data: PriceDataPoint[];
  height?: number;
  className?: string;
  showControls?: boolean;
}

type IndicatorType =
  | "sma20"
  | "sma50"
  | "ema12"
  | "ema26"
  | "rsi"
  | "macd"
  | "bollinger"
  | "volume";

interface IndicatorConfig {
  id: IndicatorType;
  label: string;
  color: string;
  enabled: boolean;
}

export const TechnicalChart: React.FC<TechnicalChartProps> = ({
  data,
  height = 400,
  className = "",
  showControls = true,
}) => {
  const [enabledIndicators, setEnabledIndicators] = useState<Set<IndicatorType>>(
    new Set(["sma20", "bollinger"])
  );
  const [chartType, setChartType] = useState<"price" | "rsi" | "macd">("price");

  // Calculate indicators
  const indicators = useMemo(() => {
    const prices = data.map((d) => d.price);

    return {
      sma20: calculateSMA(prices, 20),
      sma50: calculateSMA(prices, 50),
      ema12: calculateEMA(prices, 12),
      ema26: calculateEMA(prices, 26),
      rsi: calculateRSI(prices, 14),
      macd: calculateMACD(prices),
      bollingerBands: calculateBollingerBands(prices),
      volumeProfile: calculateVolumeProfile(data),
    };
  }, [data]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.map((point, index) => {
      const item: any = {
        timestamp: point.timestamp,
        date: new Date(point.timestamp).toLocaleDateString(),
        price: point.price,
        volume: point.volume || 0,
      };

      // Add indicators if enabled
      if (enabledIndicators.has("sma20") && indicators.sma20[index]) {
        item.sma20 = indicators.sma20[index];
      }
      if (enabledIndicators.has("sma50") && indicators.sma50[index]) {
        item.sma50 = indicators.sma50[index];
      }
      if (enabledIndicators.has("ema12") && indicators.ema12[index]) {
        item.ema12 = indicators.ema12[index];
      }
      if (enabledIndicators.has("ema26") && indicators.ema26[index]) {
        item.ema26 = indicators.ema26[index];
      }
      if (enabledIndicators.has("rsi") && indicators.rsi[index]) {
        item.rsi = indicators.rsi[index];
      }
      if (enabledIndicators.has("bollinger") && indicators.bollingerBands[index]) {
        const bb = indicators.bollingerBands[index];
        item.upperBand = bb.upper;
        item.middleBand = bb.middle;
        item.lowerBand = bb.lower;
      }
      if (enabledIndicators.has("macd") && indicators.macd[index]) {
        const macd = indicators.macd[index];
        item.macd = macd.macd;
        item.macdSignal = macd.signal;
        item.macdHistogram = macd.histogram;
      }

      return item;
    });
  }, [data, indicators, enabledIndicators]);

  // Toggle indicator
  const toggleIndicator = (indicator: IndicatorType) => {
    setEnabledIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(indicator)) {
        next.delete(indicator);
      } else {
        next.add(indicator);
      }
      return next;
    });
  };

  // Get latest signal
  const latestSignal = useMemo(() => {
    if (chartData.length === 0) return null;

    const latest = chartData[chartData.length - 1];
    return generateTradingSignals({
      price: latest.price,
      rsi: latest.rsi,
      macd: { macd: latest.macd, signal: latest.macdSignal },
      bollingerBands: {
        upper: latest.upperBand,
        lower: latest.lowerBand,
        middle: latest.middleBand,
      },
    });
  }, [chartData]);

  // Indicator configs
  const indicatorConfigs: IndicatorConfig[] = [
    { id: "sma20", label: "SMA 20", color: "#3b82f6", enabled: enabledIndicators.has("sma20") },
    { id: "sma50", label: "SMA 50", color: "#8b5cf6", enabled: enabledIndicators.has("sma50") },
    { id: "ema12", label: "EMA 12", color: "#06b6d4", enabled: enabledIndicators.has("ema12") },
    { id: "ema26", label: "EMA 26", color: "#f59e0b", enabled: enabledIndicators.has("ema26") },
    { id: "rsi", label: "RSI", color: "#10b981", enabled: enabledIndicators.has("rsi") },
    { id: "macd", label: "MACD", color: "#ef4444", enabled: enabledIndicators.has("macd") },
    {
      id: "bollinger",
      label: "Bollinger Bands",
      color: "#6366f1",
      enabled: enabledIndicators.has("bollinger"),
    },
    { id: "volume", label: "Volume", color: "#f97316", enabled: enabledIndicators.has("volume") },
  ];

  return (
    <div className={`bg-space-800 rounded-lg p-4 border border-space-700 ${className}`}>
      {/* Header with controls */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Technical Analysis</h3>
            {latestSignal && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  latestSignal === "buy"
                    ? "bg-green-500/20 text-green-400"
                    : latestSignal === "sell"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-slate-500/20 text-slate-400"
                }`}
              >
                {latestSignal === "buy" && <TrendingUp className="w-3 h-3 inline mr-1" />}
                {latestSignal === "sell" && <TrendingDown className="w-3 h-3 inline mr-1" />}
                {latestSignal.toUpperCase()} SIGNAL
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Chart type selector */}
            <div className="flex bg-space-700 rounded-lg p-1">
              {[
                { value: "price", label: "Price", icon: TrendingUp },
                { value: "rsi", label: "RSI", icon: Activity },
                { value: "macd", label: "MACD", icon: BarChart3 },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setChartType(type.value as any)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                    chartType === type.value
                      ? "bg-purple-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <type.icon className="w-3 h-3" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Indicator toggles */}
      {showControls && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Indicators:
          </span>
          {indicatorConfigs.map((config) => (
            <button
              key={config.id}
              onClick={() => toggleIndicator(config.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                config.enabled
                  ? "bg-space-700 text-white border-l-2"
                  : "bg-space-800 text-slate-500 hover:text-slate-300 border-l-2 border-transparent"
              }`}
              style={
                config.enabled
                  ? { borderColor: config.color, backgroundColor: `${config.color}20` }
                  : undefined
              }
            >
              {config.label}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {chartType === "price" && (
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              domain={["auto", "auto"]}
              tickFormatter={(value) => `$${value.toFixed(4)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#f3f4f6" }}
              formatter={(value: any, name?: string) => {
                if (name === "volume") return `$${value.toFixed(2)}`;
                if (typeof value === "number") return `$${value.toFixed(6)}`;
                return value;
              }}
            />
            <Legend />

            {/* Bollinger Bands area */}
            {enabledIndicators.has("bollinger") && (
              <>
                <Area
                  type="monotone"
                  dataKey="upperBand"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.1}
                  name="Upper Band"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="lowerBand"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.1}
                  name="Lower Band"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="middleBand"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="BB Middle"
                  dot={false}
                />
              </>
            )}

            {/* Price line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#a855f7"
              strokeWidth={2}
              name="Price"
              dot={false}
            />

            {/* SMA lines */}
            {enabledIndicators.has("sma20") && (
              <Line
                type="monotone"
                dataKey="sma20"
                stroke="#3b82f6"
                strokeWidth={1.5}
                name="SMA 20"
                dot={false}
              />
            )}
            {enabledIndicators.has("sma50") && (
              <Line
                type="monotone"
                dataKey="sma50"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                name="SMA 50"
                dot={false}
              />
            )}

            {/* EMA lines */}
            {enabledIndicators.has("ema12") && (
              <Line
                type="monotone"
                dataKey="ema12"
                stroke="#06b6d4"
                strokeWidth={1.5}
                name="EMA 12"
                dot={false}
              />
            )}
            {enabledIndicators.has("ema26") && (
              <Line
                type="monotone"
                dataKey="ema26"
                stroke="#f59e0b"
                strokeWidth={1.5}
                name="EMA 26"
                dot={false}
              />
            )}

            {/* Volume bars */}
            {enabledIndicators.has("volume") && (
              <Bar dataKey="volume" fill="#f97316" opacity={0.3} name="Volume" yAxisId={1} />
            )}
          </ComposedChart>
        )}

        {chartType === "rsi" && (
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              domain={[0, 100]}
              label={{ value: "RSI", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#f3f4f6" }}
              formatter={(value?: number) => (value !== undefined ? value.toFixed(2) : "N/A")}
            />
            <Legend />

            {/* Overbought/Oversold zones */}
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label="Overbought" />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label="Oversold" />

            {/* RSI line */}
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#10b981"
              strokeWidth={2}
              name="RSI (14)"
              dot={false}
            />
          </ComposedChart>
        )}

        {chartType === "macd" && (
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              label={{ value: "MACD", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#f3f4f6" }}
              formatter={(value?: number) => (value !== undefined ? value.toFixed(6) : "N/A")}
            />
            <Legend />

            {/* MACD Histogram */}
            <Bar dataKey="macdHistogram" fill="#10b981" name="Histogram" opacity={0.5} />

            {/* MACD line */}
            <Line
              type="monotone"
              dataKey="macd"
              stroke="#3b82f6"
              strokeWidth={2}
              name="MACD"
              dot={false}
            />

            {/* Signal line */}
            <Line
              type="monotone"
              dataKey="macdSignal"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Signal"
              dot={false}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Volume Profile (bottom section) */}
      {enabledIndicators.has("volume") && indicators.volumeProfile.length > 0 && (
        <div className="mt-4 border-t border-space-700 pt-4">
          <h4 className="text-sm font-medium text-white mb-2">Volume Profile</h4>
          <div className="flex items-end gap-1 h-20">
            {indicators.volumeProfile.slice(0, 30).map((bucket, index) => (
              <div
                key={index}
                className="flex-1 bg-gradient-to-t from-orange-500 to-orange-300 rounded-t"
                style={{ height: `${bucket.percentage}%`, opacity: 0.6 }}
                title={`$${bucket.priceRange[0].toFixed(6)} - $${bucket.priceRange[1].toFixed(6)}: ${bucket.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
