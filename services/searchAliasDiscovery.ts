/**
 * Search Alias Discovery Service
 *
 * Automatically learns nickname-to-address mappings from user search behavior.
 * When users consistently search for the same term and click the same result,
 * we learn that the search term is an "alias" for that token.
 *
 * Example:
 * - User searches for "doge" 10 times
 * - User clicks wDOGE (0xb7dd...) 9 times out of 10
 * - System learns: "doge" → wDOGE with 90% confidence
 */

import { SearchResult } from "../types";

// Minimum confirmations before an alias is considered valid
const MIN_CONFIRMATIONS = 5;

// Minimum confidence threshold (0-1) before using an alias
const MIN_CONFIDENCE = 0.7;

// Time window for alias tracking (7 days)
const TRACKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface SearchAlias {
  alias: string; // User's search term (lowercase)
  targetAddress: string; // Contract address
  confidence: number; // 0-1
  confirmedCount: number; // Number of confirmations
  totalOccurrences: number; // Total times this alias was searched
  lastSeen: number; // Timestamp of last confirmation
}

// In-memory tracking of search patterns
const searchPatterns = new Map<string, Map<string, number>>();
// alias -> (address -> count)

/**
 * Track a search query for potential alias learning
 *
 * @param query - The user's search query
 * @param results - The search results shown to the user
 */
export function trackSearchForAlias(query: string, results: SearchResult[]): void {
  const normalizedQuery = query.toLowerCase().trim();

  // Skip if query is a contract address, too short, or no results
  if (normalizedQuery.startsWith("0x") || normalizedQuery.length < 2 || results.length === 0) {
    return;
  }

  // Initialize tracking for this query if needed
  if (!searchPatterns.has(normalizedQuery)) {
    searchPatterns.set(normalizedQuery, new Map());
  }

  // Mark that we showed these results for this query
  const pattern = searchPatterns.get(normalizedQuery)!;
  for (const result of results) {
    pattern.set(result.address.toLowerCase(), (pattern.get(result.address.toLowerCase()) || 0) + 1);
  }
}

/**
 * Track a result click for alias learning
 *
 * @param query - The user's search query
 * @param clickedAddress - The contract address the user clicked
 */
export async function trackClickForAlias(query: string, clickedAddress: string): Promise<void> {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedAddress = clickedAddress.toLowerCase();

  // Get the pattern for this query
  const pattern = searchPatterns.get(normalizedQuery);
  if (!pattern) {
    return;
  }

  // Increment confirmation count for this address
  const currentCount = pattern.get(normalizedAddress) || 0;
  pattern.set(normalizedAddress, currentCount + 1);

  // Calculate total occurrences
  let totalOccurrences = 0;
  for (const count of pattern.values()) {
    totalOccurrences += count;
  }

  // Calculate confidence (confirmed / total)
  const confidence = currentCount / totalOccurrences;

  // Check if we should save this alias
  if (currentCount >= MIN_CONFIRMATIONS && confidence >= MIN_CONFIDENCE) {
    await saveSearchAlias({
      alias: normalizedQuery,
      targetAddress: normalizedAddress,
      confidence,
      confirmedCount: currentCount,
      totalOccurrences,
      lastSeen: Date.now(),
    });
  }
}

/**
 * Get learned aliases for a search query
 *
 * @param query - The user's search query
 * @returns Array of learned aliases that match this query
 */
export async function getLearnedAliases(query: string): Promise<SearchAlias[]> {
  const normalizedQuery = query.toLowerCase().trim();

  try {
    const { db } = await import("./db");

    // Check if searchAliases table exists (v19+)
    if (!("searchAliases" in db)) {
      return [];
    }

    // Get aliases that match the query (exact match or starts with)
    const aliases = await db.searchAliases
      .where("alias")
      .startsWith(normalizedQuery)
      .or("alias")
      .equals(normalizedQuery)
      .toArray();

    return aliases.map((alias) => ({
      alias: alias.alias,
      targetAddress: alias.targetAddress,
      confidence: alias.confidence,
      confirmedCount: alias.confirmedCount || 0,
      totalOccurrences: 0, // Not stored in DB
      lastSeen: alias.createdAt,
    }));
  } catch {
    // Error handled silently
    return [];
  }
}

/**
 * Save a search alias to IndexedDB
 *
 * @param alias - The alias to save
 */
async function saveSearchAlias(alias: SearchAlias): Promise<void> {
  try {
    const { db } = await import("./db");

    // Check if searchAliases table exists (v19+)
    if (!("searchAliases" in db)) {
      return;
    }

    // Check if alias already exists
    const existing = await db.searchAliases.where("alias").equals(alias.alias).first();

    if (existing) {
      // Update existing alias with higher confidence
      await db.searchAliases.put({
        ...existing,
        confidence: Math.max(existing.confidence, alias.confidence),
        confirmedCount: (existing.confirmedCount || 0) + alias.confirmedCount,
        createdAt: existing.createdAt, // Keep original creation time
      });
    } else {
      // Add new alias
      await db.searchAliases.add({
        alias: alias.alias,
        targetAddress: alias.targetAddress,
        confidence: alias.confidence,
        createdAt: alias.lastSeen,
        confirmedCount: alias.confirmedCount,
      });
    }
  } catch {
    // Error handled silently
  }
}

/**
 * Clear old aliases that haven't been confirmed recently
 * (Aliases with low confidence or old timestamps)
 */
export async function cleanupOldAliases(): Promise<void> {
  try {
    const { db } = await import("./db");

    // Check if searchAliases table exists (v19+)
    if (!("searchAliases" in db)) {
      return;
    }

    const cutoffTime = Date.now() - TRACKING_WINDOW_MS;

    // Delete aliases with low confidence or old timestamps
    await db.searchAliases
      .where("confidence")
      .below(MIN_CONFIDENCE)
      .or("createdAt")
      .below(cutoffTime)
      .delete();
  } catch {
    // Error handled silently
  }
}

/**
 * Apply learned aliases to boost search results
 *
 * @param query - The user's search query
 * @param results - The search results to boost
 * @returns Boosted results (modified in place)
 */
export async function applyAliasesToResults(
  query: string,
  results: SearchResult[]
): Promise<SearchResult[]> {
  const aliases = await getLearnedAliases(query);

  if (aliases.length === 0) {
    return results;
  }

  // Create a map of addresses to boost
  const addressBoosts = new Map<string, number>();

  for (const alias of aliases) {
    const boostScore = alias.confidence * 20; // Max +20 points
    addressBoosts.set(alias.targetAddress.toLowerCase(), boostScore);
  }

  // Apply boosts to results
  for (const result of results) {
    const boost = addressBoosts.get(result.address.toLowerCase());
    if (boost) {
      result.score = (result.score || 0) + boost;
    }
  }

  return results;
}

/**
 * Initialize the alias discovery service
 * Sets up periodic cleanup of old aliases
 */
export function initializeAliasDiscovery(): void {
  // Run cleanup every 24 hours
  setInterval(
    () => {
      cleanupOldAliases().catch(() => {});
    },
    24 * 60 * 60 * 1000
  );

  // Run initial cleanup after 5 minutes
  setTimeout(
    () => {
      cleanupOldAliases().catch(() => {});
    },
    5 * 60 * 1000
  );
}
