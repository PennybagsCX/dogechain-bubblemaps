import React, { useState, useMemo } from "react";
import { ExternalLink, ArrowUpDown, TrendingUp, Loader2 } from "lucide-react";
import { Connection, Wallet } from "../types";
import { handleTouchStopPropagation } from "../utils/touchHandlers";

type DirectionFilter = "ALL" | "IN" | "OUT";

interface ConnectionDetailsViewProps {
  connection: Connection;
  sourceWallet: Wallet | undefined;
  targetWallet: Wallet | undefined;
  tokenSymbol: string;
  tokenDecimals?: number;
}

export const ConnectionDetailsView: React.FC<ConnectionDetailsViewProps> = ({
  connection,
  sourceWallet,
  targetWallet,
  tokenSymbol,
  tokenDecimals = 18,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const pageSize = 20;

  const { transactions, stats, loading, error } = connection;

  // Format values for display
  // Note: value is already in human-readable format (divided by decimals in dataService)
  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatDirection = (direction: Connection["stats"]["flowDirection"]) => {
    switch (direction) {
      case "source_to_target":
        return `Primarily ${sourceWallet!.address.slice(0, 6)} → ${targetWallet!.address.slice(0, 6)}`;
      case "target_to_source":
        return `Primarily ${targetWallet!.address.slice(0, 6)} → ${sourceWallet!.address.slice(0, 6)}`;
      case "balanced":
        return "Balanced flow";
    }
  };

  // Filter transactions by direction
  const filteredTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    if (directionFilter === "ALL") return transactions;

    return transactions.filter((tx) => {
      const isFromSource = tx.from.toLowerCase() === sourceWallet!.address.toLowerCase();
      return directionFilter === "IN" ? !isFromSource : isFromSource;
    });
  }, [transactions, directionFilter, sourceWallet]);

  // Paginate filtered transactions
  const paginatedTxs = filteredTransactions.slice(0, currentPage * pageSize);
  const hasMore = filteredTransactions.length > currentPage * pageSize;

  // Reset page when filter changes
  const handleFilterChange = (filter: DirectionFilter) => {
    setDirectionFilter(filter);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        <span className="ml-2 text-slate-400">Loading transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  // Check if wallets are available
  if (!sourceWallet || !targetWallet) {
    return (
      <div className="p-8 text-center text-yellow-400">
        <p>Unable to display connection details: wallet information not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      {stats && (
        <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/50 rounded-xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span>Summary Statistics</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-1">Total Transactions</p>
              <p className="text-xl sm:text-2xl font-bold text-white break-words">
                {stats.totalTransactions}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-1">Total Volume</p>
              <p className="text-xl sm:text-2xl font-bold text-white break-all">
                {formatValue(stats.totalVolume)} {tokenSymbol}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-1">Average Amount</p>
              <p className="text-lg sm:text-xl font-semibold text-white break-all">
                {formatValue(stats.averageAmount)} {tokenSymbol}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-1">Flow Direction</p>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 flex-shrink-0" />
                <span className="break-words">{formatDirection(stats.flowDirection)}</span>
              </p>
            </div>
          </div>

          {stats.firstTransaction && stats.lastTransaction && (
            <div className="pt-3 border-t border-purple-700/30 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
              <span className="break-words">First: {formatTimestamp(stats.firstTransaction)}</span>
              <span className="break-words">Last: {formatTimestamp(stats.lastTransaction)}</span>
            </div>
          )}
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-3">
        {/* Filter Bar - Matching WalletSidebar design */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            {(["ALL", "IN", "OUT"] as const).map((filter) => (
              <button
                key={filter}
                onTouchStart={handleTouchStopPropagation}
                onClick={() => handleFilterChange(filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  directionFilter === filter
                    ? "bg-doge-600 text-white border-doge-500"
                    : "bg-space-800 text-slate-400 border-space-700 hover:bg-space-700"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">{filteredTransactions.length} transactions</span>
        </div>

        {!transactions || transactions.length === 0 ? (
          <p className="text-slate-500 text-sm p-4 text-center">
            No transactions found between these wallets
          </p>
        ) : filteredTransactions.length === 0 ? (
          <p className="text-slate-500 text-sm p-4 text-center">
            No {directionFilter.toLowerCase()} transactions found.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {paginatedTxs.map((tx) => {
                const isFromSource = tx.from.toLowerCase() === sourceWallet.address.toLowerCase();

                return (
                  <a
                    key={tx.hash}
                    href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onTouchStart={handleTouchStopPropagation}
                    className="block p-3 sm:p-4 rounded-lg bg-space-900 border border-space-700 hover:border-space-600 hover:border-blue-500/50 transition-colors group [touch-action:manipulation]"
                    title="View transaction on Blockscout"
                  >
                    <div className="flex justify-between items-start gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isFromSource
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {isFromSource ? "OUT" : "IN"}
                          </span>
                          <span className="text-xs text-slate-500 break-words">
                            {new Date(tx.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white break-all">
                          {formatValue(tx.value)} {tokenSymbol}
                        </p>
                      </div>

                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors flex-shrink-0 mt-1" />
                    </div>

                    <div className="text-xs text-slate-500 font-mono break-all mt-2">{tx.hash}</div>
                  </a>
                );
              })}
            </div>

            {hasMore && (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                onTouchStart={handleTouchStopPropagation}
                className="w-full py-2 px-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm font-medium transition-colors"
              >
                Load More Transactions
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
