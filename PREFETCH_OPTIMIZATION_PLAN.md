# Wallet Activity Analytics - Pre-fetching Optimization Plan

## Problem Statement

When a user navigates away from the Wallet Activity Analytics page (by clicking on a top buyer/seller), the background pre-fetching stops. When they return and switch to a different timeframe, it has to reload everything from scratch (~45 seconds).

### Current Flow:

1. User loads Wallet Activity Analytics → 24H loads (~45s)
2. Pre-fetching starts in background for 1H, 7D, 30D, All Time
3. User clicks a wallet → navigates to bubble map
4. **PROBLEM**: Pre-fetching stops/interrupted
5. User returns → clicks 7D
6. **PROBLEM**: Has to reload from scratch (~45s)

### Root Cause:

- Pre-fetching is tied to component lifecycle
- When component unmounts, async operations are cancelled
- State updates (`setPrefetchingStatus`) fail after unmount
- No persistence of pre-fetch progress across navigation

---

## Optimization Solutions

### Solution 1: Global Pre-fetch Manager (RECOMMENDED) ⭐

Create a singleton manager that persists pre-fetching state across page navigations.

**Pros:**

- Pre-fetching continues even when user navigates away
- Progress is preserved and can be resumed
- No wasted API calls
- Works with existing architecture

**Cons:**

- Requires new singleton service
- Need to handle concurrent pre-fetch requests

**Implementation:**

#### 1.1 Create Global Pre-fetch Manager

