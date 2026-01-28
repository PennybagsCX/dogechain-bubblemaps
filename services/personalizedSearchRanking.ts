/**
 * Personalized Search Ranking Service
 *
 * Boosts search results based on user's search history.
 * Tokens that a user frequently searches for appear higher in results.
 *
 * Privacy: All data stored locally in IndexedDB, no server transmission.
 */

import { SearchResult } from "../types";

interface UserSearchHistory {
  address: string; // Token address
  searchCount: number; // Number of times searched
  lastSearched: number; // Timestamp of last search
  clickCount: number; // Number of times clicked
}

const MAX_HISTORY_SIZE = 100; // Keep top 100 tokens
const MIN_SEARCH_COUNT = 2; // Minimum searches before boosting
const BOOST_MULTIPLIER = 2; // Points per search
const MAX_BOOST = 10; // Maximum boost from personalization

/**
 * Get user's top searched tokens
 *
 * @param limit - Maximum number of tokens to return
 * @returns Map of address -> search count
 */
export async function getUserTopSearches(limit: number = 20): Promise<Map<string, number>> {
  try {
    const { db } = await import("./db");

    // Check if searchAnalytics store exists (v16+)
    if (!("searchAnalytics" in db)) {
      return new Map();
    }

    // Get recent search events from the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const searchEvents = await db.searchAnalytics
      .where("timestamp")
      .above(thirtyDaysAgo)
      .reverse()
      .limit(1000)
      .toArray();

    // Extract clicked addresses from search events
    const searchCounts = new Map<string, number>();

    for (const event of searchEvents) {
      if (event.clickedAddress) {
        const address = event.clickedAddress.toLowerCase();
        searchCounts.set(address, (searchCounts.get(address) || 0) + 1);
      }
    }

    // Sort by count and return top N
    const sorted = Array.from(searchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return new Map(sorted);
  } catch {
    // Error handled silently
    return new Map();
  }
}

/**
 * Get user's detailed search history with metadata
 *
 * @param limit - Maximum number of tokens to return
 * @returns Array of user search history
 */
export async function getUserSearchHistory(
  limit: number = MAX_HISTORY_SIZE
): Promise<UserSearchHistory[]> {
  try {
    const { db } = await import("./db");

    if (!("searchAnalytics" in db)) {
      return [];
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const searchEvents = await db.searchAnalytics
      .where("timestamp")
      .above(thirtyDaysAgo)
      .reverse()
      .limit(1000)
      .toArray();

    // Aggregate by address
    const historyMap = new Map<string, UserSearchHistory>();

    for (const event of searchEvents) {
      if (event.clickedAddress) {
        const address = event.clickedAddress.toLowerCase();

        if (!historyMap.has(address)) {
          historyMap.set(address, {
            address,
            searchCount: 0,
            clickCount: 0,
            lastSearched: event.timestamp,
          });
        }

        const history = historyMap.get(address)!;
        history.searchCount++;
        history.lastSearched = Math.max(history.lastSearched, event.timestamp);

        // Count clicks (events with clickedAddress are clicks)
        if (event.type === "click") {
          history.clickCount++;
        }
      }
    }

    // Convert to array and sort by search count
    const history = Array.from(historyMap.values())
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, limit);

    return history;
  } catch {
    // Error handled silently
    return [];
  }
}

/**
 * Apply personalized ranking to search results
 *
 * @param results - Search results to boost
 * @param userHistory - User's search history (optional, will fetch if not provided)
 * @returns Boosted results (modified in place)
 */
export async function applyPersonalizedRanking(
  results: SearchResult[],
  userHistory?: UserSearchHistory[]
): Promise<SearchResult[]> {
  try {
    // Fetch user history if not provided
    const history = userHistory || (await getUserSearchHistory(MAX_HISTORY_SIZE));

    if (history.length === 0) {
      return results;
    }

    // Create a map of addresses to search counts
    const searchCounts = new Map<string, number>();
    for (const item of history) {
      if (item.searchCount >= MIN_SEARCH_COUNT) {
        searchCounts.set(item.address.toLowerCase(), item.searchCount);
      }
    }

    // Apply boosts to results
    for (const result of results) {
      const searchCount = searchCounts.get(result.address.toLowerCase()) || 0;

      if (searchCount >= MIN_SEARCH_COUNT) {
        // Calculate boost: 2 points per search, max 10 points
        const boost = Math.min(searchCount * BOOST_MULTIPLIER, MAX_BOOST);
        result.score = (result.score || 0) + boost;

        // Add priority flag for frequently searched tokens
        if (searchCount >= 10) {
          result.priority = "high";
        } else if (searchCount >= 5) {
          result.priority = "medium";
        }
      }
    }

    return results;
  } catch {
    // Error handled silently - return original results
    return results;
  }
}

/**
 * Track a search for personalization
 *
 * @param query - Search query
 * @param results - Search results
 * @param clickedAddress - Address that was clicked (if any)
 */
export async function trackPersonalizedSearch(
  query: string,
  results: SearchResult[],
  clickedAddress?: string
): Promise<void> {
  try {
    const { db } = await import("./db");

    if (!("searchAnalytics" in db)) {
      return;
    }

    // Get session ID
    const sessionId = localStorage.getItem("search_session_id") || generateSessionId();
    localStorage.setItem("search_session_id", sessionId);

    // Track search event
    await db.searchAnalytics.add({
      sessionId,
      query,
      results: results.map((r) => r.address),
      resultCount: results.length,
      timestamp: Date.now(),
      clickedAddress: clickedAddress || null,
      type: clickedAddress ? "click" : "search",
    });
  } catch {
    // Error handled silently
  }
}

/**
 * Generate a session ID for tracking
 */
function generateSessionId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Clear user's personalized search history
 * Useful for privacy or resetting personalization
 */
export async function clearPersonalizedHistory(): Promise<void> {
  try {
    const { db } = await import("./db");

    if (!("searchAnalytics" in db)) {
      return;
    }

    await db.searchAnalytics.clear();
  } catch {
    // Error handled silently
  }
}

/**
 * Get personalization statistics
 *
 * @returns Statistics about personalized search
 */
export async function getPersonalizationStats(): Promise<{
  totalSearches: number;
  uniqueTokens: number;
  topTokens: Array<{ address: string; count: number }>;
}> {
  try {
    const history = await getUserSearchHistory(MAX_HISTORY_SIZE);

    return {
      totalSearches: history.reduce((sum, h) => sum + h.searchCount, 0),
      uniqueTokens: history.length,
      topTokens: history.slice(0, 10).map((h) => ({ address: h.address, count: h.searchCount })),
    };
  } catch {
    return {
      totalSearches: 0,
      uniqueTokens: 0,
      topTokens: [],
    };
  }
}
