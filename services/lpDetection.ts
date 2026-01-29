/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * DEX Liquidity Pool Detection Service
 *
 * This service handles the detection and identification of DEX liquidity pool
 * contracts on Dogechain by monitoring factory contract events.
 */

import { KNOWN_FACTORIES, PAIR_CREATED_EVENT_SIGNATURE } from "./knownFactories";
import { saveLPPairs, loadAllLPPairs } from "./db";
import type { DbLPPair } from "./db";

// Dogechain Explorer API endpoints
const EXPLORER_API_V1 = "https://explorer.dogechain.dog/api";

/**
 * Fetch PairCreated events from a factory contract
 */
export async function fetchPairCreatedEvents(
  factoryAddress: string,
  fromBlock: number,
  toBlock: number | "latest" = "latest"
): Promise<any[]> {
  try {
    const url = `${EXPLORER_API_V1}?module=logs&action=getLogs&address=${factoryAddress}&topic0=${PAIR_CREATED_EVENT_SIGNATURE}&fromBlock=${fromBlock}&toBlock=${toBlock}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "1" && data.result) {
      return data.result;
    }

    return [];
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Calculate pair address using CREATE2 formula
 *
 * pair_address = keccak256(
 *   abi.encodePacked(
 *     '0xff',
 *     factory_address,
 *     keccak256(abi.encodePacked(token0, token1)),
 *     init_code_hash
 *   )
 * )
 *
 * Note: This is a simplified version. For production, use ethers.js or web3.js
 * for proper keccak256 hashing.
 */
export function calculatePairAddress(
  _factoryAddress: string,
  _token0: string,
  _token1: string,
  _initCodeHash: string
): string {
  // This is a placeholder implementation
  // In a real scenario, you would use ethers.js:
  //
  // const ethers = require('ethers');
  // const factory = factoryAddress.toLowerCase();
  // const salt = ethers.utils.keccak256(
  //   ethers.utils.solidityPack(['address', 'address'], [token0.toLowerCase(), token1.toLowerCase()])
  // );
  // const pairAddress = ethers.utils.getCreate2Address(factory, salt, initCodeHash);
  //
  // For now, we'll return a placeholder

  return "0x0000000000000000000000000000000000000000";
}

/**
 * Parse PairCreated event logs
 */
export function parsePairCreatedEvents(
  logs: any[],
  factoryAddress: string,
  dexName: string
): DbLPPair[] {
  const pairs: DbLPPair[] = [];

  for (const log of logs) {
    try {
      // Parse topics and data from event log
      // topic0: event signature
      // topic1: token0 (indexed)
      // topic2: token1 (indexed)
      // data: pair address (uint256) + other params

      const token0 = log.topics[1] ? "0x" + log.topics[1].slice(26) : "0x0";
      const token1 = log.topics[2] ? "0x" + log.topics[2].slice(26) : "0x0";

      // Pair address is in the data field (first 32 bytes)
      const pairAddress = "0x" + log.data.slice(26, 66);

      pairs.push({
        pairAddress,
        factoryAddress,
        token0Address: token0,
        token1Address: token1,
        dexName,
        discoveredAt: Date.now(),
        lastVerifiedAt: Date.now(),
        isValid: true,
      });
    } catch {
      // Error handled silently
    }
  }

  return pairs;
}

/**
 * Scan all known factory contracts for PairCreated events
 *
 * This function will:
 * 1. Iterate through all known factories
 * 2. Fetch PairCreated events from each factory
 * 3. Parse the events and extract pair data
 * 4. Save discovered pairs to the database
 */
export async function scanAllFactories(
  onProgress?: (message: string, progress: number) => void
): Promise<number> {
  const totalPairs: DbLPPair[] = [];

  for (let i = 0; i < KNOWN_FACTORIES.length; i++) {
    const factory = KNOWN_FACTORIES[i];
    if (!factory) continue;

    if (factory.status !== "ACTIVE") {
      continue;
    }

    onProgress?.(`Scanning ${factory.name}...`, (i / KNOWN_FACTORIES.length) * 100);

    try {
      // Fetch events from factory (from deploy block to latest)
      const events = await fetchPairCreatedEvents(factory.address, factory.deployBlock, "latest");

      // Parse events
      const pairs = parsePairCreatedEvents(events, factory.address, factory.name);

      totalPairs.push(...pairs);
    } catch {
      // Error handled silently
    }
  }

  // Save all discovered pairs to database
  if (totalPairs.length > 0) {
    await saveLPPairs(totalPairs);
  }

  onProgress?.("Factory scan complete", 100);

  return totalPairs.length;
}

/**
 * Check if address is an LP pair by looking it up in the database
 *
 * This is a faster alternative to scanning factories when you have
 * already populated the database.
 */
export async function isAddressLPPair(address: string): Promise<DbLPPair | null> {
  const { isAddressLPPair: dbCheck } = await import("./db");
  return dbCheck(address);
}

/**
 * Get all LP pairs from database
 * Re-exports loadAllLPPairs from db.ts for convenience
 */
export async function getAllLPPairs(): Promise<DbLPPair[]> {
  return loadAllLPPairs();
}

// Also export loadAllLPPairs directly
export { loadAllLPPairs };

/**
 * Initialize LP detection by scanning factories if database is empty
 */
export async function initializeLPDetection(
  forceRescan: boolean = false,
  onProgress?: (message: string, progress: number) => void
): Promise<void> {
  try {
    // Check if we already have LP pairs in database
    const existingPairs = await loadAllLPPairs();

    if (existingPairs.length > 0 && !forceRescan) {
      return;
    }

    // Scan factories to populate database
    onProgress?.("Initializing LP detection...", 0);
    await scanAllFactories(onProgress);
  } catch {
    // Error handled silently
  }
}

/**
 * Feature flag to enable/disable LP detection
 * Set to false to disable LP pool detection
 */
export const LP_DETECTION_ENABLED = true;

/**
 * Pool statistics for DEX analytics
 */
export interface PoolStats {
  address: string;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  factory: string; // DogeSwap, QuickSwap, etc.
  reserve0: string;
  reserve1: string;
  tvlUsd: number;
  lpTokenSupply: string;
  createdAt: number;
  pairAge: number; // seconds since creation
}

/**
 * Factory statistics
 */
export interface FactoryStats {
  name: string;
  poolCount: number;
  totalTVL: number;
}

/**
 * Get all pools with statistics
 * Returns cached LP pairs with additional metadata
 */
export async function getAllPools(): Promise<PoolStats[]> {
  try {
    const pairs = await loadAllLPPairs();

    // Map DbLPPair to PoolStats with default values
    // TVL calculation requires separate price data fetching
    return pairs.map((pair) => {
      const pairAge = Date.now() - pair.discoveredAt;

      return {
        address: pair.pairAddress,
        token0: {
          address: pair.token0Address,
          symbol: "TOKEN0", // Will be fetched from metadata
        },
        token1: {
          address: pair.token1Address,
          symbol: "TOKEN1", // Will be fetched from metadata
        },
        factory: pair.dexName,
        reserve0: "0",
        reserve1: "0",
        tvlUsd: 0,
        lpTokenSupply: "0",
        createdAt: pair.discoveredAt,
        pairAge,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get top pools by TVL
 * @param limit Maximum number of pools to return
 */
export async function getTopPoolsByTVL(limit: number = 20): Promise<PoolStats[]> {
  try {
    const { DogechainRPCClient } = await import("./dogechainRPC");

    const rpcClient = new DogechainRPCClient();
    const pairs = await loadAllLPPairs();

    // Fetch analytics for all pools (in batches)
    const analytics = await (
      await import("./dexPoolService")
    ).fetchMultiplePoolsAnalytics(
      pairs.map((p) => p.pairAddress),
      rpcClient
    );

    // Merge with factory info and sort by TVL
    const poolMap = new Map(pairs.map((p) => [p.pairAddress.toLowerCase(), p]));

    const poolsWithAnalytics = analytics
      .map((a) => ({
        ...a,
        factory: poolMap.get(a.address.toLowerCase())?.dexName || "Unknown",
      }))
      .filter((p) => p.tvlUsd > 0) // Only include pools with TVL
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit);

    return poolsWithAnalytics;
  } catch (error) {
    console.warn("[lpDetection] Failed to get top pools by TVL:", error);
    return [];
  }
}

/**
 * Get new pools created within the specified time period
 * @param since Time in milliseconds ago (default: 24 hours)
 */
export async function getNewPools(since: number = 24 * 60 * 60 * 1000): Promise<PoolStats[]> {
  try {
    const { DogechainRPCClient } = await import("./dogechainRPC");

    const rpcClient = new DogechainRPCClient();
    const pairs = await loadAllLPPairs();
    const cutoffTime = Date.now() - since;

    // Filter for new pools
    const newPairs = pairs.filter((pair) => pair.discoveredAt >= cutoffTime);

    // Fetch analytics for new pools
    const analytics = await (
      await import("./dexPoolService")
    ).fetchMultiplePoolsAnalytics(
      newPairs.map((p) => p.pairAddress),
      rpcClient
    );

    // Merge with factory info and sort by creation time (newest first)
    const poolMap = new Map(newPairs.map((p) => [p.pairAddress.toLowerCase(), p]));

    const poolsWithAnalytics = analytics
      .map((a) => ({
        ...a,
        factory: poolMap.get(a.address.toLowerCase())?.dexName || "Unknown",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return poolsWithAnalytics;
  } catch (error) {
    console.warn("[lpDetection] Failed to get new pools:", error);
    return [];
  }
}

/**
 * Get factory distribution statistics with TVL
 */
export async function getFactoryDistribution(): Promise<FactoryStats[]> {
  try {
    const { DogechainRPCClient } = await import("./dogechainRPC");

    const rpcClient = new DogechainRPCClient();
    const pairs = await loadAllLPPairs();

    // Group by factory
    const factoryMap = new Map<string, { pairs: DbLPPair[]; totalTVL: number }>();

    for (const pair of pairs) {
      const existing = factoryMap.get(pair.dexName);
      if (existing) {
        existing.pairs.push(pair);
      } else {
        factoryMap.set(pair.dexName, { pairs: [pair], totalTVL: 0 });
      }
    }

    // Calculate TVL for each factory (sample top 20 pools per factory for performance)
    const results: FactoryStats[] = [];

    for (const [factoryName, data] of factoryMap.entries()) {
      // Fetch analytics for a sample of pools (limit to 20 for performance)
      const samplePairs = data.pairs.slice(0, 20);
      const analytics = await (
        await import("./dexPoolService")
      ).fetchMultiplePoolsAnalytics(
        samplePairs.map((p) => p.pairAddress),
        rpcClient
      );

      const totalTVL = analytics.reduce((sum, pool) => sum + pool.tvlUsd, 0);

      results.push({
        name: factoryName,
        poolCount: data.pairs.length,
        totalTVL,
      });
    }

    // Sort by pool count
    return results.sort((a, b) => b.poolCount - a.poolCount);
  } catch (error) {
    console.warn("[lpDetection] Failed to get factory distribution:", error);
    return [];
  }
}
