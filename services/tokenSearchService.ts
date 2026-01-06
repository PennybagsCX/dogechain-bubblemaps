import { AssetType, SearchResult } from "../types";
import {
  loadAllLPPairs,
  loadDiscoveredContracts,
  saveTokenToSearchIndex,
  searchTokensLocally as dbSearchTokensLocally,
} from "./db";

const BLOCKSCOUT_API = "https://explorer.dogechain.dog/api";

/**
 * Debounce function to limit API calls
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Initialize token search index from existing databases
 * This should be called once on app startup to populate the search index
 */
export async function initializeTokenSearchIndex(): Promise<void> {
  try {
    console.log("[Token Search] Initializing search index...");

    // Check if index is already populated
    const { getAllTokenSearchIndex } = await import("./db");
    const existingIndex = await getAllTokenSearchIndex();

    if (existingIndex.length > 0) {
      console.log(`[Token Search] Index already populated with ${existingIndex.length} tokens`);
      return;
    }

    // 1. Index all tokens from LP pairs
    const lpPairs = await loadAllLPPairs();
    const lpTokens: any[] = [];

    for (const pair of lpPairs) {
      // Add token0
      lpTokens.push({
        address: pair.token0Address,
        name: `Token from ${pair.dexName}`,
        symbol: `TOKEN`,
        type: AssetType.TOKEN,
        source: "lp_pair",
        decimals: 18,
      });

      // Add token1
      lpTokens.push({
        address: pair.token1Address,
        name: `Token from ${pair.dexName}`,
        symbol: `TOKEN`,
        type: AssetType.TOKEN,
        source: "lp_pair",
        decimals: 18,
      });
    }

    // 2. Index discovered contracts
    const discoveredContracts = await loadDiscoveredContracts();
    const discoveredTokens = discoveredContracts.map((c) => ({
      address: c.contractAddress,
      name: c.name || "Unknown Token",
      symbol: c.symbol || "UNKNOWN",
      type: c.type === "NFT" ? AssetType.NFT : AssetType.TOKEN,
      source: "whale",
      decimals: c.type === "NFT" ? 0 : 18,
    }));

    // 3. Bulk save to search index
    const { bulkSaveTokensToSearchIndex } = await import("./db");
    await bulkSaveTokensToSearchIndex([...lpTokens, ...discoveredTokens]);

    console.log(`[Token Search] Indexed ${lpTokens.length + discoveredTokens.length} tokens`);
  } catch (error) {
    console.error("[Token Search] Failed to initialize search index:", error);
  }
}

/**
 * Search tokens locally (instant, offline-first)
 */
export async function searchTokensLocally(
  query: string,
  type: AssetType,
  limit: number = 10
): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const queryLower = query.toLowerCase();

    // Search LP pairs database
    const lpPairs = await loadAllLPPairs();
    const lpResults: SearchResult[] = [];

    for (const pair of lpPairs) {
      // Check token0
      if (pair.token0Address.toLowerCase().includes(queryLower)) {
        lpResults.push({
          address: pair.token0Address,
          name: `Token from ${pair.dexName}`,
          symbol: "TOKEN",
          type: AssetType.TOKEN,
          source: "local",
          decimals: 18,
        });
      }

      // Check token1
      if (pair.token1Address.toLowerCase().includes(queryLower)) {
        lpResults.push({
          address: pair.token1Address,
          name: `Token from ${pair.dexName}`,
          symbol: "TOKEN",
          type: AssetType.TOKEN,
          source: "local",
          decimals: 18,
        });
      }

      if (lpResults.length >= limit) break;
    }

    // Search discovered contracts
    const discoveredContracts = await loadDiscoveredContracts();
    const discoveredResults: SearchResult[] = discoveredContracts
      .filter((c) => {
        const matchesType =
          (type === AssetType.NFT && c.type === "NFT") ||
          (type === AssetType.TOKEN && c.type !== "NFT");
        const matchesQuery =
          c.contractAddress?.toLowerCase().includes(queryLower) ||
          c.symbol?.toLowerCase().includes(queryLower) ||
          c.name?.toLowerCase().includes(queryLower);

        return matchesType && matchesQuery;
      })
      .slice(0, limit)
      .map((c) => ({
        address: c.contractAddress,
        name: c.name || "Unknown Token",
        symbol: c.symbol || "UNKNOWN",
        type: c.type === "NFT" ? AssetType.NFT : AssetType.TOKEN,
        source: "local" as const,
        decimals: c.type === "NFT" ? 0 : 18,
      }));

    // Search token search index
    const dbResults = await dbSearchTokensLocally(query, type);
    const indexResults: SearchResult[] = dbResults.map((r) => ({
      address: r.address,
      name: r.name,
      symbol: r.symbol,
      type: r.type as AssetType,
      source: "local" as const,
      decimals: r.decimals,
    }));

    // Merge and deduplicate
    const allResults = [...lpResults, ...discoveredResults, ...indexResults];
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.address.toLowerCase(), r])).values()
    );

    return uniqueResults.slice(0, limit);
  } catch (error) {
    console.error("[Token Search] Local search failed:", error);
    return [];
  }
}

