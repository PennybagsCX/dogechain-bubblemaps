/**
 * DEX Pool Service
 *
 * Handles pool reserve queries and TVL calculations for DEX liquidity pools
 * on Dogechain. This service queries Uniswap V2-style pairs directly via RPC.
 */

import { DogechainRPCClient } from "./dogechainRPC";

// Uniswap V2 Pair ABI (minimal)
const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "reserve0", type: "uint112" },
      { internalType: "uint112", name: "reserve1", type: "uint112" },
      { internalType: "uint32", name: "blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Pool reserves data
 */
export interface Reserves {
  reserve0: bigint;
  reserve1: bigint;
  timestamp: number;
}

/**
 * Enhanced pool data with reserves
 */
export interface PoolReserves {
  address: string;
  token0Address: string;
  token1Address: string;
  reserve0: string;
  reserve1: string;
  lpTokenSupply: string;
  lastUpdated: number;
}

/**
 * Price map for token valuations
 */
export interface PriceMap {
  [tokenAddress: string]: number; // USD price
}

/**
 * RPC client singleton
 */
let rpcClient: DogechainRPCClient | null = null;

function getRPCClient(): DogechainRPCClient {
  if (!rpcClient) {
    rpcClient = new DogechainRPCClient();
  }
  return rpcClient;
}

/**
 * Fetch pool reserves from a Uniswap V2-style pair contract
 */
export async function fetchPoolReserves(pairAddress: string): Promise<Reserves | null> {
  const client = getRPCClient();

  try {
    // Direct RPC call using viem's readContract
    const result = await (client as any).getClient().readContract({
      address: pairAddress as `0x${string}`,
      abi: PAIR_ABI,
      functionName: "getReserves",
    });

    if (!result) {
      return null;
    }

    return {
      reserve0: result[0] as bigint,
      reserve1: result[1] as bigint,
      timestamp: Number(result[2]),
    };
  } catch (error) {
    console.warn(`[dexPoolService] Failed to fetch reserves for ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Fetch complete pool data including reserves and token info
 */
export async function fetchPoolData(pairAddress: string): Promise<PoolReserves | null> {
  const client = getRPCClient();

  try {
    // Fetch reserves, total supply, and token addresses in parallel
    const [reserves, totalSupply, token0, token1] = await Promise.all([
      fetchPoolReserves(pairAddress),
      (client as any)
        .getClient()
        .readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "totalSupply",
        })
        .catch(() => 0n),
      (client as any)
        .getClient()
        .readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "token0",
        })
        .catch(() => "0x0000000000000000000000000000000000000000"),
      (client as any)
        .getClient()
        .readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: "token1",
        })
        .catch(() => "0x0000000000000000000000000000000000000000"),
    ]);

    if (!reserves) {
      return null;
    }

    return {
      address: pairAddress,
      token0Address: token0 as string,
      token1Address: token1 as string,
      reserve0: reserves.reserve0.toString(),
      reserve1: reserves.reserve1.toString(),
      lpTokenSupply: (totalSupply as bigint).toString(),
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.warn(`[dexPoolService] Failed to fetch pool data for ${pairAddress}:`, error);
    return null;
  }
}

/**
 * Calculate TVL for a pool given reserves and token prices
 * Formula: TVL = (reserve0 * price0) + (reserve1 * price1)
 */
export function calculateTVL(
  reserves: Reserves,
  token0Decimals: number,
  token1Decimals: number,
  prices: PriceMap
): number {
  // Convert reserves from wei to token amounts
  const amount0 = Number(reserves.reserve0) / Math.pow(10, token0Decimals);
  const amount1 = Number(reserves.reserve1) / Math.pow(10, token1Decimals);

  // Get prices (default to 0 if not available)
  const price0 = prices["0x0000000000000000000000000000000000000000"] || 0;
  const price1 = prices["0x0000000000000000000000000000000000000000"] || 0;

  // Calculate TVL
  const tvl = amount0 * price0 + amount1 * price1;

  return tvl;
}

/**
 * Fetch data for multiple pools in parallel
 */
export async function fetchMultiplePoolsData(pairAddresses: string[]): Promise<PoolReserves[]> {
  const batchSize = 10;
  const results: PoolReserves[] = [];

  for (let i = 0; i < pairAddresses.length; i += batchSize) {
    const batch = pairAddresses.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((address) => fetchPoolData(address)));
    results.push(...(batchResults.filter((r) => r !== null) as PoolReserves[]));
  }

  return results;
}

/**
 * Get simple price map from known tokens
 * In production, this would fetch from a price oracle or DEX
 */
export async function getKnownPrices(): Promise<PriceMap> {
  // Dogechain native token prices (hardcoded for now)
  // In production, fetch from Coingecko, DEX, or price oracle
  return {
    "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101": 0.15, // wDOGE
    "0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d": 1.0, // USDT
    "0x7b4328c127b85369d9f82ca0503b000d09cf9180": 0.05, // DC
  };
}
