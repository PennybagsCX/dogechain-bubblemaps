/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Loader2, Coins, Image as ImageIcon, Clock, TrendingUp } from "lucide-react";
import { Tooltip } from "./Tooltip";

import { AssetType, SearchResult, TokenSearchInputProps } from "../types";
import type { TrendingAsset } from "../services/trendingService";
import {
  searchTokensHybrid,
  generatePhoneticSuggestions,
  searchProgressiveAll,
} from "../services/tokenSearchService";
import { fuzzySearch as fuzzySearchMini } from "../services/fuzzySearchService";
import {
  trackSearch,
  trackResultClick,
  getSessionId,
  getRecentSearchHistory,
} from "../services/searchAnalytics";
import { highlightMatch } from "../utils/highlightText";
import { logSearchQuery, getTrendingAssetsWithFallback } from "../services/trendingService";
import { getNicknameExpansions } from "../services/tokenNicknameRegistry";
import { getCachedSearchResults, cacheSearchResults } from "../utils/searchCacheManager";
import { trackSearchPerformance } from "../utils/performanceMonitor";
import SearchWorkerInstance from "../services/searchWorker.ts?worker";
import { logTokenInteraction, fetchLearnedTokens } from "../services/learnedTokensService";

// Worker pool management
let searchWorker: Worker | null = null;
let workerInitializationPromise: Promise<boolean> | null = null;

// =====================================================
// Popular Tokens Interface
// =====================================================

/**
 * Enhanced popular token with address for direct search execution
 */
interface PopularToken {
  address: string;
  symbol: string;
  name: string;
  type: AssetType;
  source: "local" | "trending";
}

/**
 * Extended TrendingAsset with hits property for getTrendingAssetsWithFallback
 */
interface TrendingAssetWithHits extends TrendingAsset {
  hits: number;
}

/**
 * Initialize search worker (singleton pattern)
 */
async function initializeSearchWorker(): Promise<boolean> {
  if (workerInitializationPromise) {
    return workerInitializationPromise;
  }

  workerInitializationPromise = (async () => {
    try {
      if (searchWorker) {
        return true;
      }

      // Create worker from external file using Vite's worker import
      searchWorker = new SearchWorkerInstance({ type: "module" });

      return true;
    } catch {
      searchWorker = null;
      return false;
    }
  })();

  return workerInitializationPromise;
}

/**
 * Terminate search worker (call on app unmount)
 */
export function terminateSearchWorker(): void {
  if (searchWorker) {
    searchWorker.terminate();
    searchWorker = null;
    workerInitializationPromise = null;
  }
}

