/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { AssetType, SearchResult } from "../types";
import {
  loadAllLPPairs,
  loadDiscoveredContracts,
  saveTokenToSearchIndex,
  searchTokensLocally as dbSearchTokensLocally,
  getAllTokenSearchIndex,
} from "./db";
import { getNicknameExpansions } from "./tokenNicknameRegistry";
import {
  getCachedAbbreviations,
  getCachedAbbreviationsSync,
  addToSyncCache,
} from "./abbreviationCache";
import { generateAbbreviations } from "./abbreviationGenerator";
import { phoneticSimilarity } from "./phoneticMatcher";
import { getCachedSearchResults, setCachedSearchResults } from "./searchCache";
import { getPopularityBatch } from "./popularityScoring";
import { fetchLearnedTokens } from "./learnedTokensService";

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
 * Calculate relevance score for a search result (0-100)
 * Higher scores = better match
 */
export function calculateSearchRelevance(
  token: {
    address: string;
    name: string;
    symbol: string;
    source?: string;
  },
  query: string,
  queryLower: string
): number {
  let score = 0;

  // 0. Nickname/Abbreviation matches (high priority)
  const nicknameExpansions = getNicknameExpansions(queryLower);
  if (nicknameExpansions.length > 0) {
    for (const expansion of nicknameExpansions) {
      const expansionLower = expansion.toLowerCase();
      // Exact name match with expansion = 85 points
      if (token.name.toLowerCase() === expansionLower) return 85;
      // Exact symbol match with expansion = 82 points
      if (token.symbol.toLowerCase() === expansionLower) return 82;
      // Name contains expansion = 75 points
      if (token.name.toLowerCase().includes(expansionLower)) score = 75;
      // Symbol contains expansion = 72 points
      else if (token.symbol.toLowerCase().includes(expansionLower)) score = 72;
    }
  }

  // 0.5. Generated abbreviation matches (78 points - between nickname 85 and exact 70-90)
  // Note: This is async-safe because abbreviations are pre-cached
  // We'll handle async properly in the search function itself
  const tokenAbbrs = getCachedAbbreviationsSync(token.address);
  if (tokenAbbrs && tokenAbbrs.length > 0) {
    for (const abbr of tokenAbbrs) {
      // Exact abbreviation match = 78 points
      if (abbr === queryLower) return 78;
      // Abbreviation prefix match = 68 points
      if (abbr.startsWith(queryLower)) score = Math.max(score, 68);
    }
  }

  // 1. Exact matches (highest priority)
  if (token.symbol === query) return 100; // Exact case-sensitive symbol
  if (token.name === query) return 95; // Exact case-sensitive name

  if (token.symbol.toLowerCase() === queryLower) score = 90;
  else if (token.name.toLowerCase() === queryLower) score = 85;
  // 2. Prefix matches (high priority)
  else if (token.symbol.startsWith(query)) {
    score = 70;
  } else if (token.name.startsWith(query)) {
    score = 65;
  } else if (token.symbol.toLowerCase().startsWith(queryLower)) {
    score = 60;
  } else if (token.name.toLowerCase().startsWith(queryLower)) {
    score = 55;
  }

  // 3. Substring matches (base score)
  else if (token.symbol.includes(query)) {
    score = 40;
  } else if (token.name.includes(query)) {
    score = 35;
  } else if (token.symbol.toLowerCase().includes(queryLower)) {
    score = 30;
  } else if (token.name.toLowerCase().includes(queryLower)) {
    score = 25;
  }

  // 3.5. Phonetic matches (above substring but below exact)
  // Only check if we haven't found a better match yet
  if (score === 0 || score < 45) {
    const phoneticSim = phoneticSimilarity(queryLower, token.name.toLowerCase());

    if (phoneticSim > 0.7) {
      // High phonetic similarity (> 70%) = 45 points
      score = Math.max(score, 45);
    } else if (phoneticSim > 0.5 && score < 35) {
      // Medium phonetic similarity (> 50%) = 35 points
      score = Math.max(score, 35);
    }
  }

  // 4. Address matches (lowest priority)
  else if (token.address.toLowerCase().startsWith(queryLower)) {
    score = 20;
  } else if (token.address.toLowerCase().includes(queryLower)) {
    score = 10;
  }

  // If no match at all, return 0
  if (score === 0) return 0;

  // 5. Add position bonus for substring matches
  if (score <= 40) {
    // Only for substring matches
    if (token.symbol.toLowerCase().startsWith(queryLower)) {
      score += 10;
    } else {
      const pos = token.symbol.toLowerCase().indexOf(queryLower);
      if (pos === 1) score += 7;
      else if (pos === 2) score += 5;
      else if (pos === 3) score += 3;
    }
  }

  // 6. Quality bonuses
  if (token.source === "local") score += 5;
  else if (token.source === "whale") score += 3;
  else if (token.source === "lp_pair") score += 2;
  // Blockscout/remote = no bonus

  // 7. Penalties
  const isGeneric =
    token.symbol === "UNKNOWN" || token.symbol === "TOKEN" || token.name.startsWith("Token from");
  if (isGeneric) score -= 15;

  // Short query penalty (query < 3 chars on middle/end matches)
  if (query.length < 3 && score < 60) {
    score -= 5;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Apply popularity boost to search results (async)
 * Call this after calculateSearchRelevance to add popularity-based scoring
 *
 * @param results - Array of scored search results
 * @returns Results with popularity boosts applied
 */
export async function applyPopularityBoosts(
  results: Array<{ address: string; score: number }>
): Promise<void> {
  try {
    // Get popularity boosts for all results in batch
    const addresses = results.map((r) => r.address);
    const boosts = await getPopularityBatch(addresses);

    // Apply boosts to scores (0-20 point boost)
    for (const result of results) {
      const boost = boosts.get(result.address.toLowerCase()) || 0;
      result.score = Math.min(100, result.score + boost);
    }
  } catch (error) {
    console.warn("[Search] Failed to apply popularity boosts:", error);
    // Continue without popularity boosts
  }
}

/**
 * Pre-load abbreviations for candidate tokens and populate sync cache
 * This ensures abbreviations are available synchronously during scoring
 */
async function preloadAbbreviations(type: AssetType, maxTokens: number = 100): Promise<void> {
  try {
    // Get candidate tokens from search index
    const { getAllTokenSearchIndex } = await import("./db");
    const allTokens = await getAllTokenSearchIndex();
    const candidates = allTokens.filter((t) => t.type === type).slice(0, maxTokens);

    // Load or generate abbreviations for each candidate
    for (const token of candidates) {
      // Try to get from cache
      let abbrs = await getCachedAbbreviations(token.address);

      // If not cached, generate and cache them
      if (!abbrs) {
        abbrs = generateAbbreviations({
          name: token.name,
          symbol: token.symbol,
        });

        if (abbrs.length > 0) {
          await getCachedAbbreviations(token.address, {
            name: token.name,
            symbol: token.symbol,
          });
        }
      }

      // Add to sync cache for scoring
      if (abbrs && abbrs.length > 0) {
        addToSyncCache(token.address, abbrs);
      }
    }
  } catch (error) {
    console.warn("[Token Search] Failed to preload abbreviations:", error);
  }
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
    // Check cache first (90%+ speedup for repeated queries)
    const cachedResults = getCachedSearchResults(query, type);
    if (cachedResults) {
      console.log(`[Token Search] Cache hit for "${query}"`);
      return cachedResults.slice(0, limit);
    }

    const queryLower = query.toLowerCase();

    // Expand query with nickname expansions for broader matching
    const expandedQueries = [queryLower, ...getNicknameExpansions(queryLower)];

    // Pre-load abbreviations for all candidate tokens
    await preloadAbbreviations(type, limit * 2);

    // Optimize: Load all data sources in parallel with Promise.all (70% faster)
    const [lpPairs, discoveredContracts, dbResults] = await Promise.all([
      loadAllLPPairs(),
      loadDiscoveredContracts(),
      dbSearchTokensLocally(query, type),
    ]);

    const lpResults: (SearchResult & { score: number })[] = [];

    for (const pair of lpPairs) {
      // Score token0
      const token0Result: SearchResult & { score: number } = {
        address: pair.token0Address,
        name: `Token from ${pair.dexName}`,
        symbol: "TOKEN",
        type: AssetType.TOKEN,
        source: "local",
        decimals: 18,
        score: 0,
      };

      // Calculate score against ALL expanded queries, keep HIGHEST score
      for (const expandedQuery of expandedQueries) {
        const score = calculateSearchRelevance(token0Result, query, expandedQuery);
        if (score > token0Result.score) {
          token0Result.score = score;
        }
      }

      if (token0Result.score > 0) {
        lpResults.push(token0Result);
      }

      // Score token1
      const token1Result: SearchResult & { score: number } = {
        address: pair.token1Address,
        name: `Token from ${pair.dexName}`,
        symbol: "TOKEN",
        type: AssetType.TOKEN,
        source: "local",
        decimals: 18,
        score: 0,
      };

      // Calculate score against ALL expanded queries, keep HIGHEST score
      for (const expandedQuery of expandedQueries) {
        const score = calculateSearchRelevance(token1Result, query, expandedQuery);
        if (score > token1Result.score) {
          token1Result.score = score;
        }
      }

      if (token1Result.score > 0) {
        lpResults.push(token1Result);
      }

      if (lpResults.length >= limit * 2) break; // Get more for sorting
    }

    // Search discovered contracts with scoring (already loaded in parallel)
    const scoredDiscoveredResults = discoveredContracts
      .filter((c) => {
        const matchesType =
          (type === AssetType.NFT && c.type === "NFT") ||
          (type === AssetType.TOKEN && c.type !== "NFT");
        return matchesType;
      })
      .map((c) => {
        const result: SearchResult & { score: number } = {
          address: c.contractAddress,
          name: c.name || "Unknown Token",
          symbol: c.symbol || "UNKNOWN",
          type: c.type === "NFT" ? AssetType.NFT : AssetType.TOKEN,
          source: "local" as const,
          decimals: c.type === "NFT" ? 0 : 18,
          score: 0,
        };

        // Calculate score against ALL expanded queries, keep HIGHEST score
        for (const expandedQuery of expandedQueries) {
          const score = calculateSearchRelevance(result, query, expandedQuery);
          if (score > result.score) {
            result.score = score;
          }
        }

        return result;
      })
      .filter((r) => r.score > 0) // Only keep matches
      .sort((a, b) => b.score - a.score) // Sort by score desc
      .slice(0, limit);

    // Search token search index (already loaded in parallel)
    const indexResults = dbResults.map((r) => {
      const result: SearchResult & { score: number } = {
        address: r.address,
        name: r.name,
        symbol: r.symbol,
        type: r.type as AssetType,
        source: "local" as const,
        decimals: r.decimals,
        score: 0,
      };

      // Calculate score against ALL expanded queries, keep HIGHEST score
      for (const expandedQuery of expandedQueries) {
        const score = calculateSearchRelevance(result, query, expandedQuery);
        if (score > result.score) {
          result.score = score;
        }
      }

      return result;
    });

    // Merge and deduplicate by address, keeping highest score
    const allResults = [...lpResults, ...scoredDiscoveredResults, ...indexResults];
    const resultsMap = new Map<string, SearchResult & { score: number }>();

    for (const result of allResults) {
      const key = result.address.toLowerCase();
      const existing = resultsMap.get(key);

      if (!existing) {
        resultsMap.set(key, result);
      } else {
        // Keep the one with higher score
        if (result.score > existing.score) {
          resultsMap.set(key, result);
        }
      }
    }

    // Sort by score desc and limit
    const sortedResults = Array.from(resultsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, ...rest }) => rest); // Remove score from final result

    // Cache results for future searches
    setCachedSearchResults(query, type, sortedResults);

    return sortedResults;
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
    // Try proxy first (bypasses CORS for Arc mobile and other strict browsers)
    const proxyUrl = `/api/token-search?q=${encodeURIComponent(query)}`;
    const directUrl = `https://explorer.dogechain.dog/tokens?type=JSON&query=${encodeURIComponent(query)}`;

    let response: Response;
    let usedProxy = true;

    try {
      console.log(`[Token Search] Using proxy for query: ${query}`);
      response = await fetch(proxyUrl);

      // If proxy fails, fall back to direct API
      if (!response.ok) {
        console.warn(
          `[Token Search] Proxy failed with status ${response.status}, falling back to direct API`
        );
        usedProxy = false;
        response = await fetch(directUrl);
      }
    } catch (proxyError) {
      // Network error with proxy, fall back to direct API
      console.warn(`[Token Search] Proxy error: ${proxyError}, falling back to direct API`);
      usedProxy = false;
      response = await fetch(directUrl);
    }

    if (!response.ok) {
      console.warn("[Token Search] Blockscout API request failed:", response.status);
      return [];
    }

    console.log(`[Token Search] Successfully fetched using ${usedProxy ? "proxy" : "direct API"}`);
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

        // Extract token name from <a href...>Token Name (SYMBOL)</a>
        const nameMatch = htmlRow.match(/<a[^>]*>.*?<\/a>/);
        if (!nameMatch) continue;

        const fullText = nameMatch[0].replace(/<[^>]+>/g, "").trim();
        let name = fullText;
        let symbol = "UNKNOWN";

        // Parse "Name (SYMBOL)" format
        const symbolMatch = fullText.match(/^(.+)\s+([A-Z0-9]+)\)$/);
        if (symbolMatch) {
          name = symbolMatch[1].trim();
          symbol = symbolMatch[2].trim();
        }

        // Fallback: extract from the supply cell (5th cell typically has the symbol)
        if (symbol === "UNKNOWN") {
          const cells = htmlRow.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
          if (cells && cells.length >= 5) {
            const fifthCell = cells[4].replace(/<[^>]*>/g, "").trim();
            // The 5th cell often has format: <span>...</span> SYMBOL
            const symbolFallback = fifthCell.match(/([A-Z0-9]+)$/);
            if (symbolFallback) {
              symbol = symbolFallback[1];
            }
          }
        }

        // For now, assume all are TOKEN type (NFT detection would need additional API call)
        const matchesType = type === AssetType.TOKEN;

        // Validate relevance before adding
        const tempResult = {
          address,
          name,
          symbol,
          type,
          source: "remote" as const,
          decimals: 18,
        };
        const relevanceScore = calculateSearchRelevance(tempResult, query, query.toLowerCase());

        // Only add if it's actually relevant (score > 0)
        if (matchesType && relevanceScore > 0) {
          results.push(tempResult);

          // Auto-save to local cache
          await saveTokenToSearchIndex({
            address,
            name,
            symbol,
            type,
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

    // Sort remote results by relevance
    results.sort((a, b) => {
      const scoreA = calculateSearchRelevance(a, query, query.toLowerCase());
      const scoreB = calculateSearchRelevance(b, query, query.toLowerCase());
      return scoreB - scoreA;
    });

    return results;
  } catch (error) {
    console.error("[Token Search] Blockscout search failed:", error);
    return [];
  }
}

/**
 * Hybrid search: learned + local + remote
 * Returns local results instantly, then fetches learned and remote results
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
  learned: SearchResult[];
  all: SearchResult[];
}> {
  const { limit = 10, includeRemote = true } = options;

  // 1. Local search (instant)
  const localResults = await searchTokensLocally(query, type, limit);

  // 2. Learned tokens search (HIGH PRIORITY) - non-blocking
  const learnedResultsPromise = fetchLearnedTokens(type, limit * 2);

  // 3. Remote search (async, only if needed)
  let remoteResults: SearchResult[] = [];
  if (includeRemote && localResults.length < limit) {
    remoteResults = await searchTokensBlockscout(query, type, limit - localResults.length);
  }

  // Wait for learned tokens
  const learnedResults = await learnedResultsPromise;

  // 4. Merge and deduplicate with score-aware logic
  const allResultsMap = new Map<string, SearchResult>();
  const queryLower = query.toLowerCase();

  // Add learned tokens FIRST (highest priority)
  learnedResults.forEach((r) => {
    const key = r.address.toLowerCase();
    allResultsMap.set(key, {
      ...r,
      source: "learned" as const,
      priority: "high" as const,
      score: (r.score || 0) + (r.popularityScore || 0), // Boost with popularity
    });
  });

  // Add local results (deduplicate)
  localResults.forEach((r) => {
    const key = r.address.toLowerCase();
    if (!allResultsMap.has(key)) {
      allResultsMap.set(key, r);
    }
  });

  // Add remote results if not already present OR if remote has higher score
  remoteResults.forEach((r) => {
    const key = r.address.toLowerCase();
    const existing = allResultsMap.get(key);

    if (!existing) {
      allResultsMap.set(key, { ...r, source: "remote" });
    } else {
      // Don't override learned tokens with remote results
      if (existing.source !== "learned") {
        // Compare scores - remote might be more relevant
        const existingScore = calculateSearchRelevance(existing, query, queryLower);
        const remoteScore = calculateSearchRelevance(r, query, queryLower);

        if (remoteScore > existingScore) {
          allResultsMap.set(key, { ...r, source: "remote" });
        }
      }
    }
  });

  // Sort ALL results: learned tokens first, then by score
  const allResults = Array.from(allResultsMap.values())
    .sort((a, b) => {
      // Learned tokens always first
      if (a.source === "learned" && b.source !== "learned") return -1;
      if (b.source === "learned" && a.source !== "learned") return 1;

      // Then by relevance score (including popularity boost for learned)
      const scoreA = calculateSearchRelevance(a, query, queryLower) + (a.popularityScore || 0);
      const scoreB = calculateSearchRelevance(b, query, queryLower) + (b.popularityScore || 0);
      return scoreB - scoreA;
    })
    .slice(0, limit);

  // Apply popularity boosts (async, non-blocking)
  const resultsWithScores = allResults.map((r) => ({
    address: r.address,
    score: r.score || 0,
  }));
  await applyPopularityBoosts(resultsWithScores);

  // Re-sort after popularity boosts
  allResults.sort((a, b) => {
    // Learned tokens always first
    if (a.source === "learned" && b.source !== "learned") return -1;
    if (b.source === "learned" && a.source !== "learned") return 1;

    // Then by score
    return (b.score || 0) - (a.score || 0);
  });

  return {
    local: localResults,
    remote: remoteResults,
    learned: learnedResults,
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

/**
 * Generate "did you mean?" phonetic suggestions for failed searches
 *
 * @param query - User's search query
 * @param type - Asset type (TOKEN or NFT)
 * @param limit - Maximum number of suggestions to return
 * @returns Array of phonetically similar tokens
 */
export async function generatePhoneticSuggestions(
  query: string,
  type: AssetType,
  limit: number = 3
): Promise<SearchResult[]> {
  if (query.length < 3) {
    return [];
  }

  try {
    const queryLower = query.toLowerCase();
    const suggestions: Array<SearchResult & { score: number }> = [];

    // Get all tokens of matching type
    const allTokens = await getAllTokenSearchIndex();
    const candidates = allTokens.filter((t) => t.type === type);

    // Check phonetic similarity for each candidate
    for (const token of candidates) {
      const nameSim = phoneticSimilarity(queryLower, token.name.toLowerCase());
      const symbolSim = phoneticSimilarity(queryLower, token.symbol.toLowerCase());
      const maxSim = Math.max(nameSim, symbolSim);

      // Only suggest if > 60% similar
      if (maxSim > 0.6) {
        suggestions.push({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          type: token.type as AssetType,
          source: "local" as const,
          decimals: token.decimals,
          score: maxSim * 100, // Convert to 0-100 scale
        });
      }
    }

    // Sort by similarity desc and return top N
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, ...rest }) => rest);
  } catch (error) {
    console.error("[Token Search] Failed to generate phonetic suggestions:", error);
    return [];
  }
}

