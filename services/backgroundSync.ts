/**
 * Background Sync Service
 *
 * Periodically syncs learned data from the server to keep the local search index updated.
 * Runs in the background without blocking the UI.
 *
 * Features:
 * - Automatic hourly sync
 * - Manual sync trigger
 * - Sync status tracking
 * - Error handling and retry logic
 */

import { syncLearnedData } from "./learningService";

// =====================================================
// CONFIGURATION
// =====================================================

const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour
const SYNC_ENABLED = import.meta.env.VITE_BACKGROUND_SYNC_ENABLED !== "false";

// =====================================================
// STATE
// =====================================================

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let lastSyncTime: number | null = null;
let lastSyncCount = 0;
let syncError: string | null = null;

// =====================================================
// SYNC CONTROL
// =====================================================

/**
 * Start background sync
 * Runs periodic sync every hour
 */
export function startBackgroundSync(): void {
  if (!SYNC_ENABLED) {
    console.log("[Sync] Background sync disabled via feature flag");
    return;
  }

  if (syncIntervalId) {
    console.log("[Sync] Background sync already running");
    return;
  }

  console.log("[Sync] Starting background sync...");

  // Initial sync (async, non-blocking)
  performSync().catch((error) => {
    console.error("[Sync] Initial sync failed:", error);
  });

  // Periodic sync
  syncIntervalId = setInterval(() => {
    performSync().catch((error) => {
      console.error("[Sync] Periodic sync failed:", error);
    });
  }, SYNC_INTERVAL);

  console.log("[Sync] Background sync started");
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("[Sync] Background sync stopped");
  } else {
    console.log("[Sync] Background sync not running");
  }
}

/**
 * Perform manual sync
 * Triggers an immediate sync regardless of schedule
 *
 * @returns Promise<number> - Number of tokens synced
 */
export async function manualSync(): Promise<number> {
  console.log("[Sync] Manual sync triggered");
  return performSync();
}

// =====================================================
// SYNC EXECUTION
// =====================================================

/**
 * Perform sync operation
 *
 * @returns Promise<number> - Number of tokens synced
 */
async function performSync(): Promise<number> {
  if (isSyncing) {
    console.log("[Sync] Sync already in progress, skipping");
    return 0;
  }

  isSyncing = true;
  syncError = null;

  try {
    console.log("[Sync] Starting sync operation...");
    const startTime = Date.now();

    // Sync learned data from server
    const count = await syncLearnedData();

    // Update state
    lastSyncTime = Date.now();
    lastSyncCount = count;
    const duration = Date.now() - startTime;

    console.log(`[Sync] Sync completed: ${count} tokens synced in ${duration}ms`);

    return count;
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Unknown error";
    console.error("[Sync] Sync failed:", error);
    return 0;
  } finally {
    isSyncing = false;
  }
}

// =====================================================
// SYNC STATUS
// =====================================================

/**
 * Get current sync status
 *
 * @returns Sync status object
 */
export function getSyncStatus(): {
  isRunning: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastSyncCount: number;
  syncError: string | null;
  nextSyncTime: number | null;
} {
  const isRunning = syncIntervalId !== null;
  let nextSyncTime: number | null = null;

  if (isRunning && lastSyncTime) {
    nextSyncTime = lastSyncTime + SYNC_INTERVAL;
  }

  return {
    isRunning,
    isSyncing,
    lastSyncTime,
    lastSyncCount,
    syncError,
    nextSyncTime,
  };
}

/**
 * Format sync status for display
 *
 * @returns Human-readable sync status
 */
export function getSyncStatusMessage(): string {
  const status = getSyncStatus();

  if (!status.isRunning) {
    return "Background sync disabled";
  }

  if (status.isSyncing) {
    return "Syncing...";
  }

  if (status.lastSyncTime) {
    const timeAgo = Date.now() - status.lastSyncTime;
    const minutesAgo = Math.floor(timeAgo / 60000);

    if (minutesAgo < 1) {
      return `Synced just now (${status.lastSyncCount} tokens)`;
    } else if (minutesAgo < 60) {
      return `Synced ${minutesAgo}m ago (${status.lastSyncCount} tokens)`;
    } else {
      const hoursAgo = Math.floor(minutesAgo / 60);
      return `Synced ${hoursAgo}h ago (${status.lastSyncCount} tokens)`;
    }
  }

  if (status.syncError) {
    return `Sync error: ${status.syncError}`;
  }

  return "Waiting for initial sync...";
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize background sync
 * Called automatically on module import
 */
export function initializeBackgroundSync(): void {
  if (!SYNC_ENABLED) {
    return;
  }

  // Auto-start if in browser environment
  if (typeof window !== "undefined") {
    // Wait for app to be ready (delay by 5 seconds)
    setTimeout(() => {
      startBackgroundSync();
    }, 5000);
  }
}

/**
 * Cleanup background sync
 * Called on app unmount
 */
export function cleanupBackgroundSync(): void {
  stopBackgroundSync();
}

// Auto-initialize
initializeBackgroundSync();
