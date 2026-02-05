/**
 * Wallet Activity Analytics Service
 *
 * Provides comprehensive analytics for wallet activity including:
 * - Transaction analysis (buys, sells, transfers)
 * - Behavior classification (whale, retail, smart money, etc.)
 * - Activity timeline generation
 * - Flow pattern calculation
 * - Activity heatmap data
 */

import {
  Token,
  Wallet,
  Transaction,
  WalletActivity,
  WalletActivityStats,
  WalletBehaviorType,
  ActivityTimelinePoint,
  FlowPattern,
  ActivityHeatmapData,
  TimeRange,
} from "../types";
import { fetchWalletTransactions } from "./dataService";
import {
  loadWalletActivityCache,
  saveWalletActivityCache,
  loadAllTransactionsCache,
  saveAllTransactionsCache,
} from "./db";
import { getWalletActivityWorkerClient } from "./walletActivityWorkerClient";

// =====================================================
// Time Range Utilities
// =====================================================

/**
 * Get timestamp filter based on time range
 */
function getTimeRangeFilter(timeRange: TimeRange): number {
  const now = Date.now();
  switch (timeRange) {
    case "1h":
      return now - 60 * 60 * 1000;
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
      return 0;
    default:
      return 0;
  }
}

/**
 * Format timestamp for display
 */
function formatTimelineDate(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  switch (timeRange) {
    case "1h":
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    case "24h":
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "all":
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
    default:
      return date.toISOString();
  }
}

// =====================================================
// Wallet Behavior Classification
// =====================================================

/**
 * Classify wallet behavior type based on activity patterns
 */
export function classifyWalletBehavior(
  activity: WalletActivity,
  allWallets: WalletActivity[]
): WalletBehaviorType {
  // Whale: holds significant amount (top 10% by balance)
  const sortedByBalance = [...allWallets].sort((a, b) => b.currentBalance - a.currentBalance);
  const whaleThresholdIndex = Math.floor(sortedByBalance.length * 0.1);
  const whaleThreshold = sortedByBalance[whaleThresholdIndex]?.currentBalance ?? 0;

  if (activity.currentBalance >= whaleThreshold) {
    return WalletBehaviorType.WHALE;
  }

  // Smart Money: high transaction volume with profitable trading pattern
  const avgVolume =
    allWallets.reduce((sum, w) => sum + (w.totalBuyVolume + w.totalSellVolume), 0) /
    allWallets.length;
  if (
    activity.totalBuyVolume + activity.totalSellVolume > avgVolume * 10 &&
    activity.netVolume > 0
  ) {
    return WalletBehaviorType.SMART_MONEY;
  }

  // Sniper: early buyer with long holding period
  if (activity.holdingPeriod > 180 && activity.buyCount > 0 && activity.sellCount === 0) {
    return WalletBehaviorType.SNIPER;
  }

  // HODLer: long holding period, low transaction count
  if (activity.holdingPeriod > 90 && activity.totalTransactions < 10) {
    return WalletBehaviorType.HODLER;
  }

  // Trader: high transaction count relative to holding period
  const txPerDay = activity.totalTransactions / Math.max(1, activity.holdingPeriod);
  if (txPerDay > 0.5) {
    return WalletBehaviorType.TRADER;
  }

  // Retail: small holder with moderate activity
  return WalletBehaviorType.RETAIL;
}

// =====================================================
// Activity Timeline Generation
// =====================================================

/**
 * Build activity timeline from transactions
 * Fixed to properly track buys vs sells
 * OPTIMIZED: Uses Web Worker for parallel processing with fallback to main thread
 */
export async function buildActivityTimeline(
  transactions: Transaction[],
  timeRange: TimeRange,
  holderAddresses: Set<string>
): Promise<ActivityTimelinePoint[]> {
  // Try worker first for better performance, with fallback to main thread
  try {
    const workerClient = getWalletActivityWorkerClient();
    return await workerClient.buildActivityTimeline(transactions, timeRange, holderAddresses);
  } catch (error) {
    console.warn("[buildActivityTimeline] Worker failed, falling back to main thread:", error);
    // Fall through to main thread implementation
  }

  // Main thread implementation (fallback)
  const cutoffTime = getTimeRangeFilter(timeRange);
  const filteredTxs = transactions.filter((tx) => tx.timestamp >= cutoffTime);

  if (filteredTxs.length === 0) {
    return [];
  }

  // Group transactions by time period based on timeRange
  const timelineMap = new Map<string, ActivityTimelinePoint>();

  filteredTxs.forEach((tx) => {
    const dateKey = formatTimelineDate(tx.timestamp, timeRange);
    const existing = timelineMap.get(dateKey);

    // Classify transaction as buy or sell
    const toLower = tx.to.toLowerCase();
    const fromLower = tx.from.toLowerCase();
    const toIsHolder = holderAddresses.has(toLower);
    const fromIsHolder = holderAddresses.has(fromLower);

    let isBuy = false;
    let isSell = false;

    // If TO is a holder (and FROM is not), it's likely a buy
    if (toIsHolder && !fromIsHolder) {
      isBuy = true;
    }
    // If FROM is a holder (and TO is not), it's likely a sell
    else if (fromIsHolder && !toIsHolder) {
      isSell = true;
    }

    if (existing) {
      existing.transactions += 1;
      existing.volume += tx.value;
      if (isBuy) existing.buys += 1;
      if (isSell) existing.sells += 1;
    } else {
      timelineMap.set(dateKey, {
        timestamp: tx.timestamp,
        date: dateKey,
        transactions: 1,
        volume: tx.value,
        activeWallets: 0,
        buys: isBuy ? 1 : 0,
        sells: isSell ? 1 : 0,
      });
    }
  });

  // Convert to array and sort by timestamp
  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // Calculate active wallets for each time point
  const uniqueWalletsPerPeriod = new Map<string, Set<string>>();
  filteredTxs.forEach((tx) => {
    const dateKey = formatTimelineDate(tx.timestamp, timeRange);
    if (!uniqueWalletsPerPeriod.has(dateKey)) {
      uniqueWalletsPerPeriod.set(dateKey, new Set());
    }
    uniqueWalletsPerPeriod.get(dateKey)!.add(tx.from);
    uniqueWalletsPerPeriod.get(dateKey)!.add(tx.to);
  });

  timeline.forEach((point) => {
    const uniqueWallets = uniqueWalletsPerPeriod.get(point.date);
    point.activeWallets = uniqueWallets?.size ?? 0;
  });

  return timeline;
}

