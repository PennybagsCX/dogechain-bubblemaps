/**
 * GeckoTerminal API Service
 *
 * Fetches pool data, OHLCV charts, and trading volume from GeckoTerminal API.
 * Implements rate limiting and multi-level caching for optimal performance.
 *
 * API Documentation: https://www.geckoterminal.com/docs
 */

// =====================================================
// Base Configuration
// =====================================================

const GECKO_TERMINAL_API = "https://api.geckoterminal.com/api/v2";
const DOGECHAIN_NETWORK = "dogechain";

// Rate limiting: 30 requests per minute
// To stay safe, we use 2 second intervals (30 req/min / 60 sec * 2 = buffer)
const RATE_LIMIT_MIN_INTERVAL = 2000; // 2 seconds between requests

// =====================================================
// Data Types
// =====================================================

export interface GeckoToken {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
}

export interface GeckoPool {
  address: string;
  name: string;
  token0: GeckoToken;
  token1: GeckoToken;
  reserve0Usd: number;
  reserve1Usd: number;
  totalValueLockedUsd: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  marketCapUsd?: number;
  createdAt: string;
  dexId?: string;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GeckoPoolResponse {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    token_price_usd?: string;
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    base_token_price_native_currency?: string;
    reserve_in_usd?: string;
    reserve_usd?: string;
    liquidity_usd?: string;
    volume_usd?: Record<string, string | null>;
    total_value_locked_usd?: string;
    market_cap_usd?: string;
    price_change_percentage?: Record<string, string | null>;
    created_at: string;
    dex?: {
      id: string;
      name: string;
    };
    base_token: {
      id: string;
      type: string;
      attributes: {
        address: string;
        name: string;
        symbol: string;
        decimals: string;
      };
    };
    quote_token: {
      id: string;
      type: string;
      attributes: {
        address: string;
        name: string;
        symbol: string;
        decimals: string;
      };
    };
  };
  relationships: {
    dex: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

export interface GeckoPoolsResponse {
  data: GeckoPoolResponse[];
  meta: {
    per_page: number;
    current_page: number;
    total_items: number;
  };
}

export interface GeckoOHLCVResponse {
  data: Array<[number, string, string, string, string, string]>;
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
          console.error("[RateLimiter] Task failed:", error);
        });
      }
    }

    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

// =====================================================
// Multi-Level Cache
// =====================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = {
  pools: new Map<string, CacheEntry<GeckoPool>>(),
  ohlcv: new Map<string, CacheEntry<OHLCVData[]>>(),
  newPools: null as CacheEntry<GeckoPool[]> | null,
  topPools: null as CacheEntry<GeckoPool[]> | null,
  volumePools: null as CacheEntry<GeckoPool[]> | null,
};

