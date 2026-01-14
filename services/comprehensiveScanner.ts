/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comprehensive DEX and LP Pool Scanner
 *
 * This service orchestrates the complete 3-phase workflow:
 * Phase 1: Factory Discovery (Genesis → Current)
 * Phase 2: LP Pair Discovery (Per Factory)
 * Phase 3: Validation and Integration
 */

import type { ScanCheckpoint, ScanPhase, ScanProgress } from "./scanProgress";
import type { DiscoveredFactory } from "../utils/discoverFactories";
import type { BatchScanResult } from "./lpBatchScanner";
import {
  loadCheckpoint,
  saveCheckpoint,
  clearCheckpoints,
  buildScanProgress,
  validateCheckpoint,
} from "./scanProgress";
import { loadAllLPPairs } from "./db";
import { scanMultipleFactories, validateLPPairs } from "./lpBatchScanner";
import { getActiveDiscoveredFactories } from "./db";

export interface ComprehensiveScanConfig {
  startFromBlock?: number; // For factory discovery (default: 0)
  endBlock?: number | "latest"; // For factory discovery (default: "latest")
  batchSize?: number; // Blocks per batch (default: 10000)
  concurrency?: number; // Factories to scan in parallel (default: 2)
  onProgress?: (progress: ScanProgress) => void;
  onPhaseChange?: (phase: ScanPhase) => void;
  onLog?: (message: string) => void;
}

export interface ComprehensiveScanResult {
  success: boolean;
  phase: ScanPhase;
  factoriesDiscovered: number;
  lpPairsDiscovered: number;
  blocksScanned: number;
  errors: number;
  duration: number;
  checkpoint?: ScanCheckpoint;
}

/**
 * Phase 1: Factory Discovery
 * Scan entire blockchain for Uniswap V2 factory contracts
 */
async function phase1FactoryDiscovery(
  config: ComprehensiveScanConfig,
  _checkpoint?: ScanCheckpoint
): Promise<{ factories: DiscoveredFactory[]; checkpoint: ScanCheckpoint }> {
  config.onLog?.("[Phase 1] Starting factory discovery...");
  config.onPhaseChange?.("factory_discovery");

  const { runFactoryDiscoveryWithCheckpoint } = await import("../utils/discoverFactories");

  const result = await runFactoryDiscoveryWithCheckpoint(
    (message, _progress) => {
      config.onProgress?.(
        buildScanProgress({
          phase: "factory_discovery",
          currentBlock: 0,
          totalBlocks: 20000000,
          discoveredFactories: 0,
          scannedLPPairs: 0,
          lastUpdated: Date.now(),
          errors: [],
          metadata: {},
        })
      );
      config.onLog?.(message);
    },
    true // Auto-add all discovered factories
  );

  config.onLog?.(`[Phase 1] ✅ Discovered ${result.factories.length} factories`);

  return result;
}

/**
 * Phase 2: LP Pair Discovery
 * Scan all discovered factories for PairCreated events
 */
async function phase2LPScanning(
  config: ComprehensiveScanConfig,
  checkpoint?: ScanCheckpoint
): Promise<{ results: BatchScanResult[]; checkpoint: ScanCheckpoint }> {
  config.onLog?.("[Phase 2] Starting LP pair scanning...");
  config.onPhaseChange?.("lp_scanning");

  // Load all discovered factories
  const factories = await getActiveDiscoveredFactories();

  if (factories.length === 0) {
    throw new Error("No factories discovered. Run Phase 1 first.");
  }

  config.onLog?.(`[Phase 2] Scanning ${factories.length} factories for LP pairs...`);

  // Create batch scan configs for each factory
  const scanConfigs = factories.map((factory) => ({
    factoryAddress: factory.address,
    factoryName: factory.name,
    startBlock: factory.deployBlock || 0,
    endBlock: "latest" as const,
    batchSize: config.batchSize || 10000,
    onProgress: (progress: any) => {
      config.onProgress?.(
        buildScanProgress({
          phase: "lp_scanning",
          currentBlock: progress.currentBlock,
          totalBlocks: progress.totalBlocks,
          discoveredFactories: factories.length,
          scannedLPPairs: progress.pairsDiscovered,
          lastUpdated: Date.now(),
          errors: [],
          metadata: { currentFactory: progress.factoryName },
        })
      );
    },
  }));

  // Scan factories with concurrency limit
  const results = await scanMultipleFactories(scanConfigs, config.concurrency || 2);

  // Calculate totals
  const totalPairs = results.reduce((sum, r) => sum + r.totalPairs, 0);

  config.onLog?.(`[Phase 2] ✅ Discovered ${totalPairs} LP pairs from ${results.length} factories`);

  // Update checkpoint
  const updatedCheckpoint: ScanCheckpoint = {
    phase: "validation",
    currentBlock: checkpoint?.currentBlock || 0,
    totalBlocks: checkpoint?.totalBlocks || 20000000,
    discoveredFactories: factories.length,
    scannedLPPairs: totalPairs,
    lastUpdated: Date.now(),
    errors: results.flatMap((r) => r.errors),
    metadata: {
      phase2Complete: true,
      scanResults: results.map((r) => ({
        factory: r.factoryAddress,
        pairs: r.totalPairs,
        duration: r.duration,
      })),
    },
  };

  await saveCheckpoint(updatedCheckpoint);

  return { results, checkpoint: updatedCheckpoint };
}

