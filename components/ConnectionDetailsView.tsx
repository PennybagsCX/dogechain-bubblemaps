import { useState, useMemo, useCallback } from "react";
import { Connection, Wallet, ConnectionStats } from "../types";
import { ExternalLink } from "lucide-react";
import { Tooltip } from "./Tooltip";

type DirectionFilter = "ALL" | "IN" | "OUT";

const BLOCKSCOUT_BASE_URL = "https://explorer.dogechain.dog";

interface ConnectionDetailsViewProps {
  connection: Connection;
  sourceWallet: Wallet | undefined;
  targetWallet: Wallet | undefined;
  tokenSymbol: string;
}

export function ConnectionDetailsView({
  connection,
  sourceWallet,
  targetWallet,
  tokenSymbol,
}: ConnectionDetailsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const ITEMS_PER_PAGE = 20;

  // Filter transactions by direction
  const filteredTransactions = useMemo(() => {
    if (!connection.transactions || connection.transactions.length === 0) return [];

    if (directionFilter === "ALL") return connection.transactions;

    return connection.transactions.filter((tx) => {
      const isFromSource =
        sourceWallet && tx.from.toLowerCase() === sourceWallet.address.toLowerCase();
      return directionFilter === "IN" ? !isFromSource : isFromSource;
    });
  }, [connection.transactions, directionFilter, sourceWallet]);

  // Paginate transactions
  const paginatedTransactions = useMemo(() => {
    const endIndex = currentPage * ITEMS_PER_PAGE;
    return filteredTransactions.slice(0, endIndex);
  }, [filteredTransactions, currentPage]);

  const hasMore = paginatedTransactions.length < filteredTransactions.length;

  const handleLoadMore = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  const handleFilterChange = useCallback((filter: DirectionFilter) => {
    setDirectionFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes
  }, []);

  // Format value - already human-readable from dataService
  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format flow direction
  const formatDirection = (stats: ConnectionStats) => {
    if (stats.flowDirection === "balanced") {
      return "Balanced flow";
    } else if (stats.flowDirection === "source_to_target") {
      return `Mostly ${sourceWallet?.address.slice(0, 8)}... → ${targetWallet?.address.slice(0, 8)}...`;
    } else {
      return `Mostly ${targetWallet?.address.slice(0, 8)}... → ${sourceWallet?.address.slice(0, 8)}...`;
    }
  };

  const renderDirection = (stats: ConnectionStats) => {
    if (stats.flowDirection === "balanced") return <span>Balanced flow</span>;

    const fromAddress =
      stats.flowDirection === "source_to_target"
        ? sourceWallet?.address || "Source"
        : targetWallet?.address || "Target";

    const toAddress =
      stats.flowDirection === "source_to_target"
        ? targetWallet?.address || "Target"
        : sourceWallet?.address || "Source";

    return (
      <span className="flex flex-col gap-0.5">
        <span className="shrink-0">Mostly</span>
        <a
          className="font-mono text-purple-200 break-all leading-snug hover:text-purple-100 underline decoration-purple-400/60 underline-offset-2"
          title={fromAddress}
          href={`${BLOCKSCOUT_BASE_URL}/address/${fromAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {fromAddress}
        </a>
        <a
          className="font-mono text-purple-200 break-all leading-snug hover:text-purple-100 underline decoration-purple-400/60 underline-offset-2"
          title={toAddress}
          href={`${BLOCKSCOUT_BASE_URL}/address/${toAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          → {toAddress}
        </a>
      </span>
    );
  };

  // Loading state
  if (connection.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-doge-500 mb-4"></div>
          <p className="text-sm text-slate-400">Loading connection details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (connection.error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">Error loading connection details</p>
          <p className="text-xs text-slate-500">{connection.error}</p>
        </div>
      </div>
    );
  }

  // No transactions
  if (!connection.transactions || connection.transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">No transactions found between these wallets</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics Card */}
      {connection.stats && (
        <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-lg p-4 sm:p-5 border border-purple-700/30">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Summary Statistics</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs text-slate-400">Total Transactions</p>
              <p className="text-lg sm:text-xl font-semibold text-white">
                {connection.stats.totalTransactions.toLocaleString()}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs text-slate-400">Total Volume</p>
              <p className="text-lg sm:text-xl font-semibold text-white break-all">
                {formatValue(connection.stats.totalVolume)} {tokenSymbol}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs text-slate-400">Average Amount</p>
              <p className="text-lg sm:text-xl font-semibold text-white break-all">
                {formatValue(connection.stats.averageAmount)} {tokenSymbol}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] sm:text-xs text-slate-400">Flow Direction</p>
              <div
                className="text-xs text-purple-300 flex flex-col gap-0.5 whitespace-normal break-words leading-snug w-full"
                title={formatDirection(connection.stats)}
              >
                {renderDirection(connection.stats)}
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          {(connection.stats.firstTransaction || connection.stats.lastTransaction) && (
            <div className="mt-4 pt-4 border-t border-purple-700/30 grid grid-cols-2 gap-4">
              {connection.stats.firstTransaction && (
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs text-slate-400">First Transaction</p>
                  <p className="text-[10px] sm:text-xs text-slate-300">
                    {formatTimestamp(connection.stats.firstTransaction)}
                  </p>
                </div>
              )}
              {connection.stats.lastTransaction && (
                <div className="space-y-1">
                  <p className="text-[10px] sm:text-xs text-slate-400">Last Transaction</p>
                  <p className="text-[10px] sm:text-xs text-slate-300">
                    {formatTimestamp(connection.stats.lastTransaction)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Direction Filter Bar */}
      <div className="flex items-center gap-2 bg-space-900 rounded-lg p-2">
        <button
          onClick={() => handleFilterChange("ALL")}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            directionFilter === "ALL"
              ? "bg-doge-600 text-white"
              : "bg-space-800 text-slate-400 hover:text-white hover:bg-space-700"
          }`}
        >
          ALL ({filteredTransactions.length})
        </button>
        <button
          onClick={() => handleFilterChange("IN")}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            directionFilter === "IN"
              ? "bg-doge-600 text-white"
              : "bg-space-800 text-slate-400 hover:text-white hover:bg-space-700"
          }`}
        >
          IN ({connection.stats?.toCount || 0})
        </button>
        <button
          onClick={() => handleFilterChange("OUT")}
          className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            directionFilter === "OUT"
              ? "bg-doge-600 text-white"
              : "bg-space-800 text-slate-400 hover:text-white hover:bg-space-700"
          }`}
        >
          OUT ({connection.stats?.fromCount || 0})
        </button>
      </div>

      {/* Transaction List */}
      <div className="space-y-2 pr-1">
        {paginatedTransactions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No transactions match the current filter
          </p>
        ) : (
          <>
            {paginatedTransactions.map((tx) => {
              const isFromSource =
                sourceWallet && tx.from.toLowerCase() === sourceWallet.address.toLowerCase();
              const direction = isFromSource ? "OUT" : "IN";

              return (
                <div
                  key={tx.hash}
                  className="w-full bg-space-900 rounded-lg p-3 sm:p-4 border border-space-700 hover:border-purple-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            direction === "IN"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-green-500/20 text-green-300"
                          }`}
                        >
                          {direction}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(tx.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-white break-all">
                        {formatValue(tx.value)} {tokenSymbol}
                      </p>
                    </div>
                    <Tooltip content="View transaction on Dogechain Explorer">
                      <a
                        href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-purple-400 hover:text-purple-300 transition-colors p-2 rounded hover:bg-space-700 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </Tooltip>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-1 text-[10px] sm:text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">From:</span>
                      <a
                        href={`${BLOCKSCOUT_BASE_URL}/address/${tx.from}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-300 hover:text-blue-200 break-all inline-flex items-center gap-1"
                        title={tx.from}
                      >
                        {tx.from.slice(0, 10)}...{tx.from.slice(-8)}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">To:</span>
                      <a
                        href={`${BLOCKSCOUT_BASE_URL}/address/${tx.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-green-300 hover:text-green-200 break-all inline-flex items-center gap-1"
                        title={tx.to}
                      >
                        {tx.to.slice(0, 10)}...{tx.to.slice(-8)}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                className="w-full py-3 px-4 bg-space-900 hover:bg-space-700 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-space-700 hover:border-purple-700/50"
              >
                Load More Transactions ({filteredTransactions.length - paginatedTransactions.length}{" "}
                remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