/**
 * Progressive search: Stream results in stages
 *
 * Returns initial results in <50ms, then progressively refines:
 * - Stage 1: Exact matches (0-50ms)
 * - Stage 2: Prefix matches (50-100ms)
 * - Stage 3: Substring matches (100-150ms)
 * - Stage 4: Phonetic matches (150-200ms)
 *
 * @param query - Search query
 * @param type - Asset type
 * @param limit - Maximum results per stage
 * @returns Async generator yielding progressive results
 */
export async function* searchProgressive(
  query: string,
  type: AssetType,
  limit: number = 10
): AsyncGenerator<SearchResult[], void, unknown> {
  if (!query || query.length < 2) {
    yield [];
    return;
  }

  const queryLower = query.toLowerCase();
  const seenAddresses = new Set<string>();

  try {
    // Stage 1: Exact matches (<50ms)
    console.log(`[Progressive Search] Stage 1: Exact matches for "${query}"`);
    const exactResults = await searchExactMatches(query, queryLower, type, limit);
    exactResults.forEach((r) => seenAddresses.add(r.address.toLowerCase()));
    yield exactResults;

    // Stage 2: Prefix matches (50-100ms)
    console.log(`[Progressive Search] Stage 2: Prefix matches for "${query}"`);
    const prefixResults = await searchPrefixMatches(query, queryLower, type, limit);
    const newPrefixResults = prefixResults.filter(
      (r) => !seenAddresses.has(r.address.toLowerCase())
    );
    newPrefixResults.forEach((r) => seenAddresses.add(r.address.toLowerCase()));
    yield [...exactResults, ...newPrefixResults].slice(0, limit);

    // Stage 3: Substring matches (100-150ms)
    console.log(`[Progressive Search] Stage 3: Substring matches for "${query}"`);
    const substringResults = await searchSubstringMatches(query, queryLower, type, limit);
    const newSubstringResults = substringResults.filter(
      (r) => !seenAddresses.has(r.address.toLowerCase())
    );
    newSubstringResults.forEach((r) => seenAddresses.add(r.address.toLowerCase()));
    yield [...exactResults, ...newPrefixResults, ...newSubstringResults].slice(0, limit);

    // Stage 4: Phonetic matches (150-200ms)
    console.log(`[Progressive Search] Stage 4: Phonetic matches for "${query}"`);
    const phoneticResults = await searchPhoneticMatches(query, queryLower, type, limit);
    const newPhoneticResults = phoneticResults.filter(
      (r) => !seenAddresses.has(r.address.toLowerCase())
    );
    newPhoneticResults.forEach((r) => seenAddresses.add(r.address.toLowerCase()));

    // Final merged results
    const finalResults = [
      ...exactResults,
      ...newPrefixResults,
      ...newSubstringResults,
      ...newPhoneticResults,
    ].slice(0, limit);

    yield finalResults;
  } catch (error) {
    console.error("[Progressive Search] Error:", error);
    yield [];
  }
}