export function TokenSearchInput({
  searchType,
  onSearch,
  placeholder,
  disabled = false,
  autoFocus = false,
  value: externalValue,
  onChange: externalOnChange,
  inputRef: externalInputRef,
}: TokenSearchInputProps & { inputRef?: React.RefObject<HTMLInputElement | null> }) {
  // Determine if controlled mode
  const isControlled = externalValue !== undefined;

  // Use external value if controlled, otherwise use local state
  const [internalQuery, setInternalQuery] = useState("");
  const query = isControlled ? externalValue : internalQuery;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [phoneticSuggestions, setPhoneticSuggestions] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularTokens, setPopularTokens] = useState<PopularToken[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<PopularToken[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [resultCountMessage, setResultCountMessage] = useState<string>("");
  const useProgressiveSearch = true; // Enable progressive search by default
  const useMiniSearch = true; // Enable MiniSearch fuzzy matching by default

  // Sanitize suggestion tokens to avoid logging/noise appearing in UI
  const sanitizeSuggestion = useCallback((value: string | null | undefined) => {
    if (!value) return null;
    const trimmed = value.trim();
    // Drop extremely long values or values with obvious URLs/paths
    if (trimmed.length === 0 || trimmed.length > 24) return null;
    if (trimmed.includes("http") || trimmed.includes("://") || trimmed.includes("/")) return null;
    // Allow only basic token characters (letters, numbers, underscores, dots, dashes)
    if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
    return trimmed;
  }, []);

  // Combined popular suggestions (local + global) with deduplication by address
  const suggestionTokens = useMemo(() => {
    const allTokens = [...popularTokens, ...trendingTokens];
    const seen = new Set<string>();
    const unique: PopularToken[] = [];
    for (const token of allTokens) {
      const key = token.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(token);
    }
    return unique;
  }, [popularTokens, trendingTokens]);

  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const workerReadyRef = useRef(false);

  // Analytics tracking refs
  const searchTimestampRef = useRef<number>(0);
  const currentQueryRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");

  // Initialize worker and session on mount
  useEffect(() => {
    initializeSearchWorker().then((ready) => {
      workerReadyRef.current = ready;
    });

    // Initialize analytics session
    sessionIdRef.current = getSessionId();

    // Load recent searches
    getRecentSearchHistory(5)
      .then((history) => {
        setRecentSearches(history);
      })
      .catch((_error) => {});

    // Load popular tokens from learned database (local, last 7 days)
    fetchLearnedTokens(searchType, 20)
      .then((tokens) => {
        const popularTokenList: PopularToken[] = tokens
          .filter((t) => {
            const symbol = sanitizeSuggestion(t.symbol);
            const name = sanitizeSuggestion(t.name);
            return symbol || name;
          })
          .map((t) => ({
            address: t.address,
            symbol: t.symbol || "UNKNOWN",
            name: t.name || "Unknown Token",
            type: t.type,
            source: "local" as const,
          }));
        setPopularTokens(popularTokenList);
      })
      .catch((_error) => {});

    // Load global trending assets (server with local fallback)
    getTrendingAssetsWithFallback<TrendingAssetWithHits>(
      [],
      searchType === AssetType.NFT ? "NFT" : "TOKEN",
      20
    )
      .then((assets) => {
        const tokens: PopularToken[] = assets
          .filter((a) => a.address && (a.symbol || a.name))
          .map((a) => ({
            address: a.address,
            symbol: a.symbol || "UNKNOWN",
            name: a.name || "Unknown Token",
            type: a.type === "NFT" ? AssetType.NFT : AssetType.TOKEN,
            source: "trending" as const,
          }));
        setTrendingTokens(tokens);
      })
      .catch((_error) => {});

    // Cleanup on unmount
    return () => {
      const debounceTimer = debounceTimerRef.current;
      const searchAbort = searchAbortRef.current;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (searchAbort) {
        searchAbort.abort();
      }
    };
  }, [sanitizeSuggestion, searchType]);

  // Search with Web Worker (background processing, no UI blocking)
  const searchWithWorker = async (
    searchQuery: string,
    type: AssetType
  ): Promise<SearchResult[]> => {
    return new Promise((resolve, reject) => {
      if (!searchWorker) {
        reject(new Error("Worker not available"));
        return;
      }

      // Get token data for worker
      import("../services/db")
        .then(({ getAllTokenSearchIndex }) => {
          getAllTokenSearchIndex()
            .then((tokens) => {
              const queryLower = searchQuery.toLowerCase();
              const expandedQueries = [queryLower, ...getNicknameExpansions(queryLower)];

              // Send search request to worker
              searchWorker?.postMessage({
                messageType: "search",
                query: searchQuery,
                queryLower,
                tokens,
                assetType: type,
                expandedQueries,
              });

              // Set up one-time listener for response
              const handler = (e: MessageEvent) => {
                if (e.data.type === "complete") {
                  searchWorker?.removeEventListener("message", handler);
                  resolve(e.data.results);
                } else if (e.data.type === "error") {
                  searchWorker?.removeEventListener("message", handler);
                  reject(new Error(e.data.error));
                }
              };

              searchWorker?.addEventListener("message", handler);

              // Timeout after 5 seconds
              setTimeout(() => {
                searchWorker?.removeEventListener("message", handler);
                reject(new Error("Worker search timeout"));
              }, 5000);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  };

  // Debounced search function (optimized: 150ms + immediate for addresses)
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    currentQueryRef.current = searchQuery;
    searchTimestampRef.current = Date.now(); // Record search start time

    // PERFORMANCE TRACKING: Record search start time
    const searchStartTime = performance.now();

    // Cancel previous search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    // Create new abort controller
    searchAbortRef.current = new AbortController();

    try {
      let searchResults: SearchResult[];
      let cacheHit = false;

      // SERVICE WORKER CACHE: Check cache first for instant results

      const cachedResults = await getCachedSearchResults(searchQuery, searchType);

      if (cachedResults && cachedResults.length > 0) {
        searchResults = cachedResults as SearchResult[];
        cacheHit = true;
      } else {
        // MINISEARCH FUZZY SEARCH: Fast, typo-tolerant search (3KB library vs 15KB custom)
        if (useMiniSearch && !searchQuery.startsWith("0x")) {
          try {
            searchResults = await fuzzySearchMini(searchQuery, 10);

            // If MiniSearch found results, use them; otherwise fallback to progressive search
            if (searchResults.length > 0) {
              // Use MiniSearch results
            } else {
              searchResults = await searchProgressiveAll(searchQuery, searchType, 10);
            }
          } catch {
            // MiniSearch failed, using progressive search
            searchResults = await searchProgressiveAll(searchQuery, searchType, 10);
          }
        }
        // PROGRESSIVE SEARCH: Stream results in stages for instant feedback (<50ms to first result)
        else if (useProgressiveSearch && !searchQuery.startsWith("0x")) {
          searchResults = await searchProgressiveAll(searchQuery, searchType, 10);
        }
        // Try Web Worker for addresses (background processing, no UI blocking)
        else if (workerReadyRef.current && searchWorker && searchQuery.startsWith("0x")) {
          try {
            searchResults = await searchWithWorker(searchQuery, searchType);
          } catch {
            // Worker search failed, falling back to main thread
            const { all } = await searchTokensHybrid(searchQuery, searchType, {
              limit: 10,
              includeRemote: true,
            });
            searchResults = all;
          }
        }
        // Fallback to main thread search
        else {
          const { all } = await searchTokensHybrid(searchQuery, searchType, {
            limit: 10,
            includeRemote: true,
          });
          searchResults = all;
        }

        // CACHE RESULTS: Store in cache for future use (non-blocking)
        if (searchResults.length > 0) {
          cacheSearchResults(searchQuery, searchType, searchResults).catch((_error) => {});
        }
      }

      if (!searchAbortRef.current.signal.aborted) {
        setResults(searchResults);

        // PERFORMANCE TRACKING: Record search performance
        const responseTime = performance.now() - searchStartTime;
        trackSearchPerformance(
          searchQuery,
          searchType,
          responseTime,
          cacheHit,
          searchResults.length
        );

        // Announce result count for screen readers
        const count = searchResults.length;
        if (count > 0) {
          setResultCountMessage(
            `Found ${count} ${count === 1 ? "result" : "results"} for "${searchQuery}"`
          );
        } else {
          setResultCountMessage(`No results found for "${searchQuery}"`);
        }

        // Track search analytics (async, non-blocking)
        trackSearch(searchQuery, searchResults, sessionIdRef.current).catch((_error) => {});

        // If no results, fetch phonetic suggestions
        if (searchResults.length === 0 && searchQuery.length >= 3) {
          const suggestions = await generatePhoneticSuggestions(searchQuery, searchType, 3);
          setPhoneticSuggestions(suggestions);
        } else {
          setPhoneticSuggestions([]);
        }

        setShowDropdown(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        // Non-abort errors handled silently
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input focus - show history if empty
  const handleInputFocus = () => {
    // Show history if input is empty and we have recent searches
    if (!query.trim() && recentSearches.length > 0) {
      setShowHistory(true);
      setShowDropdown(false);
    }
  };

  // Handle input change (optimized debounce)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Hide history when user starts typing
    if (showHistory) {
      setShowHistory(false);
    }

    // Update both internal state and external onChange
    if (isControlled) {
      externalOnChange?.(value);
    } else {
      setInternalQuery(value);
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Immediate search for addresses (0x prefix)
    if (value.startsWith("0x") && value.length >= 2) {
      performSearch(value);
      return;
    }

    // Optimized debounce: 150ms (down from 300ms)
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 150);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter": {
        e.preventDefault();
        const selectedResult = results[selectedIndex];
        if (selectedResult) {
          handleSelectResult(selectedResult);
        } else if (query.length > 0) {
          // Submit query directly if no result selected
          handleSubmit(e);
        }
        break;
      }
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle result selection
  const handleSelectResult = (result: SearchResult) => {
    // Calculate time-to-click
    const timeToClickMs = Date.now() - searchTimestampRef.current;

    // Find result rank
    const resultRank = results.findIndex((r) => r.address === result.address);

    // Track click analytics (async, non-blocking)
    if (resultRank >= 0) {
      trackResultClick(
        currentQueryRef.current,
        result.address,
        resultRank,
        result.score || 0,
        timeToClickMs,
        sessionIdRef.current
      ).catch((_error) => {});

      // Log to learned tokens database (async, non-blocking)
      logTokenInteraction(
        result.address,
        "click",
        sessionIdRef.current,
        currentQueryRef.current,
        resultRank
      );
    }

    // Log search to global trending service (fire-and-forget)
    logSearchQuery(
      result.address,
      result.type === AssetType.NFT ? "NFT" : "TOKEN",
      result.symbol,
      result.name
    ).catch((_error) => {});

    if (isControlled) {
      externalOnChange?.(result.address);
    } else {
      setInternalQuery(result.address);
    }
    setShowDropdown(false);
    onSearch(result.address, searchType);
  };

  // Handle form submission
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      onSearch(query.trim(), searchType);
    }
  };

  // Clear input
  const handleClear = () => {
    if (isControlled) {
      externalOnChange?.("");
    } else {
      setInternalQuery("");
    }
    setResults([]);
    setShowDropdown(false);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  // Handle history item selection
  const handleHistorySelect = (historyQuery: string) => {
    if (isControlled) {
      externalOnChange?.(historyQuery);
    } else {
      setInternalQuery(historyQuery);
    }
    setShowHistory(false);
    // Trigger search immediately for history items
    performSearch(historyQuery);
  };

  // Handle popular token click - executes search with contract address
  const handlePopularTokenClick = (token: PopularToken) => {
    if (isControlled) {
      externalOnChange?.(token.address);
    } else {
      setInternalQuery(token.address);
    }
    setShowDropdown(false);
    setShowHistory(false);
    // Directly trigger search with address
    onSearch(token.address, token.type);

    // Log search analytics for popular token click
    logSearchQuery(
      token.address,
      token.type === AssetType.NFT ? "NFT" : "TOKEN",
      token.symbol,
      token.name
    ).catch((_error) => {});
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputRef]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus, inputRef]);

  return (
    <div className="relative">
      {/* Hidden screen reader instructions */}
      <span
        id="search-instructions"
        className="sr-only"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        Search for tokens by name, symbol, or contract address. Use arrow keys to navigate results,
        Enter to select.
      </span>

      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-space-800 rounded-lg border border-space-700 overflow-hidden">
          <div className="pl-3 pr-2 text-slate-500">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder={
              placeholder ||
              (searchType === AssetType.NFT ? "Collection Address..." : "Token Address...")
            }
            className="flex-1 min-w-0 bg-transparent py-3 px-2 text-white placeholder-slate-500 text-base outline-none font-mono"
            style={{ touchAction: "manipulation" }}
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={searchType === AssetType.NFT ? "Search NFT collections" : "Search tokens"}
            aria-describedby="search-instructions"
            aria-autocomplete="list"
            aria-controls="search-results-listbox"
            aria-activedescendant={
              selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined
            }
            role="combobox"
            aria-expanded={showDropdown || showHistory}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              ×
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || isSearching || !query.trim()}
            className="px-3 sm:px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
          >
            {isSearching ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Go</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search History Dropdown */}
      {showHistory && recentSearches.length > 0 && (
        <div
          ref={dropdownRef}
          className="fixed left-0 right-0 mx-4 md:absolute md:mx-0 md:w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl z-50"
          style={{ top: "100%" }}
          role="listbox"
          aria-label="Recent searches"
        >
          <div className="px-4 py-3 border-b border-space-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Clock size={16} className="text-purple-500" />
              <span>Recent Searches</span>
            </div>
            <Tooltip content="Clear all search history permanently">
              <button
                type="button"
                onClick={() => {
                  setRecentSearches([]);
                  setShowHistory(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Clear search history"
              >
                Clear
              </button>
            </Tooltip>
          </div>
          {recentSearches.map((historyQuery, index) => (
            <button
              key={`${historyQuery}-${index}`}
              type="button"
              onClick={() => handleHistorySelect(historyQuery)}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-space-700 active:bg-space-600 transition-colors text-slate-300"
              style={{ touchAction: "manipulation", minHeight: "44px" }}
              role="option"
              aria-selected="false"
              aria-label={`Search for "${historyQuery}"`}
            >
              <Clock size={16} className="text-slate-500 shrink-0" />
              <span className="flex-1 truncate">{historyQuery}</span>
              <span className="text-xs text-slate-500 shrink-0">Search again</span>
            </button>
          ))}
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="fixed left-0 right-0 mx-4 md:absolute md:mx-0 md:w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
          style={{ top: "100%" }}
          role="listbox"
          id="search-results-listbox"
          aria-label="Search results"
        >
          {/* Live region for screen readers */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              borderWidth: 0,
            }}
          >
            {resultCountMessage}
          </div>

          {results.map((result, index) => (
            <button
              key={result.address}
              id={`search-result-${index}`}
              type="button"
              onClick={() => handleSelectResult(result)}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                index === selectedIndex
                  ? "bg-purple-600/20 text-white"
                  : "hover:bg-space-700 active:bg-space-600 text-slate-300"
              }`}
              style={{ touchAction: "manipulation", minHeight: "44px" }}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div
                className={`p-2 rounded-md ${
                  result.type === AssetType.NFT
                    ? "bg-blue-600/20 text-blue-400"
                    : "bg-purple-600/20 text-purple-400"
                }`}
              >
                {result.type === AssetType.NFT ? <ImageIcon size={16} /> : <Coins size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white truncate">
                    {highlightMatch(result.symbol, query)}
                  </span>
                  {result.source === "learned" && (
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-600/20 text-green-400">
                      <TrendingUp size={10} />
                      Popular
                    </span>
                  )}
                  {result.source === "remote" && !result.source.includes("learned") && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">
                      New
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {highlightMatch(result.name, query)}
                </div>
                <div className="text-xs text-slate-600 font-mono truncate">
                  {highlightMatch(
                    `${result.address.slice(0, 8)}...${result.address.slice(-6)}`,
                    query
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty State / Loading */}
      {showDropdown && isSearching && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl p-4 text-center"
        >
          <Loader2 className="animate-spin mx-auto mb-2 text-slate-500" size={24} />
          <p className="text-sm text-slate-500">Searching tokens...</p>
        </div>
      )}

      {/* No Results with Phonetic Suggestions */}
      {showDropdown && !isSearching && results.length === 0 && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl"
        >
          {/* Did you mean? suggestions */}
          {phoneticSuggestions.length > 0 && (
            <div className="p-3 border-b border-space-700">
              <p className="text-xs text-slate-500 mb-2">Did you mean?</p>
              {phoneticSuggestions.map((suggestion) => (
                <button
                  key={suggestion.address}
                  type="button"
                  onClick={() => handleSelectResult(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-space-700 rounded text-slate-300 transition-colors flex items-center gap-3"
                >
                  <div
                    className={`p-2 rounded-md ${
                      suggestion.type === AssetType.NFT
                        ? "bg-blue-600/20 text-blue-400"
                        : "bg-purple-600/20 text-purple-400"
                    }`}
                  >
                    {suggestion.type === AssetType.NFT ? (
                      <ImageIcon size={16} />
                    ) : (
                      <Coins size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white">{suggestion.symbol}</span>
                    <span className="text-xs text-slate-500 ml-2">{suggestion.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Fallback message with helpful guidance */}
          <div className="p-4 text-center">
            <p className="text-sm text-slate-500">
              {phoneticSuggestions.length > 0 ? "No exact matches found" : "No tokens found"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {phoneticSuggestions.length > 0
                ? "Try a different search term or select a suggestion above"
                : "Try entering a full contract address"}
            </p>

            {/* Popular token suggestions */}
            {phoneticSuggestions.length === 0 && suggestionTokens.length > 0 && (
              <div className="mt-4 pt-4 border-t border-space-700">
                <p className="text-xs text-slate-500 mb-2">Popular tokens to try:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestionTokens.slice(0, searchType === AssetType.NFT ? 6 : 10).map((token) => (
                    <button
                      key={token.address}
                      type="button"
                      onClick={() => handlePopularTokenClick(token)}
                      className="px-3 py-1.5 bg-space-700 hover:bg-space-600 rounded-full text-xs text-purple-400 font-medium transition-colors"
                    >
                      {token.symbol}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-3">
                  💡 Search by token symbol, name, or contract address
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