// =====================================================
// Flow Pattern Calculation
// =====================================================

/**
 * Calculate flow patterns between wallet behavior clusters
 * OPTIMIZED: Uses Web Worker for parallel processing with fallback to main thread
 */
export async function calculateFlowPatterns(
  activities: WalletActivity[],
  transactions: Transaction[]
): Promise<FlowPattern[]> {
  // Try worker first for better performance, with fallback to main thread
  try {
    const workerClient = getWalletActivityWorkerClient();
    return await workerClient.calculateFlowPatterns(activities, transactions);
  } catch (error) {
    console.warn("[calculateFlowPatterns] Worker failed, falling back to main thread:", error);
    // Fall through to main thread implementation
  }

  // Main thread implementation (fallback)
  // Create address -> behavior mapping
  const addressToBehavior = new Map<string, WalletBehaviorType>();
  activities.forEach((activity) => {
    addressToBehavior.set(activity.walletAddress.toLowerCase(), activity.behaviorType);
  });

  // Track flows between behavior types
  const flowMap = new Map<string, FlowPattern>();

  transactions.forEach((tx) => {
    const fromBehavior = addressToBehavior.get(tx.from.toLowerCase()) ?? WalletBehaviorType.UNKNOWN;
    const toBehavior = addressToBehavior.get(tx.to.toLowerCase()) ?? WalletBehaviorType.UNKNOWN;

    if (fromBehavior === toBehavior) return; // Skip internal flows

    const key = `${fromBehavior}->${toBehavior}`;
    const existing = flowMap.get(key);

    if (existing) {
      existing.volume += tx.value;
      existing.transactionCount += 1;
    } else {
      flowMap.set(key, {
        fromCluster: fromBehavior,
        toCluster: toBehavior,
        volume: tx.value,
        transactionCount: 1,
      });
    }
  });

  return Array.from(flowMap.values()).sort((a, b) => b.volume - a.volume);
}

// =====================================================
// Activity Heatmap Generation
// =====================================================

/**
 * Generate activity heatmap data (hour of day vs day of week)
 */
export function generateActivityHeatmap(transactions: Transaction[]): ActivityHeatmapData[] {
  const heatmapMap = new Map<string, ActivityHeatmapData>();

  transactions.forEach((tx) => {
    const date = new Date(tx.timestamp);
    const dayOfWeek = date.getDay();
    const hourOfDay = date.getHours();
    const key = `${dayOfWeek}-${hourOfDay}`;

    const existing = heatmapMap.get(key);
    if (existing) {
      existing.transactionCount += 1;
      existing.volume += tx.value;
    } else {
      heatmapMap.set(key, {
        dayOfWeek,
        hourOfDay,
        transactionCount: 1,
        volume: tx.value,
      });
    }
  });

  // Fill in missing values with zeros for complete heatmap
  const result: ActivityHeatmapData[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const existing = heatmapMap.get(key);
      result.push(
        existing ?? {
          dayOfWeek: day,
          hourOfDay: hour,
          transactionCount: 0,
          volume: 0,
        }
      );
    }
  }

  return result;
}

// =====================================================
// Individual Wallet Activity Analysis
// =====================================================

/**
 * Analyze individual wallet activity from transactions
 * Optimized with parallel batch processing
 */
