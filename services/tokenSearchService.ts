import { AssetType, SearchResult } from "../types";
import {
  loadAllLPPairs,
  loadDiscoveredContracts,
  saveTokenToSearchIndex,
  searchTokensLocally as dbSearchTokensLocally,
} from "./db";

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
    // Use the working endpoint: /tokens?type=JSON&query=SEARCH_TERM
    const apiUrl = `https://explorer.dogechain.dog/tokens?type=JSON&query=${encodeURIComponent(query)}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.warn("[Token Search] Blockscout API request failed:", response.status);
      return [];
    }

    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    // Parse HTML table rows to extract token data
    const results: SearchResult[] = [];

    for (const htmlRow of data.items) {
      try {
        // Extract token address from href="/token/0x..."
        const addressMatch = htmlRow.match(/href="\/token\/(0x[a-fA-F0-9]+)"/);
        if (!addressMatch) continue;

        const address = addressMatch[1];

        // Extract token name from <a href...>TOKEN_NAME</a>
        const nameMatch = htmlRow.match(/<a[^>]*>([^<]+)<\/a>/);
        const name = nameMatch ? nameMatch[1].trim() : "Unknown Token";

        // Extract symbol from table cells (usually in the 3rd column)
        const cells = htmlRow.match(/<td[^>]*>([^<]+)<\/td>/g);
        let symbol = "UNKNOWN";

        if (cells && cells.length >= 3) {
          // Third cell usually contains the symbol
          const symbolText = cells[2].replace(/<td[^>]*>|<\/td>/g, "").trim();
          if (symbolText) symbol = symbolText;
        }

        // For now, assume all are TOKEN type (NFT detection would need additional API call)
        const matchesType = type === AssetType.TOKEN;

        if (matchesType) {
          results.push({
            address: address,
            name: name,
            symbol: symbol,
            type: type,
            source: "remote" as const,
            decimals: 18, // Default to 18 for ERC20 tokens
          });

          // Auto-save to local cache
          await saveTokenToSearchIndex({
            address: address,
            name: name,
            symbol: symbol,
            type: type,
            source: "blockscout",
            decimals: 18,
            indexedAt: Date.now(),
          });
        }

        // Stop if we've reached the limit
        if (results.length >= limit) break;
      } catch (parseError) {
        // Skip rows that fail to parse
        console.warn("[Token Search] Failed to parse token row:", parseError);
        continue;
      }
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