/**
 * Phase 3: Validation
 * Verify discovered data and export results
 */
async function phase3Validation(
  config: ComprehensiveScanConfig,
  checkpoint: ScanCheckpoint
): Promise<ComprehensiveScanResult> {
  config.onLog?.("[Phase 3] Starting validation...");
  config.onPhaseChange?.("validation");

  // Load all discovered LP pairs
  const allPairs = await loadAllLPPairs();

  config.onLog?.(`[Phase 3] Validating ${allPairs.length} LP pairs...`);

  // Validate pairs (duplicate detection, address validation)
  const { valid, invalid } = validateLPPairs(allPairs);

  config.onLog?.(`[Phase 3] ✅ Validated: ${valid.length} valid, ${invalid.length} invalid`);

  // Generate statistics
  const factories = await getActiveDiscoveredFactories();

  const stats = {
    totalFactories: factories.length,
    totalPairs: valid.length,
    invalidPairs: invalid.length,
    blocksScanned: checkpoint.currentBlock,
    errors: checkpoint.errors.length,
  };

  config.onLog?.("[Phase 3] 📊 Scan Statistics:");
  config.onLog?.(`  - Factories: ${stats.totalFactories}`);
  config.onLog?.(`  - LP Pairs: ${stats.totalPairs}`);
  config.onLog?.(`  - Invalid: ${stats.invalidPairs}`);
  config.onLog?.(`  - Blocks Scanned: ${stats.blocksScanned.toLocaleString()}`);
  config.onLog?.(`  - Errors: ${stats.errors}`);

  // Update checkpoint to complete
  const finalCheckpoint: ScanCheckpoint = {
    ...checkpoint,
    phase: "complete",
    lastUpdated: Date.now(),
    metadata: {
      ...checkpoint.metadata,
      validationComplete: true,
      stats,
    },
  };

  await saveCheckpoint(finalCheckpoint);

  config.onLog?.("[Phase 3] ✅ Validation complete!");

  return {
    success: true,
    phase: "complete",
    factoriesDiscovered: stats.totalFactories,
    lpPairsDiscovered: stats.totalPairs,
    blocksScanned: stats.blocksScanned,
    errors: stats.errors,
    duration: Date.now() - (checkpoint.metadata.startTime as number),
    checkpoint: finalCheckpoint,
  };
}

/**
 * Main comprehensive scan function
 * Runs all 3 phases or resumes from checkpoint
 */