export async function analyzeWalletActivities(
  token: Token,
  wallets: Wallet[],
  timeRange: TimeRange,
  onProgress?: (message: string) => void
): Promise<WalletActivity[]> {
  const cutoffTime = getTimeRangeFilter(timeRange);
  const holderAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));

  // FIX 3.1: Pre-filter to only active wallets (balance > 0) to reduce API calls
  const activeWallets = wallets.filter((w) => w.balance > 0);
  console.log(
    `[analyzeWalletActivities] Filtered to ${activeWallets.length} active wallets from ${wallets.length} total`
  );

  const activities: WalletActivity[] = [];
  const totalWallets = activeWallets.length;

  // FIX 2.1: Reduced batch size from 50 to 15 to prevent rate limiting (60 req/min limit)
  const BATCH_SIZE = 15;
  for (let batchStart = 0; batchStart < activeWallets.length; batchStart += BATCH_SIZE) {
    const batch = activeWallets.slice(batchStart, batchStart + BATCH_SIZE);
    const progress = Math.round((batchStart / totalWallets) * 100);
    onProgress?.(
      `Analyzing wallets ${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, totalWallets)}/${totalWallets} (${progress}%)`
    );

    // FIX 2.2: Add 200ms delay between batches to respect rate limiter
    if (batchStart > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (wallet) => {
        if (!wallet) return null;

        try {
          // Fetch transactions for this wallet
          const transactions = await fetchWalletTransactions(
            wallet.address,
            token.address,
            token.type
          );

          // Filter by time range
          const filteredTxs = transactions.filter((tx) => tx.timestamp >= cutoffTime);

          if (filteredTxs.length === 0) {
            return null; // Skip wallets with no activity in time range
          }

          // Classify transactions from this wallet's perspective
          // Fix: Check if wallet is receiving (buy) or sending (sell) tokens
          const walletAddressLower = wallet.address.toLowerCase();
          let buyCount = 0;
          let sellCount = 0;
          let transferCount = 0;
          let totalBuyVolume = 0;
          let totalSellVolume = 0;

          filteredTxs.forEach((tx) => {
            const fromLower = tx.from.toLowerCase();
            const toLower = tx.to.toLowerCase();
            const fromIsHolder = holderAddresses.has(fromLower);
            const toIsHolder = holderAddresses.has(toLower);

            // If wallet is receiving tokens (TO address)
            if (toLower === walletAddressLower) {
              // If receiving from non-holder, it's a buy
              if (!fromIsHolder) {
                buyCount += 1;
                totalBuyVolume += tx.value;
              } else {
                // Receiving from another holder is a transfer
                transferCount += 1;
              }
            }
            // If wallet is sending tokens (FROM address)
            else if (fromLower === walletAddressLower) {
              // If sending to non-holder, it's a sell
              if (!toIsHolder) {
                sellCount += 1;
                totalSellVolume += tx.value;
              } else {
                // Sending to another holder is a transfer
                transferCount += 1;
              }
            }
            // Wallet is neither from nor to (shouldn't happen in wallet's transactions)
            else {
              transferCount += 1;
            }
          });

          // Calculate timing metrics
          const timestamps = filteredTxs.map((tx) => tx.timestamp).sort((a, b) => a - b);
          const firstTransaction = timestamps[0] ?? Date.now();
          const lastTransaction = timestamps[timestamps.length - 1] ?? Date.now();

          // Calculate average days between transactions
          let avgDaysBetweenTxs = 0;
          if (timestamps.length > 1) {
            const totalDays = (lastTransaction - firstTransaction) / (24 * 60 * 60 * 1000);
            avgDaysBetweenTxs = totalDays / (timestamps.length - 1);
          }

          // Calculate holding period (days from first buy to now)
          const holdingPeriod = (Date.now() - firstTransaction) / (24 * 60 * 60 * 1000);

          // Build activity object
          const activity: WalletActivity = {
            walletAddress: wallet.address,
            label: wallet.label,
            behaviorType: WalletBehaviorType.UNKNOWN, // Will be classified after all activities are built
            totalTransactions: filteredTxs.length,
            buyCount,
            sellCount,
            transferCount,
            totalBuyVolume,
            totalSellVolume,
            netVolume: totalBuyVolume - totalSellVolume,
            firstTransaction,
            lastTransaction,
            avgDaysBetweenTxs,
            holdingPeriod,
            currentBalance: wallet.balance,
            peakBalance: wallet.balance,
            lowestBalance: wallet.balance,
            isWhale: wallet.isWhale,
            isActive: filteredTxs.length > 0,
            isAccumulating: totalBuyVolume > totalSellVolume,
            isDistributing: totalSellVolume > totalBuyVolume,
          };

          return activity;
        } catch (error) {
          console.error(`Error analyzing wallet ${wallet.address}:`, error);
          return null;
        }
      })
    );

    // Collect successful results from batch
    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        activities.push(result.value);
      }
    });
  }

  // Classify behavior types
  onProgress?.("Classifying wallet behaviors...");
  activities.forEach((activity) => {
    activity.behaviorType = classifyWalletBehavior(activity, activities);
  });

  return activities;
}

// =====================================================
// Client-Side Filtering Optimization
// =====================================================

/**
 * Filter transactions by time range (client-side, instant)
 * Used by fetchWalletActivityStatsFast for instant time range switching
 */
export function filterTransactionsByTimeRange(
  transactions: Transaction[],
  timeRange: TimeRange
): Transaction[] {
  const cutoffTime = getTimeRangeFilter(timeRange);
  return transactions.filter((tx) => tx.timestamp >= cutoffTime);
}

/**
 * Fast path for analytics using cached "all" transactions
 * Enables instant time range switching when "all" data is cached
 *
 * @param token - Token to analyze
 * @param wallets - Wallet list to analyze
 * @param timeRange - Time range to filter by
 * @param onProgress - Optional progress callback
 * @returns Analytics stats or null if cache miss (falls back to normal fetch)
 */
