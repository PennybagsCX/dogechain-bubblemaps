/**
 * Wallet Activity Analytics Dashboard
 *
 * Displays comprehensive wallet activity analytics for tokens including:
 * - Transaction activity metrics
 * - Behavior distribution (Whale, Retail, Smart Money, etc.)
 * - Activity timeline charts
 * - Buy/sell pressure analysis
 * - Activity heatmap
 * - Wallet behavior explorer
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  Activity,
  TrendingUp,
  Users,
  Wallet as WalletIcon,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Database,
  Zap,
} from "lucide-react";
import {
  Token,
  TimeRange,
  WalletActivityStats,
  WalletBehaviorType,
  WalletActivity,
  Transaction,
  Wallet,
} from "../types";
import { fetchWalletTransactions } from "../services/dataService";

interface WalletActivityAnalyticsProps {
  token?: Token | null;
  className?: string;
  onWalletSelect?: (walletAddress: string) => void; // Callback to navigate to wallet on bubble map
  wallets?: Wallet[]; // Wallet data to find wallet object
}

// Color palette for charts
const BEHAVIOR_COLORS: Record<WalletBehaviorType, string> = {
  [WalletBehaviorType.WHALE]: "#8b5cf6", // Purple
  [WalletBehaviorType.RETAIL]: "#3b82f6", // Blue
  [WalletBehaviorType.SMART_MONEY]: "#10b981", // Emerald
  [WalletBehaviorType.HODLER]: "#f59e0b", // Amber
  [WalletBehaviorType.TRADER]: "#ef4444", // Red
  [WalletBehaviorType.SNIPER]: "#ec4899", // Pink
  [WalletBehaviorType.UNKNOWN]: "#6b7280", // Gray
};

const BEHAVIOR_LABELS: Record<WalletBehaviorType, string> = {
  [WalletBehaviorType.WHALE]: "Whale",
  [WalletBehaviorType.RETAIL]: "Retail",
  [WalletBehaviorType.SMART_MONEY]: "Smart Money",
  [WalletBehaviorType.HODLER]: "HODLer",
  [WalletBehaviorType.TRADER]: "Trader",
  [WalletBehaviorType.SNIPER]: "Sniper",
  [WalletBehaviorType.UNKNOWN]: "Unknown",
};

const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

export const WalletActivityAnalytics: React.FC<WalletActivityAnalyticsProps> = ({
  token,
  className = "",
  onWalletSelect,
  wallets: _wallets, // Unused prop - kept for interface compatibility
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [stats, setStats] = useState<WalletActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<Record<string, Transaction[]>>({});
  const [loadingTransactions, setLoadingTransactions] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Progress tracking states
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressDetails, setProgressDetails] = useState<string>("");
  const [walletsProcessed, setWalletsProcessed] = useState<number>(0);
  const [totalWallets, setTotalWallets] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>("");

  // Separate expansion states for Top Buyers and Top Sellers
  const [expandedBuyerWallet, setExpandedBuyerWallet] = useState<string | null>(null);
  const [expandedSellerWallet, setExpandedSellerWallet] = useState<string | null>(null);

  // Track fetch key to prevent unnecessary refetches
  const fetchKeyRef = useRef<string>("");
  const loadingStartTimeRef = useRef<number>(0);

  // OPTIMIZATION: Cache wallet holders per token to avoid re-fetching on timeframe changes
  const [walletsCache, setWalletsCache] = useState<Wallet[] | null>(null);
  const cachedTokenAddressRef = useRef<string | null>(null);

  // Track when analytics were last refreshed (for cache indicator)
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());

  // Cycle loading messages to show activity while loading
  const loadingMessages: readonly string[] = [
    "Working away...",
    "Making good progress...",
    "Almost there...",
    "Just a little longer...",
    "Crunching the numbers...",
    "Analyzing transactions...",
    "Building your dashboard...",
  ] as const;
  const messageIndexRef = useRef<number>(0);

  // Cycle messages every 3 seconds while loading
  useEffect(() => {
    if (!loading) {
      setLoadingMessage("");
      messageIndexRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndexRef.current]!);
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  // Reset status when token changes
  useEffect(() => {
    // Clean up sessionStorage entries for old tokens to prevent stale data
    try {
      const allKeys = Object.keys(sessionStorage);
      allKeys.forEach((key) => {
        if (key.startsWith("analytics-")) {
          const data = sessionStorage.getItem(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              // Remove entries older than 15 minutes or for different tokens
              if (Date.now() > parsed.expiresAt || (token && !key.includes(token.address))) {
                sessionStorage.removeItem(key);
              }
            } catch {
              // Invalid JSON, remove it
              sessionStorage.removeItem(key);
            }
          }
        }
      });
    } catch (e) {
      // SessionStorage cleanup failed, ignore
    }
  }, [token?.address]);

  // Memoized fetch function with progress tracking
  const fetchAnalytics = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setStats(null);
      setError(null);
      setWalletsCache(null);
      cachedTokenAddressRef.current = null;
      // Reset status - no longer tracking per-timeframe status
      return;
    }

    const currentKey = `${token.address}-${timeRange}-${refreshKey}`;
    if (currentKey === fetchKeyRef.current) return;
    fetchKeyRef.current = currentKey;

    // OPTIMIZATION: First check if "all" timeframe data is available for instant client-side filtering
    // This is the most efficient approach - load "all" once (60s), then all timeframes work instantly (<100ms)
    if (timeRange !== "all") {
      const { loadWalletActivityCache } = await import("../services/db");
      const allData = await loadWalletActivityCache(token.address, "all");

      if (allData && allData.data && Date.now() < allData.expiresAt) {
        const allStats = allData.data as WalletActivityStats;

        // Validate completeness
        const isIncomplete =
          Object.keys(allStats.behaviorDistribution).length === 0 ||
          allStats.topBuyers.length === 0 ||
          allStats.topSellers.length === 0;

        if (!isIncomplete) {
          // Filter "all" data to the selected timeframe (instant!)
          const { generateAnalyticsFromCachedTransactions } =
            await import("../services/walletActivityService");

          // Check if we have the raw transactions cached for client-side filtering
          const { loadAllTransactionsCache } = await import("../services/db");
          const rawAllData = await loadAllTransactionsCache(token.address);

          if (rawAllData && Date.now() < rawAllData.expiresAt && walletsCache) {
            console.log(
              `[WalletActivityAnalytics] Using cached 'all' transactions, filtering for ${timeRange} (<100ms)`
            );

            // Generate analytics for the selected timeframe from cached data
            const filteredStats = await generateAnalyticsFromCachedTransactions(
              token,
              walletsCache,
              timeRange,
              (msg) => console.log(`[WalletActivityAnalytics] ${msg}`)
            );

            // Mark all timeframes as cached since we have the raw "all" data
            // All timeframes are now cached - no status tracking needed

            if (filteredStats) {
              setStats(filteredStats);
              setError(null);
              setLoading(false);
              setProgressStage("");
              setProgressDetails("");
              setLastRefreshed(rawAllData.cachedAt);
              return;
            }

            // No data for this timeframe, but all timeframes are still cached
            setStats(null);
            setError(null);
            setLoading(false);
            setProgressStage("");
            setProgressDetails("");
            return;
          }
        }
      }
    }

    // OPTIMIZATION: Check if analytics STATE is cached (instant return!)
    // This enables instant restoration when returning from bubble map
    const { loadAnalyticsState, loadAllTransactionsCache } = await import("../services/db");

    // First, check if we have "all" analytics cached (our new strategy)
    const allCachedState = await loadAnalyticsState(token.address, "all");

    if (allCachedState && Date.now() < allCachedState.expiresAt) {
      // We have "all" data cached - filter it to the requested timeframe
      console.log(
        `[WalletActivityAnalytics] Found 'all' analytics in cache, filtering to ${timeRange}`
      );

      // If requesting "all" timeframe, use it directly
      if (timeRange === "all") {
        setStats(allCachedState.stats as WalletActivityStats);
        setWalletsCache(allCachedState.wallets);
        setError(null);
        setLoading(false);
        setProgressStage("");
        setProgressDetails("");
        setLastRefreshed(allCachedState.lastUpdated);
        return;
      }

      // Otherwise, filter client-side from "all" transactions
      const rawAllData = await loadAllTransactionsCache(token.address);
      if (rawAllData && Date.now() < rawAllData.expiresAt) {
        const { generateAnalyticsFromCachedTransactions } =
          await import("../services/walletActivityService");
        const filteredStats = await generateAnalyticsFromCachedTransactions(
          token,
          allCachedState.wallets,
          timeRange,
          (msg) => console.log(`[WalletActivityAnalytics] ${msg}`)
        );

        if (filteredStats) {
          setStats(filteredStats);
          setWalletsCache(allCachedState.wallets);
          setError(null);
          setLoading(false);
          setProgressStage("");
          setProgressDetails("");
          setLastRefreshed(rawAllData.cachedAt);
          console.log(`[WalletActivityAnalytics] Filtered 'all' data to ${timeRange} successfully`);
          return;
        }
      }

      // If filtering failed (no data in this timeframe), show empty state instead of error
      // This happens for small tokens with no activity in short timeframes (1H, 24H)
      console.log(
        `[WalletActivityAnalytics] No data in ${timeRange} timeframe - showing empty state`
      );
      setStats(null); // Show empty state message
      setWalletsCache(allCachedState.wallets);
      setError(null);
      setLoading(false);
      setProgressStage("");
      setProgressDetails("");
      setLastRefreshed(rawAllData ? rawAllData.cachedAt : Date.now());
      return;
    }

    // SessionStorage restore removed - we only cache "all" data and filter client-side

    // OPTIMIZATION: Check if analytics data is already cached (instant switch!)
    // This check happens BEFORE setting loading=true for truly instant switches
    const { loadWalletActivityCache } = await import("../services/db");
    const cachedAnalytics = await loadWalletActivityCache(token.address, timeRange);

    console.log(`[WalletActivityAnalytics] Cache check for ${timeRange}:`, {
      hasCache: !!cachedAnalytics,
      hasData: !!cachedAnalytics?.data,
      keys: cachedAnalytics ? Object.keys(cachedAnalytics) : [],
    });

    if (cachedAnalytics && cachedAnalytics.data) {
      const cachedStats = cachedAnalytics.data as WalletActivityStats;

      // Validate cache completeness - check if required fields are populated
      // Fast path returns incomplete data (empty behavior distribution, empty top buyers/sellers)
      const isIncomplete =
        Object.keys(cachedStats.behaviorDistribution).length === 0 ||
        cachedStats.topBuyers.length === 0 ||
        cachedStats.topSellers.length === 0;

      if (isIncomplete) {
        console.log(
          `[WalletActivityAnalytics] Cache HIT but data incomplete - refetching with full analysis`
        );
        // Delete incomplete cache and continue to full fetch
        const { deleteWalletActivityCache } = await import("../services/db");
        await deleteWalletActivityCache(token.address, timeRange);
      } else {
        // Instant switch from cache - no loading state!
        console.log(
          `[WalletActivityAnalytics] Instant cache HIT for ${timeRange} - setting stats and returning`
        );
        setStats(cachedStats);
        setError(null);
        setLoading(false);
        setProgressStage("");
        setProgressDetails("");
        setLastRefreshed(Date.now());

        // Check if we have "all" transactions cached - if so, mark ALL timeframes as cached
        const { loadAllTransactionsCache } = await import("../services/db");
        const rawAllData = await loadAllTransactionsCache(token.address);
        if (rawAllData && Date.now() < rawAllData.expiresAt) {
          // All timeframes are cached - no status tracking needed
        } else {
          // Only this timeframe is cached
          // Timeframe cached - no status tracking needed
        }

        return;
      }
    }

    console.log(`[WalletActivityAnalytics] Cache miss for ${timeRange} - fetching from API`);

    // Cache miss - need to fetch data
    try {
      setLoading(true);
      loadingStartTimeRef.current = Date.now();
      setError(null);

      // OPTIMIZATION: Check if we need to fetch wallet holders (only when token changes)
      const needsWalletsFetch = token.address !== cachedTokenAddressRef.current;
      let wallets: Wallet[];

      if (needsWalletsFetch) {
        // New token - fetch holders
        setProgressStage("Initializing");
        setProgressPercent(2);
        setProgressDetails("Preparing to fetch wallet data...");
        setEstimatedTimeRemaining(60); // Updated estimate: 60 seconds for "all" timeframe

        // Show progress bar during initialization
        setProgressPercent(5);
        setProgressDetails("Fetching wallet holders...");

        const { fetchTokenHolders } = await import("../services/dataService");
        const { wallets: fetchedWallets } = await fetchTokenHolders(token);

        if (fetchedWallets.length === 0) {
          setStats(null);
          setWalletsCache(null);
          cachedTokenAddressRef.current = null;
          setLoading(false);
          return;
        }

        wallets = fetchedWallets;
        setWalletsCache(wallets);
        cachedTokenAddressRef.current = token.address;
        setTotalWallets(wallets.length);
        setProgressPercent(15);
        setProgressDetails(`Found ${wallets.length} wallets, analyzing transactions...`);
      } else {
        // Same token, different timeframe - use cached wallets (instant switch!)
        wallets = walletsCache!;
        console.log(
          `[WalletActivityAnalytics] Using cached ${wallets.length} wallets for ${token.address}`
        );

        // Minimal progress for timeframe switch
        setProgressStage("Updating Timeframe");
        setProgressPercent(10);
        setProgressDetails("Filtering data for selected time range...");
      }

      // Fetch analytics with progress callbacks
      setProgressStage("Analyzing Wallet Activity");

      // OPTIMIZATION: Always fetch "all" timeframe first (only ~15s extra than 24h)
      // This enables instant switching to ANY timeframe afterward
      // We'll display the selected timeframe by filtering the "all" data
      const timeframeToFetch = "all"; // Always fetch "all" for maximum efficiency
      const displayTimeRange = timeRange; // This is what the user wants to see

      // Update the message to reflect we're loading all data
      setProgressDetails(`Loading all transaction data for instant timeframe switching...`);

      const { fetchWalletActivityStats, generateAnalyticsFromCachedTransactions } =
        await import("../services/walletActivityService");
      const analytics = await fetchWalletActivityStats(token, wallets, timeframeToFetch, (msg) => {
        console.log(`[WalletActivityAnalytics] ${msg}`);

        // Parse progress message and update UI
        if (msg.includes("Analyzing wallets")) {
          const match = msg.match(/Analyzing wallets (\d+)-(\d+)\/(\d+)/);
          if (match && match[2] && match[3]) {
            const currentEnd = parseInt(match[2], 10);
            const total = parseInt(match[3], 10);
            setWalletsProcessed(currentEnd);
            setTotalWallets(total);
            const percent = 15 + Math.floor((currentEnd / total) * 50); // 15-65%
            setProgressPercent(percent);
            setProgressDetails(`Analyzing wallets ${currentEnd}/${total}...`);

            // Update estimated time remaining
            const elapsed = (Date.now() - loadingStartTimeRef.current) / 1000;
            const estimatedTotal = elapsed / (percent / 100);
            const remaining = Math.max(0, Math.ceil(estimatedTotal - elapsed));
            setEstimatedTimeRemaining(remaining);
          }
        } else if (msg.includes("Classifying")) {
          setProgressPercent(70);
          setProgressDetails("Classifying wallet behaviors...");
        } else if (msg.includes("Fetching transaction data")) {
          setProgressStage("Building Timeline");
          setProgressPercent(75);
          setProgressDetails("Fetching transaction data for timeline...");
        } else if (msg.includes("Building activity timeline")) {
          setProgressPercent(85);
          setProgressDetails("Creating activity timeline...");
        } else if (msg.includes("Calculating flow patterns")) {
          setProgressPercent(90);
          setProgressDetails("Analyzing flow patterns...");
        }
      });

      if (!analytics) {
        setStats(null);
        setLoading(false);
        return;
      }

      // OPTIMIZATION: If we fetched "all" but user wants a different timeframe, filter the data
      let finalStats = analytics;
      if (timeframeToFetch === "all" && displayTimeRange !== "all") {
        // Filter "all" data to the selected timeframe (instant!)
        console.log(
          `[WalletActivityAnalytics] Filtering 'all' data to ${displayTimeRange} (<100ms)`
        );
        setProgressStage("Filtering Data");
        setProgressDetails(`Filtering to ${displayTimeRange.toUpperCase()} timeframe...`);

        // Use the generateAnalyticsFromCachedTransactions function which does client-side filtering
        const { loadAllTransactionsCache } = await import("../services/db");
        const rawAllData = await loadAllTransactionsCache(token.address);

        if (rawAllData && Date.now() < rawAllData.expiresAt) {
          // Generate filtered analytics from cached transactions
          const filteredStats = await generateAnalyticsFromCachedTransactions(
            token,
            wallets,
            displayTimeRange,
            (msg) => console.log(`[WalletActivityAnalytics] ${msg}`)
          );

          if (filteredStats) {
            finalStats = filteredStats;
          } else {
            // No data in this timeframe - show empty state instead of showing "all" data
            // This happens for small tokens with no activity in short timeframes (1H, 24H)
            console.log(
              `[WalletActivityAnalytics] No data in ${displayTimeRange} timeframe - showing empty state`
            );
            setStats(null); // Show empty state message
            setWalletsCache(wallets);
            setLoading(false);
            setProgressStage("");
            setProgressDetails("");
            setLastRefreshed(Date.now());
            return;
          }
        }
      }

      setStats(finalStats);
      setProgressPercent(100);
      setProgressDetails("Complete!");
      setLastRefreshed(Date.now());

      // CRITICAL: Save ONLY "all" data to cache - filtering happens client-side on restore
      // This prevents saving incorrect data to specific timeframe keys
      (async () => {
        const { saveAnalyticsState, saveWalletActivityCache } = await import("../services/db");

        // Save the "all" timeframe analytics (this is the source of truth)
        await saveWalletActivityCache(token.address, "all", analytics);
        await saveAnalyticsState(token.address, "all", analytics, wallets);

        // Note: We do NOT save filtered timeframes to cache
        // Instead, we always filter from "all" data client-side when switching timeframes

        console.log(
          "[WalletActivityAnalytics] Saved 'all' data to cache - timeframe filtering happens client-side"
        );
      })();

      setTimeout(() => {
        setProgressStage("");
        setProgressDetails("");
      }, 500);

      // OPTIMIZATION: Since we loaded "all" data, ALL timeframes are now cached!
      // All timeframes are available for instant switching
      console.log(
        "[WalletActivityAnalytics] All data loaded - instant timeframe switching enabled!"
      );
    } catch (err) {
      console.error("Error fetching wallet activity analytics:", err);
      setError("Failed to load wallet activity data");
      setProgressStage("");
      setProgressDetails("");
    } finally {
      setLoading(false);
    }
  }, [token, timeRange, refreshKey]);

  // Fetch analytics data when dependencies change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle refresh without page reload
  const handleRefresh = () => {
    fetchKeyRef.current = ""; // Reset fetch key
    setRefreshKey((prev) => prev + 1);
  };

  // Handle toggle expand/collapse and load transactions
  const handleToggleExpand = async (walletAddress: string, section: "buyers" | "sellers") => {
    const setExpanded = section === "buyers" ? setExpandedBuyerWallet : setExpandedSellerWallet;
    const expanded = section === "buyers" ? expandedBuyerWallet : expandedSellerWallet;

    // Toggle collapse if already expanded
    if (expanded === walletAddress) {
      setExpanded(null);
      return;
    }

    setExpanded(walletAddress);

    // Load transactions if not already loaded
    if (!walletTransactions[walletAddress] && !loadingTransactions[walletAddress]) {
      setLoadingTransactions((prev) => ({ ...prev, [walletAddress]: true }));
      try {
        const txs = await fetchWalletTransactions(walletAddress, token!.address, token!.type);
        setWalletTransactions((prev) => ({ ...prev, [walletAddress]: txs }));
      } catch (error) {
        console.error(
          `[WalletActivityAnalytics] Failed to load transactions for ${walletAddress}:`,
          error
        );
      } finally {
        setLoadingTransactions((prev) => ({ ...prev, [walletAddress]: false }));
      }
    }
  };

  // Handle wallet address click to navigate to bubble map
  const handleWalletAddressClick = (walletAddress: string) => {
    if (onWalletSelect) {
      onWalletSelect(walletAddress);
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get behavior distribution data for pie chart
  const behaviorDistributionData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.behaviorDistribution)
      .filter(([_, count]) => count > 0)
      .map(([behavior, count]) => ({
        name: BEHAVIOR_LABELS[behavior as WalletBehaviorType],
        value: count,
        behavior: behavior as WalletBehaviorType,
      }));
  }, [stats]);

  // No token selected state
  if (!token) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <WalletIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a token to view wallet activity analytics</p>
        </div>
      </div>
    );
  }

  // Loading state with progress tracking
  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white">Wallet Activity Analytics</h2>
          <p className="text-slate-400">Activity analysis for {token?.symbol || "..."}</p>
        </div>

        {/* Progress Card */}
        <div className="bg-space-800 rounded-xl p-8 border border-space-700">
          {/* Stage indicator */}
          <div className="flex items-center gap-3 mb-6">
            {progressStage === "Initializing" && (
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            )}
            {progressStage === "Fetching Wallet Holders" && (
              <Database className="w-6 h-6 text-blue-500 animate-pulse" />
            )}
            {progressStage === "Analyzing Wallet Activity" && (
              <Activity className="w-6 h-6 text-green-500 animate-pulse" />
            )}
            {progressStage === "Building Timeline" && (
              <Zap className="w-6 h-6 text-amber-500 animate-pulse" />
            )}
            <span className="text-lg font-semibold text-white">
              {progressStage || "Loading..."}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">{progressDetails || "Preparing..."}</span>
              <span className="text-purple-400 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-space-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-500 h-full rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
              </div>
            </div>
          </div>

          {/* Wallet processing details */}
          {progressStage === "Analyzing Wallet Activity" && walletsProcessed > 0 && (
            <div className="mt-6 p-4 bg-space-700/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Wallets processed</span>
                <span className="text-white font-semibold">
                  {walletsProcessed} / {totalWallets}
                </span>
              </div>
              <div className="w-full bg-space-600 rounded-full h-2 mt-2">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(walletsProcessed / totalWallets) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Estimated time remaining hint with dynamic loading message */}
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>
              {loadingMessage ||
                (estimatedTimeRemaining > 0
                  ? `~${estimatedTimeRemaining} seconds remaining`
                  : progressPercent < 20
                    ? "This may take 30-45 seconds..."
                    : progressPercent < 50
                      ? "Fetching wallet transactions..."
                      : progressPercent < 80
                        ? "Almost done, analyzing patterns..."
                        : "Finalizing...")}
            </span>
          </div>

          {/* Optimization notice */}
          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <Zap className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <p className="text-purple-300">
                Performance optimized with parallel processing and reduced API delays
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - still show full UI with inline error message
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="sm:w-48">
            <h2 className="text-2xl font-bold text-white">Wallet Activity Analytics</h2>
            <p className="text-slate-400">Activity analysis for {token.symbol}</p>
          </div>

          {/* Time Range Selector - Centered */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 bg-space-800 rounded-lg p-1">
              {TIME_RANGES.map((range) => {
                return (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      timeRange === range
                        ? "bg-purple-600 text-white"
                        : loading
                          ? "text-slate-500 cursor-wait"
                          : "text-slate-400 hover:text-white hover:bg-space-700"
                    }`}
                  >
                    {range === "all" ? "All Time" : range.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Refresh button - Right aligned with fixed width */}
          <div className="sm:w-48 flex justify-end">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:text-white transition-colors text-slate-400"
              title="Force refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Error State */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
          <div className="text-center text-slate-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-50" />
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="sm:w-48">
          <h2 className="text-2xl font-bold text-white">Wallet Activity Analytics</h2>
          <p className="text-slate-400">Activity analysis for {token.symbol}</p>
        </div>

        {/* Time Range Selector - Centered */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 bg-space-800 rounded-lg p-1">
            {TIME_RANGES.map((range) => {
              return (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? "bg-purple-600 text-white"
                      : loading
                        ? "text-slate-500 cursor-wait"
                        : "text-slate-400 hover:text-white hover:bg-space-700"
                  }`}
                >
                  {range === "all" ? "All Time" : range.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Last Updated / Refresh - Right aligned with fixed width */}
        <div className="sm:w-48 flex justify-end">
          {stats ? (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                <span>Data from {formatTimeAgo(stats.lastUpdated)}</span>
              </div>
              {!loading && (
                <span className="text-slate-500">({formatTimeAgo(lastRefreshed)} refreshed)</span>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-1 hover:text-white transition-colors text-slate-400"
                title="Force refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 hover:text-white transition-colors text-slate-400"
              title="Force refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Data Disclaimer */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">Data Source & Limitations</p>
            <ul className="text-blue-200/80 space-y-1 text-xs">
              <li>
                • Analytics based on <strong>top 100 token holders</strong> by balance
              </li>
              <li>• Transaction classification is estimated using pattern matching</li>
              <li>
                • Wallet behavior labels (HODLer, Retail, Trader, Whale, etc.) are algorithmic
                estimates
              </li>
              <li>
                • Data updates every 15 minutes; &quot;All Time&quot; view shows complete historical
                data
              </li>
              <li>• New tokens with fewer transactions may show limited behavior data</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Inline Empty State - shown when no data for selected time range */}
      {!stats && (
        <div className="bg-space-800 rounded-xl p-12 border border-space-700">
          <div className="text-center text-slate-400">
            <WalletIcon className="w-16 h-16 mx-auto mb-4 opacity-50 text-purple-400" />
            <h3 className="text-xl font-semibold text-white mb-2">No Wallet Activity Data</h3>
            <p className="mb-4">No wallet activity data available for the selected time range</p>
            <p className="text-sm text-slate-500">
              Try selecting a different time range (e.g., &ldquo;All Time&rdquo; or
              &ldquo;30d&rdquo;)
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics Cards - only show when stats exist */}
      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Wallets */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="text-slate-400 text-sm">Active Wallets</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {stats.activeWallets.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                of {stats.totalWallets.toLocaleString()} total
              </div>
            </div>

            {/* Total Transactions */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-slate-400 text-sm">Total Transactions</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {formatNumber(stats.totalTransactions)}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {stats.transactionTypes.buys} buys / {stats.transactionTypes.sells} sells
              </div>
            </div>

            {/* Total Volume */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-slate-400 text-sm">Total Volume</span>
              </div>
              <div className="text-3xl font-bold text-white">{formatNumber(stats.totalVolume)}</div>
              <div className="text-xs text-slate-500 mt-2">{token.symbol} tokens</div>
            </div>

            {/* Avg Holding Period */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-slate-400 text-sm">Avg Holding</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {/* Calculate avg holding from activities */}
                {(() => {
                  const allActivities: WalletActivity[] = [
                    ...stats.topBuyers,
                    ...stats.topSellers,
                    ...stats.topAccumulators,
                    ...stats.topDistributors,
                  ];
                  const unique = new Map<string, WalletActivity>();
                  allActivities.forEach((a) => unique.set(a.walletAddress, a));
                  const avgHolding =
                    Array.from(unique.values()).reduce((sum, a) => sum + a.holdingPeriod, 0) /
                    unique.size;
                  return avgHolding > 0 ? `${avgHolding.toFixed(0)}d` : "N/A";
                })()}
              </div>
              <div className="text-xs text-slate-500 mt-2">Average days held</div>
            </div>
          </div>

          {/* Charts Row 1: Behavior Distribution and Activity Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Behavior Distribution Pie Chart */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <h3 className="text-lg font-semibold text-white mb-4">
                Wallet Behavior Distribution
              </h3>
              {behaviorDistributionData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <Pie
                        data={behaviorDistributionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={false} // Disable labels on pie slices, using legend instead
                      >
                        {behaviorDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={BEHAVIOR_COLORS[entry.behavior]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length > 0) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-space-800 border border-space-600 rounded-lg p-3 shadow-xl">
                                <div className="text-sm font-medium text-white">{data.name}</div>
                                <div className="text-lg font-bold text-purple-400">
                                  {data.value} wallets (
                                  {((data.value / (stats?.totalWallets || 1)) * 100).toFixed(1)}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={80}
                        iconType="circle"
                        content={({ payload }) => (
                          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 px-2">
                            {payload?.map((entry, index) => (
                              <div key={index} className="flex items-center gap-1.5">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-xs text-slate-300">
                                  {entry.value} (
                                  {(
                                    (entry.payload?.value / (stats?.totalWallets || 1)) *
                                    100
                                  ).toFixed(1)}
                                  %)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-slate-400">
                  <p>No behavior data available</p>
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
              {stats.activityTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={stats.activityTimeline}
                    margin={{ top: 10, right: 30, bottom: 20, left: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      width={40}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-space-800 border border-space-600 rounded-lg p-3 shadow-xl">
                              <div className="text-sm text-slate-400 mb-1">{data.date}</div>
                              <div className="text-sm font-medium text-white">
                                TXs: {data.transactions}
                              </div>
                              <div className="text-sm font-medium text-green-400">
                                Vol: {data.volume.toFixed(2)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="transactions"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      name="Transactions"
                    />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                      name="Volume"
                      yAxisId="right"
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      content={({ payload }) => (
                        <div className="flex justify-center gap-4 mt-2">
                          {payload?.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1.5">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-xs text-slate-300">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-slate-400">
                  <p>No timeline data available for this time range</p>
                </div>
              )}
            </div>
          </div>

          {/* Buy/Sell Pressure Chart */}
          <div className="bg-space-800 rounded-xl p-6 border border-space-700">
            <h3 className="text-lg font-semibold text-white mb-4">Buy/Sell Pressure</h3>
            {stats.activityTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stats.activityTimeline}
                  margin={{ top: 10, right: 30, bottom: 20, left: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={{ stroke: "#334155" }}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={{ stroke: "#334155" }}
                    width={40}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-space-800 border border-space-600 rounded-lg p-3 shadow-xl">
                            <div className="text-sm text-slate-400 mb-1">{data.date}</div>
                            <div className="flex items-center gap-2">
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-400">Buys: {data.buys}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ArrowDownRight className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-400">Sells: {data.sells}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    content={({ payload }) => (
                      <div className="flex justify-center gap-4 mt-2">
                        {payload?.map((entry, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs text-slate-300">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                  <Bar dataKey="buys" fill="#10b981" name="Buys" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sells" fill="#ef4444" name="Sells" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400">
                <p>No buy/sell data available for this time range</p>
              </div>
            )}
          </div>

          {/* Top Wallets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Buyers */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
                Top Buyers
              </h3>
              <div className="space-y-2">
                {stats.topBuyers.slice(0, 10).map((activity, index) => {
                  const isExpanded = expandedBuyerWallet === activity.walletAddress;
                  const transactions = walletTransactions[activity.walletAddress] || [];
                  const isLoadingTxs = loadingTransactions[activity.walletAddress];

                  return (
                    <div
                      key={activity.walletAddress}
                      className="border border-space-700 rounded-lg overflow-hidden"
                    >
                      <div className="w-full flex items-center justify-between p-3 bg-space-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium text-white">
                              {onWalletSelect ? (
                                <button
                                  onClick={() => handleWalletAddressClick(activity.walletAddress)}
                                  className="hover:text-purple-400 transition-colors underline decoration-dotted underline-offset-2"
                                  title="Click to view on bubble map"
                                >
                                  {activity.label || formatAddress(activity.walletAddress)}
                                </button>
                              ) : (
                                activity.label || formatAddress(activity.walletAddress)
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{activity.buyCount} buys</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-400">
                              {formatNumber(activity.totalBuyVolume)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {BEHAVIOR_LABELS[activity.behaviorType]}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(activity.walletAddress, "buyers");
                            }}
                            className="p-1 hover:bg-space-600 rounded transition-colors"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Inline Transaction Details */}
                      {isExpanded && (
                        <div className="border-t border-space-700 bg-space-800/50 p-3">
                          {isLoadingTxs ? (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                              Loading transactions...
                            </div>
                          ) : transactions.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              <div className="text-xs text-slate-400 mb-2">
                                Recent transactions (showing first 10)
                              </div>
                              {transactions.slice(0, 10).map((tx, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-space-700/30 rounded text-xs"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400">
                                        {formatTimeAgo(tx.timestamp)}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded ${
                                          tx.to.toLowerCase() ===
                                          activity.walletAddress.toLowerCase()
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}
                                      >
                                        {tx.to.toLowerCase() ===
                                        activity.walletAddress.toLowerCase()
                                          ? "IN"
                                          : "OUT"}
                                      </span>
                                    </div>
                                    <div className="text-slate-500 mt-1">
                                      {formatAddress(tx.from)} → {formatAddress(tx.to)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-white font-medium">
                                      {formatNumber(tx.value)} {token.symbol}
                                    </div>
                                    <a
                                      href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              No transactions found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state for buyers */}
                {stats.topBuyers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">No buyers found in this time range</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Sellers */}
            <div className="bg-space-800 rounded-xl p-6 border border-space-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
                Top Sellers
              </h3>
              <div className="space-y-2">
                {stats.topSellers.slice(0, 10).map((activity, index) => {
                  const isExpanded = expandedSellerWallet === activity.walletAddress;
                  const transactions = walletTransactions[activity.walletAddress] || [];
                  const isLoadingTxs = loadingTransactions[activity.walletAddress];

                  return (
                    <div
                      key={activity.walletAddress}
                      className="border border-space-700 rounded-lg overflow-hidden"
                    >
                      <div className="w-full flex items-center justify-between p-3 bg-space-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            {index + 1}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium text-white">
                              {onWalletSelect ? (
                                <button
                                  onClick={() => handleWalletAddressClick(activity.walletAddress)}
                                  className="hover:text-purple-400 transition-colors underline decoration-dotted underline-offset-2"
                                  title="Click to view on bubble map"
                                >
                                  {activity.label || formatAddress(activity.walletAddress)}
                                </button>
                              ) : (
                                activity.label || formatAddress(activity.walletAddress)
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{activity.sellCount} sells</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-red-400">
                              {formatNumber(activity.totalSellVolume)}
                            </div>
                            <div className="text-xs text-slate-400">
                              {BEHAVIOR_LABELS[activity.behaviorType]}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(activity.walletAddress, "sellers");
                            }}
                            className="p-1 hover:bg-space-600 rounded transition-colors"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Inline Transaction Details */}
                      {isExpanded && (
                        <div className="border-t border-space-700 bg-space-800/50 p-3">
                          {isLoadingTxs ? (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" />
                              Loading transactions...
                            </div>
                          ) : transactions.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              <div className="text-xs text-slate-400 mb-2">
                                Recent transactions (showing first 10)
                              </div>
                              {transactions.slice(0, 10).map((tx, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-space-700/30 rounded text-xs"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400">
                                        {formatTimeAgo(tx.timestamp)}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded ${
                                          tx.to.toLowerCase() ===
                                          activity.walletAddress.toLowerCase()
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}
                                      >
                                        {tx.to.toLowerCase() ===
                                        activity.walletAddress.toLowerCase()
                                          ? "IN"
                                          : "OUT"}
                                      </span>
                                    </div>
                                    <div className="text-slate-500 mt-1">
                                      {formatAddress(tx.from)} → {formatAddress(tx.to)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-white font-medium">
                                      {formatNumber(tx.value)} {token.symbol}
                                    </div>
                                    <a
                                      href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                    >
                                      View <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-sm">
                              No transactions found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state for sellers */}
                {stats.topSellers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">No sellers found in this time range</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
