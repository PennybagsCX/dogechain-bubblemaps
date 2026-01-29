/**
 * DexScreener API Service
 *
 * Fallback service for real-time pool data when GeckoTerminal is unavailable.
 * Provides fast access to pair data, prices, and trading metrics.
 *
 * API Documentation: https://docs.dexscreener.com/api
 */

// =====================================================
// Base Configuration
// =====================================================

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

// Rate limiting: DexScreener has generous free tier (~300 req/min)
// We use 1 second intervals to be conservative
const RATE_LIMIT_MIN_INTERVAL = 1000;

// =====================================================
// Data Types
// =====================================================

export interface DexScreenerToken {
  address: string;
  name: string;
  symbol: string;
}

export interface DexScreenerPair {
  chainId: string;
  pairAddress: string;
  dexId: string;
  baseToken: DexScreenerToken;
  quoteToken: DexScreenerToken;
  priceUsd: string;
  priceNative: string;
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  volume24h: number;
  volume24hBase: number;
  volume24hQuote: number;
  priceChange24h: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange12h?: number;
  priceChange30d?: number;
  txns24h: {
    buys: number;
    sells: number;
  };
  txns6h?: {
    buys: number;
    sells: number;
  };
  pairCreatedAt: number;
  pairCreatedAtBlock?: string;
  fdv?: number;
  marketCap?: number;
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export interface DexScreenerSearchResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

// =====================================================
// Rate Limiter
// =====================================================

class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastCall = 0;
  private minInterval: number;

  constructor(minInterval: number = RATE_LIMIT_MIN_INTERVAL) {
    this.minInterval = minInterval;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastCall = now - this.lastCall;

      if (timeSinceLastCall < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastCall;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const task = this.queue.shift();
      if (task) {
        this.lastCall = Date.now();
        await task().catch((error) => {
          console.error("[DexScreener RateLimiter] Task failed:", error);
        });
      }
    }

    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

// =====================================================
// Cache
// =====================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = {
  pairs: new Map<string, CacheEntry<DexScreenerPair>>(),
  searches: new Map<string, CacheEntry<DexScreenerPair[]>>(),
};

const PAIR_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const SEARCH_CACHE_TTL = 1 * 60 * 1000; // 1 minute

function getPairFromCache(pairAddress: string): DexScreenerPair | null {
  const entry = cache.pairs.get(pairAddress.toLowerCase());
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }
  return null;
}

function setPairInCache(pair: DexScreenerPair): void {
  cache.pairs.set(pair.pairAddress.toLowerCase(), {
    data: pair,
    expiry: Date.now() + PAIR_CACHE_TTL,
  });
}

function getSearchFromCache(query: string): DexScreenerPair[] | null {
  const entry = cache.searches.get(query.toLowerCase());
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }
  return null;
}

function setSearchInCache(query: string, pairs: DexScreenerPair[]): void {
  cache.searches.set(query.toLowerCase(), {
    data: pairs,
    expiry: Date.now() + SEARCH_CACHE_TTL,
  });
}

// =====================================================
// API Functions
// =====================================================

/**
 * Get pair data by address on a specific chain
 * @param chainId Chain identifier (e.g., "dogechain", "ethereum")
 * @param pairAddress The pair/pool address
 */
export async function getPairData(
  chainId: string,
  pairAddress: string
): Promise<DexScreenerPair | null> {
  try {
    // Check cache first
    const cached = getPairFromCache(pairAddress);
    if (cached) {
      console.log("[dexScreenerService] Returning cached pair data");
      return cached;
    }

    const url = `${DEXSCREENER_API}/pairs/${chainId}/${pairAddress}`;

    const response = await rateLimiter.execute(async () => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`DexScreener API error: ${res.status}`);
      }

      return res.json() as Promise<DexScreenerResponse>;
    });

    if (!response.pairs || response.pairs.length === 0) {
      return null;
    }

    const pair = response.pairs[0];

    if (!pair) {
      return null;
    }

    // Cache the result
    setPairInCache(pair);

    return pair;
  } catch (error) {
    console.error("[dexScreenerService] Failed to fetch pair data:", error);
    return null;
  }
}