// Cache TTLs
const POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const OHLCV_CACHE_TTL = 1 * 60 * 1000; // 1 minute
const NEW_POOLS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const TOP_POOLS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getFromCache<T>(
  cacheMap: Map<string, CacheEntry<T>> | CacheEntry<T[]> | null,
  key?: string
): T | null {
  try {
    if (
      Array.isArray(cacheMap) ||
      (cacheMap && typeof cacheMap === "object" && "data" in cacheMap)
    ) {
      // Single entry cache (newPools, topPools)
      const entry = cacheMap as CacheEntry<T>;
      if (entry && Date.now() < entry.expiry) {
        return entry.data;
      }
      return null;
    }

    if (cacheMap instanceof Map && key) {
      const entry = cacheMap.get(key);
      if (entry && Date.now() < entry.expiry) {
        return entry.data;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function setCache<T>(
  cacheMap: Map<string, CacheEntry<T>> | (CacheEntry<T> | null),
  data: T,
  key?: string,
  ttl?: number
): void {
  const expiry = Date.now() + (ttl || POOL_CACHE_TTL);

  if (cacheMap instanceof Map && key) {
    cacheMap.set(key, { data, expiry });
  } else if (key === undefined) {
    // For single entry caches
    const target = cacheMap as { data?: T; expiry?: number };
    target.data = data;
    target.expiry = expiry;
  }
}

// =====================================================
// Data Transformation
// =====================================================

function transformPoolData(pool: GeckoPoolResponse): GeckoPool {
  const attr = pool.attributes;
  const baseToken = attr.base_token.attributes;
  const quoteToken = attr.quote_token.attributes;

  // Extract 24h volume
  const volume24h = attr.volume_usd?.["24h"] ? parseFloat(attr.volume_usd["24h"]) : undefined;

  // Extract price change
  const priceChange24h = attr.price_change_percentage?.["24h"]
    ? parseFloat(attr.price_change_percentage["24h"])
    : undefined;

  // Extract market cap
  const marketCap = attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : undefined;

  return {
    address: attr.address.toLowerCase(),
    name: attr.name,
    token0: {
      address: baseToken.address.toLowerCase(),
      name: baseToken.name,
      symbol: baseToken.symbol,
      decimals: parseInt(baseToken.decimals) || 18,
    },
    token1: {
      address: quoteToken.address.toLowerCase(),
      name: quoteToken.name,
      symbol: quoteToken.symbol,
      decimals: parseInt(quoteToken.decimals) || 18,
    },
    reserve0Usd: parseFloat(attr.reserve_usd || "0"),
    reserve1Usd: parseFloat(attr.reserve_usd || "0"),
    totalValueLockedUsd: parseFloat(attr.total_value_locked_usd || "0"),
    volume24hUsd: volume24h,
    priceChange24h,
    marketCapUsd: marketCap,
    createdAt: attr.created_at,
    dexId: attr.dex?.id,
  };
}

function transformOHLCVData(response: GeckoOHLCVResponse): OHLCVData[] {
  return response.data.map((entry) => ({
    timestamp: entry[0],
    open: parseFloat(entry[1]),
    high: parseFloat(entry[2]),
    low: parseFloat(entry[3]),
    close: parseFloat(entry[4]),
    volume: parseFloat(entry[5]),
  }));
}

// =====================================================
// API Functions
// =====================================================

/**
 * Fetch top pools by 24h trading volume on Dogechain
 * @param limit Maximum number of pools to return (max 100)
 */
export async function getTopPoolsByVolume(limit: number = 20): Promise<GeckoPool[]> {
  try {
    // Check cache first
    if (cache.volumePools && Date.now() < cache.volumePools.expiry) {
      console.log("[geckoTerminalService] Returning cached top pools by volume");
      return cache.volumePools.data.slice(0, limit);
    }

    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=1&include=${encodeURIComponent("base_token,quote_token,dex")}`;

    const pools = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoPoolsResponse = await response.json();

      return data.data.map(transformPoolData);
    });

    // Sort by volume (if available)
    const sortedPools = pools
      .filter((p) => p.volume24hUsd !== undefined && p.volume24hUsd > 0)
      .sort((a, b) => (b.volume24hUsd || 0) - (a.volume24hUsd || 0))
      .slice(0, limit);

    // Update cache
    cache.volumePools = { data: sortedPools, expiry: Date.now() + TOP_POOLS_CACHE_TTL };

    return sortedPools;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch top pools by volume:", error);
    return [];
  }
}

/**
 * Fetch top pools by TVL on Dogechain
 * @param limit Maximum number of pools to return (max 100)
 */
export async function getTopPoolsByTVL(limit: number = 20): Promise<GeckoPool[]> {
  try {
    // Check cache first
    if (cache.topPools && Date.now() < cache.topPools.expiry) {
      console.log("[geckoTerminalService] Returning cached top pools by TVL");
      return cache.topPools.data.slice(0, limit);
    }

    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=1&include=${encodeURIComponent("base_token,quote_token,dex")}`;

    const pools = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoPoolsResponse = await response.json();

      return data.data.map(transformPoolData);
    });

    // Sort by TVL
    const sortedPools = pools
      .filter((p) => p.totalValueLockedUsd > 0)
      .sort((a, b) => b.totalValueLockedUsd - a.totalValueLockedUsd)
      .slice(0, limit);

    // Update cache
    cache.topPools = { data: sortedPools, expiry: Date.now() + TOP_POOLS_CACHE_TTL };

    return sortedPools;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch top pools by TVL:", error);
    return [];
  }
}

/**
 * Fetch new pools created recently on Dogechain
 * @param limit Maximum number of pools to return (max 100)
 */
export async function getNewPools(limit: number = 20): Promise<GeckoPool[]> {
  try {
    // Check cache first
    if (cache.newPools && Date.now() < cache.newPools.expiry) {
      console.log("[geckoTerminalService] Returning cached new pools");
      return cache.newPools.data.slice(0, limit);
    }

    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=1&include=${encodeURIComponent("base_token,quote_token,dex")}`;

    const pools = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoPoolsResponse = await response.json();

      return data.data.map(transformPoolData);
    });

    // Sort by creation date (newest first)
    const sortedPools = pools
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // Update cache
    cache.newPools = { data: sortedPools, expiry: Date.now() + NEW_POOLS_CACHE_TTL };

    return sortedPools;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch new pools:", error);
    return [];
  }
}

/**
 * Fetch OHLCV data for a specific pool
 * @param poolAddress The pool's address
 * @param timeframe Timeframe for OHLCV data (1m, 5m, 1h, 6h, 1d)
 * @param aggregate Number of time units to aggregate (default: varies by timeframe)
 * @param limit Number of data points to fetch (max 1000)
 */
export async function getPoolOHLCV(
  poolAddress: string,
  timeframe: "1m" | "5m" | "1h" | "6h" | "1d" = "1d",
  aggregate: number = 1,
  limit: number = 100
): Promise<OHLCVData[]> {
  try {
    const cacheKey = `ohlcv_${poolAddress}_${timeframe}_${aggregate}`;
    const cached = getFromCache<OHLCVData[]>(cache.ohlcv, cacheKey);
    if (cached) {
      console.log("[geckoTerminalService] Returning cached OHLCV data");
      return cached;
    }

    const timeframeToAggregate: Record<string, number> = {
      "1m": 1,
      "5m": 5,
      "1h": 60,
      "6h": 360,
      "1d": 1440,
    };

    const aggregateMinutes = aggregate * (timeframeToAggregate[timeframe] ?? 1440);
    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools/${poolAddress}/ohlcv?timeframe=${timeframe}&aggregate=${aggregateMinutes}&limit=${limit}`;

    const ohlcvData = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoOHLCVResponse = await response.json();

      return transformOHLCVData(data);
    });

    // Update cache
    setCache(cache.ohlcv, ohlcvData, cacheKey, OHLCV_CACHE_TTL);

    return ohlcvData;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch OHLCV data:", error);
    return [];
  }
}