export async function fetchWalletActivityStatsFast(
  token: Token,
  wallets: Wallet[],
  timeRange: TimeRange,
  onProgress?: (message: string) => void
): Promise<WalletActivityStats | null> {
  // Only use fast path for time ranges other than "all"
  if (timeRange === "all") {
    return null; // Let normal fetch handle "all" time range
  }

  // Check if we have "all" transactions cached
  const allData = await loadAllTransactionsCache(token.address);

  if (!allData || Date.now() >= allData.expiresAt) {
    return null; // Cache miss - let normal fetch handle it
  }

  onProgress?.("Using cached transactions (instant filtering)");

  // Filter client-side (instant)
  const filteredTxs = filterTransactionsByTimeRange(allData.transactions, timeRange);
  const holderAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));

  // Process filtered data to generate analytics
  // This mirrors the logic in fetchWalletActivityStats but uses cached data
  onProgress?.("Processing filtered data...");

  // Build timeline from filtered transactions
  const activityTimeline = await buildActivityTimeline(filteredTxs, timeRange, holderAddresses);

  // For fast path, we need to also analyze wallet activities from the filtered transactions
  // This is a simplified version that focuses on the timeline data
  const totalTransactions = filteredTxs.length;
  const totalVolume = filteredTxs.reduce((sum, tx) => sum + tx.value, 0);

  // Count buys and sells from filtered transactions
  let buys = 0;
  let sells = 0;

  filteredTxs.forEach((tx) => {
    const toLower = tx.to.toLowerCase();
    const fromLower = tx.from.toLowerCase();
    const toIsHolder = holderAddresses.has(toLower);
    const fromIsHolder = holderAddresses.has(fromLower);

    // If TO is a holder (and FROM is not), it's likely a buy
    if (toIsHolder && !fromIsHolder) {
      buys++;
    }
    // If FROM is a holder (and TO is not), it's likely a sell
    else if (fromIsHolder && !toIsHolder) {
      sells++;
    }
  });

  // Build simplified stats from filtered data
  const result: WalletActivityStats = {
    period: timeRange,
    lastUpdated: allData.cachedAt,
    totalWallets: wallets.length,
    activeWallets: wallets.length, // Approximate
    totalTransactions,
    totalVolume,
    behaviorDistribution: {} as Record<WalletBehaviorType, number>,
    transactionTypes: {
      buys,
      sells,
      transfers: totalTransactions - buys - sells,
    },
    topBuyers: [],
    topSellers: [],
    topAccumulators: [],
    topDistributors: [],
    activityTimeline,
    flowPatterns: [],
  };

  // Note: This fast path provides timeline data but skips full wallet activity analysis
  // For complete analytics (top wallets, behaviors, etc.), use normal fetch
  return result;
}

// =====================================================
// Main Analytics Fetch Function
// =====================================================

/**
 * Fetch comprehensive wallet activity analytics for a token
 * OPTIMIZED: Checks cache first, only fetches if cache is stale/missing
 *
 * @param skipFastPath - If true, skip the fast path and always do full fetch (for pre-fetching)
 */