/**
 * Search for token pairs by token address
 * @param tokenAddress The token contract address to search for
 */
export async function searchTokenPairs(tokenAddress: string): Promise<DexScreenerPair[]> {
  try {
    // Check cache first
    const cached = getSearchFromCache(tokenAddress);
    if (cached) {
      console.log("[dexScreenerService] Returning cached search results");
      return cached;
    }

    const url = `${DEXSCREENER_API}/tokens/${tokenAddress}`;

    const response = await rateLimiter.execute(async () => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`DexScreener API error: ${res.status}`);
      }

      return res.json() as Promise<DexScreenerSearchResponse>;
    });

    const pairs = response.pairs || [];

    // Cache the results
    setSearchInCache(tokenAddress, pairs);

    return pairs;
  } catch (error) {
    console.error("[dexScreenerService] Failed to search token pairs:", error);
    return [];
  }
}

/**
 * Search for pairs by query string (token name, symbol, or address)
 * @param query Search query (token name, symbol, or address)
 */
export async function searchPairs(query: string): Promise<DexScreenerPair[]> {
  try {
    // Check cache first
    const cached = getSearchFromCache(query);
    if (cached) {
      console.log("[dexScreenerService] Returning cached search results");
      return cached;
    }

    const url = `${DEXSCREENER_API}/search/?q=${encodeURIComponent(query)}`;

    const response = await rateLimiter.execute(async () => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`DexScreener API error: ${res.status}`);
      }

      return res.json() as Promise<DexScreenerSearchResponse>;
    });

    const pairs = response.pairs || [];

    // Cache the results
    setSearchInCache(query, pairs);

    return pairs;
  } catch (error) {
    console.error("[dexScreenerService] Failed to search pairs:", error);
    return [];
  }
}

/**
 * Get data for multiple pairs on the same chain
 * @param chainId Chain identifier
 * @param pairAddresses Array of pair addresses
 */
export async function getMultiplePairs(
  chainId: string,
  pairAddresses: string[]
): Promise<DexScreenerPair[]> {
  try {
    const batchSize = 30;
    const results: DexScreenerPair[] = [];

    for (let i = 0; i < pairAddresses.length; i += batchSize) {
      const batch = pairAddresses.slice(i, i + batchSize);

      // Try to get from cache first
      const uncachedAddresses: string[] = [];
      const cachedPairs: DexScreenerPair[] = [];

      for (const address of batch) {
        const cached = getPairFromCache(address);
        if (cached) {
          cachedPairs.push(cached);
        } else {
          uncachedAddresses.push(address);
        }
      }

      results.push(...cachedPairs);

      // Fetch uncached pairs
      if (uncachedAddresses.length > 0) {
        const batchResults = await Promise.all(
          uncachedAddresses.map((address) => getPairData(chainId, address))
        );

        results.push(...(batchResults.filter((p) => p !== null) as DexScreenerPair[]));
      }
    }

    return results;
  } catch (error) {
    console.error("[dexScreenerService] Failed to fetch multiple pairs:", error);
    return [];
  }
}

/**
 * Get top pairs by volume for a chain
 * Note: DexScreener doesn't have a native "top pairs" endpoint,
 * so we use search with common tokens as a proxy
 * @param chainId Chain identifier
 * @param limit Maximum number of pairs to return
 */
