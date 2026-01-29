/**
 * Pool Search Component with Autocomplete
 *
 * Features:
 * - Fuzzy search by token symbol, name, or address
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Recent searches with local storage
 * - Popular pools quick-select
 * - Copy address to clipboard
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Clock, TrendingUp, Copy, Check, X } from "lucide-react";

// Re-use PoolStats interface from parent component
export interface PoolSearchPoolStats {
  address: string;
  token0: { address: string; symbol: string; name?: string; decimals?: number };
  token1: { address: string; symbol: string; name?: string; decimals?: number };
  factory: string;
  tvlUsd: number;
  volume24h?: number;
  priceChange24h?: number;
  reserve0?: string;
  reserve1?: string;
  lpTokenSupply?: string;
  createdAt?: number;
  pairAge?: number;
  priceUsd?: string;
  marketCap?: number;
}

interface PoolSearchProps {
  pools: PoolSearchPoolStats[];
  onPoolSelect: (pool: PoolSearchPoolStats) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult extends PoolSearchPoolStats {
  score?: number;
}

interface RecentSearch {
  address: string;
  token0Symbol: string;
  token1Symbol: string;
  timestamp: number;
}

// Fuzzy search implementation
function fuzzySearch(query: string, pools: PoolSearchPoolStats[]): SearchResult[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const pool of pools) {
    let score = 0;
    const { token0, token1, factory, address } = pool;

    // Exact match gets highest score
    if (token0.symbol.toLowerCase() === q || token1.symbol.toLowerCase() === q) {
      score = 100;
    }
    // Starts with query
    else if (
      token0.symbol.toLowerCase().startsWith(q) ||
      token1.symbol.toLowerCase().startsWith(q)
    ) {
      score = 80;
    }
    // Contains query
    else if (token0.symbol.toLowerCase().includes(q) || token1.symbol.toLowerCase().includes(q)) {
      score = 60;
    }
    // Factory name match
    else if (factory.toLowerCase().includes(q)) {
      score = 40;
    }
    // Address match
    else if (address.toLowerCase().includes(q)) {
      score = 30;
    }
    // Partial symbol match
    else {
      const t0Lower = token0.symbol.toLowerCase();
      const t1Lower = token1.symbol.toLowerCase();
      let partialScore = 0;

      // Count matching characters in order
      let qIndex = 0;
      for (const char of t0Lower) {
        if (qIndex < q.length && char === q[qIndex]) {
          partialScore += 5;
          qIndex++;
        }
      }

      qIndex = 0;
      for (const char of t1Lower) {
        if (qIndex < q.length && char === q[qIndex]) {
          partialScore += 5;
          qIndex++;
        }
      }

      score = partialScore;
    }

    if (score > 0) {
      results.push({ ...pool, score });
    }
  }

  return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
}

export const PoolSearch: React.FC<PoolSearchProps> = ({
  pools,
  onPoolSelect,
  placeholder = "Search pools by token symbol or address...",
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const loadRecentSearches = () => {
      try {
        const saved = localStorage.getItem("dex-analytics-recent-searches");
        if (saved) {
          const parsed = JSON.parse(saved);
          // Remove searches older than 7 days
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const filtered = parsed.filter((s: RecentSearch) => s.timestamp > weekAgo);
          setRecentSearches(filtered.slice(0, 5)); // Keep top 5
        }
      } catch (error) {
        console.error("[PoolSearch] Failed to load recent searches:", error);
      }
    };

    loadRecentSearches();
  }, []);

  // Save recent search to localStorage
  const saveRecentSearch = useCallback(
    (pool: PoolSearchPoolStats) => {
      try {
        const timestamp = Date.now();
        const token0Symbol = pool.token0.symbol;
        const token1Symbol = pool.token1.symbol;
        const address = pool.address;

        const updated = [
          { address, token0Symbol, token1Symbol, timestamp } as RecentSearch,
          ...recentSearches.filter((s) => s.address !== pool.address),
        ].slice(0, 5);

        localStorage.setItem("dex-analytics-recent-searches", JSON.stringify(updated));
        setRecentSearches(updated);
      } catch (error) {
        console.error("[PoolSearch] Failed to save recent search:", error);
      }
    },
    [recentSearches]
  );

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowRecent(value.trim() === "");

    if (value.trim()) {
      const searchResults = fuzzySearch(value, pools);
      setResults(searchResults);
      setSelectedIndex(-1);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  // Handle pool selection
  const handleSelectPool = (pool: PoolSearchPoolStats) => {
    saveRecentSearch(pool);
    onPoolSelect(pool);
    setQuery("");
    setResults([]);
    setShowResults(false);
    setShowRecent(false);
    inputRef.current?.blur();
  };

  // Copy address to clipboard
  const handleCopyAddress = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error("[PoolSearch] Failed to copy address:", error);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = showRecent ? recentSearches : results;
    const maxIndex = items.length - 1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => (i < maxIndex ? i + 1 : maxIndex));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
          const item = items[selectedIndex];
          if (!item) return;

          if (showRecent) {
            const pool = pools.find((p) => p.address === item.address);
            if (pool) handleSelectPool(pool);
          } else {
            handleSelectPool(item as PoolSearchPoolStats);
          }
        }
        break;
      case "Escape":
        setShowResults(false);
        setShowRecent(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
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

  // Get popular pools (top 5 by TVL)
  const popularPools = pools.slice(0, 5);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowRecent(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!query) setShowRecent(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-space-700 border border-space-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
              setShowRecent(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {(showResults || showRecent) && (
        <div className="absolute z-50 w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl max-h-96 overflow-hidden flex flex-col">
          {/* Search Results */}
          {showResults && results.length > 0 && (
            <div ref={resultsRef} className="py-2 overflow-y-auto">
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Search Results
              </div>
              {results.map((pool, index) => (
                <button
                  key={pool.address}
                  onClick={() => handleSelectPool(pool)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-space-700 transition-colors ${
                    index === selectedIndex ? "bg-space-700" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                      {pool.token0.symbol.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </div>
                      <div className="text-sm text-slate-400">
                        {pool.factory} · {formatCurrency(pool.tvlUsd)} TVL
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {pool.priceChange24h !== undefined && (
                      <span
                        className={`text-sm font-medium ${
                          pool.priceChange24h >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {pool.priceChange24h >= 0 ? "+" : ""}
                        {pool.priceChange24h.toFixed(2)}%
                      </span>
                    )}
                    <button
                      onClick={(e) => handleCopyAddress(pool.address, e)}
                      className="p-1.5 hover:bg-space-600 rounded-lg transition-colors"
                      title="Copy address"
                    >
                      {copiedAddress === pool.address ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && recentSearches.length > 0 && (
            <div className="py-2 border-t border-space-700">
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              {recentSearches.map((search, index) => {
                const pool = pools.find((p) => p.address === search.address);
                if (!pool) return null;

                return (
                  <button
                    key={search.address}
                    onClick={() => handleSelectPool(pool)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-space-700 transition-colors ${
                      index === selectedIndex ? "bg-space-700" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <div className="text-left">
                        <div className="font-medium text-white">
                          {search.token0Symbol} / {search.token1Symbol}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(search.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">{formatCurrency(pool.tvlUsd)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Popular Pools */}
          {showRecent && recentSearches.length === 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Popular Pools
              </div>
              {popularPools.map((pool, index) => (
                <button
                  key={pool.address}
                  onClick={() => handleSelectPool(pool)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-space-700 transition-colors ${
                    index === selectedIndex ? "bg-space-700" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
                      {pool.token0.symbol.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-white">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </div>
                      <div className="text-xs text-slate-400">{pool.factory}</div>
                    </div>
                  </div>
                  <span className="text-sm text-slate-400">{formatCurrency(pool.tvlUsd)}</span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {showResults && query && results.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No pools found</p>
              <p className="text-sm mt-1">Try searching by token symbol or pool address</p>
            </div>
          )}

          {/* Keyboard Hint */}
          {(showResults || showRecent) && (results.length > 0 || recentSearches.length > 0) && (
            <div className="px-4 py-2 border-t border-space-700 text-xs text-slate-500 flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