export async function fetchWalletActivityStats(
  token: Token,
  wallets: Wallet[],
  timeRange: TimeRange,
  onProgress?: (message: string) => void,
  skipFastPath: boolean = false
): Promise<WalletActivityStats | null> {
  try {
    // OPTIMIZATION 1: Check time-range specific cache first (fastest)
    const cached = await loadWalletActivityCache(token.address, timeRange);
    if (cached) {
      onProgress?.("Loaded from cache");
      return cached.data as WalletActivityStats;
    }

    // OPTIMIZATION 2: Try fast path with client-side filtering from "all" cache
    // This enables instant time range switching when "all" data is cached
    // NOTE: Fast path is skipped during pre-fetching to ensure complete data is cached
    // NOTE: Fast path data is incomplete (missing top buyers/sellers, behavior distribution)
    if (!skipFastPath) {
      const fastResult = await fetchWalletActivityStatsFast(token, wallets, timeRange, onProgress);
      if (fastResult) {
        onProgress?.("Instant data from cached transactions");
        // DO NOT cache fast path results - they are incomplete
        // Return for display but don't save to cache
        return fastResult;
      }
    }

    onProgress?.("Analyzing wallet activities...");

    // Analyze individual wallet activities
    const activities = await analyzeWalletActivities(token, wallets, timeRange, onProgress);

    if (activities.length === 0) {
      return null;
    }

    onProgress?.("Building analytics...");

    // Calculate overall metrics
    const activeWallets = activities.filter((a) => a.isActive).length;
    const totalTransactions = activities.reduce((sum, a) => sum + a.totalTransactions, 0);
    const totalVolume = activities.reduce(
      (sum, a) => sum + a.totalBuyVolume + a.totalSellVolume,
      0
    );

    // Calculate behavior distribution
    const behaviorDistribution: Record<WalletBehaviorType, number> = {
      [WalletBehaviorType.WHALE]: 0,
      [WalletBehaviorType.RETAIL]: 0,
      [WalletBehaviorType.SMART_MONEY]: 0,
      [WalletBehaviorType.HODLER]: 0,
      [WalletBehaviorType.TRADER]: 0,
      [WalletBehaviorType.SNIPER]: 0,
      [WalletBehaviorType.UNKNOWN]: 0,
    };

    activities.forEach((a) => {
      behaviorDistribution[a.behaviorType] = (behaviorDistribution[a.behaviorType] ?? 0) + 1;
    });

    // Calculate transaction type breakdown
    const transactionTypes = {
      buys: activities.reduce((sum, a) => sum + a.buyCount, 0),
      sells: activities.reduce((sum, a) => sum + a.sellCount, 0),
      transfers: activities.reduce((sum, a) => sum + a.transferCount, 0),
    };

    // Sort top wallets (increased to 10) - filter out wallets with 0 volume
    const topBuyers = [...activities]
      .filter((a) => a.totalBuyVolume > 0)
      .sort((a, b) => b.totalBuyVolume - a.totalBuyVolume)
      .slice(0, 10);

    const topSellers = [...activities]
      .filter((a) => a.totalSellVolume > 0)
      .sort((a, b) => b.totalSellVolume - a.totalSellVolume)
      .slice(0, 10);

    const topAccumulators = [...activities]
      .filter((a) => a.netVolume > 0)
      .sort((a, b) => b.netVolume - a.netVolume)
      .slice(0, 10);

    const topDistributors = [...activities]
      .filter((a) => a.netVolume < 0)
      .sort((a, b) => a.netVolume - b.netVolume)
      .slice(0, 10);

    // Fetch all transactions for timeline and flow patterns
    onProgress?.("Fetching transaction data...");
    const allTransactions: Transaction[] = [];

    // FIX 4.1: Limit to top 15 wallets for transaction fetching (reduced from 25)
    // Timeline visualization doesn't need data from all wallets
    const topWalletsByActivity = [...activities]
      .sort((a, b) => b.totalTransactions - a.totalTransactions)
      .slice(0, 15);

    // Fetch transactions in batches of 15 (reduced from 25 to prevent rate limiting)
    const TX_BATCH_SIZE = 15;
    for (let i = 0; i < topWalletsByActivity.length; i += TX_BATCH_SIZE) {
      const batch = topWalletsByActivity.slice(i, i + TX_BATCH_SIZE);

      // Add delay between timeline batches to prevent rate limiting
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      const batchResults = await Promise.allSettled(
        batch.map(async (activity) => {
          try {
            const txs = await fetchWalletTransactions(
              activity.walletAddress,
              token.address,
              token.type
            );
            const cutoffTime = getTimeRangeFilter(timeRange);
            return txs.filter((tx) => tx.timestamp >= cutoffTime);
          } catch (error) {
            console.error(`Error fetching transactions for ${activity.walletAddress}:`, error);
            return [];
          }
        })
      );

      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          allTransactions.push(...result.value);
        }
      });
    }

    // Build timeline
    onProgress?.("Building activity timeline...");
    // Create holder addresses set for buy/sell classification
    const holderAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));
    const activityTimeline = await buildActivityTimeline(
      allTransactions,
      timeRange,
      holderAddresses
    );

    // Calculate flow patterns
    onProgress?.("Calculating flow patterns...");
    const flowPatterns = await calculateFlowPatterns(activities, allTransactions);

    const result: WalletActivityStats = {
      period: timeRange,
      lastUpdated: Date.now(),
      totalWallets: activities.length,
      activeWallets,
      totalTransactions,
      totalVolume,
      behaviorDistribution,
      transactionTypes,
      topBuyers,
      topSellers,
      topAccumulators,
      topDistributors,
      activityTimeline,
      flowPatterns,
    };

    // OPTIMIZATION: Save to cache for future instant loads
    await saveWalletActivityCache(token.address, timeRange, result);

    // OPTIMIZATION: Save all transactions when timeRange is "all" for instant client-side filtering
    // This enables the fast path for time range switches without API calls
    if (timeRange === "all" && allTransactions.length > 0) {
      const walletAddresses = wallets.map((w) => w.address);
      const holderAddressesArray = Array.from(holderAddresses);
      await saveAllTransactionsCache(
        token.address,
        allTransactions,
        walletAddresses,
        holderAddressesArray
      );
      console.log(
        `[Cache] Saved ${allTransactions.length} transactions for fast client-side filtering`
      );
    }

    return result;
  } catch (error) {
    console.error("[fetchWalletActivityStats] Error:", error);
    return null;
  }
}

// =====================================================
// Background Pre-fetching (Phase 2 Optimization)
// =====================================================

/**
 * Pre-fetch analytics for other time ranges in the background
 * This runs silently without progress updates and doesn't block the UI
 *
 * Requirements:
 * - Fire and forget (no await needed)
 * - Stagger fetches with 2 second delays
 * - Check cache before fetching
 * - Handle errors gracefully
 * - No progress UI updates
 *
 * @param token - Token to fetch analytics for
 * @param wallets - Wallet list to analyze
 * @param currentTimeRange - Current time range (will be skipped)
 */