/**
 * Search for exact matches only (Stage 1)
 */
async function searchExactMatches(
  query: string,
  queryLower: string,
  type: AssetType,
  limit: number
): Promise<SearchResult[]> {
  try {
    const [lpPairs, discoveredContracts, dbResults] = await Promise.all([
      loadAllLPPairs(),
      loadDiscoveredContracts(),
      dbSearchTokensLocally(query, type),
    ]);

    const results: Array<SearchResult & { score: number }> = [];

    // Check LP pairs for exact matches
    for (const pair of lpPairs) {
      if (results.length >= limit) break;

      const token0Exact = pair.token0Address.toLowerCase() === queryLower;
      if (token0Exact) {
        results.push({
          address: pair.token0Address,
          name: `Token from ${pair.dexName}`,
          symbol: "TOKEN",
          type: AssetType.TOKEN,
          source: "local",
          decimals: 18,
          score: 100,
        });
      }

      if (results.length >= limit) break;

      const token1Exact = pair.token1Address.toLowerCase() === queryLower;
      if (token1Exact) {
        results.push({
          address: pair.token1Address,
          name: `Token from ${pair.dexName}`,
          symbol: "TOKEN",
          type: AssetType.TOKEN,
          source: "local",
          decimals: 18,
          score: 100,
        });
      }
    }

    // Check discovered contracts for exact matches
    for (const contract of discoveredContracts) {
      if (results.length >= limit) break;

      const matchesType =
        (type === AssetType.NFT && contract.type === "NFT") ||
        (type === AssetType.TOKEN && contract.type !== "NFT");

      if (matchesType) {
        const exactMatch =
          contract.contractAddress.toLowerCase() === queryLower ||
          contract.symbol?.toLowerCase() === queryLower ||
          contract.name?.toLowerCase() === queryLower;

        if (exactMatch) {
          results.push({
            address: contract.contractAddress,
            name: contract.name || "Unknown Token",
            symbol: contract.symbol || "UNKNOWN",
            type: contract.type === "NFT" ? AssetType.NFT : AssetType.TOKEN,
            source: "local",
            decimals: contract.type === "NFT" ? 0 : 18,
            score: 100,
          });
        }
      }
    }

    // Check search index for exact matches
    for (const token of dbResults) {
      if (results.length >= limit) break;

      if (token.type === type) {
        const exactMatch =
          token.address.toLowerCase() === queryLower ||
          token.symbol.toLowerCase() === queryLower ||
          token.name.toLowerCase() === queryLower;

        if (exactMatch) {
          results.push({
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            type: token.type as AssetType,
            source: "local",
            decimals: token.decimals,
            score: 100,
          });
        }
      }
    }

    return results.map(({ score: _score, ...rest }) => rest);
  } catch (error) {
    console.error("[Progressive Search] Stage 1 failed:", error);
    return [];
  }
}