/**
 * Fetch detailed information for a specific pool
 * @param poolAddress The pool's address
 */
export async function getPoolDetails(poolAddress: string): Promise<GeckoPool | null> {
  try {
    const cacheKey = `pool_${poolAddress}`;
    const cached = getFromCache<GeckoPool>(cache.pools, cacheKey);
    if (cached) {
      console.log("[geckoTerminalService] Returning cached pool details");
      return cached;
    }

    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools/${poolAddress}?include=${encodeURIComponent("base_token,quote_token,dex")}`;

    const pool = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoPoolResponse = await response.json();

      return transformPoolData(data);
    });

    // Update cache
    setCache(cache.pools, pool, cacheKey, POOL_CACHE_TTL);

    return pool;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch pool details:", error);
    return null;
  }
}

/**
 * Fetch details for multiple pools in batch
 * @param poolAddresses Array of pool addresses
 */
export async function getMultiplePools(poolAddresses: string[]): Promise<GeckoPool[]> {
  try {
    const batchSize = 10;
    const results: GeckoPool[] = [];

    for (let i = 0; i < poolAddresses.length; i += batchSize) {
      const batch = poolAddresses.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((address) => getPoolDetails(address)));
      results.push(...(batchResults.filter((p) => p !== null) as GeckoPool[]));
    }

    return results;
  } catch (error) {
    console.error("[geckoTerminalService] Failed to fetch multiple pools:", error);
    return [];
  }
}

/**
 * Search for pools by token address or symbol
 * @param query Token address or symbol to search for
 * @param limit Maximum number of results
 */
export async function searchPools(query: string, limit: number = 20): Promise<GeckoPool[]> {
  try {
    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools/search?query=${encodeURIComponent(query)}&include=${encodeURIComponent("base_token,quote_token,dex")}`;

    const pools = await rateLimiter.execute(async () => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data: GeckoPoolsResponse = await response.json();

      return data.data.map(transformPoolData);
    });

    return pools.slice(0, limit);
  } catch (error) {
    console.error("[geckoTerminalService] Failed to search pools:", error);
    return [];
  }
}

/**
 * Clear all caches (useful for testing or forced refresh)
 */
export function clearCache(): void {
  cache.pools.clear();
  cache.ohlcv.clear();
  cache.newPools = null;
  cache.topPools = null;
  console.log("[geckoTerminalService] Cache cleared");
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    poolsCacheSize: cache.pools.size,
    ohlcvCacheSize: cache.ohlcv.size,
    newPoolsCached: cache.newPools !== null,
    topPoolsCached: cache.topPools !== null,
  };
}