export async function prefetchOtherTimeRanges(
  token: Token,
  wallets: Wallet[],
  currentTimeRange: TimeRange
): Promise<void> {
  // All time ranges except the current one
  const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];
  const timeRangesToPrefetch = allTimeRanges.filter((tr) => tr !== currentTimeRange);

  console.log(
    `[Prefetch] Starting background pre-fetch for ${timeRangesToPrefetch.length} time ranges: ${timeRangesToPrefetch.join(", ")}`
  );

  // Stagger fetches with 2 second delays to prevent rate limiting
  for (let i = 0; i < timeRangesToPrefetch.length; i++) {
    const timeRange = timeRangesToPrefetch[i]!;

    // Add delay between fetches (skip delay for first one)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Check cache first - skip if already cached
    const cached = await loadWalletActivityCache(token.address, timeRange);
    if (cached) {
      console.log(`[Prefetch] Cache HIT for ${timeRange}, skipping`);
      continue;
    }

    // Fire and forget - fetch in background without progress callbacks
    // IMPORTANT: Skip fast path to ensure complete data is cached (including behavior distribution, top buyers/sellers)
    fetchWalletActivityStats(token, wallets, timeRange, undefined, true)
      .then((result) => {
        if (result) {
          console.log(`[Prefetch] ✓ Pre-fetched ${timeRange} successfully`);
        } else {
          console.log(`[Prefetch] ✗ Pre-fetch for ${timeRange} returned null`);
        }
      })
      .catch((error) => {
        // Handle errors silently - don't let pre-fetch errors affect the UI
        console.error(`[Prefetch] ✗ Error pre-fetching ${timeRange}:`, error);
      });
  }

  console.log("[Prefetch] All pre-fetch tasks initiated");
}

/**
 * Pre-fetch analytics for other time ranges with progress callbacks
 * This version provides progress updates for UI indicators
 */
interface PrefetchProgress {
  type: "complete" | "error" | "start";
  timeRange: TimeRange;
}

export async function prefetchOtherTimeRangesWithProgress(
  token: Token,
  wallets: Wallet[],
  currentTimeRange: TimeRange,
  onProgress?: (progress: PrefetchProgress) => void
): Promise<void> {
  // All time ranges except the current one
  const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];
  const timeRangesToPrefetch = allTimeRanges.filter((tr) => tr !== currentTimeRange);

  console.log(
    `[Prefetch] Starting background pre-fetch for ${timeRangesToPrefetch.length} time ranges: ${timeRangesToPrefetch.join(", ")}`
  );

  // Stagger fetches with 2 second delays to prevent rate limiting
  for (let i = 0; i < timeRangesToPrefetch.length; i++) {
    const timeRange = timeRangesToPrefetch[i]!;

    // Add delay between fetches (skip delay for first one)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Check cache first - skip if already cached
    const cached = await loadWalletActivityCache(token.address, timeRange);
    if (cached) {
      console.log(`[Prefetch] Cache HIT for ${timeRange}, skipping`);
      onProgress?.({ type: "complete", timeRange });
      continue;
    }

    // Notify start
    onProgress?.({ type: "start", timeRange });

    // Fire and forget - fetch in background without progress callbacks
    // IMPORTANT: Skip fast path to ensure complete data is cached (including behavior distribution, top buyers/sellers)
    fetchWalletActivityStats(token, wallets, timeRange, undefined, true)
      .then((result) => {
        if (result) {
          console.log(`[Prefetch] ✓ Pre-fetched ${timeRange} successfully`);
          onProgress?.({ type: "complete", timeRange });
        } else {
          console.log(`[Prefetch] ✗ Pre-fetch for ${timeRange} returned null`);
          onProgress?.({ type: "error", timeRange });
        }
      })
      .catch((error) => {
        // Handle errors silently - don't let pre-fetch errors affect the UI
        console.error(`[Prefetch] ✗ Error pre-fetching ${timeRange}:`, error);
        onProgress?.({ type: "error", timeRange });
      });
  }

  console.log("[Prefetch] All pre-fetch tasks initiated");
}

// =====================================================
// OPTIMIZATION: Transaction-Level Caching for Instant Switching
// =====================================================

/**
 * Fetch ALL transactions for ALL wallets once
 * This enables instant client-side timeframe filtering (<100ms)
 * OPTIMIZED: Single API call roundtrip per wallet, cached for 20 minutes
 */
export async function fetchAllTransactionsForToken(
  token: Token,
  wallets: Wallet[],
  onProgress?: (message: string) => void
): Promise<{
  transactions: Transaction[];
  walletAddresses: string[];
  holderAddresses: string[];
}> {
  onProgress?.("Fetching all wallet transactions...");

  const allTransactions: Transaction[] = [];
  const BATCH_SIZE = 15;
  const totalWallets = wallets.length;

  for (let i = 0; i < totalWallets; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE);
    const progress = Math.round((i / totalWallets) * 100);
    onProgress?.(
      `Fetching wallet transactions ${i + 1}-${Math.min(i + BATCH_SIZE, totalWallets)}/${totalWallets} (${progress}%)`
    );

    // Small delay between batches to prevent rate limiting
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const batchResults = await Promise.allSettled(
      batch.map(async (wallet) => {
        try {
          return await fetchWalletTransactions(wallet.address, token.address, token.type);
        } catch (error) {
          console.error(`Error fetching transactions for ${wallet.address}:`, error);
          return [];
        }
      })
    );

    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        allTransactions.push(...result.value);
      }
    });
  }

  const holderAddresses = wallets.map((w) => w.address.toLowerCase());
  const walletAddresses = wallets.map((w) => w.address);

  // Cache ALL transactions for instant client-side filtering
  await saveAllTransactionsCache(token.address, allTransactions, walletAddresses, holderAddresses);

  console.log(`[Cache] Saved ${allTransactions.length} transactions for instant filtering`);

  return {
    transactions: allTransactions,
    walletAddresses,
    holderAddresses,
  };
}