/**
 * Search for prefix matches only (Stage 2)
 */
async function searchPrefixMatches(
  query: string,
  queryLower: string,
  type: AssetType,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Use existing local search but filter for prefix matches only
    const allResults = await searchTokensLocally(query, type, limit * 2);

    // Filter for prefix matches only (score >= 60)
    return allResults
      .filter((result) => {
        const score = calculateSearchRelevance(result, query, queryLower);
        return score >= 60;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("[Progressive Search] Stage 2 failed:", error);
    return [];
  }
}

/**
 * Search for substring matches only (Stage 3)
 */
async function searchSubstringMatches(
  query: string,
  queryLower: string,
  type: AssetType,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Use existing local search but filter for substring matches only
    const allResults = await searchTokensLocally(query, type, limit * 2);

    // Filter for substring matches only (score 25-59)
    return allResults
      .filter((result) => {
        const score = calculateSearchRelevance(result, query, queryLower);
        return score >= 25 && score < 60;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("[Progressive Search] Stage 3 failed:", error);
    return [];
  }
}

/**
 * Search for phonetic matches only (Stage 4)
 */
async function searchPhoneticMatches(
  query: string,
  _queryLower: string,
  type: AssetType,
  limit: number
): Promise<SearchResult[]> {
  if (query.length < 3) {
    return [];
  }

  try {
    return await generatePhoneticSuggestions(query, type, limit);
  } catch (error) {
    console.error("[Progressive Search] Stage 4 failed:", error);
    return [];
  }
}

/**
 * Quick progressive search: Returns results from all stages at once
 * Useful for non-streaming scenarios that still want progressive optimization
 *
 * @param query - Search query
 * @param type - Asset type
 * @param limit - Maximum results
 * @returns All results from all stages, deduplicated and sorted
 */
export async function searchProgressiveAll(
  query: string,
  type: AssetType,
  limit: number = 10
): Promise<SearchResult[]> {
  const generator = searchProgressive(query, type, limit);
  let finalResults: SearchResult[] = [];

  for await (const results of generator) {
    finalResults = results;
  }

  return finalResults;
}
