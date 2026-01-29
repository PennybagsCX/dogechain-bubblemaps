/**
 * GeckoTerminal API Client
 *
 * Direct API client for fetching DEX analytics data from GeckoTerminal.
 * This is used by the frontend to bypass the need for a backend API.
 */

const GECKO_TERMINAL_API = "https://api.geckoterminal.com/api/v2";
const DOGECHAIN_NETWORK = "dogechain";

// =====================================================
// Type Definitions
// =====================================================

export interface PoolStats {
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

export interface FactoryStats {
  name: string;
  poolCount: number;
  totalTVL: number;
}

export interface ChainMetrics {
  chainName: string;
  totalTVL: number;
  dexVolume24h: number;
  dexVolume7d: number;
  activePools: number;
  dailyUsers: number;
}

export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface GeckoPoolResponse {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    total_value_locked_usd?: string;
    reserve_usd?: string;
    reserve_in_usd?: string;
    volume_usd?: Record<string, string | null>;
    fdv_usd?: string;
    market_cap_usd?: string;
    price_change_percentage?: Record<string, string | null>;
    pool_created_at?: string;
    pool_name?: string;
  };
  relationships?: {
    base_token: {
      data: {
        id: string;
        type: string;
      };
    };
    quote_token: {
      data: {
        id: string;
        type: string;
      };
    };
    dex?: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

// =====================================================
// Cache
// =====================================================

const cache = {
  tvl: null as { data: PoolStats[]; timestamp: number } | null,
  new: null as { data: PoolStats[]; timestamp: number } | null,
  factory: null as { data: FactoryStats[]; timestamp: number } | null,
  volume: null as { data: PoolStats[]; timestamp: number } | null,
  chain: null as { data: ChainMetrics; timestamp: number } | null,
  ohlcv: new Map<string, { data: OHLCVData[]; timestamp: number }>(),
};

const CACHE_TTL = 300000; // 5 minutes
const OHLCV_CACHE_TTL = 60000; // 1 minute

// =====================================================
// API Functions
// ===================================================

// Helper function to extract token symbols from pool name
// Pool name format: "TOKEN0 / TOKEN1 fee%" or "TOKEN0 / TOKEN1"
function parseTokenSymbols(poolName: string): { token0Symbol: string; token1Symbol: string } {
  // Remove fee percentage if present (e.g., " 0.017%")
  const withoutFee = poolName.split(/\s+\d+\.\d+%?$/)[0] || poolName;
  // Split by " / " to get token symbols
  const parts = withoutFee.split(/\s*\/\s*/);
  return {
    token0Symbol: parts[0]?.trim() || "UNKNOWN",
    token1Symbol: parts[1]?.trim() || "UNKNOWN",
  };
}

// Helper function to extract address from GeckoTerminal token ID
// Format: "dogechain_0x..." -> "0x..."
function extractAddressFromId(id: string): string {
  return id.split("_")[1]?.toLowerCase() || "0x0";
}

// Helper function to get DEX name from relationship ID
function parseDexName(dexId?: string): string {
  if (!dexId) return "Unknown";
  // Format: "quickswap_dogechain" -> "QuickSwap"
  const name = dexId.split("_")[0];
  if (!name) return "Unknown";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function fetchTopPoolsByVolumeFromGecko(limit: number = 20): Promise<PoolStats[]> {
  try {
    // Fetch multiple pages to get more pools
    // GeckoTerminal returns ~20 pools per page, so we fetch enough pages
    const maxPages = Math.ceil((limit * 3) / 20); // Fetch 3x more than needed
    const allPools: PoolStats[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=${page}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        break; // No more data
      }

      if (data.data.length === 0) {
        break; // Empty page, stop fetching
      }

      // Process pools from this page
      const pagePools = data.data
        .filter((pool: GeckoPoolResponse) => pool && pool.attributes && pool.attributes.address)
        .map((pool: GeckoPoolResponse) => {
          const attr = pool.attributes;
          const rels = pool.relationships;

          // Parse token symbols from pool name
          const poolName = attr.name || attr.pool_name || "";
          const { token0Symbol, token1Symbol } = parseTokenSymbols(poolName);

          // Extract addresses from relationship IDs
          const token0Address = rels?.base_token?.data?.id
            ? extractAddressFromId(rels.base_token.data.id)
            : "0x0";
          const token1Address = rels?.quote_token?.data?.id
            ? extractAddressFromId(rels.quote_token.data.id)
            : "0x0";

          // Parse DEX name from relationship
          const dexName = rels?.dex?.data?.id ? parseDexName(rels.dex.data.id) : "Unknown";

          const volume24h = attr.volume_usd?.["h24"] ? parseFloat(attr.volume_usd["h24"]) : 0;
          const priceChange24h = attr.price_change_percentage?.["h24"]
            ? parseFloat(attr.price_change_percentage["h24"])
            : 0;
          const marketCap = attr.fdv_usd
            ? parseFloat(attr.fdv_usd)
            : attr.market_cap_usd
              ? parseFloat(attr.market_cap_usd)
              : 0;

          return {
            address: attr.address.toLowerCase(),
            token0: {
              address: token0Address,
              symbol: token0Symbol,
              decimals: 18, // Default to 18 as we don't have this info
            },
            token1: {
              address: token1Address,
              symbol: token1Symbol,
              decimals: 18,
            },
            factory: dexName,
            reserve0: attr.reserve_in_usd || attr.reserve_usd || "0",
            reserve1: "0",
            tvlUsd: parseFloat(attr.reserve_in_usd || attr.reserve_usd || "0"),
            lpTokenSupply: "0",
            createdAt: attr.pool_created_at ? new Date(attr.pool_created_at).getTime() : Date.now(),
            pairAge: attr.pool_created_at
              ? Date.now() - new Date(attr.pool_created_at).getTime()
              : 0,
            volume24h,
            priceChange24h,
            marketCap,
          };
        });

      allPools.push(...pagePools);

      // If we have enough pools, stop fetching
      if (allPools.length >= limit * 3) {
        break;
      }
    }

    // Remove duplicates (by address) and return sorted
    const uniquePools = Array.from(new Map(allPools.map((p) => [p.address, p])).values());

    return uniquePools
      .filter((p: PoolStats) => p.volume24h !== undefined && p.volume24h > 0)
      .sort((a: PoolStats, b: PoolStats) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, limit);
  } catch (error) {
    console.error("[GeckoTerminal] Failed to fetch volume pools:", error);
    return [];
  }
}

async function fetchTopPoolsByTVLFromGecko(limit: number = 20): Promise<PoolStats[]> {
  try {
    // Fetch multiple pages to get more pools
    const maxPages = Math.ceil((limit * 3) / 20);
    const allPools: PoolStats[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=${page}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        break; // No more data
      }

      if (data.data.length === 0) {
        break; // Empty page, stop fetching
      }

      // Process pools from this page
      const pagePools = data.data
        .filter((pool: GeckoPoolResponse) => pool && pool.attributes && pool.attributes.address)
        .map((pool: GeckoPoolResponse) => {
          const attr = pool.attributes;
          const rels = pool.relationships;

          // Parse token symbols from pool name
          const poolName = attr.name || attr.pool_name || "";
          const { token0Symbol, token1Symbol } = parseTokenSymbols(poolName);

          // Extract addresses from relationship IDs
          const token0Address = rels?.base_token?.data?.id
            ? extractAddressFromId(rels.base_token.data.id)
            : "0x0";
          const token1Address = rels?.quote_token?.data?.id
            ? extractAddressFromId(rels.quote_token.data.id)
            : "0x0";

          // Parse DEX name from relationship
          const dexName = rels?.dex?.data?.id ? parseDexName(rels.dex.data.id) : "Unknown";

          const volume24h = attr.volume_usd?.["h24"] ? parseFloat(attr.volume_usd["h24"]) : 0;
          const priceChange24h = attr.price_change_percentage?.["h24"]
            ? parseFloat(attr.price_change_percentage["h24"])
            : 0;
          const marketCap = attr.fdv_usd
            ? parseFloat(attr.fdv_usd)
            : attr.market_cap_usd
              ? parseFloat(attr.market_cap_usd)
              : 0;

          return {
            address: attr.address.toLowerCase(),
            token0: {
              address: token0Address,
              symbol: token0Symbol,
              decimals: 18,
            },
            token1: {
              address: token1Address,
              symbol: token1Symbol,
              decimals: 18,
            },
            factory: dexName,
            reserve0: attr.reserve_in_usd || attr.reserve_usd || "0",
            reserve1: "0",
            tvlUsd: parseFloat(attr.reserve_in_usd || attr.reserve_usd || "0"),
            lpTokenSupply: "0",
            createdAt: attr.pool_created_at ? new Date(attr.pool_created_at).getTime() : Date.now(),
            pairAge: attr.pool_created_at
              ? Date.now() - new Date(attr.pool_created_at).getTime()
              : 0,
            volume24h,
            priceChange24h,
            marketCap,
          };
        });

      allPools.push(...pagePools);

      // If we have enough pools, stop fetching
      if (allPools.length >= limit * 3) {
        break;
      }
    }

    // Remove duplicates (by address) and return sorted
    const uniquePools = Array.from(new Map(allPools.map((p) => [p.address, p])).values());

    return uniquePools
      .filter((p: PoolStats) => p.tvlUsd > 0)
      .sort((a: PoolStats, b: PoolStats) => b.tvlUsd - a.tvlUsd)
      .slice(0, limit);
  } catch (error) {
    console.error("[GeckoTerminal] Failed to fetch TVL pools:", error);
    return [];
  }
}

async function fetchNewPoolsFromGecko(limit: number = 20): Promise<PoolStats[]> {
  try {
    // Fetch multiple pages to get more pools
    const maxPages = Math.ceil((limit * 3) / 20);
    const allPools: PoolStats[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=${page}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GeckoTerminal API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        break; // No more data
      }

      if (data.data.length === 0) {
        break; // Empty page, stop fetching
      }

      // Process pools from this page
      const pagePools = data.data
        .filter((pool: GeckoPoolResponse) => pool && pool.attributes && pool.attributes.address)
        .map((pool: GeckoPoolResponse) => {
          const attr = pool.attributes;
          const rels = pool.relationships;

          // Parse token symbols from pool name
          const poolName = attr.name || attr.pool_name || "";
          const { token0Symbol, token1Symbol } = parseTokenSymbols(poolName);

          // Extract addresses from relationship IDs
          const token0Address = rels?.base_token?.data?.id
            ? extractAddressFromId(rels.base_token.data.id)
            : "0x0";
          const token1Address = rels?.quote_token?.data?.id
            ? extractAddressFromId(rels.quote_token.data.id)
            : "0x0";

          // Parse DEX name from relationship
          const dexName = rels?.dex?.data?.id ? parseDexName(rels.dex.data.id) : "Unknown";

          const volume24h = attr.volume_usd?.["h24"] ? parseFloat(attr.volume_usd["h24"]) : 0;
          const priceChange24h = attr.price_change_percentage?.["h24"]
            ? parseFloat(attr.price_change_percentage["h24"])
            : 0;
          const marketCap = attr.fdv_usd
            ? parseFloat(attr.fdv_usd)
            : attr.market_cap_usd
              ? parseFloat(attr.market_cap_usd)
              : 0;

          return {
            address: attr.address.toLowerCase(),
            token0: {
              address: token0Address,
              symbol: token0Symbol,
              decimals: 18,
            },
            token1: {
              address: token1Address,
              symbol: token1Symbol,
              decimals: 18,
            },
            factory: dexName,
            reserve0: attr.reserve_in_usd || attr.reserve_usd || "0",
            reserve1: "0",
            tvlUsd: parseFloat(attr.reserve_in_usd || attr.reserve_usd || "0"),
            lpTokenSupply: "0",
            createdAt: attr.pool_created_at ? new Date(attr.pool_created_at).getTime() : Date.now(),
            pairAge: attr.pool_created_at
              ? Date.now() - new Date(attr.pool_created_at).getTime()
              : 0,
            volume24h,
            priceChange24h,
            marketCap,
          };
        });

      allPools.push(...pagePools);

      // If we have enough pools, stop fetching
      if (allPools.length >= limit * 3) {
        break;
      }
    }

    // Remove duplicates (by address) and return sorted by creation date
    const uniquePools = Array.from(new Map(allPools.map((p) => [p.address, p])).values());

    return uniquePools
      .sort((a: PoolStats, b: PoolStats) => b.createdAt - a.createdAt)
      .slice(0, limit);
  } catch (error) {
    console.error("[GeckoTerminal] Failed to fetch new pools:", error);
    return [];
  }
}

