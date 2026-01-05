/**
 * Scan Progress Tracking Service
 *
 * This service provides persistent progress tracking for long-running scans
 * across browser sessions. It saves checkpoints to IndexedDB and enables
 * pause/resume functionality.
 */

import { db } from "./db";

export type ScanPhase = "factory_discovery" | "lp_scanning" | "validation" | "complete";

export interface ScanCheckpoint {
  id?: number;
  phase: ScanPhase;
  currentBlock: number;
  totalBlocks: number;
  discoveredFactories: number;
  scannedLPPairs: number;
  lastUpdated: number;
  errors: ScanError[];
  metadata: Record<string, any>;
}

export interface ScanError {
  timestamp: number;
  phase: ScanPhase;
  block?: number;
  factory?: string;
  message: string;
  severity: "warning" | "error" | "critical";
}

export interface ScanProgress {
  phase: ScanPhase;
  currentBlock: number;
  totalBlocks: number;
  progressPercent: number;
  discoveredFactories: number;
  scannedLPPairs: number;
  errorCount: number;
  lastUpdated: number;
  estimatedTimeRemaining?: number; // seconds
}

// Table name for scan checkpoints
const SCAN_CHECKPOINTS_TABLE = "scanCheckpoints" as any;

/**
 * Initialize the scan checkpoints table if it doesn't exist
 */
async function ensureCheckpointTable(): Promise<void> {
  try {
    // Check if table exists
    const tables = await db.tables.map((t) => t.name);

    if (!tables.includes(SCAN_CHECKPOINTS_TABLE)) {
      console.log("[Scan Progress] Creating scan checkpoints table...");
      // Use version 7 to add the new table
      db.version(7).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
      });
    }
  } catch (error) {
    console.error("[Scan Progress] Failed to ensure checkpoint table:", error);
  }
}

/**
 * Save a scan checkpoint
 */
export async function saveCheckpoint(checkpoint: ScanCheckpoint): Promise<void> {
  try {
    await ensureCheckpointTable();

    const checkpointWithTimestamp: ScanCheckpoint = {
      ...checkpoint,
      lastUpdated: Date.now(),
    };

    // Use a table reference (will be created by ensureCheckpointTable)
    const table = (db as any)[SCAN_CHECKPOINTS_TABLE];

    await table.put(checkpointWithTimestamp);
    console.log(
      `[Scan Progress] Checkpoint saved: Phase ${checkpoint.phase}, Block ${checkpoint.currentBlock}/${checkpoint.totalBlocks}`
    );
  } catch (error) {
    console.error("[Scan Progress] Failed to save checkpoint:", error);
  }
}

/**
 * Load the most recent checkpoint
 */
export async function loadCheckpoint(): Promise<ScanCheckpoint | null> {
  try {
    await ensureCheckpointTable();

    const table = (db as any)[SCAN_CHECKPOINTS_TABLE];
    const checkpoints = await table.toArray();

    if (checkpoints.length === 0) {
      return null;
    }

    // Get the most recent checkpoint
    const latest = checkpoints.sort((a: ScanCheckpoint, b: ScanCheckpoint) => b.lastUpdated - a.lastUpdated)[0];

    // Check if checkpoint is stale (older than 24 hours)
    const age = Date.now() - latest.lastUpdated;
    if (age > 24 * 60 * 60 * 1000) {
      console.warn(`[Scan Progress] Checkpoint is stale (${Math.round(age / 3600000)}h old). Recommend starting fresh.`);
      // Return it anyway, let the user decide
    }

    console.log(`[Scan Progress] Loaded checkpoint from ${new Date(latest.lastUpdated).toLocaleString()}`);
    return latest;
  } catch (error) {
    console.error("[Scan Progress] Failed to load checkpoint:", error);
    return null;
  }
}

/**
 * Clear all checkpoints (start fresh)
 */