/**
 * Generate analytics for ANY timeframe from cached transactions
 * This is INSTANT (<100ms) because it's all client-side
 */
export async function generateAnalyticsFromCachedTransactions(
  token: Token,
  _wallets: Wallet[],
  timeRange: TimeRange,
  onProgress?: (message: string) => void
): Promise<WalletActivityStats | null> {
  onProgress?.("Loading from cache...");

  // Load all transactions
  const allData = await loadAllTransactionsCache(token.address);

  if (!allData || Date.now() >= allData.expiresAt) {
    onProgress?.("Cache expired, fetching from API...");
    return null; // Fall back to API fetch
  }

  onProgress?.("Filtering transactions...");

  // Filter transactions by timeframe (instant!)
  const filteredTxs = filterTransactionsByTimeRange(allData.transactions, timeRange);

  if (filteredTxs.length === 0) {
    return null;
  }

  // Process filtered data (fast, no API calls)
  onProgress?.("Analyzing wallet activities...");
  const holderAddressesSet = new Set(allData.holderAddresses);

  const activities = await analyzeWalletActivitiesFromTransactions(
    filteredTxs,
    allData.walletAddresses,
    token.address,
    timeRange,
    holderAddressesSet
  );

  if (activities.length === 0) return null;

  onProgress?.("Building analytics...");

  // Calculate metrics (instant, client-side)
  const activeWallets = activities.filter((a) => a.isActive).length;
  const totalTransactions = activities.reduce((sum, a) => sum + a.totalTransactions, 0);
  const totalVolume = activities.reduce((sum, a) => sum + a.totalBuyVolume + a.totalSellVolume, 0);

  // Calculate behavior distribution
  const behaviorDistribution: Record<WalletBehaviorType, number> = {
    [WalletBehaviorType.WHALE]: 0,
    [WalletBehaviorType.RETAIL]: 0,
    [WalletBehaviorType.SMART_MONEY]: 0,
    [WalletBehaviorType.HODLER]: 0,
    [WalletBehaviorType.TRADER]: 0,
    [WalletBehaviorType.SNIPER]: 0,
    [WalletBehaviorType.UNKNOWN]: 0,
  };

  activities.forEach((a) => {
    behaviorDistribution[a.behaviorType] = (behaviorDistribution[a.behaviorType] || 0) + 1;
  });

  // Calculate transaction type breakdown
  const transactionTypes = {
    buys: activities.reduce((sum, a) => sum + a.buyCount, 0),
    sells: activities.reduce((sum, a) => sum + a.sellCount, 0),
    transfers: activities.reduce((sum, a) => sum + a.transferCount, 0),
  };

  // Check if there's sufficient trading activity for meaningful analytics
  // If total volume is 0 and there are no buys or sells, the data is not meaningful
  // (likely only transfers between wallets, not actual trading activity)
  const hasTradingActivity =
    totalVolume > 0 || transactionTypes.buys > 0 || transactionTypes.sells > 0;

  if (!hasTradingActivity) {
    onProgress?.("No trading activity in this timeframe");
    return null; // Show empty state instead of meaningless partial data
  }

  // Sort top wallets
  const topBuyers = [...activities]
    .filter((a) => a.totalBuyVolume > 0)
    .sort((a, b) => b.totalBuyVolume - a.totalBuyVolume)
    .slice(0, 10);

  const topSellers = [...activities]
    .filter((a) => a.totalSellVolume > 0)
    .sort((a, b) => b.totalSellVolume - a.totalSellVolume)
    .slice(0, 10);

  const topAccumulators = [...activities]
    .filter((a) => a.netVolume > 0)
    .sort((a, b) => b.netVolume - a.netVolume)
    .slice(0, 10);

  const topDistributors = [...activities]
    .filter((a) => a.netVolume < 0)
    .sort((a, b) => a.netVolume - b.netVolume)
    .slice(0, 10);

  // Build timeline from filtered transactions
  onProgress?.("Building timeline...");
  const activityTimeline = await buildActivityTimeline(filteredTxs, timeRange, holderAddressesSet);

  // Calculate flow patterns
  onProgress?.("Calculating flows...");
  const flowPatterns = await calculateFlowPatterns(activities, filteredTxs);

  const result: WalletActivityStats = {
    period: timeRange,
    lastUpdated: allData.cachedAt,
    totalWallets: activities.length,
    activeWallets,
    totalTransactions,
    totalVolume,
    behaviorDistribution,
    transactionTypes,
    topBuyers,
    topSellers,
    topAccumulators,
    topDistributors,
    activityTimeline,
    flowPatterns,
  };

  return result;
}

/**
 * Analyze wallet activities from transaction data
 * Simplified version that works with cached transactions
 */
