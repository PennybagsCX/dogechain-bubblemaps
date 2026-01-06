/**
 * Abbreviation Cache
 *
 * LRU in-memory cache + IndexedDB persistence for token abbreviations.
 * Provides instant access to cached abbreviations with 7-day TTL.
 *
 * Performance: ~1ms for memory hits, ~10ms for IndexedDB hits
 */

import { db } from "./db";
import { generateAbbreviations, TokenInfo } from "./abbreviationGenerator";

/**
 * Cache entry interface
 */
interface CacheEntry {
  tokenAddress: string;
  abbreviations: string[];
  generatedAt: number;
  expiresAt: number;
}

/**
 * Database interface for abbreviation cache
 */
export interface DbAbbreviationCache {
  tokenAddress: string; // Primary key
  abbreviations: string[];
  generatedAt: number;
  expiresAt: number;
}

/**
 * LRU in-memory + IndexedDB cache for token abbreviations
 */
class AbbreviationCache {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_MEMORY_ENTRIES = 500;
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  /**
   * Get cached abbreviations for a token address
   * Checks memory first (instant), then IndexedDB (persisted)
   *
   * @param address - Token contract address
   * @returns Array of abbreviations or null if not found/expired
   */
  async get(address: string): Promise<string[] | null> {
    const normalizedAddress = address.toLowerCase();

    // Check memory cache first (instant)
    const memEntry = this.memoryCache.get(normalizedAddress);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.abbreviations;
    }

    // Check IndexedDB cache (persisted)
    try {
      // Type assertion to bypass TypeScript checking for dynamic table access
      const abbreviationCacheTable = (db as any).abbreviationCache;

      if (abbreviationCacheTable) {
        const dbEntry = await abbreviationCacheTable.get(normalizedAddress);
        if (dbEntry && dbEntry.expiresAt > Date.now()) {
          // Promote to memory cache (LRU)
          this.setMemory(normalizedAddress, dbEntry);
          return dbEntry.abbreviations;
        }
      }
    } catch (error) {
      console.warn("[AbbreviationCache] Failed to read from IndexedDB:", error);
    }

    return null;
  }

  /**
   * Set abbreviations for a token address (writes to both memory and IndexedDB)
   *
   * @param address - Token contract address
   * @param abbreviations - Array of abbreviations to cache
   */
  async set(address: string, abbreviations: string[]): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const now = Date.now();

    const entry: CacheEntry = {
      tokenAddress: normalizedAddress,
      abbreviations,
      generatedAt: now,
      expiresAt: now + this.CACHE_TTL,
    };

    // Set memory cache (with LRU eviction)
    this.setMemory(normalizedAddress, entry);

    // Set IndexedDB cache (persisted)
    try {
      // Type assertion to bypass TypeScript checking for dynamic table access
      const abbreviationCacheTable = (db as any).abbreviationCache;

      if (abbreviationCacheTable) {
        await abbreviationCacheTable.put(entry);
      }
    } catch (error) {
      console.warn("[AbbreviationCache] Failed to write to IndexedDB:", error);
    }
  }

  /**
   * Get or generate abbreviations for a token address
   * If not in cache, generates and caches them
   *
   * @param address - Token contract address
   * @param tokenInfo - Token info (name, symbol) for generation if not cached
   * @returns Array of abbreviations
   */
  async getOrGenerate(address: string, tokenInfo: TokenInfo): Promise<string[]> {
    // Try to get from cache
    const cached = await this.get(address);
    if (cached) {
      return cached;
    }

    // Generate new abbreviations
    const abbreviations = generateAbbreviations(tokenInfo);

    // Cache them
    if (abbreviations.length > 0) {
      await this.set(address, abbreviations);
    }

    return abbreviations;
  }

  /**
   * Set entry in memory cache with LRU eviction
   */
  private setMemory(address: string, entry: CacheEntry): void {
    // LRU eviction: if at capacity, remove oldest entry
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(address, entry);
  }

  /**
   * Clear expired entries from IndexedDB
   * Returns the number of entries cleared
   */
  async clearExpired(): Promise<number> {
    try {
      const abbreviationCacheTable = (db as any).abbreviationCache;

      if (!abbreviationCacheTable) {
        return 0;
      }

      const now = Date.now();
      const allEntries = await abbreviationCacheTable.toArray();
      const expiredEntries = allEntries.filter((e: CacheEntry) => e.expiresAt < now);

      for (const entry of expiredEntries) {
        await abbreviationCacheTable.delete(entry.tokenAddress);
      }

      // Also clear from memory
      for (const entry of expiredEntries) {
        this.memoryCache.delete(entry.tokenAddress);
      }

      if (expiredEntries.length > 0) {
        console.log(`[AbbreviationCache] Cleared ${expiredEntries.length} expired entries`);
      }

      return expiredEntries.length;
    } catch (error) {
      console.error("[AbbreviationCache] Failed to clear expired entries:", error);
      return 0;
    }
  }

  /**
   * Clear all entries from both memory and IndexedDB
   */
  async clearAll(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();

    // Clear IndexedDB
    try {
      const abbreviationCacheTable = (db as any).abbreviationCache;

      if (abbreviationCacheTable) {
        await abbreviationCacheTable.clear();
        console.log("[AbbreviationCache] Cleared all entries");
      }
    } catch (error) {
      console.error("[AbbreviationCache] Failed to clear all entries:", error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; oldestEntry?: number; newestEntry?: number } {
    const entries = Array.from(this.memoryCache.values());

    if (entries.length === 0) {
      return { memorySize: 0 };
    }

    const oldestEntry = Math.min(...entries.map((e) => e.generatedAt));
    const newestEntry = Math.max(...entries.map((e) => e.generatedAt));

    return {
      memorySize: this.memoryCache.size,
      oldestEntry,
      newestEntry,
    };
  }
}

// Export singleton instance
export const abbreviationCache = new AbbreviationCache();

/**
 * Synchronous in-memory cache for use in scoring functions
 * This is a subset of the full cache, used in calculateSearchRelevance
 */
const syncMemoryCache = new Map<string, string[]>();

/**
 * Add abbreviations to sync cache (called by search functions)
 */
export function addToSyncCache(address: string, abbreviations: string[]): void {
  syncMemoryCache.set(address.toLowerCase(), abbreviations);
}

/**
 * Get abbreviations from sync cache (synchronous, for scoring)
 */
export function getCachedAbbreviationsSync(address: string): string[] | null {
  return syncMemoryCache.get(address.toLowerCase()) || null;
}

/**
 * Clear sync cache (call periodically to prevent memory bloat)
 */
export function clearSyncCache(): void {
  syncMemoryCache.clear();
}

/**
 * Convenience function to get cached abbreviations
 */
export async function getCachedAbbreviations(
  address: string,
  tokenInfo?: TokenInfo
): Promise<string[]> {
  if (tokenInfo) {
    return abbreviationCache.getOrGenerate(address, tokenInfo);
  }
  return abbreviationCache.get(address);
}

/**
 * Initialize abbreviation cache by clearing expired entries
 * Should be called once on app startup
 */
export async function initializeAbbreviationCache(): Promise<void> {
  try {
    console.log("[AbbreviationCache] Initializing...");
    await abbreviationCache.clearExpired();
    const stats = abbreviationCache.getStats();
    console.log(`[AbbreviationCache] Initialized with ${stats.memorySize} entries in memory`);
  } catch (error) {
    console.error("[AbbreviationCache] Failed to initialize:", error);
  }
}