export async function runComprehensiveScan(
  config: ComprehensiveScanConfig = {}
): Promise<ComprehensiveScanResult> {
  const startTime = Date.now();
  config.onLog?.("=== Starting Comprehensive DEX/LP Pool Scan ===\n");

  try {
    // Check for existing checkpoint
    const existingCheckpoint = await loadCheckpoint();

    if (existingCheckpoint) {
      config.onLog?.(
        `Found checkpoint from ${new Date(existingCheckpoint.lastUpdated).toLocaleString()}`
      );
      config.onLog?.(
        `Phase: ${existingCheckpoint.phase}, Block: ${existingCheckpoint.currentBlock.toLocaleString()}`
      );

      if (!validateCheckpoint(existingCheckpoint)) {
        config.onLog?.("⚠️ Checkpoint validation failed. Starting fresh...");
        await clearCheckpoints();
      } else {
        config.onLog?.("✅ Checkpoint valid, resuming...");
      }
    }

    let checkpoint = existingCheckpoint || {
      phase: "factory_discovery",
      currentBlock: 0,
      totalBlocks: 20000000,
      discoveredFactories: 0,
      scannedLPPairs: 0,
      lastUpdated: Date.now(),
      errors: [],
      metadata: { startTime },
    };

    // Phase 1: Factory Discovery
    if (checkpoint.phase === "factory_discovery") {
      const phase1Result = await phase1FactoryDiscovery(config, checkpoint);
      checkpoint = phase1Result.checkpoint;
    }

    // Phase 2: LP Pair Scanning
    if (checkpoint.phase === "lp_scanning") {
      const phase2Result = await phase2LPScanning(config, checkpoint);
      checkpoint = phase2Result.checkpoint;
    }

    // Phase 3: Validation
    if (checkpoint.phase === "validation" || checkpoint.phase === "lp_scanning") {
      const result = await phase3Validation(config, checkpoint);
      result.duration = Date.now() - startTime;
      return result;
    }

    // Already complete
    if (checkpoint.phase === "complete") {
      config.onLog?.("✅ Scan already complete!");
      return {
        success: true,
        phase: "complete",
        factoriesDiscovered: checkpoint.discoveredFactories,
        lpPairsDiscovered: checkpoint.scannedLPPairs,
        blocksScanned: checkpoint.currentBlock,
        errors: checkpoint.errors.length,
        duration: Date.now() - startTime,
        checkpoint,
      };
    }

    throw new Error(`Unknown phase: ${checkpoint.phase}`);
  } catch (error) {
    config.onLog?.(`❌ Scan failed: ${error instanceof Error ? error.message : String(error)}`);

    return {
      success: false,
      phase: "factory_discovery",
      factoriesDiscovered: 0,
      lpPairsDiscovered: 0,
      blocksScanned: 0,
      errors: 1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Reset the comprehensive scan (clear checkpoints and start fresh)
 */
export async function resetComprehensiveScan(): Promise<void> {
  await clearCheckpoints();
}

/**
 * Get current scan status
 */
export async function getScanStatus(): Promise<ScanProgress | null> {
  const checkpoint = await loadCheckpoint();

  if (!checkpoint) {
    return null;
  }

  return buildScanProgress(checkpoint);
}

/**
 * Export scan results as JSON
 */
export async function exportScanResults(): Promise<string> {
  const checkpoint = await loadCheckpoint();
  const factories = await getActiveDiscoveredFactories();
  const lpPairs = await loadAllLPPairs();

  if (!checkpoint) {
    throw new Error("No scan data found");
  }

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    checkpoint,
    factories,
    lpPairs: lpPairs.map((pair) => ({
      address: pair.pairAddress,
      factory: pair.factoryAddress,
      token0: pair.token0Address,
      token1: pair.token1Address,
      dex: pair.dexName,
    })),
    statistics: {
      totalFactories: factories.length,
      totalLPPairs: lpPairs.length,
      blocksScanned: checkpoint.currentBlock,
      errors: checkpoint.errors.length,
      duration: checkpoint.metadata.duration,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export scan results as CSV
 */
export async function exportScanResultsCSV(): Promise<string> {
  const factories = await getActiveDiscoveredFactories();
  const lpPairs = await loadAllLPPairs();

  // Factories CSV
  const factoriesHeader = "Address,Name,Type,Deploy Block,Status,Description\n";
  const factoriesRows = factories
    .map(
      (f) =>
        `${f.address},${f.name},${f.type},${f.deployBlock},${f.status},"${f.description || ""}"`
    )
    .join("\n");

  // LP Pairs CSV
  const pairsHeader = "\n\nPair Address,Factory Address,Token0,Token1,DEX Name\n";
  const pairsRows = lpPairs
    .map(
      (p) =>
        `${p.pairAddress},${p.factoryAddress},${p.token0Address},${p.token1Address},${p.dexName}`
    )
    .join("\n");

  return factoriesHeader + factoriesRows + pairsHeader + pairsRows;
}
