import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Coins, Image as ImageIcon } from "lucide-react";
import { AssetType, SearchResult, TokenSearchInputProps } from "../types";
import { searchTokensHybrid } from "../services/tokenSearchService";

export function TokenSearchInput({
  searchType,
  onSearch,
  placeholder,
  disabled = false,
  autoFocus = false,
}: TokenSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Cancel previous search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    // Create new abort controller
    searchAbortRef.current = new AbortController();

    try {
      const { all } = await searchTokensHybrid(searchQuery, searchType, {
        limit: 10,
        includeRemote: true,
      });

      if (!searchAbortRef.current.signal.aborted) {
        setResults(all);
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

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
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
    setQuery(result.address);
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
    setQuery("");
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

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

      {/* No Results */}
      {showDropdown && !isSearching && results.length === 0 && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-space-800 border border-space-700 rounded-lg shadow-xl p-4 text-center"
        >
          <p className="text-sm text-slate-500">No tokens found</p>
          <p className="text-xs text-slate-600 mt-1">Try entering a full contract address</p>
        </div>
      )}
    </div>
  );
}