```typescript
// services/prefetchManager.ts

interface PrefetchTask {
  tokenAddress: string;
  token: Token;
  wallets: Wallet[];
  timeRange: TimeRange;
  status: "pending" | "in-progress" | "complete" | "error";
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

interface PrefetchState {
  tasks: Map<string, PrefetchTask>; // key: `${tokenAddress}-${timeRange}`
  isRunning: boolean;
}

class PrefetchManager {
  private static instance: PrefetchManager;
  private state: PrefetchState = {
    tasks: new Map(),
    isRunning: false,
  };

  private static readonly STORAGE_KEY = "prefetch-state";
  private static readonly SYNC_CHANNEL = "prefetch-sync";

  private constructor() {
    this.loadState();
    this.setupSyncChannel();
  }

  static getInstance(): PrefetchManager {
    if (!this.instance) {
      this.instance = new PrefetchManager();
    }
    return this.instance;
  }

  // Load state from sessionStorage (survives page navigation)
  private loadState(): void {
    try {
      const stored = sessionStorage.getItem(PrefetchManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state.tasks = new Map(Object.entries(parsed.tasks));

        // Reset any in-progress tasks to pending (they were interrupted)
        for (const [key, task] of this.state.tasks) {
          if (task.status === "in-progress") {
            task.status = "pending";
          }
        }
      }
    } catch (e) {
      console.warn("[PrefetchManager] Failed to load state:", e);
    }
  }

  // Save state to sessionStorage
  private saveState(): void {
    try {
      const serialized = {
        tasks: Object.fromEntries(this.state.tasks),
        isRunning: this.state.isRunning,
      };
      sessionStorage.setItem(PrefetchManager.STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.warn("[PrefetchManager] Failed to save state:", e);
    }
  }

  // Setup BroadcastChannel for cross-tab sync
  private setupSyncChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(PrefetchManager.SYNC_CHANNEL);
    channel.onmessage = (event) => {
      const { type, data } = event.data;
      if (type === "STATE_UPDATE") {
        this.loadState();
      }
    };
  }

  private notifyStateUpdate(): void {
    this.saveState();

    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(PrefetchManager.SYNC_CHANNEL);
    channel.postMessage({ type: "STATE_UPDATE" });
  }

  // Start pre-fetching for a token
  async startPrefetching(
    token: Token,
    wallets: Wallet[],
    currentTimeRange: TimeRange,
    onProgress?: (progress: { timeRange: TimeRange; status: string }) => void
  ): Promise<void> {
    const tokenAddress = token.address.toLowerCase();
    const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];
    const timeRangesToPrefetch = allTimeRanges.filter((tr) => tr !== currentTimeRange);

    // Create tasks
    for (const timeRange of timeRangesToPrefetch) {
      const key = `${tokenAddress}-${timeRange}`;
      if (!this.state.tasks.has(key)) {
        this.state.tasks.set(key, {
          tokenAddress,
          token,
          wallets,
          timeRange,
          status: "pending",
        });
      }
    }
    this.notifyStateUpdate();

    // Start processing
    await this.processQueue(onProgress);
  }

  // Process the pre-fetch queue
  private async processQueue(
    onProgress?: (progress: { timeRange: TimeRange; status: string }) => void
  ): Promise<void> {
    if (this.state.isRunning) return;
    this.state.isRunning = true;

    try {
      const pendingTasks = Array.from(this.state.tasks.values())
        .filter((t) => t.status === "pending")
        .sort((a, b) => {
          // Prioritize: 7d, 30d, 1h, all (skip 24h as it's usually current)
          const priority = { "7d": 1, "30d": 2, "1h": 3, all: 4 };
          return (priority[a.timeRange] || 99) - (priority[b.timeRange] || 99);
        });

      for (const task of pendingTasks) {
        const key = `${task.tokenAddress}-${task.timeRange}`;

        // Check if still pending (might have been updated by another tab)
        const currentTask = this.state.tasks.get(key);
        if (!currentTask || currentTask.status !== "pending") continue;

        // Mark as in-progress
        task.status = "in-progress";
        task.startedAt = Date.now();
        this.state.tasks.set(key, task);
        this.notifyStateUpdate();
        onProgress?.({ timeRange: task.timeRange, status: "in-progress" });

        // Fetch analytics
        try {
          const { fetchWalletActivityStats } = await import("./walletActivityService");
          const result = await fetchWalletActivityStats(
            task.token,
            task.wallets,
            task.timeRange,
            undefined,
            true // skipFastPath
          );

          if (result) {
            task.status = "complete";
            task.completedAt = Date.now();
            this.state.tasks.set(key, task);
            this.notifyStateUpdate();
            onProgress?.({ timeRange: task.timeRange, status: "complete" });
          } else {
            task.status = "error";
            task.error = "No data returned";
            this.state.tasks.set(key, task);
            this.notifyStateUpdate();
            onProgress?.({ timeRange: task.timeRange, status: "error" });
          }
        } catch (error) {
          task.status = "error";
          task.error = error instanceof Error ? error.message : "Unknown error";
          this.state.tasks.set(key, task);
          this.notifyStateUpdate();
          onProgress?.({ timeRange: task.timeRange, status: "error" });
        }

        // Stagger fetches (2 second delay)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      this.state.isRunning = false;
    }
  }

  // Get pre-fetch status for all timeframes
  getPrefetchStatus(tokenAddress: string): Record<TimeRange, string> {
    const status: Record<string, string> = {};
    const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

    for (const timeRange of allTimeRanges) {
      const key = `${tokenAddress.toLowerCase()}-${timeRange}`;
      const task = this.state.tasks.get(key);
      status[timeRange] = task?.status || "idle";
    }

    return status as Record<TimeRange, string>;
  }

  // Clear completed tasks (call when token changes)
  clearToken(tokenAddress: string): void {
    const prefix = tokenAddress.toLowerCase();
    for (const [key] of this.state.tasks) {
      if (key.startsWith(prefix)) {
        this.state.tasks.delete(key);
      }
    }
    this.notifyStateUpdate();
  }
}

export const prefetchManager = PrefetchManager.getInstance();
```

#### 1.2 Update Component to Use Global Manager

