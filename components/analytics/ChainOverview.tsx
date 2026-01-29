/**
 * ChainOverview Component
 *
 * Displays chain-level metrics for Dogechain including:
 * - Total TVL
 * - 24h DEX volume
 * - Active pools count
 * - Daily active users
 */

import React from "react";
import { Layers3, DollarSign, TrendingUp, Users } from "lucide-react";

export interface ChainMetrics {
  chainName: string;
  totalTVL: number;
  dexVolume24h: number;
  dexVolume7d: number;
  activePools: number;
  dailyUsers: number;
}

interface ChainOverviewProps {
  metrics: ChainMetrics | null;
  loading?: boolean;
  className?: string;
}

export const ChainOverview: React.FC<ChainOverviewProps> = ({
  metrics,
  loading = false,
  className = "",
}) => {
  const formatCurrency = (value: number): string => {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number): string => {
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <div className={`bg-space-800 rounded-xl border border-space-700 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-space-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-space-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`bg-space-800 rounded-xl border border-space-700 p-6 ${className}`}>
        <div className="text-center text-slate-400 py-12">
          <Layers3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No chain metrics available</p>
          <p className="text-sm mt-2">
            Try again later or check if the analytics service is running
          </p>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Total TVL",
      value: formatCurrency(metrics.totalTVL),
      icon: DollarSign,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: "24h Volume",
      value: formatCurrency(metrics.dexVolume24h),
      icon: TrendingUp,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "Active Pools",
      value: formatNumber(metrics.activePools),
      icon: Layers3,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Daily Users",
      value: formatNumber(metrics.dailyUsers),
      icon: Users,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
  ];

  return (
    <div className={`bg-space-800 rounded-xl border border-space-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Chain Overview</h3>
          <p className="text-slate-400 text-sm">Dogechain network metrics</p>
        </div>
        <div className="px-3 py-1 bg-space-700 rounded-full">
          <span className="text-xs text-slate-300">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-space-700/50 rounded-lg p-4 hover:bg-space-700 transition-colors"
            >
              <div
                className={`${card.bgColor} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}
              >
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-sm text-slate-400 mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* Additional 7-day volume if available */}
      {metrics.dexVolume7d > 0 && (
        <div className="mt-6 pt-6 border-t border-space-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">7-Day DEX Volume</span>
            <span className="text-lg font-semibold text-white">
              {formatCurrency(metrics.dexVolume7d)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