export async function getTopPairs(chainId: string, limit: number = 20): Promise<DexScreenerPair[]> {
  try {
    // Search for common tokens on the chain to get active pairs
    const commonTokens = ["WDOGE", "USDT", "USDC", "ETH", "BTC"];

    const allPairs: DexScreenerPair[] = [];

    for (const token of commonTokens) {
      const pairs = await searchPairs(token);
      const chainPairs = pairs.filter((p) => p.chainId === chainId);
      allPairs.push(...chainPairs);
    }

    // Remove duplicates and sort by volume
    const uniquePairs = Array.from(new Map(allPairs.map((p) => [p.pairAddress, p])).values());

    return uniquePairs.sort((a, b) => b.volume24h - a.volume24h).slice(0, limit);
  } catch (error) {
    console.error("[dexScreenerService] Failed to get top pairs:", error);
    return [];
  }
}

/**
 * Convert DexScreener pair to common pool format
 * Useful for normalizing data between different APIs
 */
export function normalizePairData(pair: DexScreenerPair): {
  address: string;
  token0: { address: string; symbol: string; name: string };
  token1: { address: string; symbol: string; name: string };
  reserve0Usd: number;
  reserve1Usd: number;
  totalValueLockedUsd: number;
  volume24hUsd: number;
  priceChange24h: number;
  marketCapUsd?: number;
  createdAt: number;
} {
  const totalLiquidity = pair.liquidity?.usd || 0;

  // Estimate reserves from liquidity and price
  const reserve0Usd = totalLiquidity / 2;
  const reserve1Usd = totalLiquidity / 2;

  return {
    address: pair.pairAddress.toLowerCase(),
    token0: {
      address: pair.baseToken.address.toLowerCase(),
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
    },
    token1: {
      address: pair.quoteToken.address.toLowerCase(),
      symbol: pair.quoteToken.symbol,
      name: pair.quoteToken.name,
    },
    reserve0Usd,
    reserve1Usd,
    totalValueLockedUsd: totalLiquidity,
    volume24hUsd: pair.volume24h,
    priceChange24h: pair.priceChange24h,
    marketCapUsd: pair.fdv || pair.marketCap,
    createdAt: pair.pairCreatedAt,
  };
}

/**
 * Clear all caches
 */
export function clearCache(): void {
  cache.pairs.clear();
  cache.searches.clear();
  console.log("[dexScreenerService] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    pairsCacheSize: cache.pairs.size,
    searchesCacheSize: cache.searches.size,
  };
}

// =====================================================
// Compatibility Functions (matching GeckoTerminal interface)
// =====================================================

interface PoolStats {
  address: string;
  token0: { address: string; symbol: string; decimals?: number };
  token1: { address: string; symbol: string; decimals?: number };
  factory: string;
  reserve0: string;
  reserve1: string;
  tvlUsd: number;
  lpTokenSupply: string;
  createdAt: number;
  pairAge: number;
  volume24h?: number;
  priceChange24h?: number;
  marketCap?: number;
}

interface FactoryStats {
  name: string;
  poolCount: number;
  totalTVL: number;
}

interface ChainMetrics {
  chainName: string;
  totalTVL: number;
  dexVolume24h: number;
  dexVolume7d: number;
  activePools: number;
  dailyUsers: number;
}

/**
 * Convert DexScreener pair to PoolStats format (compatible with GeckoTerminal)
 */
function toPoolStats(pair: DexScreenerPair): PoolStats {
  const now = Date.now();
  const liquidity = pair.liquidity?.usd || 0;

  return {
    address: pair.pairAddress.toLowerCase(),
    token0: {
      address: pair.baseToken.address.toLowerCase(),
      symbol: pair.baseToken.symbol,
      decimals: 18, // Default as we don't have this info
    },
    token1: {
      address: pair.quoteToken.address.toLowerCase(),
      symbol: pair.quoteToken.symbol,
      decimals: 18,
    },
    factory: pair.dexId || "Unknown",
    reserve0: (liquidity / 2).toString(),
    reserve1: (liquidity / 2).toString(),
    tvlUsd: liquidity,
    lpTokenSupply: "0", // Not available from DexScreener
    createdAt: pair.pairCreatedAt,
    pairAge: now - pair.pairCreatedAt,
    volume24h: pair.volume24h,
    priceChange24h: pair.priceChange24h,
    marketCap: pair.fdv || pair.marketCap,
  };
}

