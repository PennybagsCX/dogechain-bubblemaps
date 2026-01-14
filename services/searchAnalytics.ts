/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Search Analytics Service
 *
 * Tracks search queries and user interactions to improve search relevance over time.
 * Uses hybrid architecture: IndexedDB for local storage + API for server aggregation.
 *
 * Features:
 * - Anonymous session tracking
 * - Search query logging
 * - Click tracking
 * - Time-to-click measurement
 * - Async non-blocking analytics
 */

import { SearchAnalyticsEvent, ClickAnalyticsEvent, SearchSession, SearchResult } from "../types";

// =====================================================
// SESSION MANAGEMENT
// =====================================================

let currentSession: SearchSession | null = null;
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate or retrieve current session ID
 */
export function getSessionId(): string {
  const now = Date.now();

  // Check if session exists and is valid
  if (currentSession && now - currentSession.lastActivity < SESSION_DURATION_MS) {
    currentSession.lastActivity = now;
    return currentSession.sessionId;
  }

  // Create new session
  currentSession = {
    sessionId: generateSessionId(),
    startTime: now,
    lastActivity: now,
    searchCount: 0,
    clickCount: 0,
  };

  return currentSession.sessionId;
}

/**
 * Generate anonymous session ID
 */
function generateSessionId(): string {
  // Generate 128-bit random session ID (32 hex chars)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// =====================================================
// SEARCH TRACKING
// =====================================================

/**
 * Track search query and results
 *
 * @param query - Search query text
 * @param results - Array of search results
 * @param sessionId - Anonymous session identifier
 */
export async function trackSearch(
  query: string,
  results: SearchResult[],
  sessionId: string = getSessionId()
): Promise<void> {
  try {
    const event: SearchAnalyticsEvent = {
      sessionId,
      query,
      results: results.map((r) => r.address),
      resultCount: results.length,
      timestamp: Date.now(),
    };

    // Skip tracking if no results (not a useful search event)
    if (results.length === 0) {
      return;
    }

    // Update session stats
    if (currentSession) {
      currentSession.searchCount++;
      currentSession.lastActivity = event.timestamp;
    }

    // Save to IndexedDB (local)
    await saveSearchEventLocally(event);

    // Send to server (async, non-blocking)
    sendSearchEventToServer(event).catch((_err) => {
      // Silently fail if server is unavailable
    });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Track result click
 *
 * @param query - Search query text
 * @param clickedAddress - Token address that was clicked
 * @param resultRank - Position in results (0-indexed)
 * @param resultScore - Relevance score
 * @param timeToClickMs - Time from search to click (ms)
 * @param sessionId - Session identifier
 */
export async function trackResultClick(
  query: string,
  clickedAddress: string,
  resultRank: number,
  resultScore: number,
  timeToClickMs: number,
  sessionId: string = getSessionId()
): Promise<void> {
  try {
    const event: ClickAnalyticsEvent = {
      sessionId,
      query,
      clickedAddress,
      resultRank,
      resultScore,
      timeToClickMs,
      timestamp: Date.now(),
    };

    // Update session stats
    if (currentSession) {
      currentSession.clickCount++;
      currentSession.lastActivity = event.timestamp;
    }

    // Save to IndexedDB (local)
    await saveClickEventLocally(event);

    // Send to server (async, non-blocking)
    sendClickEventToServer(event).catch((_err) => {
      // Silently fail if server is unavailable
    });
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Track search abandonment (no clicks within timeout)
 *
 * @param query - Search query text
 * @param resultsShown - Number of results shown
 * @param sessionId - Session identifier
 */
export async function trackSearchAbandonment(
  _query: string,
  _resultsShown: number,
  _sessionId: string = getSessionId()
): Promise<void> {
  try {
    // Abandonment is implied by lack of clicks
    // Tracking is implicit - no action needed
  } catch (error) {
    // Error handled silently
  }
}

// =====================================================
// LOCAL STORAGE (IndexedDB)
// =====================================================

/**
 * Save search event to IndexedDB
 * (Requires searchAnalytics store to be added to db.ts)
 */
async function saveSearchEventLocally(event: SearchAnalyticsEvent): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import("./db");

    // Check if searchAnalytics store exists (v14+)
    if ("searchAnalytics" in db) {
      await db.searchAnalytics.add({
        sessionId: event.sessionId,
        query: event.query,
        results: event.results,
        resultCount: event.resultCount,
        timestamp: event.timestamp,
      });
    }
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Save click event to IndexedDB
 */
async function saveClickEventLocally(event: ClickAnalyticsEvent): Promise<void> {
  try {
    const { db } = await import("./db");

    if ("searchAnalytics" in db) {
      await db.searchAnalytics.add({
        sessionId: event.sessionId,
        query: event.query,
        clickedAddress: event.clickedAddress,
        resultRank: event.resultRank,
        resultScore: event.resultScore,
        timeToClickMs: event.timeToClickMs,
        timestamp: event.timestamp,
        type: "click", // Distinguish from search events
      });
    }
  } catch (error) {
    // Error handled silently
  }
}

// =====================================================
// SERVER COMMUNICATION
// =====================================================

/**
 * Send search event to server
 */
async function sendSearchEventToServer(event: SearchAnalyticsEvent): Promise<void> {
  // Construct full URL for analytics endpoint
  const apiBase = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "";
  const apiEndpoint = apiBase ? `${apiBase}/api/analytics/search` : "/api/analytics/search";

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: event.sessionId,
      query: event.query,
      results: event.results,
      resultCount: event.resultCount,
      timestamp: event.timestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Send click event to server
 */
async function sendClickEventToServer(event: ClickAnalyticsEvent): Promise<void> {
  const apiBase = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "";
  const apiEndpoint = apiBase ? `${apiBase}/api/analytics/click` : "/api/analytics/click";

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: event.sessionId,
      query: event.query,
      clickedAddress: event.clickedAddress,
      resultRank: event.resultRank,
      resultScore: event.resultScore,
      timeToClickMs: event.timeToClickMs,
      timestamp: event.timestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

// =====================================================
// ANALYTICS QUERIES (Local)
// =====================================================

/**
 * Get recent search events from local IndexedDB
 */
export async function getRecentSearches(limit: number = 100): Promise<SearchAnalyticsEvent[]> {
  try {
    const { db } = await import("./db");

    if (!("searchAnalytics" in db)) {
      return [];
    }

    const events = await db.searchAnalytics
      .where("timestamp")
      .above(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .reverse()
      .limit(limit)
      .toArray();

    return events
      .filter((e: any) => !e.type || e.type !== "click")
      .map((e: any) => ({
        sessionId: e.sessionId,
        query: e.query,
        results: e.results || [],
        resultCount: e.resultCount || 0,
        timestamp: e.timestamp,
      }));
  } catch (error) {
    // Error handled silently

    return [];
  }
}

/**
 * Get top search queries (local only)
 */
export async function getTopQueries(
  limit: number = 20
): Promise<Array<{ query: string; count: number }>> {
  try {
    const recentSearches = await getRecentSearches(1000);
    const queryCounts = new Map<string, number>();

    for (const search of recentSearches) {
      const normalized = search.query.toLowerCase().trim();
      queryCounts.set(normalized, (queryCounts.get(normalized) || 0) + 1);
    }

    return Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    // Error handled silently

    return [];
  }
}

/**
 * Get recent unique search queries for search history
 * Returns deduplicated list of recent queries, most recent first
 *
 * @param limit - Maximum number of unique queries to return
 * @returns Array of unique search query strings
 */
export async function getRecentSearchHistory(limit: number = 10): Promise<string[]> {
  try {
    const recentSearches = await getRecentSearches(100);
    const uniqueQueries = new Set<string>();
    const history: string[] = [];

    // Get unique queries in reverse order (most recent first)
    for (let i = recentSearches.length - 1; i >= 0; i--) {
      const searchEntry = recentSearches[i];
      if (!searchEntry) continue;

      const query = searchEntry.query.trim();

      // Skip empty queries or addresses
      if (!query || query.startsWith("0x")) continue;

      // Skip if already in history
      if (uniqueQueries.has(query.toLowerCase())) continue;

      uniqueQueries.add(query.toLowerCase());
      history.push(query);

      // Stop when we reach the limit
      if (history.length >= limit) break;
    }

    return history;
  } catch (error) {
    // Error handled silently

    return [];
  }
}

/**
 * Clear all search analytics data from IndexedDB
 * Useful for privacy or resetting analytics
 */
export async function clearSearchAnalytics(): Promise<void> {
  try {
    const { db } = await import("./db");

    if ("searchAnalytics" in db) {
      await db.searchAnalytics.clear();
    }
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Get current session stats
 */
export function getSessionStats(): SearchSession | null {
  return currentSession;
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize analytics on app load
 */
export function initializeAnalytics(): void {
  try {
    // Generate session ID
    getSessionId();
  } catch (error) {
    // Error handled silently
  }
}

/**
 * Cleanup on app unload
 */
export function cleanupAnalytics(): void {
  try {
    // Session data is automatically cleaned up
  } catch (error) {
    // Error handled silently
  }
}

// Auto-initialize
if (typeof window !== "undefined") {
  initializeAnalytics();

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanupAnalytics);
}