```typescript
// components/WalletActivityAnalytics.tsx

// In fetchAnalytics, after analytics load:
(async () => {
  const { prefetchManager } = await import("../services/prefetchManager");

  // Start global pre-fetching (continues even if component unmounts)
  await prefetchManager.startPrefetching(token, wallets, timeRange, (progress) => {
    // Update local state for UI indicators
    setPrefetchingStatus((prev) => ({
      ...prev,
      [progress.timeRange]: progress.status === "complete" ? "cached" : "loading",
    }));
  });
})();

// Add effect to sync with global manager state
useEffect(() => {
  if (!token) return;

  const syncState = async () => {
    const { prefetchManager } = await import("../services/prefetchManager");
    const globalStatus = prefetchManager.getPrefetchStatus(token.address);

    setPrefetchingStatus((prev) => {
      const updated = { ...prev };
      for (const [timeRange, status] of Object.entries(globalStatus)) {
        if (status === "complete") {
          updated[timeRange as TimeRange] = "cached";
        } else if (status === "in-progress") {
          updated[timeRange as TimeRange] = "loading";
        }
      }
      return updated;
    });
  };

  // Sync immediately
  syncState();

  // Sync every 2 seconds
  const interval = setInterval(syncState, 2000);
  return () => clearInterval(interval);
}, [token?.address]);
```

---

### Solution 2: Transaction-Level Caching (MOST EFFICIENT) ⭐⭐⭐

Instead of caching processed analytics, cache the RAW TRANSACTION DATA. This allows any timeframe to be calculated client-side in milliseconds.

**Pros:**

- Fastest possible timeframe switching (<100ms)
- Minimal API calls
- Works perfectly with offline/cache-first architecture
- Scales to many timeframes

**Cons:**

- Higher memory usage (but manageable with 100 wallets × ~1000 txs each)
- Initial fetch is slower (need all transactions)

**Implementation:**

#### 2.1 Add All Transactions Cache

```typescript
// services/db.ts

export interface DbAllTransactionsCache {
  tokenAddress: string; // Primary key
  transactions: Transaction[]; // ALL transactions for all top 100 wallets
  walletAddresses: string[]; // List of wallet addresses
  holderAddresses: string[]; // For buy/sell classification
  fetchedAt: number;
  expiresAt: number; // 20 minutes TTL
}

// Add to database version 24
allTransactionsCache: "tokenAddress, fetchedAt, expiresAt";

export async function saveAllTransactionsCache(
  tokenAddress: string,
  transactions: Transaction[],
  walletAddresses: string[],
  holderAddresses: string[]
): Promise<void> {
  try {
    const now = Date.now();
    const cacheEntry: DbAllTransactionsCache = {
      tokenAddress: tokenAddress.toLowerCase(),
      transactions,
      walletAddresses,
      holderAddresses,
      fetchedAt: now,
      expiresAt: now + 20 * 60 * 1000, // 20 minutes
    };

    await db.allTransactionsCache.put(cacheEntry);
    console.log(`[Cache] Saved all ${transactions.length} transactions for instant filtering`);
  } catch (error) {
    console.error("[Cache] Failed to save all transactions cache:", error);
  }
}

export async function loadAllTransactionsCache(
  tokenAddress: string
): Promise<DbAllTransactionsCache | null> {
  try {
    const cacheEntry = await db.allTransactionsCache.get(tokenAddress.toLowerCase());

    if (!cacheEntry) return null;

    // Check if cache is still valid
    if (Date.now() > cacheEntry.expiresAt) {
      await db.allTransactionsCache.delete(tokenAddress.toLowerCase());
      console.log("[Cache] All transactions cache expired");
      return null;
    }

    const remainingTime = Math.round((cacheEntry.expiresAt - Date.now()) / 1000);
    console.log(`[Cache] All transactions cache HIT - ${remainingTime}s remaining`);
    return cacheEntry;
  } catch (error) {
    console.error("[Cache] Failed to load all transactions cache:", error);
    return null;
  }
}
```

#### 2.2 Fetch All Transactions Once

```typescript
// services/walletActivityService.ts

/**
 * Fetch ALL transactions for ALL wallets once
 * This enables instant client-side filtering for any timeframe
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

    // Small delay between batches
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

  // Cache ALL transactions
  const { saveAllTransactionsCache } = await import("./db");
  await saveAllTransactionsCache(
    token.address,
    allTransactions,
    wallets.map((w) => w.address),
    holderAddresses
  );

  return {
    transactions: allTransactions,
    walletAddresses: wallets.map((w) => w.address),
    holderAddresses,
  };
}
```

