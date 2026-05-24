/**
 * Global Pre-fetch Manager
 *
 * Manages pre-fetching state across page navigations.
 * Persists state in sessionStorage so pre-fetching continues
 * even when user navigates away from the component.
 */

import type { Token, Wallet, TimeRange } from "../types";

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
  tasks: Record<string, PrefetchTask>; // key: `${tokenAddress}-${timeRange}`
  isRunning: boolean;
}

// Global callback registry for progress updates
const progressCallbacks = new Set<(progress: { timeRange: TimeRange; status: string }) => void>();

const STORAGE_KEY = "prefetch-state";
const SYNC_CHANNEL = "prefetch-sync";

class PrefetchManagerClass {
  private state: PrefetchState = {
    tasks: {},
    isRunning: false,
  };

  constructor() {
    this.loadState();
    this.setupSyncChannel();
  }

  private loadState(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Convert tasks array back to record
        const tasks: Record<string, PrefetchTask> = {};
        if (Array.isArray(parsed.tasks)) {
          parsed.tasks.forEach((task: PrefetchTask) => {
            const key = `${task.tokenAddress}-${task.timeRange}`;
            tasks[key] = task;
          });
        } else if (parsed.tasks) {
          Object.assign(tasks, parsed.tasks);
        }

        this.state.tasks = tasks;

        // Reset any in-progress tasks to pending (they were interrupted)
        for (const [key, task] of Object.entries(this.state.tasks)) {
          if (task.status === "in-progress") {
            task.status = "pending";
            this.state.tasks[key] = task;
          }
        }
      }
    } catch (e) {
      console.warn("[PrefetchManager] Failed to load state:", e);
    }
  }

  private saveState(): void {
    try {
      const serialized = {
        tasks: Object.values(this.state.tasks),
        isRunning: this.state.isRunning,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.warn("[PrefetchManager] Failed to save state:", e);
    }
  }

  private setupSyncChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;

    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event) => {
        const { type } = event.data;
        if (type === "STATE_UPDATE") {
          this.loadState();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported
      console.warn("[PrefetchManager] BroadcastChannel not supported:", e);
    }
  }

  private notifyStateUpdate(): void {
    this.saveState();

    if (typeof BroadcastChannel === "undefined") return;

    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage({ type: "STATE_UPDATE" });
    } catch (e) {
      // BroadcastChannel not supported
    }
  }

  /**
   * Start pre-fetching for a token
   */
  async startPrefetching(
    token: Token,
    wallets: Wallet[],
    currentTimeRange: TimeRange,
    onProgress?: (progress: { timeRange: TimeRange; status: string }) => void
  ): Promise<void> {
    const tokenAddress = token.address.toLowerCase();
    const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];
    const timeRangesToPrefetch = allTimeRanges.filter((tr) => tr !== currentTimeRange);

    // Register the callback
    if (onProgress) {
      progressCallbacks.add(onProgress);
    }

    // Create tasks for each timeframe
    for (const timeRange of timeRangesToPrefetch) {
      const key = `${tokenAddress}-${timeRange}`;
      if (!this.state.tasks[key]) {
        this.state.tasks[key] = {
          tokenAddress,
          token,
          wallets,
          timeRange,
          status: "pending",
        };
      }
    }
    this.notifyStateUpdate();

    // Start processing
    await this.processQueue();

    // Note: We don't remove the callback here because processing continues in background
    // Callbacks will be cleaned up when components unmount (via unregisterCallback)
  }

  /**
   * Unregister a progress callback (call when component unmounts)
   */
  unregisterCallback(
    onProgress: (progress: { timeRange: TimeRange; status: string }) => void
  ): void {
    progressCallbacks.delete(onProgress);
  }

  /**
   * Notify all registered callbacks of progress
   */
  private notifyProgress(progress: { timeRange: TimeRange; status: string }): void {
    progressCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error("[PrefetchManager] Callback error:", error);
      }
    });
  }

  /**
   * Process the pre-fetch queue
   */
  private async processQueue(): Promise<void> {
    if (this.state.isRunning) return;
    this.state.isRunning = true;

    try {
      const pendingTasks = Object.values(this.state.tasks)
        .filter((t) => t.status === "pending")
        .sort((a, b) => {
          // Prioritize: 7d, 30d, 1h, all (skip 24h as it's usually current)
          const priority: Record<string, number> = { "7d": 1, "30d": 2, "1h": 3, all: 4 };
          return (priority[a.timeRange] || 99) - (priority[b.timeRange] || 99);
        });

      for (const task of pendingTasks) {
        const key = `${task.tokenAddress}-${task.timeRange}`;

        // Check if still pending (might have been updated by another tab)
        const currentTask = this.state.tasks[key];
        if (!currentTask || currentTask.status !== "pending") continue;

        // Mark as in-progress
        task.status = "in-progress";
        task.startedAt = Date.now();
        this.state.tasks[key] = task;
        this.notifyStateUpdate();
        this.notifyProgress({ timeRange: task.timeRange, status: "in-progress" });

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
            this.state.tasks[key] = task;
            this.notifyStateUpdate();
            this.notifyProgress({ timeRange: task.timeRange, status: "complete" });
          } else {
            task.status = "error";
            task.error = "No data returned";
            this.state.tasks[key] = task;
            this.notifyStateUpdate();
            this.notifyProgress({ timeRange: task.timeRange, status: "error" });
          }
        } catch (error) {
          task.status = "error";
          task.error = error instanceof Error ? error.message : "Unknown error";
          this.state.tasks[key] = task;
          this.notifyStateUpdate();
          this.notifyProgress({ timeRange: task.timeRange, status: "error" });
        }

        // Stagger fetches (2 second delay)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * Get pre-fetch status for all timeframes
   */
  getPrefetchStatus(tokenAddress: string): Record<TimeRange, string> {
    const status: Record<string, string> = {};
    const allTimeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

    for (const timeRange of allTimeRanges) {
      const key = `${tokenAddress.toLowerCase()}-${timeRange}`;
      const task = this.state.tasks[key];
      status[timeRange] = task?.status || "idle";
    }

    return status as Record<TimeRange, string>;
  }

  /**
   * Clear completed tasks for a token (call when token changes)
   */
  clearToken(tokenAddress: string): void {
    const prefix = tokenAddress.toLowerCase();
    for (const key of Object.keys(this.state.tasks)) {
      if (key.startsWith(prefix)) {
        delete this.state.tasks[key];
      }
    }
    this.notifyStateUpdate();
  }

  /**
   * Check if a specific timeframe is complete
   */
  isTimeframeComplete(tokenAddress: string, timeRange: TimeRange): boolean {
    const key = `${tokenAddress.toLowerCase()}-${timeRange}`;
    const task = this.state.tasks[key];
    return task?.status === "complete";
  }
}

