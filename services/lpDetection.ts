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
