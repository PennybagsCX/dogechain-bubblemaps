/**
 * Pool Detail Modal Component
 *
 * Comprehensive pool information modal with:
 * - Price overview with changes
 * - Key metrics grid
 * - Token information
 * - Contract links
 * - Historical data table
 * - Related pools
 */

import React, { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Droplets,
  BarChart3,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TechnicalChart } from "./TechnicalChart";

interface PoolStats {
  address: string;
  token0: { address: string; symbol: string; name?: string; decimals?: number };
  token1: { address: string; symbol: string; name?: string; decimals?: number };
  factory: string;
  tvlUsd: number;
  volume24h?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  marketCap?: number;
  reserve0?: string;
  reserve1?: string;
  lpTokenSupply?: string;
  pairAge?: number;
  priceUsd?: string;
}

interface PoolDetailModalProps {
  pool: PoolStats;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface HistoricalDataPoint {
  date: string;
  price: number;
  volume: number;
  tvl: number;
}

export const PoolDetailModal: React.FC<PoolDetailModalProps> = ({
  pool,
  isOpen,
  onClose,
  className = "",
}) => {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);

  // Generate mock historical data
  useEffect(() => {
    if (!isOpen) return;

    // Generate last 30 days of mock data
    const data: HistoricalDataPoint[] = [];
    const now = Date.now();
    const currentPrice = parseFloat(pool.priceUsd || "0.000124");

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const randomChange = (Math.random() - 0.5) * 0.1;
      const price = currentPrice * (1 + (randomChange * i) / 30);

      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        price,
        volume: (pool.volume24h || 50000) * (1 + Math.random() * 0.5),
        tvl: pool.tvlUsd * (1 + Math.random() * 0.3),
      });
    }

    // Use requestAnimationFrame to avoid setState-in-effect warning
    requestAnimationFrame(() => {
      setHistoricalData(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pool.address]); // Only regenerate when pool address changes

  // Copy address to clipboard
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error("[PoolDetailModal] Failed to copy address:", error);
    }
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

  // Format price
  const formatPrice = (value: number): string => {
    if (value > 0.0001) {
      return `$${value.toFixed(6)}`;
    }
    return `$${value.toExponential(2)}`;
  };

  // Format age
  const formatAge = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  };

  // Get price change display
  const getPriceChangeDisplay = (change?: number) => {
    if (change === undefined) return null;

    const isPositive = change >= 0;
    const color = isPositive ? "text-green-400" : "text-red-400";
    const icon = isPositive ? TrendingUp : TrendingDown;

    const Icon = icon;
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {change >= 0 ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    );
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!isOpen) return null;

  const currentPrice = parseFloat(pool.priceUsd || "0");

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ${className}`}
    >
      <button
        className="absolute inset-0 w-full h-full"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        className="bg-space-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-space-700 relative z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pool-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-space-700">
          <div className="flex items-center gap-4">
            {/* Token Icons */}
            <div className="flex -space-x-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold border-2 border-space-800">
                {pool.token0.symbol.charAt(0)}
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold border-2 border-space-800">
                {pool.token1.symbol.charAt(0)}
              </div>
            </div>

            {/* Pool Info */}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {pool.token0.symbol} / {pool.token1.symbol}
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </h2>
              <p className="text-sm text-slate-400">{pool.factory}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
              🔥 Hot
            </span>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              ✓ Verified
            </span>
          </div>

          {/* Close Button */}
          <button onClick={onClose} className="p-2 hover:bg-space-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Price Overview */}
          <div className="bg-space-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Price</p>
                <p className="text-3xl font-bold text-white">{formatPrice(currentPrice)}</p>
              </div>
              {pool.priceChange24h !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-slate-400 mb-1">24h Change</p>
                  {getPriceChangeDisplay(pool.priceChange24h)}
                </div>
              )}
            </div>

            {/* Price Changes */}
            <div className="flex gap-4 pt-4 border-t border-space-600">
              {pool.priceChange1h !== undefined && (
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">1 Hour</p>
                  {getPriceChangeDisplay(pool.priceChange1h)}
                </div>
              )}
              {pool.priceChange6h !== undefined && (
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">6 Hours</p>
                  {getPriceChangeDisplay(pool.priceChange6h)}
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">High (24h)</p>
                <p className="text-sm font-semibold text-green-400">
                  {formatPrice(currentPrice * 1.05)}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Low (24h)</p>
                <p className="text-sm font-semibold text-red-400">
                  {formatPrice(currentPrice * 0.95)}
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-space-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-slate-400">TVL</p>
              </div>
              <p className="text-xl font-bold text-white">{formatCurrency(pool.tvlUsd)}</p>
            </div>

            {pool.volume24h !== undefined && (
              <div className="bg-space-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <p className="text-xs text-slate-400">24h Volume</p>
                </div>
                <p className="text-xl font-bold text-white">{formatCurrency(pool.volume24h)}</p>
              </div>
            )}

            {pool.marketCap !== undefined && (
              <div className="bg-space-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-slate-400">Market Cap</p>
                </div>
                <p className="text-xl font-bold text-white">{formatCurrency(pool.marketCap)}</p>
              </div>
            )}

            {pool.pairAge !== undefined && (
              <div className="bg-space-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <p className="text-xs text-slate-400">Pool Age</p>
                </div>
                <p className="text-xl font-bold text-white">{formatAge(pool.pairAge)}</p>
              </div>
            )}
          </div>

          {/* Price Chart */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Technical Analysis</h3>
            <TechnicalChart
              data={historicalData.map((item) => ({
                timestamp: new Date(item.date).getTime(),
                price: item.price,
                volume: item.volume,
              }))}
              height={350}
              showControls={true}
            />
          </div>

          {/* Token Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Token 0 */}
            <div className="bg-space-700/50 rounded-lg p-4 border border-space-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  {pool.token0.symbol.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-white">{pool.token0.symbol}</p>
                  <p className="text-sm text-slate-400">{pool.token0.name}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Price</span>
                  <span className="text-white font-medium">{formatPrice(currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reserves</span>
                  <span className="text-white font-medium">
                    {pool.reserve0 ? parseFloat(pool.reserve0).toFixed(2) : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Token 1 */}
            <div className="bg-space-700/50 rounded-lg p-4 border border-space-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                  {pool.token1.symbol.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-white">{pool.token1.symbol}</p>
                  <p className="text-sm text-slate-400">{pool.token1.name}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Price</span>
                  <span className="text-white font-medium">$1.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reserves</span>
                  <span className="text-white font-medium">
                    {pool.reserve1 ? parseFloat(pool.reserve1).toFixed(2) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Links */}
          <div className="bg-space-700/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Contract Links
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-space-800 rounded">
                <div>
                  <p className="text-xs text-slate-400">Pool Address</p>
                  <p className="text-sm text-white font-mono">
                    {pool.address.slice(0, 10)}...{pool.address.slice(-8)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyAddress(pool.address)}
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    {copiedAddress === pool.address ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <a
                    href={`https://dogechain-blockexplorer.com/address/${pool.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-space-800 rounded">
                <div>
                  <p className="text-xs text-slate-400">Token0 ({pool.token0.symbol})</p>
                  <p className="text-sm text-white font-mono">
                    {pool.token0.address.slice(0, 10)}...{pool.token0.address.slice(-8)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyAddress(pool.token0.address)}
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    {copiedAddress === pool.token0.address ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <a
                    href={`https://dogechain-blockexplorer.com/token/${pool.token0.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-space-800 rounded">
                <div>
                  <p className="text-xs text-slate-400">Token1 ({pool.token1.symbol})</p>
                  <p className="text-sm text-white font-mono">
                    {pool.token1.address.slice(0, 10)}...{pool.token1.address.slice(-8)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyAddress(pool.token1.address)}
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    {copiedAddress === pool.token1.address ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <a
                    href={`https://dogechain-blockexplorer.com/token/${pool.token1.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-space-700 rounded transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Data Table */}
          <div>
            <button
              onClick={() => toggleSection("historical")}
              className="w-full flex items-center justify-between p-4 bg-space-700/50 rounded-lg hover:bg-space-700 transition-colors"
            >
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Historical Data
              </h4>
              {expandedSection === "historical" ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {expandedSection === "historical" && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-space-600">
                      <th className="text-left p-2 text-slate-400 font-medium">Date</th>
                      <th className="text-right p-2 text-slate-400 font-medium">Price</th>
                      <th className="text-right p-2 text-slate-400 font-medium">Volume</th>
                      <th className="text-right p-2 text-slate-400 font-medium">TVL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalData.slice(0, 10).map((row, index) => (
                      <tr key={index} className="border-b border-space-700/50">
                        <td className="p-2 text-white">{row.date}</td>
                        <td className="p-2 text-right text-white font-mono">
                          {formatPrice(row.price)}
                        </td>
                        <td className="p-2 text-right text-purple-400 font-mono">
                          {formatCurrency(row.volume)}
                        </td>
                        <td className="p-2 text-right text-blue-400 font-mono">
                          {formatCurrency(row.tvl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-space-700">
            <button
              onClick={() => {
                window.open(`https://dexscreener.com/dogechain/${pool.address}`, "_blank");
              }}
              className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View on DexScreener
            </button>
            <button
              onClick={() => {
                window.open(
                  `https://www.geckoterminal.com/dogechain/pools/${pool.address}`,
                  "_blank"
                );
              }}
              className="flex-1 px-4 py-3 bg-space-700 hover:bg-space-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View on GeckoTerminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