async function analyzeWalletActivitiesFromTransactions(
  transactions: Transaction[],
  walletAddresses: string[],
  _tokenAddress: string,
  timeRange: TimeRange,
  holderAddresses: Set<string>
): Promise<WalletActivity[]> {
  const cutoffTime = getTimeRangeFilter(timeRange);

  // Group transactions by wallet
  const walletTxs = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    if (tx.timestamp < cutoffTime) return;

    const fromLower = tx.from.toLowerCase();
    const toLower = tx.to.toLowerCase();

    // Track incoming transactions (to is wallet)
    if (walletAddresses.includes(fromLower)) {
      if (!walletTxs.has(fromLower)) {
        walletTxs.set(fromLower, []);
      }
      walletTxs.get(fromLower)!.push(tx);
    }

    // Track outgoing transactions (from is wallet)
    if (walletAddresses.includes(toLower)) {
      if (!walletTxs.has(toLower)) {
        walletTxs.set(toLower, []);
      }
      walletTxs.get(toLower)!.push(tx);
    }
  });

  const activities: WalletActivity[] = [];

  for (const [walletAddress, txs] of walletTxs) {
    if (txs.length === 0) continue;

    let buyCount = 0;
    let sellCount = 0;
    let transferCount = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let firstTx = Number.MAX_VALUE;
    let lastTx = 0;
    const currentBalance = 0;

    // Process transactions
    txs.forEach((tx) => {
      const fromLower = tx.from.toLowerCase();
      const toLower = tx.to.toLowerCase();
      const toIsHolder = holderAddresses.has(toLower);
      const fromIsHolder = holderAddresses.has(fromLower);

      // Classify transaction
      if (toIsHolder && !fromIsHolder) {
        buyCount++;
        totalBuyVolume += tx.value;
      } else if (fromIsHolder && !toIsHolder) {
        sellCount++;
        totalSellVolume += tx.value;
      } else {
        transferCount++;
      }

      // Track timing
      firstTx = Math.min(firstTx, tx.timestamp);
      lastTx = Math.max(lastTx, tx.timestamp);
    });

    // Calculate holding period (days since first buy)
    const holdingPeriod = buyCount > 0 ? (Date.now() - firstTx) / (1000 * 60 * 60 * 24) : 0;

    // Calculate average days between transactions
    const avgDaysBetweenTxs =
      txs.length > 1 ? (lastTx - firstTx) / (1000 * 60 * 24 * (txs.length - 1)) : 0;

    // Classify behavior
    const behaviorType = classifyWalletBehaviorFromMetrics(
      walletAddress,
      buyCount,
      sellCount,
      totalBuyVolume,
      totalSellVolume,
      holdingPeriod,
      txs.length
    );

    activities.push({
      walletAddress,
      label: undefined,
      behaviorType,
      isActive: txs.length > 0,
      totalTransactions: txs.length,
      buyCount,
      sellCount,
      transferCount,
      totalBuyVolume,
      totalSellVolume,
      netVolume: totalBuyVolume - totalSellVolume,
      firstTransaction: firstTx,
      lastTransaction: lastTx,
      avgDaysBetweenTxs,
      holdingPeriod,
      currentBalance,
      peakBalance: currentBalance, // Use currentBalance as peak (we don't track balance history)
      lowestBalance: currentBalance, // Use currentBalance as lowest (we don't track balance history)
      isWhale: totalBuyVolume > 10000 || totalSellVolume > 10000, // Simple threshold
      isAccumulating: totalBuyVolume > totalSellVolume, // Net buyer
      isDistributing: totalSellVolume > totalBuyVolume, // Net seller
    });
  }

  return activities;
}

/**
 * Classify wallet behavior from metrics (simplified version)
 */
function classifyWalletBehaviorFromMetrics(
  _walletAddress: string,
  buyCount: number,
  sellCount: number,
  totalBuyVolume: number,
  totalSellVolume: number,
  holdingPeriod: number,
  txCount: number
): WalletBehaviorType {
  // Calculate metrics
  const netVolume = totalBuyVolume - totalSellVolume;
  const avgVolume = (totalBuyVolume + totalSellVolume) / (txCount || 1);

  // Sniper: early buyer with long holding period
  if (holdingPeriod > 180 && buyCount > 0 && sellCount === 0) {
    return WalletBehaviorType.SNIPER;
  }

  // HODLer: long holding, low selling
  if (holdingPeriod > 90 && sellCount < buyCount * 0.2) {
    return WalletBehaviorType.HODLER;
  }

  // Trader: high transaction count with both buys and sells
  if (txCount > 10 && buyCount > 0 && sellCount > 0) {
    return WalletBehaviorType.TRADER;
  }

  // Whale: very high volume
  if (avgVolume > 100000) {
    return WalletBehaviorType.WHALE;
  }

  // Smart Money: profitable with significant volume
  if (netVolume > 0 && avgVolume > 10000 && txCount > 5) {
    return WalletBehaviorType.SMART_MONEY;
  }

  // Retail: small transactions, occasional activity
  if (avgVolume < 1000 || txCount <= 3) {
    return WalletBehaviorType.RETAIL;
  }

  return WalletBehaviorType.UNKNOWN;
}