/**
 * Search tokens via Blockscout API
 * This is slower but can discover new tokens
 */
export async function searchTokensBlockscout(
  query: string,
  type: AssetType,
  limit: number = 10
): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  try {
    // Try V2 API
    const v2Url = `${BLOCKSCOUT_API}/v2/tokens?q=${encodeURIComponent(query)}`;

    const response = await fetch(v2Url);
    if (!response.ok) {
      console.warn("[Token Search] Blockscout API request failed:", response.status);
      return [];
    }

    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    // Filter by type and map to SearchResult
    const results: SearchResult[] = data.items
      .filter((item: any) => {
        // Determine type from token data
        const tokenType = item.type?.toString().toLowerCase() || "";
        const isNFT = tokenType.includes("721") || tokenType.includes("1155");
        const matchesType = type === AssetType.NFT ? isNFT : !isNFT;

        return matchesType;
      })
      .slice(0, limit)
      .map((item: any) => ({
        address: item.address || item.hash,
        name: item.name || "Unknown Token",
        symbol: item.symbol || "UNKNOWN",
        type: type,
        source: "remote" as const,
        decimals: item.decimals ? parseInt(item.decimals) : type === AssetType.NFT ? 0 : 18,
      }));

    // Auto-save to local cache for future searches
    for (const result of results) {
      await saveTokenToSearchIndex({
        address: result.address,
        name: result.name,
        symbol: result.symbol,
        type: result.type,
        source: "blockscout",
        decimals: result.decimals || (type === AssetType.NFT ? 0 : 18),
        indexedAt: Date.now(),
      });
    }

    return results;
  } catch (error) {
    console.error("[Token Search] Blockscout search failed:", error);
    return [];
  }
}

/**
 * Hybrid search: local + remote
 * Returns local results instantly, then fetches remote results
 */
export async function searchTokensHybrid(
  query: string,
  type: AssetType,
  options: {
    limit?: number;
    includeRemote?: boolean;
  } = {}
): Promise<{
  local: SearchResult[];
  remote: SearchResult[];
  all: SearchResult[];
}> {
  const { limit = 10, includeRemote = true } = options;

  // 1. Local search (instant)
  const localResults = await searchTokensLocally(query, type, limit);

  // 2. Remote search (async, only if needed)
  let remoteResults: SearchResult[] = [];
  if (includeRemote && localResults.length < limit) {
    remoteResults = await searchTokensBlockscout(query, type, limit - localResults.length);
  }

  // 3. Merge and deduplicate
  const allResultsMap = new Map<string, SearchResult>();

  // Add local results first (prioritize local)
  localResults.forEach((r) => {
    allResultsMap.set(r.address.toLowerCase(), r);
  });

  // Add remote results if not already present
  remoteResults.forEach((r) => {
    const key = r.address.toLowerCase();
    if (!allResultsMap.has(key)) {
      allResultsMap.set(key, { ...r, source: "remote" });
    }
  });

  const allResults = Array.from(allResultsMap.values()).slice(0, limit);

  return {
    local: localResults,
    remote: remoteResults,
    all: allResults,
  };
}

/**
 * Create debounced search function
 */
export function createDebouncedSearch(
  callback: (results: SearchResult[]) => void,
  delay: number = 300
) {
  return debounce(callback, delay);
}
