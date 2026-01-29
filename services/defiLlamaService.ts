/**
 * DefiLlama API Service
 *
 * Fetches chain-level TVL, historical data, and protocol rankings from DefiLlama.
 * API Documentation: https://api-docs.defillama.com/
 *
 * Free tier: No authentication required, ~1 req/sec rate limit
 */

const DEFILLAMA_API = "https://api.llama.fi";

// =====================================================
// Type Definitions
// =====================================================

export interface DefiLlamaChain {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string | null;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  address: string | null;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  gecko_id: string | null;
  cmcId: string | null;
  tags: string[];
  chains: string[];
  module: string;
  twitter: string | null;
  forkedFromIds: number[];
  listedAt: number;
  deadUrl: boolean;
  category: string;
  misrepresentedTokens: boolean;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  tokenBreakdowns: Record<string, unknown>;
  mcap: number | null;
}

export interface DefiLlamaHistoricalTVL {
  date: number;
  tvl: number;
  totalLiquidityUSD?: number; // Alias for compatibility
}

export interface ChainMetricsEnhanced {
  chainName: string;
  totalTVL: number;
  dexVolume24h: number;
  dexVolume7d: number;
  activePools: number;
  dailyUsers: number;
  historicalTVL?: DefiLlamaHistoricalTVL[];
  protocols?: DefiLlamaProtocol[];
  tvlChange1h?: number;
  tvlChange1d?: number;
  tvlChange7d?: number;
}

// =====================================================
// Cache
// =====================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = {
  chains: null as CacheEntry<DefiLlamaChain[]> | null,
  protocols: null as CacheEntry<DefiLlamaProtocol[]> | null,
  historicalTVL: new Map<string, CacheEntry<DefiLlamaHistoricalTVL[]>>(),
  chainMetrics: new Map<string, CacheEntry<ChainMetricsEnhanced>>(),
};

const CHAINS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const PROTOCOLS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const HISTORICAL_TTL = 5 * 60 * 1000; // 5 minutes
const CHAIN_METRICS_TTL = 5 * 60 * 1000; // 5 minutes

// =====================================================
// API Functions
// =====================================================

/**
 * Get all chains supported by DefiLlama
 */
export async function getAllChains(): Promise<DefiLlamaChain[]> {
  try {
    // Check cache
    if (cache.chains && Date.now() < cache.chains.expiry) {
      return cache.chains.data;
    }

    const response = await fetch(`${DEFILLAMA_API}/chains`);

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = (await response.json()) as DefiLlamaChain[];

    // Cache the result
    cache.chains = {
      data,
      expiry: Date.now() + CHAINS_CACHE_TTL,
    };

    return data;
  } catch (error) {
    console.error("[defiLlamaService] Failed to fetch chains:", error);
    return [];
  }
}

/**
 * Get chain info by name
 */
export async function getChainInfo(chainName: string): Promise<DefiLlamaChain | null> {
  try {
    const chains = await getAllChains();
    return (
      chains.find(
        (c) =>
          c.name.toLowerCase() === chainName.toLowerCase() ||
          c.gecko_id?.toLowerCase() === chainName.toLowerCase()
      ) || null
    );
  } catch (error) {
    console.error("[defiLlamaService] Failed to get chain info:", error);
    return null;
  }
}

/**
 * Get all protocols
 */
export async function getAllProtocols(): Promise<DefiLlamaProtocol[]> {
  try {
    // Check cache
    if (cache.protocols && Date.now() < cache.protocols.expiry) {
      return cache.protocols.data;
    }

    const response = await fetch(`${DEFILLAMA_API}/protocols`);

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = (await response.json()) as DefiLlamaProtocol[];

    // Cache the result
    cache.protocols = {
      data,
      expiry: Date.now() + PROTOCOLS_CACHE_TTL,
    };

    return data;
  } catch (error) {
    console.error("[defiLlamaService] Failed to fetch protocols:", error);
    return [];
  }
}

/**
 * Get protocols for a specific chain
 */
export async function getChainProtocols(chainName: string): Promise<DefiLlamaProtocol[]> {
  try {
    const protocols = await getAllProtocols();
    const chainNameLower = chainName.toLowerCase();

    return protocols.filter(
      (p) =>
        (p.chain && p.chain.toLowerCase() === chainNameLower) ||
        (p.chains && p.chains.some((c) => c && c.toLowerCase() === chainNameLower))
    );
  } catch (error) {
    console.error("[defiLlamaService] Failed to fetch chain protocols:", error);
    return [];
  }
}

/**
 * Get historical TVL for a chain
 * @param chainName Chain name (e.g., "Dogechain")
 * @param timeframe Timeframe in days (default: 30)
 */