// Singleton instance
let instance: PrefetchManagerClass | null = null;

export const prefetchManager = {
  getInstance: (): PrefetchManagerClass => {
    if (!instance) {
      instance = new PrefetchManagerClass();
    }
    return instance;
  },

  startPrefetching: async (
    token: Token,
    wallets: Wallet[],
    currentTimeRange: TimeRange,
    onProgress?: (progress: { timeRange: TimeRange; status: string }) => void
  ) => {
    const mgr = prefetchManager.getInstance();
    return mgr.startPrefetching(token, wallets, currentTimeRange, onProgress);
  },

  getPrefetchStatus: (tokenAddress: string): Record<TimeRange, string> => {
    const mgr = prefetchManager.getInstance();
    return mgr.getPrefetchStatus(tokenAddress);
  },

  clearToken: (tokenAddress: string) => {
    const mgr = prefetchManager.getInstance();
    mgr.clearToken(tokenAddress);
  },

  isTimeframeComplete: (tokenAddress: string, timeRange: TimeRange): boolean => {
    const mgr = prefetchManager.getInstance();
    return mgr.isTimeframeComplete(tokenAddress, timeRange);
  },

  unregisterCallback: (
    onProgress: (progress: { timeRange: TimeRange; status: string }) => void
  ) => {
    const mgr = prefetchManager.getInstance();
    mgr.unregisterCallback(onProgress);
  },
};