#### 2.3 Instant Timeframe Switching

```typescript
// services/walletActivityService.ts

/**
 * Generate analytics for ANY timeframe from cached transactions
 * This is INSTANT (<100ms) because it's all client-side
 */
export async function generateAnalyticsFromCachedTransactions(
  token: Token,
  timeRange: TimeRange,
  onProgress?: (message: string) => void
): Promise<WalletActivityStats | null> {
  onProgress?.("Loading from cache...");

  // Load all transactions
  const { loadAllTransactionsCache } = await import("./db");
  const allData = await loadAllTransactionsCache(token.address);

  if (!allData || Date.now() >= allData.expiresAt) {
    onProgress?.("Cache expired, fetching from API...");
    return null; // Fall back to API fetch
  }

  onProgress?.("Filtering transactions...");

  // Filter transactions by timeframe (instant!)
  const cutoffTime = getTimeRangeFilter(timeRange);
  const filteredTxs = allData.transactions.filter((tx) => tx.timestamp >= cutoffTime);

  if (filteredTxs.length === 0) {
    return null;
  }

  // Process transactions (fast, no API calls)
  onProgress?.("Analyzing wallet activities...");
  const holderAddressesSet = new Set(allData.holderAddresses);

  const activities = await analyzeWalletActivitiesFromTransactions(
    filteredTxs,
    allData.walletAddresses,
    timeRange,
    holderAddressesSet
  );

  if (activities.length === 0) return null;

  onProgress?.("Building analytics...");

  // Calculate metrics (instant, client-side)
  const activeWallets = activities.filter((a) => a.isActive).length;
  const totalTransactions = activities.reduce((sum, a) => sum + a.totalTransactions, 0);
  const totalVolume = activities.reduce((sum, a) => sum + a.totalBuyVolume + a.totalSellVolume, 0);

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
    .sort((a, b) => b.netVolume - b.netVolume)
    .slice(0, 10);

  const topDistributors = [...activities]
    .filter((a) => a.netVolume < 0)
    .sort((a, b) => a.netVolume - b.netVolume)
    .slice(0, 10);

  // Build timeline from filtered transactions
  onProgress?.("Building timeline...");
  const activityTimeline = buildActivityTimeline(filteredTxs, timeRange, holderAddressesSet);

  // Calculate flow patterns
  onProgress?.("Calculating flows...");
  const flowPatterns = calculateFlowPatterns(activities, filteredTxs);

  const result: WalletActivityStats = {
    period: timeRange,
    lastUpdated: allData.fetchedAt,
    totalWallets: activities.length,
    activeWallets,
    totalTransactions,
    totalVolume,
    behaviorDistribution,
    transactionTypes: {
      buys: activities.reduce((sum, a) => sum + a.buyCount, 0),
      sells: activities.reduce((sum, a) => sum + a.sellCount, 0),
      transfers: activities.reduce((sum, a) => sum + a.transferCount, 0),
    },
    topBuyers,
    topSellers,
    topAccumulators,
    topDistributors,
    activityTimeline,
    flowPatterns,
  };

  return result;
}
```

#### 2.4 Update Main Fetch Function

```typescript
export async function fetchWalletActivityStats(
  token: Token,
  wallets: Wallet[],
  timeRange: TimeRange,
  onProgress?: (message: string) => void
): Promise<WalletActivityStats | null> {
  // OPTIMIZATION 1: Try instant client-side generation from cached transactions
  const instantResult = await generateAnalyticsFromCachedTransactions(token, timeRange, onProgress);
  if (instantResult) {
    return instantResult;
  }

  // OPTIMIZATION 2: Check analytics cache
  const cached = await loadWalletActivityCache(token.address, timeRange);
  if (cached) {
    return cached.data as WalletActivityStats;
  }

  // FALLBACK: Fetch from API (only if no cached transactions)
  // ... rest of existing fetch logic

  // NEW: After successful fetch, save all transactions for future instant switching
  if (timeRange === "all" && allTransactions.length > 0) {
    await saveAllTransactionsCache(
      token.address,
      allTransactions,
      wallets.map((w) => w.address),
      holderAddresses
    );
  }
}
```