export async function clearCheckpoints(): Promise<void> {
  try {
    await ensureCheckpointTable();

    const table = (db as any)[SCAN_CHECKPOINTS_TABLE];
    await table.clear();
    console.log("[Scan Progress] All checkpoints cleared");
  } catch (error) {
    console.error("[Scan Progress] Failed to clear checkpoints:", error);
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}

/**
 * Estimate time remaining based on current progress
 */
export function estimateTimeRemaining(
  currentBlock: number,
  totalBlocks: number,
  startTime: number
): number {
  const elapsed = Date.now() - startTime;
  const progress = currentBlock / totalBlocks;

  if (progress === 0) return 0;

  const totalTime = elapsed / progress;
  const remaining = totalTime - elapsed;

  return Math.max(0, Math.round(remaining / 1000)); // seconds
}

/**
 * Build scan progress object from checkpoint
 */
export function buildScanProgress(checkpoint: ScanCheckpoint, startTime?: number): ScanProgress {
  const progressPercent = calculateProgress(checkpoint.currentBlock, checkpoint.totalBlocks);

  const result: ScanProgress = {
    phase: checkpoint.phase,
    currentBlock: checkpoint.currentBlock,
    totalBlocks: checkpoint.totalBlocks,
    progressPercent,
    discoveredFactories: checkpoint.discoveredFactories,
    scannedLPPairs: checkpoint.scannedLPPairs,
    errorCount: checkpoint.errors.length,
    lastUpdated: checkpoint.lastUpdated,
  };

  if (startTime && checkpoint.currentBlock > 0) {
    result.estimatedTimeRemaining = estimateTimeRemaining(
      checkpoint.currentBlock,
      checkpoint.totalBlocks,
      startTime
    );
  }

  return result;
}

/**
 * Log a scan error
 */
export async function logScanError(error: ScanError): Promise<void> {
  try {
    const checkpoint = await loadCheckpoint();

    if (checkpoint) {
      checkpoint.errors.push(error);
      await saveCheckpoint(checkpoint);
    }
  } catch (e) {
    console.error("[Scan Progress] Failed to log error:", e);
  }
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Get all checkpoints (for debugging/management)
 */
export async function getAllCheckpoints(): Promise<ScanCheckpoint[]> {
  try {
    await ensureCheckpointTable();

    const table = (db as any)[SCAN_CHECKPOINTS_TABLE];
    return await table.toArray();
  } catch (error) {
    console.error("[Scan Progress] Failed to get checkpoints:", error);
    return [];
  }
}

/**
 * Delete old checkpoints (keep only the most recent)
 */
export async function cleanupOldCheckpoints(keepCount: number = 5): Promise<void> {
  try {
    await ensureCheckpointTable();

    const table = (db as any)[SCAN_CHECKPOINTS_TABLE];
    const checkpoints = await table.toArray();

    if (checkpoints.length <= keepCount) {
      return;
    }

    // Sort by lastUpdated descending (newest first)
    checkpoints.sort((a: ScanCheckpoint, b: ScanCheckpoint) => b.lastUpdated - a.lastUpdated);

    // Delete old checkpoints
    const toDelete = checkpoints.slice(keepCount);
    for (const checkpoint of toDelete) {
      await table.delete(checkpoint.id!);
    }

    console.log(`[Scan Progress] Cleaned up ${toDelete.length} old checkpoints`);
  } catch (error) {
    console.error("[Scan Progress] Failed to cleanup checkpoints:", error);
  }
}

/**
 * Validate checkpoint integrity
 */
export function validateCheckpoint(checkpoint: ScanCheckpoint): boolean {
  // Check required fields
  if (
    !checkpoint.phase ||
    typeof checkpoint.currentBlock !== "number" ||
    typeof checkpoint.totalBlocks !== "number" ||
    typeof checkpoint.discoveredFactories !== "number" ||
    typeof checkpoint.scannedLPPairs !== "number"
  ) {
    console.error("[Scan Progress] Checkpoint validation failed: missing or invalid fields");
    return false;
  }

  // Check logical constraints
  if (checkpoint.currentBlock < 0 || checkpoint.currentBlock > checkpoint.totalBlocks) {
    console.error("[Scan Progress] Checkpoint validation failed: invalid block range");
    return false;
  }

  if (checkpoint.discoveredFactories < 0 || checkpoint.scannedLPPairs < 0) {
    console.error("[Scan Progress] Checkpoint validation failed: negative counts");
    return false;
  }

  if (checkpoint.lastUpdated <= 0) {
    console.error("[Scan Progress] Checkpoint validation failed: invalid timestamp");
    return false;
  }

  return true;
}

/**
 * Export checkpoint data as JSON
 */
export async function exportCheckpoint(): Promise<string> {
  const checkpoint = await loadCheckpoint();

  if (!checkpoint) {
    throw new Error("No checkpoint found");
  }

  return JSON.stringify(checkpoint, null, 2);
}

/**
 * Import checkpoint data from JSON
 */
export async function importCheckpoint(jsonData: string): Promise<void> {
  try {
    const checkpoint = JSON.parse(jsonData) as ScanCheckpoint;

    if (!validateCheckpoint(checkpoint)) {
      throw new Error("Invalid checkpoint data");
    }

    await saveCheckpoint(checkpoint);
    console.log("[Scan Progress] Checkpoint imported successfully");
  } catch (error) {
    console.error("[Scan Progress] Failed to import checkpoint:", error);
    throw error;
  }
}
