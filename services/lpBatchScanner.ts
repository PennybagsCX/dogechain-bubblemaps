/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/**
 * Batch LP Pair Scanner
 *
 * This service provides efficient batch processing of LP pair discovery
 * for large-scale blockchain scanning. It handles memory-efficient streaming,
 * progress checkpointing, and automatic retry on failures.
 */

import { PAIR_CREATED_EVENT_SIGNATURE } from "./knownFactories";
import type { DbLPPair } from "./db";
import type { ScanCheckpoint, ScanError } from "./scanProgress";

const EXPLORER_API_V1 = "https://explorer.dogechain.dog/api";

export interface BatchScanConfig {
  factoryAddress: string;
  factoryName: string;
  startBlock: number;
  endBlock: number | "latest";
  batchSize: number; // blocks per batch
  onProgress?: (progress: BatchScanProgress) => void;
}

export interface BatchScanProgress {
  factoryAddress: string;
  factoryName: string;
  currentBlock: number;
  totalBlocks: number;
  pairsDiscovered: number;
  batchNumber: number;
  totalBatches: number;
  progressPercent: number;
}

export interface BatchScanResult {
  factoryAddress: string;
  factoryName: string;
  totalPairs: number;
  blocksScanned: number;
  errors: ScanError[];
  duration: number; // milliseconds
}

/**
 * Calculate total blocks for a scan range
 */
function calculateTotalBlocks(startBlock: number, endBlock: number | "latest"): number {
  if (endBlock === "latest") {
    // This is an estimate, will be updated during scan
    return 20000000; // Approximate current Dogechain block
  }
  return endBlock - startBlock + 1;
}

/**
 * Fetch PairCreated events in batches with retry logic
 */
async function fetchEventsBatch(
  factoryAddress: string,
  fromBlock: number,
  toBlock: number,
  retries: number = 3
): Promise<any[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${EXPLORER_API_V1}?module=logs&action=getLogs&address=${factoryAddress}&topic0=${PAIR_CREATED_EVENT_SIGNATURE}&fromBlock=${fromBlock}&toBlock=${toBlock}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1" && data.result && Array.isArray(data.result)) {
        return data.result;
      }

      // Empty result is valid
      if (data.status === "0" && data.message === "No logs found") {
        return [];
      }

      // API error
      console.warn(`[Batch Scanner] API returned status ${data.status}: ${data.message}`);
      return [];
    } catch (error) {
      console.error(
        `[Batch Scanner] Fetch attempt ${attempt + 1} failed for blocks ${fromBlock}-${toBlock}:`,
        error
      );

      if (attempt === retries - 1) {
        // Final attempt failed
        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return [];
}

/**
 * Parse PairCreated event log into DbLPPair
 */
function parsePairEvent(log: any, factoryAddress: string, factoryName: string): DbLPPair {
  try {
    // Extract addresses from topics (indexed parameters)
    const token0 = log.topics[1] ? "0x" + log.topics[1].slice(26) : "0x0";
    const token1 = log.topics[2] ? "0x" + log.topics[2].slice(26) : "0x0";

    // Pair address is in the data field (first 32 bytes)
    const pairAddress = "0x" + log.data.slice(26, 66);

    return {
      pairAddress,
      factoryAddress,
      token0Address: token0,
      token1Address: token1,
      dexName: factoryName,
      discoveredAt: Date.now(),
      lastVerifiedAt: Date.now(),
      isValid: true,
    };
  } catch (error) {
    console.error("[Batch Scanner] Failed to parse event log:", error);
    throw error;
  }
}

/**
 * Scan a single batch of blocks
 */
async function scanBatch(
  config: BatchScanConfig,
  startBlock: number,
  endBlock: number
): Promise<{ pairs: DbLPPair[]; error?: ScanError }> {
  try {
    console.log(
      `[Batch Scanner] Scanning blocks ${startBlock}-${endBlock} for ${config.factoryName}`
    );

    // Fetch events for this batch
    const events = await fetchEventsBatch(config.factoryAddress, startBlock, endBlock);

    // Parse events
    const pairs: DbLPPair[] = [];
    for (const event of events) {
      try {
        const pair = parsePairEvent(event, config.factoryAddress, config.factoryName);
        pairs.push(pair);
      } catch (parseError) {
        console.error("[Batch Scanner] Failed to parse event:", parseError);
      }
    }

    console.log(`[Batch Scanner] Found ${pairs.length} pairs in blocks ${startBlock}-${endBlock}`);

    return { pairs };
  } catch (error) {
    const scanError: ScanError = {
      timestamp: Date.now(),
      phase: "lp_scanning",
      block: startBlock,
      factory: config.factoryAddress,
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
    };

    return { pairs: [], error: scanError };
  }
}

/**
 * Main batch scanning function for a single factory
 */
export async function scanFactoryInBatches(config: BatchScanConfig): Promise<BatchScanResult> {
  const startTime = Date.now();
  const errors: ScanError[] = [];
  let totalPairs = 0;
  let blocksScanned = 0;
  let currentBlock = config.startBlock;

  // Calculate total blocks
  const totalBlocks = calculateTotalBlocks(config.startBlock, config.endBlock);
  const totalBatches = Math.ceil(totalBlocks / config.batchSize);
  let batchNumber = 0;

  console.log(`[Batch Scanner] Starting batch scan for ${config.factoryName}`);
  console.log(`[Batch Scanner] Range: ${config.startBlock} → ${config.endBlock}`);
  console.log(`[Batch Scanner] Batch size: ${config.batchSize} blocks`);
  console.log(`[Batch Scanner] Estimated batches: ${totalBatches}`);

  // eslint-disable-next-line no-constant-condition -- Intentional infinite loop with break conditions inside
  while (true) {
    batchNumber++;

    // Calculate end block for this batch
    const batchEndBlock =
      config.endBlock === "latest"
        ? currentBlock + config.batchSize - 1
        : Math.min(currentBlock + config.batchSize - 1, config.endBlock);

    // Scan this batch
    const result = await scanBatch(config, currentBlock, batchEndBlock);

    // Collect results
    totalPairs += result.pairs.length;
    blocksScanned += batchEndBlock - currentBlock + 1;

    if (result.error) {
      errors.push(result.error);
    }

    // Report progress
    const progressPercent = (currentBlock / totalBlocks) * 100;
    config.onProgress?.({
      factoryAddress: config.factoryAddress,
      factoryName: config.factoryName,
      currentBlock,
      totalBlocks,
      pairsDiscovered: totalPairs,
      batchNumber,
      totalBatches,
      progressPercent,
    });

    // Move to next batch
    currentBlock = batchEndBlock + 1;

    // Check if we've reached the end
    if (config.endBlock !== "latest" && currentBlock > config.endBlock) {
      break;
    }

    // If we got 0 events and this is a "latest" scan, we might be at the current block
    if (config.endBlock === "latest" && result.pairs.length === 0) {
      // Try a few more batches to confirm we're really at the end
      if (batchNumber >= 3) {
        console.log(
          `[Batch Scanner] No events in last ${batchNumber} batches, assuming scan complete`
        );
        break;
      }
    }

    // Rate limiting: wait between batches to avoid API throttling
    // Dogechain Explorer API has ~60 req/min limit
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay between batches
  }

  const duration = Date.now() - startTime;

  console.log(`[Batch Scanner] Scan complete for ${config.factoryName}`);
  console.log(`[Batch Scanner] Total pairs: ${totalPairs}`);
  console.log(`[Batch Scanner] Blocks scanned: ${blocksScanned}`);
  console.log(`[Batch Scanner] Errors: ${errors.length}`);
  console.log(`[Batch Scanner] Duration: ${Math.round(duration / 1000)}s`);

  return {
    factoryAddress: config.factoryAddress,
    factoryName: config.factoryName,
    totalPairs,
    blocksScanned,
    errors,
    duration,
  };
}

/**
 * Scan multiple factories in parallel (with concurrency limit)
 */
export async function scanMultipleFactories(
  configs: BatchScanConfig[],
  concurrency: number = 2
): Promise<BatchScanResult[]> {
  const results: BatchScanResult[] = [];

  console.log(
    `[Batch Scanner] Scanning ${configs.length} factories with concurrency ${concurrency}`
  );

  // Process in batches
  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((config) => scanFactoryInBatches(config)));

    results.push(...batchResults);

    console.log(
      `[Batch Scanner] Completed ${Math.min(i + concurrency, configs.length)}/${configs.length} factories`
    );
  }

  return results;
}