async function fetchOHLCVFromGecko(
  poolAddress: string,
  timeframe: string = "1d"
): Promise<OHLCVData[]> {
  try {
    const timeframeToAggregate: Record<string, number> = {
      "15m": 15,
      "1h": 60,
      "4h": 240,
      "6h": 360,
      "1d": 1440,
      "1w": 10080,
      "1m": 43200, // 30 days
    };

    const aggregateMinutes = timeframeToAggregate[timeframe] ?? 1440;
    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools/${poolAddress}/ohlcv?timeframe=${timeframe}&aggregate=${aggregateMinutes}&limit=100`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`GeckoTerminal API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((entry: number[]) => ({
      timestamp: entry[0] ?? 0,
      open: parseFloat(String(entry[1] ?? "0")),
      high: parseFloat(String(entry[2] ?? "0")),
      low: parseFloat(String(entry[3] ?? "0")),
      close: parseFloat(String(entry[4] ?? "0")),
      volume: parseFloat(String(entry[5] ?? "0")),
    }));
  } catch (error) {
    console.error("[GeckoTerminal] Failed to fetch OHLCV:", error);
    return [];
  }
}

async function fetchFactoryDistributionFromGecko(): Promise<FactoryStats[]> {
  try {
    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=1`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    // Group by DEX
    const factoryMap = new Map<string, { count: number; totalTVL: number }>();

    for (const pool of data.data) {
      const dexName = pool.attributes.dex?.name || "Unknown";
      const tvl = parseFloat(pool.attributes.reserve_in_usd || "0");

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
    console.error("[GeckoTerminal] Failed to fetch factory distribution:", error);
    return [];
  }
}

async function fetchChainMetricsFromGecko(): Promise<ChainMetrics | null> {
  try {
    const url = `${GECKO_TERMINAL_API}/networks/${DOGECHAIN_NETWORK}/pools?page=1`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return null;
    }

    const pools = data.data;
    const totalTVL = pools.reduce(
      (sum: number, p: GeckoPoolResponse) => sum + parseFloat(p.attributes.reserve_in_usd || "0"),
      0
    );
    const totalVolume24h = pools.reduce(
      (sum: number, p: GeckoPoolResponse) =>
        sum + parseFloat(p.attributes.volume_usd?.["h24"] || "0"),
      0
    );

    return {
      chainName: "dogechain",
      totalTVL,
      dexVolume24h: totalVolume24h,
      dexVolume7d: totalVolume24h * 7, // Estimate
      activePools: pools.length,
      dailyUsers: 0, // Not available from GeckoTerminal
    };
  } catch (error) {
    console.error("[GeckoTerminal] Failed to fetch chain metrics:", error);
    return null;
  }
}

// =====================================================
// Public API
// ===================================================

export async function getTopPoolsByVolume(limit: number = 20): Promise<PoolStats[]> {
  if (cache.volume && Date.now() - cache.volume.timestamp < CACHE_TTL) {
    return cache.volume.data.slice(0, limit);
  }

  const pools = await fetchTopPoolsByVolumeFromGecko(limit);
  cache.volume = { data: pools, timestamp: Date.now() };
  return pools;
}

export async function getTopPoolsByTVL(limit: number = 20): Promise<PoolStats[]> {
  if (cache.tvl && Date.now() - cache.tvl.timestamp < CACHE_TTL) {
    return cache.tvl.data.slice(0, limit);
  }

  const pools = await fetchTopPoolsByTVLFromGecko(limit);
  cache.tvl = { data: pools, timestamp: Date.now() };
  return pools;
}

export async function getNewPools(limit: number = 20): Promise<PoolStats[]> {
  if (cache.new && Date.now() - cache.new.timestamp < CACHE_TTL) {
    return cache.new.data.slice(0, limit);
  }

  const pools = await fetchNewPoolsFromGecko(limit);
  cache.new = { data: pools, timestamp: Date.now() };
  return pools;
}

export async function getFactoryDistribution(): Promise<FactoryStats[]> {
  if (cache.factory && Date.now() - cache.factory.timestamp < CACHE_TTL) {
    return cache.factory.data;
  }

  const factories = await fetchFactoryDistributionFromGecko();
  cache.factory = { data: factories, timestamp: Date.now() };
  return factories;
}

export async function getOHLCV(
  poolAddress: string,
  timeframe: "15m" | "1h" | "4h" | "6h" | "1d" | "1w" | "1m" = "1d"
): Promise<OHLCVData[]> {
  const cacheKey = `${poolAddress}_${timeframe}`;
  const cached = cache.ohlcv.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < OHLCV_CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchOHLCVFromGecko(poolAddress, timeframe);
  cache.ohlcv.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function getChainMetrics(): Promise<ChainMetrics | null> {
  if (cache.chain && Date.now() - cache.chain.timestamp < CACHE_TTL) {
    return cache.chain.data;
  }

  const metrics = await fetchChainMetricsFromGecko();
  if (metrics) {
    cache.chain = { data: metrics, timestamp: Date.now() };
  }
  return metrics;
}

export function clearCache(): void {
  cache.tvl = null;
  cache.new = null;
  cache.factory = null;
  cache.volume = null;
  cache.chain = null;
  cache.ohlcv.clear();
}
