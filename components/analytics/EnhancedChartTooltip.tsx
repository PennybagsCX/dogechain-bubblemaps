/**
 * Enhanced Chart Tooltip Component
 *
 * Displays comprehensive pool metrics on hover:
 * - Price and price changes
 * - Volume and liquidity
 * - Trading range (high/low)
 * - Technical indicators (MA, RSI)
 * - Trade count and market depth
 */

import React from "react";
import { TrendingUp, TrendingDown, Activity, Droplets, BarChart3 } from "lucide-react";

export interface TooltipData {
  timestamp: number;
  price: number;
  volume?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  high24h?: number;
  low24h?: number;
  liquidity?: number;
  trades?: number;
  // Technical indicators
  ma7?: number;
  ma25?: number;
  rsi?: number;
  // Token symbols for formatting
  token0Symbol?: string;
  token1Symbol?: string;
}

interface EnhancedChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TooltipData;
  }>;
  token0Symbol?: string;
  token1Symbol?: string;
}

export const EnhancedChartTooltip: React.FC<EnhancedChartTooltipProps> = ({
  active,
  payload,
  token0Symbol = "TOKEN0",
  token1Symbol = "TOKEN1",
}) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  const date = new Date(data.timestamp);

  // Format price
  const formatPrice = (value: number): string => {
    if (value > 0.0001) {
      return `$${value.toFixed(6)}`;
    }
    return `$${value.toExponential(2)}`;
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

  // Format number with commas
  const formatNumber = (value: number): string => {
    return value.toLocaleString("en-US");
  };

  // Determine price change color and icon
  const getPriceChangeDisplay = (change?: number) => {
    if (change === undefined) return null;

    const isPositive = change >= 0;
    const color = isPositive ? "text-green-400" : "text-red-400";
    const icon = isPositive ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );

    return (
      <span className={`flex items-center gap-1 ${color}`}>
        {icon}
        {change >= 0 ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    );
  };

  // Get RSI color
  const getRSIColor = (rsi?: number): string => {
    if (!rsi) return "text-slate-400";
    if (rsi >= 70) return "text-red-400"; // Overbought
    if (rsi <= 30) return "text-green-400"; // Oversold
    return "text-yellow-400"; // Neutral
  };

  // Get MA trend icon
  const getMATrend = (current?: number, ma?: number): React.ReactNode => {
    if (!current || !ma) return null;
    if (current > ma) return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (current < ma) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <span className="w-3 h-3 text-slate-400">—</span>;
  };

  return (
    <div className="bg-space-800/95 backdrop-blur-sm border border-space-700 rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px] z-50">
      {/* Header with timestamp */}
      <div className="border-b border-space-700 pb-3 mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
          {date.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-sm text-slate-400">
          {date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      </div>

      {/* Main price display */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Price</p>
            <p className="text-2xl font-bold text-white">{formatPrice(data.price)}</p>
          </div>
          {data.priceChange24h !== undefined && (
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">24h Change</p>
              {getPriceChangeDisplay(data.priceChange24h)}
            </div>
          )}
        </div>
      </div>

      {/* Price changes grid */}
      {(data.priceChange1h !== undefined || data.priceChange6h !== undefined) && (
        <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-space-700/50 rounded-lg">
          {data.priceChange1h !== undefined && (
            <div>
              <p className="text-xs text-slate-500 mb-1">1 Hour</p>
              {getPriceChangeDisplay(data.priceChange1h)}
            </div>
          )}
          {data.priceChange6h !== undefined && (
            <div>
              <p className="text-xs text-slate-500 mb-1">6 Hours</p>
              {getPriceChangeDisplay(data.priceChange6h)}
            </div>
          )}
        </div>
      )}

      {/* Trading range */}
      {(data.high24h !== undefined || data.low24h !== undefined) && (
        <div className="mb-4 p-3 bg-space-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <p className="text-xs text-slate-500 uppercase tracking-wider">24h Range</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            {data.high24h !== undefined && (
              <div>
                <p className="text-xs text-slate-500">High</p>
                <p className="text-sm font-semibold text-green-400">{formatPrice(data.high24h)}</p>
              </div>
            )}
            {data.low24h !== undefined && (
              <div>
                <p className="text-xs text-slate-500">Low</p>
                <p className="text-sm font-semibold text-red-400">{formatPrice(data.low24h)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Volume and liquidity */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {data.volume !== undefined && (
          <div className="p-3 bg-space-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-slate-500">Volume</p>
            </div>
            <p className="text-sm font-semibold text-white">{formatCurrency(data.volume)}</p>
          </div>
        )}
        {data.liquidity !== undefined && (
          <div className="p-3 bg-space-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-slate-500">Liquidity</p>
            </div>
            <p className="text-sm font-semibold text-white">{formatCurrency(data.liquidity)}</p>
          </div>
        )}
      </div>

      {/* Trade count */}
      {data.trades !== undefined && (
        <div className="mb-4 p-3 bg-space-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Trades</span>
            <span className="text-sm font-semibold text-white">{formatNumber(data.trades)}</span>
          </div>
        </div>
      )}

      {/* Technical indicators */}
      {(data.ma7 !== undefined || data.ma25 !== undefined || data.rsi !== undefined) && (
        <div className="border-t border-space-700 pt-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Indicators</p>

          {/* Moving Averages */}
          <div className="space-y-2 mb-3">
            {data.ma7 !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">MA7</span>
                <div className="flex items-center gap-2">
                  {getMATrend(data.price, data.ma7)}
                  <span className="text-white font-mono">{formatPrice(data.ma7)}</span>
                </div>
              </div>
            )}
            {data.ma25 !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">MA25</span>
                <div className="flex items-center gap-2">
                  {getMATrend(data.price, data.ma25)}
                  <span className="text-white font-mono">{formatPrice(data.ma25)}</span>
                </div>
              </div>
            )}
          </div>

          {/* RSI */}
          {data.rsi !== undefined && (
            <div className="flex items-center justify-between text-sm p-2 bg-space-700/30 rounded">
              <span className="text-slate-400">RSI</span>
              <div className="flex items-center gap-2">
                {/* RSI gauge bar */}
                <div className="w-16 h-1.5 bg-space-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      data.rsi >= 70
                        ? "bg-red-500"
                        : data.rsi <= 30
                          ? "bg-green-500"
                          : "bg-yellow-500"
                    }`}
                    style={{ width: `${data.rsi}%` }}
                  />
                </div>
                <span className={`font-mono font-bold ${getRSIColor(data.rsi)}`}>
                  {data.rsi.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pair name footer */}
      <div className="mt-3 pt-3 border-t border-space-700 text-center">
        <p className="text-xs text-slate-500">
          {token0Symbol} / {token1Symbol}
        </p>
      </div>
    </div>
  );
};

/**
 * Lightweight Tooltip for space-constrained areas
 */
interface LightweightTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TooltipData;
  }>;
  label?: string;
}

export const LightweightTooltip: React.FC<LightweightTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  const formatPrice = (value: number) =>
    value > 0.0001 ? `$${value.toFixed(6)}` : `$${value.toExponential(2)}`;

  return (
    <div className="bg-space-800 border border-space-700 rounded-lg shadow-lg p-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{formatPrice(data.price)}</p>
      {data.volume !== undefined && (
        <p className="text-xs text-slate-400 mt-1">Vol: ${data.volume.toLocaleString()}</p>
      )}
    </div>
  );
};