/**
 * Update checkpoint with batch scan progress
 */
export async function updateCheckpointWithProgress(
  checkpoint: ScanCheckpoint,
  result: BatchScanResult
): Promise<ScanCheckpoint> {
  checkpoint.scannedLPPairs += result.totalPairs;
  checkpoint.errors.push(...result.errors);

  return checkpoint;
}

/**
 * Validate LP pairs before saving (duplicate detection, address validation)
 */
export function validateLPPairs(pairs: DbLPPair[]): { valid: DbLPPair[]; invalid: DbLPPair[] } {
  const valid: DbLPPair[] = [];
  const invalid: DbLPPair[] = [];
  const seen = new Set<string>();

  for (const pair of pairs) {
    // Validate address format (40 hex characters + 0x prefix)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;

    if (!addressRegex.test(pair.pairAddress)) {
      console.warn(`[Batch Scanner] Invalid pair address: ${pair.pairAddress}`);
      invalid.push(pair);
      continue;
    }

    if (!addressRegex.test(pair.token0Address) || !addressRegex.test(pair.token1Address)) {
      console.warn(`[Batch Scanner] Invalid token address in pair: ${pair.pairAddress}`);
      invalid.push(pair);
      continue;
    }

    // Check for duplicates (same pair address)
    const key = `${pair.pairAddress.toLowerCase()}`;
    if (seen.has(key)) {
      console.warn(`[Batch Scanner] Duplicate pair address: ${pair.pairAddress}`);
      invalid.push(pair);
      continue;
    }

    seen.add(key);
    valid.push(pair);
  }

  console.log(`[Batch Scanner] Validation: ${valid.length} valid, ${invalid.length} invalid`);

  return { valid, invalid };
}

/**
 * Save LP pairs in batches to IndexedDB
 */
export async function saveLPPairsInBatches(
  pairs: DbLPPair[],
  batchSize: number = 1000,
  onSave?: (saved: number, total: number) => void
): Promise<void> {
  const { saveLPPairs } = await import("./db");

  console.log(`[Batch Scanner] Saving ${pairs.length} LP pairs in batches of ${batchSize}`);

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    await saveLPPairs(batch);

    onSave?.(Math.min(i + batchSize, pairs.length), pairs.length);

    // Small delay to avoid blocking the main thread
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  console.log(`[Batch Scanner] Finished saving ${pairs.length} LP pairs`);
}