export async function getHistoricalChainTVL(
  chainName: string,
  timeframe: number = 30
): Promise<DefiLlamaHistoricalTVL[]> {
  try {
    const cacheKey = `${chainName}_${timeframe}`;
    const cached = cache.historicalTVL.get(cacheKey);

    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Use the correct endpoint format for historical chain TVL
    const response = await fetch(
      `${DEFILLAMA_API}/v2/historicalChainTvl?chain=${encodeURIComponent(chainName)}`
    );

    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.status}`);
    }

    const data = (await response.json()) as DefiLlamaHistoricalTVL[];

    // Filter to only get data within the requested timeframe
    const cutoffTimestamp = Date.now() / 1000 - timeframe * 24 * 60 * 60;
    const filteredData = data.filter((d) => d.date >= cutoffTimestamp);

    // Cache the result
    cache.historicalTVL.set(cacheKey, {
      data: filteredData,
      expiry: Date.now() + HISTORICAL_TTL,
    });

    return filteredData;

    // Cache the result
    cache.historicalTVL.set(cacheKey, {
      data,
      expiry: Date.now() + HISTORICAL_TTL,
    });

    return data;
  } catch (error) {
    console.error("[defiLlamaService] Failed to fetch historical TVL:", error);
    return [];
  }
}

/**
 * Get enhanced chain metrics with DefiLlama data
 */
export async function getEnhancedChainMetrics(
  chainName: string = "Dogechain"
): Promise<ChainMetricsEnhanced | null> {
  try {
    const cacheKey = chainName.toLowerCase();
    const cached = cache.chainMetrics.get(cacheKey);

    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Fetch chain info, protocols, and historical TVL in parallel
    const [chainInfo, protocols, historicalTVL] = await Promise.all([
      getChainInfo(chainName),
      getChainProtocols(chainName),
      getHistoricalChainTVL(chainName, 7), // 7 days of historical data
    ]);

    if (!chainInfo) {
      return null;
    }

    // Calculate TVL changes from historical data
    const latestTVL =
      historicalTVL.length > 0
        ? historicalTVL[historicalTVL.length - 1]?.totalLiquidityUSD || 0
        : chainInfo.tvl;

    const tvlChange1d =
      historicalTVL.length > 24
        ? ((latestTVL -
            (historicalTVL[historicalTVL.length - 25]?.totalLiquidityUSD || latestTVL)) /
            (historicalTVL[historicalTVL.length - 25]?.totalLiquidityUSD || 1)) *
          100
        : 0;

    const tvlChange7d =
      historicalTVL.length > 0
        ? ((latestTVL - (historicalTVL[0]?.totalLiquidityUSD || latestTVL)) /
            (historicalTVL[0]?.totalLiquidityUSD || 1)) *
          100
        : 0;

    const metrics: ChainMetricsEnhanced = {
      chainName,
      totalTVL: latestTVL,
      dexVolume24h: protocols.reduce((sum, p) => sum + (p.change_1d > 0 ? p.tvl * 0.01 : 0), 0), // Estimate
      dexVolume7d: protocols.reduce((sum, p) => sum + (p.change_7d > 0 ? p.tvl * 0.05 : 0), 0), // Estimate
      activePools: protocols.length,
      dailyUsers: 0, // Not available from DefiLlama
      historicalTVL,
      protocols: protocols.sort((a, b) => b.tvl - a.tvl).slice(0, 20), // Top 20 protocols
      tvlChange1h: 0, // Not available from this endpoint
      tvlChange1d,
      tvlChange7d,
    };

    // Cache the result
    cache.chainMetrics.set(cacheKey, {
      data: metrics,
      expiry: Date.now() + CHAIN_METRICS_TTL,
    });

    return metrics;
  } catch (error) {
    console.error("[defiLlamaService] Failed to get enhanced chain metrics:", error);
    return null;
  }
}

/**
 * Get top DEXes by TVL for a chain
 */
export async function getTopDexesByTVL(
  chainName: string = "Dogechain",
  limit: number = 10
): Promise<DefiLlamaProtocol[]> {
  try {
    const protocols = await getChainProtocols(chainName);

    // Filter for DEX category and sort by TVL
    return protocols
      .filter((p) => p.category.toLowerCase() === "dexs")
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit);
  } catch (error) {
    console.error("[defiLlamaService] Failed to get top DEXes:", error);
    return [];
  }
}

/**
 * Clear all caches
 */
export function clearCache(): void {
  cache.chains = null;
  cache.protocols = null;
  cache.historicalTVL.clear();
  cache.chainMetrics.clear();
  console.log("[defiLlamaService] Cache cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    chainsCached: cache.chains !== null,
    protocolsCached: cache.protocols !== null,
    historicalTVLCacheSize: cache.historicalTVL.size,
    chainMetricsCacheSize: cache.chainMetrics.size,
  };
}