/**
 * Get top pools by TVL (compatible with GeckoTerminal)
 * @param chainId Chain identifier (default: "dogechain")
 * @param limit Maximum number of pools to return
 */
export async function getTopPoolsByTVL(
  chainId: string = "dogechain",
  limit: number = 20
): Promise<PoolStats[]> {
  try {
    const pairs = await getTopPairs(chainId, limit * 2); // Fetch more to have options

    return pairs
      .map((p) => toPoolStats(p))
      .filter((p) => p.tvlUsd > 0)
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit);
  } catch (error) {
    console.error("[dexScreenerService] Failed to get top pools by TVL:", error);
    return [];
  }
}

/**
 * Get top pools by volume (compatible with GeckoTerminal)
 * @param chainId Chain identifier (default: "dogechain")
 * @param limit Maximum number of pools to return
 */
export async function getTopPoolsByVolume(
  chainId: string = "dogechain",
  limit: number = 20
): Promise<PoolStats[]> {
  try {
    const pairs = await getTopPairs(chainId, limit * 2);

    return pairs
      .map((p) => toPoolStats(p))
      .filter((p) => (p.volume24h || 0) > 0)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, limit);
  } catch (error) {
    console.error("[dexScreenerService] Failed to get top pools by volume:", error);
    return [];
  }
}

/**
 * Get new pools (compatible with GeckoTerminal)
 * @param chainId Chain identifier (default: "dogechain")
 * @param limit Maximum number of pools to return
 */
export async function getNewPools(
  chainId: string = "dogechain",
  limit: number = 20
): Promise<PoolStats[]> {
  try {
    const pairs = await getTopPairs(chainId, limit * 3);

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return pairs
      .map((p) => toPoolStats(p))
      .filter((p) => p.createdAt > oneWeekAgo)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch (error) {
    console.error("[dexScreenerService] Failed to get new pools:", error);
    return [];
  }
}

/**
 * Get factory distribution (compatible with GeckoTerminal)
 * @param chainId Chain identifier (default: "dogechain")
 */
export async function getFactoryDistribution(
  chainId: string = "dogechain"
): Promise<FactoryStats[]> {
  try {
    const pairs = await getTopPairs(chainId, 100);

    // Group by DEX
    const factoryMap = new Map<string, { count: number; totalTVL: number }>();

    for (const pair of pairs) {
      const dexName = pair.dexId || "Unknown";
      const tvl = pair.liquidity?.usd || 0;

      const existing = factoryMap.get(dexName);
      if (existing) {
        existing.count++;
        existing.totalTVL += tvl;
      } else {
        factoryMap.set(dexName, { count: 1, totalTVL: tvl });
      }
    }

    return Array.from(factoryMap.entries())
      .map(([name, stats]) => ({
        name,
        poolCount: stats.count,
        totalTVL: stats.totalTVL,
      }))
      .sort((a, b) => b.poolCount - a.poolCount);
  } catch (error) {
    console.error("[dexScreenerService] Failed to get factory distribution:", error);
    return [];
  }
}

/**
 * Get chain metrics (compatible with GeckoTerminal)
 * @param chainId Chain identifier (default: "dogechain")
 */
export async function getChainMetrics(chainId: string = "dogechain"): Promise<ChainMetrics | null> {
  try {
    const pairs = await getTopPairs(chainId, 100);

    const totalTVL = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
    const totalVolume24h = pairs.reduce((sum, p) => sum + (p.volume24h || 0), 0);

    return {
      chainName: chainId,
      totalTVL,
      dexVolume24h: totalVolume24h,
      dexVolume7d: totalVolume24h * 7, // Estimate
      activePools: pairs.length,
      dailyUsers: 0, // Not available from DexScreener
    };
  } catch (error) {
    console.error("[dexScreenerService] Failed to get chain metrics:", error);
    return null;
  }
}
