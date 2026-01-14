/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Search Worker - Background processing for token search
 *
 * This Web Worker handles expensive search operations off the main thread:
 * - Token relevance scoring
 * - Phonetic similarity calculations
 * - Result sorting and deduplication
 *
 * Benefits: Zero UI blocking, smooth typing experience
 */

// Import types for worker context
interface WorkerMessage {
  messageType: "search" | "abort";
  query: string;
  queryLower: string;
  tokens: Array<{
    address: string;
    name: string;
    symbol: string;
    source?: string;
  }>;
  assetType: string;
  expandedQueries: string[];
  tokenAbbrs?: Map<string, string[]>;
}

interface WorkerResponse {
  type: "progress" | "complete" | "error";
  stage: 1 | 2 | 3;
  results?: Array<{
    address: string;
    name: string;
    symbol: string;
    type: string;
    source: string;
    decimals: number;
    score: number;
  }>;
  error?: string;
}

// Re-implement scoring function in worker (can't import from main thread)
function calculateSearchRelevance(
  token: {
    address: string;
    name: string;
    symbol: string;
    source?: string;
  },
  query: string,
  queryLower: string,
  nicknameExpansions: string[],
  tokenAbbrs?: string[]
): number {
  let score = 0;

  // 0. Nickname/Abbreviation matches (high priority)
  if (nicknameExpansions.length > 0) {
    for (const expansion of nicknameExpansions) {
      const expansionLower = expansion.toLowerCase();
      if (token.name.toLowerCase() === expansionLower) return 85;
      if (token.symbol.toLowerCase() === expansionLower) return 82;
      if (token.name.toLowerCase().includes(expansionLower)) score = 75;
      else if (token.symbol.toLowerCase().includes(expansionLower)) score = 72;
    }
  }

  // 0.5. Generated abbreviation matches (78 points)
  if (tokenAbbrs && tokenAbbrs.length > 0) {
    for (const abbr of tokenAbbrs) {
      if (abbr === queryLower) return 78;
      if (abbr.startsWith(queryLower)) score = Math.max(score, 68);
    }
  }

  // 1. Exact matches (highest priority)
  if (token.symbol === query) return 100;
  if (token.name === query) return 95;

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

  // 7. Penalties
  const isGeneric =
    token.symbol === "UNKNOWN" || token.symbol === "TOKEN" || token.name.startsWith("Token from");
  if (isGeneric) score -= 15;

  // Short query penalty
  if (query.length < 3 && score < 60) {
    score -= 5;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

// Phonetic similarity (simplified version for worker)
function phoneticSimilarity(query: string, target: string): number {
  if (query.length < 3 || target.length < 3) return 0;
  if (Math.abs(query.length - target.length) > 4) return 0;

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Simple Levenshtein distance
  const levDistance = levenshtein(queryLower, targetLower);
  const maxLen = Math.max(queryLower.length, targetLower.length);
  const levSimilarity = 1 - levDistance / maxLen;

  // Length penalty
  const lengthDiff = Math.abs(query.length - target.length);
  const lengthScore = Math.max(0, 1 - lengthDiff / 5);

  return levSimilarity * 0.7 + lengthScore * 0.3;
}

// Optimized Levenshtein distance with early exit
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 10;

  const lenA = a.length;
  const lenB = b.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= lenB; i++) {
    matrix[i] = [];
    matrix[i]![0] = i;
  }
  for (let j = 1; j <= lenA; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      const diagonal = matrix[i - 1]?.[j - 1] ?? 0;
      const left = matrix[i]?.[j - 1] ?? 0;
      const top = matrix[i - 1]?.[j] ?? 0;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = diagonal;
      } else {
        matrix[i]![j] = Math.min(diagonal + 1, left + 1, top + 1);
      }

      const current = matrix[i]![j];
      if (current && current > 3) return current;
    }
  }

  return matrix[lenB]?.[lenA] ?? 0;
}

// Worker message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { messageType, query, queryLower, tokens, assetType, expandedQueries, tokenAbbrs } =
    event.data;

  if (messageType === "abort") {
    // Handle abort if needed
    return;
  }

  if (messageType !== "search") {
    postMessage({
      type: "error",
      stage: 1,
      error: "Unknown message type",
    } as WorkerResponse);
    return;
  }

  try {
    // Stage 1: Score all tokens against all expanded queries
    const scoredTokens = tokens.map((token) => {
      let maxScore = 0;

      // Calculate score against ALL expanded queries, keep HIGHEST
      for (const expandedQuery of expandedQueries) {
        const score = calculateSearchRelevance(
          token,
          query,
          expandedQuery,
          expandedQuery === queryLower ? expandedQueries : [],
          tokenAbbrs?.get(token.address.toLowerCase())
        );

        if (score > maxScore) {
          maxScore = score;
        }
      }

      return {
        ...token,
        score: maxScore,
        type: assetType,
      };
    });

    // Stage 2: Filter and sort
    const filteredResults = scoredTokens
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    // Stage 3: Add phonetic matches for low-scoring queries
    const phoneticCandidates: typeof filteredResults = [];

    if (filteredResults.length < 20 && query.length >= 3) {
      for (const token of tokens) {
        const nameSim = phoneticSimilarity(queryLower, token.name);
        const symbolSim = phoneticSimilarity(queryLower, token.symbol);
        const maxSim = Math.max(nameSim, symbolSim);

        if (maxSim > 0.6) {
          const existing = filteredResults.find((r) => r.address === token.address);
          if (!existing) {
            phoneticCandidates.push({
              ...token,
              score: maxSim * 100,
              type: assetType,
            });
          }
        }
      }
    }

    // Merge phonetic results
    const allResults = [...filteredResults, ...phoneticCandidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ score: _score, ...rest }) => rest);

    // Send final results
    postMessage({
      type: "complete",
      stage: 3,
      results: allResults,
    } as WorkerResponse);
  } catch (err) {
    postMessage({
      type: "error",
      stage: 1,
      error: err instanceof Error ? err.message : "Unknown error",
    } as WorkerResponse);
  }
};

// Export empty object for module compatibility
export {};