---

### Solution 3: Hybrid Approach (BEST USER EXPERIENCE) ⭐⭐⭐⭐⭐

Combine both solutions for optimal performance:

1. **Initial Load**: Fetch ALL transactions once (~60s)
2. **After First Load**: All timeframe switches are instant (<100ms)
3. **Background**: Continue pre-fetching processed analytics for even faster loads
4. **Persistence**: Both raw transactions and processed analytics are cached

**User Flow:**

```
1. User loads Wallet Activity (24H)
   → Fetch all transactions (~60s)
   → Generate 24H analytics from transactions
   → Cache transactions + analytics

2. User clicks 7D
   → Filter cached transactions by 7D (<100ms!)
   → Generate 7D analytics instantly
   → Cache 7D analytics

3. User navigates to bubble map
   → Pre-fetching continues in background

4. User returns, clicks 1H
   → INSTANT load from cache!
```

---

## Implementation Priority

### Phase 1: Foundation (5 min)

- [ ] Add `allTransactionsCache` table to db.ts (version 24)
- [ ] Implement `saveAllTransactionsCache` and `loadAllTransactionsCache`

### Phase 2: Transaction Fetching (15 min)

- [ ] Implement `fetchAllTransactionsForToken` function
- [ ] Update `fetchWalletActivityStats` to use transaction cache

### Phase 3: Client-Side Processing (20 min)

- [ ] Implement `generateAnalyticsFromCachedTransactions`
- [ ] Implement `analyzeWalletActivitiesFromTransactions`

### Phase 4: Global Pre-fetch Manager (15 min)

- [ ] Create `prefetchManager.ts` singleton
- [ ] Add state persistence to sessionStorage
- [ ] Add cross-tab sync with BroadcastChannel

### Phase 5: Component Integration (10 min)

- [ ] Update `WalletActivityAnalytics.tsx` to use global manager
- [ ] Add sync effect for global state
- [ ] Update loading states

### Phase 6: Testing & Polish (10 min)

- [ ] Test all timeframe switches
- [ ] Verify pre-fetching continues after navigation
- [ ] Performance benchmarking

**Total Estimated Time**: ~75 minutes

---

## Expected Results

| Operation                    | Before            | After                            |
| ---------------------------- | ----------------- | -------------------------------- |
| **Initial load**             | ~45s              | ~60s (one-time fetch of all txs) |
| **First timeframe switch**   | ~45s              | <100ms (instant!)                |
| **Subsequent switches**      | ~45s              | <100ms (instant!)                |
| **After navigation**         | ~45s              | <100ms (instant!)                |
| **Pre-fetching persistence** | Stops on navigate | Continues in background          |

---

## Technical Considerations

### Memory Management

- 100 wallets × ~1000 transactions × ~200 bytes = ~20MB
- Well within browser limits (IndexedDB can handle GBs)
- Add automatic cleanup of old entries

### Browser Compatibility

- ✅ IndexedDB: All modern browsers
- ✅ BroadcastChannel: Chrome, Firefox, Safari (not IE)
- ✅ sessionStorage: All modern browsers
- Fallback for BroadcastChannel: localStorage polling

### Edge Cases

- What if user switches tokens mid-pre-fetch?
  → Clear queue for old token, start new queue
- What if multiple tabs open?
  → BroadcastChannel syncs state
- What if cache expires?
  → Automatic fallback to API fetch

---

## Success Criteria

1. ✅ Pre-fetching continues after user navigates away
2. ✅ Timeframe switches complete in <100ms when cached
3. ✅ All transactions fetched once, reused for all timeframes
4. ✅ Works across page navigation and tab switching
5. ✅ No redundant API calls
6. ✅ UI remains responsive during all operations
