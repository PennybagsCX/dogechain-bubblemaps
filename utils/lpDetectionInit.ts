/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LP Detection Initialization Utility
 *
 * This file provides utility functions to initialize and manage LP detection.
 * These can be called from the browser console or from a settings page.
 *
 * Usage from browser console:
 * import('./utils/lpDetectionInit').then(m => m.initializeLPDetectionFromConsole())
 */

/* eslint-disable no-console */
import { initializeLPDetection, loadAllLPPairs } from "../services/lpDetection";
import { clearOldLPPairs } from "../services/db";

/**
 * Initialize LP detection from browser console
 *
 * Call this from the browser console to populate the LP pairs database:
 * await import('./utils/lpDetectionInit').then(m => m.initializeLPDetectionFromConsole())
 */
export async function initializeLPDetectionFromConsole(): Promise<void> {
  const confirmed = confirm(
    "This will scan DEX factories to discover liquidity pools.\n\n" +
      "This may take several minutes and will make multiple API calls.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await initializeLPDetection(
      false, // Don't force rescan if data already exists
      (_message, _progress) => {
        // Progress callback
      }
    );

    await loadAllLPPairs();
  } catch {
    // Error handled silently
  }
}

/**
 * Force rescan all factories (even if data already exists)
 */
export async function forceRescanFactories(): Promise<void> {
  const confirmed = confirm(
    "This will rescan all DEX factories and update the LP pairs database.\n\n" +
      "This may take several minutes.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await initializeLPDetection(
      true, // Force rescan
      (_message, _progress) => {}
    );

    await loadAllLPPairs();
  } catch {
    // Error handled silently
  }
}

/**
 * Show LP detection statistics
 */
export async function showLPStatistics(): Promise<void> {
  const pairs = await loadAllLPPairs();

  if (pairs.length === 0) {
    console.log(
      "\n⚠️ No LP pairs found. Run initializeLPDetectionFromConsole() to populate the database."
    );
    return;
  }

  // Breakdown by DEX
  const byDEX: Record<string, number> = {};
  for (const pair of pairs) {
    byDEX[pair.dexName] = (byDEX[pair.dexName] || 0) + 1;
  }

  for (const [_dex, _count] of Object.entries(byDEX)) {
    // DEX statistics calculated above
  }

  // Valid vs Invalid
  void pairs.filter((p) => p.isValid).length;

  // Age of data could be calculated here if needed
}

/**
 * Clear old invalid LP pairs
 */
export async function cleanupOldLPPairs(): Promise<void> {
  const confirmed = confirm(
    "This will delete old invalid LP pairs from the database.\n\n" +
      "This operation cannot be undone.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await clearOldLPPairs();
  } catch {
    // Error handled silently
  }
}

/**
 * Run all maintenance tasks
 */
export async function runLPMaintenance(): Promise<void> {
  await showLPStatistics();

  const oldPairs = await clearOldLPPairs();
  if (oldPairs > 0) {
    // Old pairs cleared successfully
  } else {
    // No old pairs to clear
  }
}

// Make functions available globally for easy console access
if (typeof window !== "undefined") {
  (window as any).lpDetectionInit = initializeLPDetectionFromConsole;
  (window as any).lpDetectionForceRescan = forceRescanFactories;
  (window as any).lpDetectionStats = showLPStatistics;
  (window as any).lpDetectionCleanup = cleanupOldLPPairs;
  (window as any).lpDetectionMaintenance = runLPMaintenance;

  console.log(
    "🔧 LP Detection utilities loaded! Available commands:\n" +
      "  - lpDetectionInit() - Initialize LP detection\n" +
      "  - lpDetectionForceRescan() - Force rescan all factories\n" +
      "  - lpDetectionStats() - Show statistics\n" +
      "  - lpDetectionCleanup() - Clean up old pairs\n" +
      "  - lpDetectionMaintenance() - Run maintenance tasks"
  );
}

// Export functions with aliases for module imports
export { initializeLPDetectionFromConsole as lpDetectionInit };
export { forceRescanFactories as lpDetectionForceRescan };
export { showLPStatistics as lpDetectionStats };
export { cleanupOldLPPairs as lpDetectionCleanup };
export { runLPMaintenance as lpDetectionMaintenance };
