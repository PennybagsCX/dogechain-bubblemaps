/**
 * LP Detection Initialization Utility
 *
 * This file provides utility functions to initialize and manage LP detection.
 * These can be called from the browser console or from a settings page.
 *
 * Usage from browser console:
 * import('./utils/lpDetectionInit').then(m => m.initializeLPDetectionFromConsole())
 */

import { initializeLPDetection, loadAllLPPairs } from "../services/lpDetection";
import { clearOldLPPairs } from "../services/db";

/**
 * Initialize LP detection from browser console
 *
 * Call this from the browser console to populate the LP pairs database:
 * await import('./utils/lpDetectionInit').then(m => m.initializeLPDetectionFromConsole())
 */
export async function initializeLPDetectionFromConsole(): Promise<void> {
  console.log("=== LP Detection Initialization ===");
  console.log("This will scan all known DEX factories and populate the LP pairs database.");
  console.log("This may take several minutes...\n");

  const confirmed = confirm(
    "This will scan DEX factories to discover liquidity pools.\n\n" +
      "This may take several minutes and will make multiple API calls.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    console.log("Initialization cancelled.");
    return;
  }

  try {
    await initializeLPDetection(
      false, // Don't force rescan if data already exists
      (message, progress) => {
        console.log(`[${Math.floor(progress)}%] ${message}`);
      }
    );

    const pairs = await loadAllLPPairs();
    console.log(`\n✅ Initialization complete! Found ${pairs.length} LP pairs.`);

    // Show breakdown by DEX
    const byDEX: Record<string, number> = {};
    for (const pair of pairs) {
      byDEX[pair.dexName] = (byDEX[pair.dexName] || 0) + 1;
    }

    console.log("\nLP Pairs by DEX:");
    for (const [dex, count] of Object.entries(byDEX)) {
      console.log(`  ${dex}: ${count} pairs`);
    }
  } catch (error) {
    console.error("❌ Initialization failed:", error);
  }
}

/**
 * Force rescan all factories (even if data already exists)
 */
export async function forceRescanFactories(): Promise<void> {
  console.log("=== Force Rescan Factories ===");
  console.log("This will rescan all factories, even if LP pairs already exist.");

  const confirmed = confirm(
    "This will rescan all DEX factories and update the LP pairs database.\n\n" +
      "This may take several minutes.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    console.log("Force rescan cancelled.");
    return;
  }

  try {
    await initializeLPDetection(
      true, // Force rescan
      (message, progress) => {
        console.log(`[${Math.floor(progress)}%] ${message}`);
      }
    );

    const pairs = await loadAllLPPairs();
    console.log(`\n✅ Force rescan complete! Database now has ${pairs.length} LP pairs.`);
  } catch (error) {
    console.error("❌ Force rescan failed:", error);
  }
}

/**
 * Show LP detection statistics
 */
export async function showLPStatistics(): Promise<void> {
  console.log("=== LP Detection Statistics ===\n");

  const pairs = await loadAllLPPairs();

  console.log(`Total LP pairs in database: ${pairs.length}`);

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

  console.log("\nBy DEX:");
  for (const [dex, count] of Object.entries(byDEX)) {
    console.log(`  ${dex}: ${count} pairs`);
  }

  // Valid vs Invalid
  const valid = pairs.filter((p) => p.isValid).length;
  const invalid = pairs.length - valid;

  console.log(`\nValid pairs: ${valid}`);
  console.log(`Invalid pairs: ${invalid}`);

  // Age of data
  const now = Date.now();
  const oldest = Math.min(...pairs.map((p) => p.discoveredAt));
  const newest = Math.max(...pairs.map((p) => p.lastVerifiedAt));

  console.log(`\nData age:`);
  console.log(`  Oldest: ${new Date(oldest).toLocaleString()}`);
  console.log(`  Newest: ${new Date(newest).toLocaleString()}`);
  console.log(`  Database age: ${Math.floor((now - oldest) / (1000 * 60 * 60 * 24))} days`);
}

/**
 * Clear old invalid LP pairs
 */
export async function cleanupOldLPPairs(): Promise<void> {
  console.log("=== Clean up old LP pairs ===");
  console.log("This will remove LP pairs that are older than 30 days and marked as invalid.");

  const confirmed = confirm(
    "This will delete old invalid LP pairs from the database.\n\n" +
      "This operation cannot be undone.\n\n" +
      "Continue?"
  );

  if (!confirmed) {
    console.log("Cleanup cancelled.");
    return;
  }

  try {
    const deleted = await clearOldLPPairs();
    console.log(`✅ Cleanup complete! Deleted ${deleted} old invalid LP pairs.`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

/**
 * Run all maintenance tasks
 */
export async function runLPMaintenance(): Promise<void> {
  console.log("=== LP Detection Maintenance ===\n");

  await showLPStatistics();
  console.log("\n");

  const oldPairs = await clearOldLPPairs();
  if (oldPairs > 0) {
    console.log(`✅ Cleaned up ${oldPairs} old invalid LP pairs.`);
  } else {
    console.log("✅ No old pairs to clean up.");
  }

  console.log("\nMaintenance complete!");
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
