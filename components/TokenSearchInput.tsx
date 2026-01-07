/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Coins, Image as ImageIcon } from "lucide-react";
import { AssetType, SearchResult, TokenSearchInputProps } from "../types";
import { searchTokensHybrid, generatePhoneticSuggestions } from "../services/tokenSearchService";
import { trackSearch, trackResultClick, getSessionId } from "../services/searchAnalytics";
import SearchWorkerInstance from "../services/searchWorker.ts?worker";

// Worker pool management
let searchWorker: Worker | null = null;
let workerInitializationPromise: Promise<boolean> | null = null;

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
    } catch (error) {
      console.warn("[Token Search] Worker initialization failed:", error);
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
}: TokenSearchInputProps) {
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

  const inputRef = useRef<HTMLInputElement>(null);
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

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

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

    // Cancel previous search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    // Create new abort controller
    searchAbortRef.current = new AbortController();

    try {
      // Use main thread search for now (worker integration in next phase)
      const { all } = await searchTokensHybrid(searchQuery, searchType, {
        limit: 10,
        includeRemote: true,
      });

      if (!searchAbortRef.current.signal.aborted) {
        setResults(all);

        // Track search analytics (async, non-blocking)
        trackSearch(searchQuery, all, sessionIdRef.current).catch((error) => {
          console.warn("[Token Search] Analytics tracking failed:", error);
        });

        // If no results, fetch phonetic suggestions
        if (all.length === 0 && searchQuery.length >= 3) {
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
        console.error("[Token Search] Search failed:", error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input change (optimized debounce)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

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
      ).catch((error) => {
        console.warn("[Token Search] Click tracking failed:", error);
      });
    }

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
    inputRef.current?.focus();
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
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative">
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
            className="flex-1 bg-transparent py-3 px-2 text-white placeholder-slate-500 text-base outline-none font-mono"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ×
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || isSearching || !query.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
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

      {/* Autocomplete Dropdown */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl max-h-96 overflow-y-auto"
        >
          {results.map((result, index) => (
            <button
              key={result.address}
              type="button"
              onClick={() => handleSelectResult(result)}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                index === selectedIndex
                  ? "bg-purple-600/20 text-white"
                  : "hover:bg-space-700 text-slate-300"
              }`}
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
                  <span className="font-semibold text-white truncate">{result.symbol}</span>
                  {result.source === "remote" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">
                      New
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">{result.name}</div>
                <div className="text-xs text-slate-600 font-mono truncate">
                  {result.address.slice(0, 8)}...{result.address.slice(-6)}
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

          {/* Fallback message */}
          <div className="p-4 text-center">
            <p className="text-sm text-slate-500">
              {phoneticSuggestions.length > 0 ? "No exact matches found" : "No tokens found"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {phoneticSuggestions.length > 0
                ? "Try a different search term or select a suggestion above"
                : "Try entering a full contract address"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
