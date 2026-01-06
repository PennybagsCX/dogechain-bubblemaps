/**
 * Popularity Scoring Service
 *
 * Manages token popularity metrics with hybrid client + server architecture.
 * Boosts popular tokens in search results based on aggregate user behavior.
 *
 * Features:
 * - Local popularity cache (IndexedDB)
 * - Server aggregation (API endpoint)
 * - Automatic cache refresh (1-hour TTL)
 * - Popularity boost calculation (0-20 points)
 */

import { TokenPopularity } from "../types";

// =====================================================
// LOCAL CACHE (IndexedDB)
// =====================================================

interface CachedPopularity {
  tokenAddress: string;
  searchCount: number;
  clickCount: number;
  ctr: number;
  lastSearched: number | null;
  lastClicked: number | null;
  cachedAt: number;
  expiresAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const localCache = new Map<string, CachedPopularity>();

/**
 * Get popularity boost for a token
 *
 * @param tokenAddress - Token address
 * @returns Popularity boost score (0-20 points)
 */
export async function getPopularityBoost(tokenAddress: string): Promise<number> {
  try {
    // Check local cache first
    const cached = localCache.get(tokenAddress.toLowerCase());
    if (cached && Date.now() < cached.expiresAt) {
      return calculateBoostScore(cached);
    }

    // Try to fetch from server
    const serverData = await fetchPopularityFromServer([tokenAddress]);
    if (serverData && serverData[tokenAddress.toLowerCase()]) {
      const popularity = serverData[tokenAddress.toLowerCase()];

      // Update cache
      localCache.set(tokenAddress.toLowerCase(), {
        tokenAddress: tokenAddress.toLowerCase(),
        searchCount: popularity.searchCount,
        clickCount: popularity.clickCount,
        ctr: popularity.ctr,
        lastSearched: popularity.lastSearched,
        lastClicked: popularity.lastClicked,
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL,
      });

      return calculateBoostScore(popularity);
    }

    // Check IndexedDB cache
    const dbData = await getPopularityFromDB(tokenAddress);
    if (dbData) {
      return calculateBoostScore(dbData);
    }

    // No popularity data
    return 0;
  } catch (error) {
    console.warn("[Popularity] Failed to get popularity boost:", error);
    return 0;
  }
}

/**
 * Calculate popularity boost score from metrics
 *
 * Formula:
 * - CTR component: (ctr * 10) = 0-10 points
 * - Click count component: min(clickCount * 0.5, 5) = 0-5 points
 * - Recency bonus: up to 5 points for recent activity
 *
 * Max boost: 20 points
 */
function calculateBoostScore(popularity: TokenPopularity | CachedPopularity): number {
  const ctrComponent = popularity.ctr * 10; // 0-10 points
  const clickComponent = Math.min(popularity.clickCount * 0.5, 5); // 0-5 points

  // Recency bonus (last clicked within 24 hours)
  let recencyBonus = 0;
  if (popularity.lastClicked) {
    const hoursSinceClick = (Date.now() - popularity.lastClicked) / (1000 * 60 * 60);
    if (hoursSinceClick < 24) {
      recencyBonus = Math.max(0, 5 * (1 - hoursSinceClick / 24)); // 0-5 points
    }
  }

  const totalBoost = ctrComponent + clickComponent + recencyBonus;
  return Math.round(Math.min(20, Math.max(0, totalBoost)));
}

/**
 * Get popularity metrics for multiple tokens
 *
 * @param tokenAddresses - Array of token addresses
 * @returns Map of address -> popularity metrics
 */
export async function getPopularityBatch(tokenAddresses: string[]): Promise<Map<string, number>> {
  try {
    const boosts = new Map<string, number>();

    // Fetch from server in batch
    const serverData = await fetchPopularityFromServer(tokenAddresses);

    for (const address of tokenAddresses) {
      const normalized = address.toLowerCase();
      const popularity = serverData?.[normalized];

      if (popularity) {
        // Update cache
        localCache.set(normalized, {
          tokenAddress: normalized,
          searchCount: popularity.searchCount,
          clickCount: popularity.clickCount,
          ctr: popularity.ctr,
          lastSearched: popularity.lastSearched,
          lastClicked: popularity.lastClicked,
          cachedAt: Date.now(),
          expiresAt: Date.now() + CACHE_TTL,
        });

        boosts.set(normalized, calculateBoostScore(popularity));
      } else {
        boosts.set(normalized, 0);
      }
    }

    return boosts;
  } catch (error) {
    console.warn("[Popularity] Batch fetch failed:", error);
    return new Map(tokenAddresses.map((addr) => [addr.toLowerCase(), 0]));
  }
}

/**
 * Update popularity metrics (after user interaction)
 *
 * @param tokenAddress - Token address
 * @param appearedInResults - Whether token appeared in search results
 * @param wasClicked - Whether user clicked on the token
 */
export async function updateTokenPopularity(
  tokenAddress: string,
  appearedInResults: boolean,
  wasClicked: boolean
): Promise<void> {
  try {
    const normalized = tokenAddress.toLowerCase();
    const cached = localCache.get(normalized);

    if (cached) {
      // Update local cache
      if (appearedInResults) {
        cached.searchCount++;
        cached.lastSearched = Date.now();
      }
      if (wasClicked) {
        cached.clickCount++;
        cached.lastClicked = Date.now();
      }
      cached.ctr = cached.searchCount > 0 ? cached.clickCount / cached.searchCount : 0;
    }

    // Send to server (async, non-blocking)
    sendPopularityUpdate(normalized, appearedInResults, wasClicked).catch((error) => {
      console.warn("[Popularity] Failed to send update to server:", error);
    });

    // Update IndexedDB
    await updatePopularityInDB(normalized, appearedInResults, wasClicked);
  } catch (error) {
    console.error("[Popularity] Failed to update popularity:", error);
  }
}

// =====================================================
// SERVER COMMUNICATION
// =====================================================

/**
 * Fetch popularity metrics from server
 */
async function fetchPopularityFromServer(
  addresses: string[]
): Promise<Record<string, TokenPopularity> | null> {
  try {
    const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/trending/popularity";

    const params = new URLSearchParams();
    for (const address of addresses) {
      params.append("addresses[]", address);
    }

    const response = await fetch(`${apiEndpoint}?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint not configured, return null
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: Record<string, TokenPopularity> = await response.json();
    return data;
  } catch (error) {
    // Silent fail - popularity scoring is optional enhancement
    return null;
  }
}

/**
 * Send popularity update to server
 */
async function sendPopularityUpdate(
  tokenAddress: string,
  appearedInResults: boolean,
  wasClicked: boolean
): Promise<void> {
  const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/trending/popularity";

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tokenAddress,
      appearedInResults,
      wasClicked,
      timestamp: Date.now(),
    }),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

// =====================================================
// INDEXEDDB OPERATIONS
// =====================================================

/**
 * Get popularity from IndexedDB cache
 */
async function getPopularityFromDB(tokenAddress: string): Promise<TokenPopularity | null> {
  try {
    const { db } = await import("./db");

    // Check if tokenPopularity store exists (v15+)
    if (!("tokenPopularity" in db)) {
      return null;
    }

    const data = await db.tokenPopularity.get(tokenAddress.toLowerCase());

    if (!data) {
      return null;
    }

    // Check if expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      await db.tokenPopularity.delete(tokenAddress.toLowerCase());
      return null;
    }

    return {
      tokenAddress: data.tokenAddress,
      searchCount: data.searchCount || 0,
      clickCount: data.clickCount || 0,
      ctr: data.ctr || 0,
      lastSearched: data.lastSearched || null,
      lastClicked: data.lastClicked || null,
    };
  } catch (error) {
    console.warn("[Popularity] Failed to get from DB:", error);
    return null;
  }
}

/**
 * Update popularity in IndexedDB
 */
async function updatePopularityInDB(
  tokenAddress: string,
  appearedInResults: boolean,
  wasClicked: boolean
): Promise<void> {
  try {
    const { db } = await import("./db");

    if (!("tokenPopularity" in db)) {
      return;
    }

    const normalized = tokenAddress.toLowerCase();
    const existing = await db.tokenPopularity.get(normalized);

    if (existing) {
      // Update existing record
      await db.tokenPopularity.update(normalized, {
        searchCount: (existing.searchCount || 0) + (appearedInResults ? 1 : 0),
        clickCount: (existing.clickCount || 0) + (wasClicked ? 1 : 0),
        ctr: 0, // Will be recalculated by aggregation job
        lastSearched: appearedInResults ? Date.now() : existing.lastSearched,
        lastClicked: wasClicked ? Date.now() : existing.lastClicked,
        updatedAt: Date.now(),
      });
    } else if (appearedInResults || wasClicked) {
      // Create new record
      await db.tokenPopularity.add({
        tokenAddress: normalized,
        searchCount: appearedInResults ? 1 : 0,
        clickCount: wasClicked ? 1 : 0,
        ctr: 0,
        lastSearched: appearedInResults ? Date.now() : null,
        lastClicked: wasClicked ? Date.now() : null,
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL,
        updatedAt: Date.now(),
      });
    }
  } catch (error) {
    console.warn("[Popularity] Failed to update DB:", error);
  }
}

/**
 * Clear expired popularity cache entries
 */
export async function clearExpiredPopularityCache(): Promise<void> {
  try {
    const { db } = await import("./db");

    if (!("tokenPopularity" in db)) {
      return;
    }

    const now = Date.now();
    await db.tokenPopularity.where("expiresAt").below(now).delete();

    console.log("[Popularity] Cleared expired cache entries");
  } catch (error) {
    console.warn("[Popularity] Failed to clear cache:", error);
  }
}
