/**
 * DEX Factory Discovery Service
 *
 * Automatically discovers new DEX factory deployments.
 * Scans for factories and discovers all LP pairs from them.
 */

import { AssetType } from "../types";

// Known DEX factory patterns
const FACTORY_PATTERNS = [
  {
    name: "Uniswap V2 Factory",
    method: "createPair(address,address)",
    event: "PairCreated(address,address,address,uint256)",
  },
  {
    name: "Uniswap V3 Factory",
    method: "createPool(address,uint24,address)",
    event: "PoolCreated(address,address,uint24,int24,address)",
  },
  {
    name: "PancakeSwap V2 Factory",
    method: "createPair(address,address)",
    event: "PairCreated(address,address,address,uint256)",
  },
];

// Registry of discovered factories
interface DiscoveredFactory {
  address: string;
  name: string;
  dexName: string;
  version: string;
  pairCount: number;
  discoveredAt: number;
  lastVerified: number;
  status: "active" | "inactive" | "verified";
}

const factoryRegistry = new Map<string, DiscoveredFactory>();

/**
 * Discover new DEX factories by scanning recent deployments
 *
 * @param limit - Maximum number of factories to discover
 * @returns Array of discovered factories
 */
export async function discoverNewFactories(limit: number = 10): Promise<DiscoveredFactory[]> {
  try {
    console.log("[Factory Discovery] Scanning for new factories...");

    const discovered: DiscoveredFactory[] = [];

    // Scan recent contract deployments (would use explorer API in production)
    // For now, return known factories from registry
    const knownFactories = Array.from(factoryRegistry.values()).filter(
      (f) => f.status === "active"
    );

    console.log(`[Factory Discovery] Found ${knownFactories.length} active factories`);
    return knownFactories.slice(0, limit);
  } catch (error) {
    console.error("[Factory Discovery] Failed to discover factories:", error);
    return [];
  }
}

/**
 * Verify if a contract is a DEX factory
 *
 * @param address - Contract address
 * @returns Factory verification result
 */
export async function verifyFactory(address: string): Promise<{
  isFactory: boolean;
  name?: string;
  version?: string;
}> {
  try {
    // Check if contract has createPair method
    const response = await fetch(
      `https://explorer.dogechain.dog/api?v1&module=contract&action=getabi&address=${address}`
    );

    if (!response.ok) {
      return { isFactory: false };
    }

    const data = await response.json();
    const abi = data.result;

    if (!abi) {
      return { isFactory: false };
    }

    const abiParsed = JSON.parse(abi);

    // Check for factory methods
    const hasCreatePair = abiParsed.some(
      (item: any) =>
        item.type === "function" && (item.name === "createPair" || item.name === "createPool")
    );

    if (!hasCreatePair) {
      return { isFactory: false };
    }

    // Determine factory type
    const hasPool = abiParsed.some(
      (item: any) => item.type === "function" && item.name === "createPool"
    );

    return {
      isFactory: true,
      name: hasPool ? "Uniswap V3" : "Uniswap V2",
      version: hasPool ? "V3" : "V2",
    };
  } catch (error) {
    console.warn("[Factory Discovery] Factory verification failed:", error);
    return { isFactory: false };
  }
}

/**
 * Register a discovered factory
 *
 * @param address - Factory address
 * @param name - Factory name
 * @param dexName - DEX name
 */
export function registerFactory(address: string, name: string, dexName: string): void {
  factoryRegistry.set(address.toLowerCase(), {
    address: address.toLowerCase(),
    name,
    dexName,
    version: name.includes("V3") ? "V3" : "V2",
    pairCount: 0,
    discoveredAt: Date.now(),
    lastVerified: Date.now(),
    status: "active",
  });

  console.log(`[Factory Discovery] Registered factory: ${dexName} (${name})`);
}

/**
 * Get all discovered factories
 */
export function getDiscoveredFactories(): DiscoveredFactory[] {
  return Array.from(factoryRegistry.values()).sort((a, b) => {
    // Sort by pair count descending
    return b.pairCount - a.pairCount;
  });
}

/**
 * Discover LP pairs from a factory
 *
 * @param factoryAddress - Factory contract address
 * @param limit - Maximum pairs to discover
 * @returns Array of LP pair addresses
 */
export async function discoverFactoryPairs(
  factoryAddress: string,
  limit: number = 100
): Promise<string[]> {
  try {
    console.log(`[Factory Discovery] Discovering pairs for factory: ${factoryAddress}`);

    // Query PairCreated events (would use logs API in production)
    // For now, return empty array
    const pairs: string[] = [];

    // Update factory pair count
    const factory = factoryRegistry.get(factoryAddress.toLowerCase());
    if (factory) {
      factory.pairCount = pairs.length;
      factory.lastVerified = Date.now();
    }

    return pairs;
  } catch (error) {
    console.error("[Factory Discovery] Failed to discover pairs:", error);
    return [];
  }
}

/**
 * Scan for new factories and add them to registry
 *
 * Call this periodically (e.g., weekly) to discover new DEX deployments
 */
export async function scanForNewFactories(): Promise<number> {
  try {
    console.log("[Factory Discovery] Starting full scan for new DEX factories...");

    const discoveredCount = 0;

    // In production, would:
    // 1. Scan recent contract deployments
    // 2. Verify each contract for factory pattern
    // 3. Register new factories
    // 4. Discover pairs from new factories

    // For now, just log
    console.log(`[Factory Discovery] Scan complete: ${discoveredCount} new factories`);

    return discoveredCount;
  } catch (error) {
    console.error("[Factory Discovery] Scan failed:", error);
    return 0;
  }
}

// Auto-initialize with known factories
export function initializeFactoryRegistry(): void {
  // Add some known Dogechain DEX factories
  registerFactory("0xA10207210e5C87684Ecc26585A87eb21C4dC746", "Uniswap V2 Factory", "QuickSwap");

  registerFactory("0x4e6391e41262c3014964b4c6af2f2b6b2b28B9d8", "PancakeSwap Factory", "ChewySwap");

  console.log(`[Factory Discovery] Initialized with ${factoryRegistry.size} factories`);
}

// Auto-initialize
if (typeof window !== "undefined") {
  initializeFactoryRegistry();
}
