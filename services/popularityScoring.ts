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

      if (!popularity) return 0;

      // Update cache
      localCache.set(tokenAddress.toLowerCase(), {
        tokenAddress: tokenAddress.toLowerCase(),
        searchCount: popularity.searchCount ?? 0,
        clickCount: popularity.clickCount ?? 0,
        ctr: popularity.ctr ?? 0,
        lastSearched: popularity.lastSearched ?? 0,
        lastClicked: popularity.lastClicked ?? 0,
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
  } catch {
    // Silently fail if popularity data is unavailable
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

    // Skip server call if no addresses
    if (tokenAddresses.length === 0) {
      return boosts;
    }

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
  } catch {
    // Silently fail if batch fetch fails
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
    sendPopularityUpdate(normalized, appearedInResults, wasClicked).catch((_err) => {
      // Silently fail if server is unavailable
    });

    // Update IndexedDB
    await updatePopularityInDB(normalized, appearedInResults, wasClicked);
  } catch {
    // Error handled silently
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
    const apiBase = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "";
    const apiEndpoint = apiBase ? `${apiBase}/api/trending/popularity` : "/api/trending/popularity";

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
  } catch {
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
  const apiBase = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "";
  const apiEndpoint = apiBase ? `${apiBase}/api/trending/popularity` : "/api/trending/popularity";

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
  } catch {
    // Silently fail if DB is unavailable
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
  } catch {
    // Silently fail if DB update fails
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
  } catch {
    // Silently fail if cache clear fails
  }
}

// =====================================================
// TIME DECAY ALGORITHM
// =====================================================

/**
 * Calculate time-decayed popularity score
 *
 * Old searches have less influence, fresh searches get higher priority.
 * Uses exponential decay with a configurable half-life.
 *
 * @param hits - Number of hits/searches
 * @param lastSeenAt - Timestamp of last search/click
 * @param now - Current timestamp (default: Date.now())
 * @param decayDays - Half-life in days (default: 7 days)
 * @returns Decayed popularity score
 *
 * Formula:
 * - Days since last seen = (now - lastSeenAt) / (1000 * 60 * 60 * 24)
 * - Decay factor = 0.5 ^ (daysSinceLastSeen / decayDays)
 * - Decayed score = hits * decayFactor
 *
 * Examples:
 * - 100 hits, seen today = 100 points
 * - 100 hits, seen 7 days ago = 50 points (50% decay)
 * - 100 hits, seen 14 days ago = 25 points (75% decay)
 * - 100 hits, seen 30 days ago = ~6 points (94% decay)
 */
export function calculateDecayedPopularity(
  hits: number,
  lastSeenAt: number,
  now: number = Date.now(),
  decayDays: number = 7
): number {
  if (hits <= 0 || !lastSeenAt || lastSeenAt <= 0) {
    return 0;
  }

  const daysSinceLastSeen = (now - lastSeenAt) / (1000 * 60 * 60 * 24);

  // Exponential decay: reduce score by 50% every N days
  const decayFactor = Math.pow(0.5, daysSinceLastSeen / decayDays);

  return hits * decayFactor;
}

/**
 * Calculate popularity boost with time decay applied
 *
 * @param popularity - Token popularity metrics
 * @param now - Current timestamp (default: Date.now())
 * @returns Boost score (0-20 points) with time decay applied
 */
export function calculateBoostWithDecay(
  popularity: TokenPopularity | CachedPopularity,
  now: number = Date.now()
): number {
  // Apply time decay to click count
  const decayedClicks = popularity.lastClicked
    ? calculateDecayedPopularity(popularity.clickCount, popularity.lastClicked, now, 7)
    : 0;

  // Apply time decay to search count
  const decayedSearches = popularity.lastSearched
    ? calculateDecayedPopularity(popularity.searchCount, popularity.lastSearched, now, 7)
    : 0;

  // Recalculate CTR with decayed values
  const decayedCtr =
    decayedSearches > 0 ? Math.min(1, decayedClicks / decayedSearches) : popularity.ctr;

  // Calculate boost components
  const ctrComponent = decayedCtr * 10; // 0-10 points
  const clickComponent = Math.min(decayedClicks * 0.5, 5); // 0-5 points

  // Recency bonus (already handled by decay, but add extra for very recent)
  let recencyBonus = 0;
  if (popularity.lastClicked) {
    const hoursSinceClick = (now - popularity.lastClicked) / (1000 * 60 * 60);
    if (hoursSinceClick < 24) {
      recencyBonus = Math.max(0, 5 * (1 - hoursSinceClick / 24)); // 0-5 points
    }
  }

  const totalBoost = ctrComponent + clickComponent + recencyBonus;
  return Math.round(Math.min(20, Math.max(0, totalBoost)));
}
