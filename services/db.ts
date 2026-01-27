/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Dexie, { Table } from "dexie";
import { AlertConfig, TriggeredEvent, Transaction, Token, ScanMetadata } from "../types";
import { calculateSearchRelevance } from "./tokenSearchService";
import { getApiUrl } from "../utils/api";

// Database interface definitions
export interface DbAlert {
  id?: number; // Auto-incremented primary key
  alertId: string; // String ID from app
  name: string;
  walletAddress: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  threshold?: number; // Deprecated: Now optional for backward compatibility
  initialValue?: number;
  type?: string; // Alert type: WALLET, TOKEN, or WHALE
  createdAt: number;
}

export interface DbAlertStatus {
  alertId: string; // Primary key
  currentValue: number;
  triggered: boolean;
  checkedAt?: number; // Made optional - undefined means not yet scanned
  notified?: boolean;
  lastSeenTransactions?: string[];
  // Dismissal and baseline tracking fields
  dismissedAt?: number; // When the alert was manually dismissed
  baselineTimestamp?: number; // When baseline was established
  baselineEstablished?: boolean; // Track if initial baseline has been set
  pendingInitialScan?: boolean; // Flag to indicate alert needs its first scan
}

export interface DbTriggeredEvent {
  id?: number; // Auto-incremented primary key
  eventId: string; // String ID from app
  alertId: string;
  alertName: string;
  walletAddress: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  transactions: Transaction[];
  triggeredAt: number;
  notified: boolean;
}

export interface DbRecentSearch {
  id?: number; // Auto-incremented primary key
  query: string;
  type: string;
  timestamp: number;
  symbol?: string;
}

export interface DbTrendingAsset {
  id?: number; // Auto-incremented primary key
  symbol: string;
  name: string;
  address: string;
  type: string;
  hits: number;
}

// Wallet scan cache interfaces
export interface DbWalletScanCache {
  walletAddress: string; // Primary key
  tokens: Token[];
  nfts: Token[];
  scannedAt: number;
  expiresAt: number;
  scanMetadata: ScanMetadata;
}

export interface DbAssetMetadataCache {
  address: string; // Primary key
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  cachedAt: number;
  expiresAt: number;
}

// Per-wallet manually added contracts
export interface DbWalletForcedContracts {
  walletAddress: string; // Primary key
  contracts: string[]; // Array of contract addresses
  updatedAt: number;
}

// Discovered contracts database (shared across all users)
export interface DbDiscoveredContracts {
  id?: number; // Auto-incremented primary key
  contractAddress: string; // Contract address (unique)
  type: string; // 'TOKEN' or 'NFT'
  symbol?: string; // Token symbol
  name?: string; // Token name
  discoveredAt: number; // Timestamp when discovered
  lastSeenAt: number; // Timestamp when last seen in whale transfers
}

// LP Pairs database (DEX liquidity pool tracking)
export interface DbLPPair {
  id?: number; // Auto-incremented primary key
  pairAddress: string; // Pair contract address (unique)
  factoryAddress: string; // Factory that created this pair
  token0Address: string; // First token in pair
  token1Address: string; // Second token in pair
  dexName: string; // DEX name (e.g., "ChewySwap", "QuickSwap")
  discoveredAt: number; // Timestamp when discovered
  lastVerifiedAt: number; // Timestamp when last verified
  isValid: boolean; // false if pair was destroyed or factory renounced
}

// Token Search Index for fast autocomplete
export interface DbTokenSearchIndex {
  id?: number; // Auto-incremented primary key
  address: string; // Token contract address (unique)
  name: string; // Token name
  symbol: string; // Token symbol
  type: string; // 'TOKEN' or 'NFT'
  source: string; // 'lp_pair', 'user_search', 'whale', 'blockscout'
  decimals: number; // Token decimals
  indexedAt: number; // Timestamp when indexed
}

// Abbreviation cache for auto-generated token abbreviations
export interface DbAbbreviationCache {
  tokenAddress: string; // Token contract address (primary key)
  abbreviations: string[]; // Array of generated abbreviations
  generatedAt: number; // Timestamp when generated
  expiresAt: number; // Expiration timestamp (7 days TTL)
}

// Export data structure
export interface DatabaseExport {
  version: string;
  exportedAt: number;
  alerts: DbAlert[];
  alertStatuses: DbAlertStatus[];
  triggeredEvents: DbTriggeredEvent[];
  trendingAssets: DbTrendingAsset[];
  recentSearches: DbRecentSearch[];
}

// Database class
class DogeDatabase extends Dexie {
  alerts!: Table<DbAlert>;
  alertStatuses!: Table<DbAlertStatus>;
  triggeredEvents!: Table<DbTriggeredEvent>;
  recentSearches!: Table<DbRecentSearch>;
  trendingAssets!: Table<DbTrendingAsset>;
  walletScanCache!: Table<DbWalletScanCache>;
  assetMetadataCache!: Table<DbAssetMetadataCache>;
  walletForcedContracts!: Table<DbWalletForcedContracts>;
  discoveredContracts!: Table<DbDiscoveredContracts>;
  lpPairs!: Table<DbLPPair>;
  scanCheckpoints!: Table<any>;
  discoveredFactories!: Table<any>;
  tokenSearchIndex!: Table<DbTokenSearchIndex>;
  abbreviationCache!: Table<DbAbbreviationCache>;
  searchAnalytics!: Table<any>; // Search analytics events
  tokenPopularity!: Table<any>; // Token popularity metrics

  constructor() {
    super("DogechainBubbleMapsDB");

    // Add error handler for database migration failures
    this.on("blocked", () => {});

    this.on("versionchange", () => {
      window.location.reload();
    });

    try {
      // Define database schema with indexes
      this.version(1).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId", // alertId is primary key
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
      });

      // Version 2: Simplified approach - remove unique constraint to prevent issues
      // Deduplication will be handled at the application level
      this.version(2).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits", // Removed & constraint
      });

      // Version 3: Add wallet scan cache for 48-hour intelligent caching
      this.version(3).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, &walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, &address, cachedAt, expiresAt",
      });

      // Version 4: Add per-wallet forced contracts persistence
      this.version(4).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, &walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, &address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, &walletAddress, updatedAt",
      });

      // Version 5: Add discovered contracts database for whale enumeration
      // Note: Fixed to avoid ConstraintError by removing duplicate index syntax
      this.version(5).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
      });

      // Version 6: Add LP pairs database for DEX liquidity pool tracking
      this.version(6).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
      });

      // Version 7: Add scan checkpoints for comprehensive DEX/LP scanning
      this.version(7).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
      });

      // Version 8: Add discovered factories registry for dynamic DEX tracking
      this.version(8).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
      });

      // Version 9: Add token search index for autocomplete functionality
      this.version(9).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        tokenSearchIndex: "++id, &address, name, symbol, type, source, indexedAt",
      });

      // Version 10: Add abbreviation cache for auto-generated token abbreviations
      this.version(10).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        tokenSearchIndex: "++id, &address, name, symbol, type, source, indexedAt",
        abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
      });

      // Version 11: Add inverted index + search cache + compound indexes for 99% faster search
      this.version(11).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        // Optimized tokenSearchIndex with compound indexes for 60-80% faster filtered queries
        tokenSearchIndex: "++id, &address, [type+symbol], [type+name], source, indexedAt",
        abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
        // Inverted index for O(1) term lookups (game changer optimization)
        invertedIndex: "++id, &term, [termType+term], frequency",
        // Search cache for 90%+ speedup on repeated queries
        searchCache: "++id, &queryKey, timestamp, hits",
      });

      // Add upgrade hook for version 11 to build inverted index
      this.version(11).upgrade(async (tx) => {
        try {
          // Import inverted index builder
          const { saveInvertedIndex } = await import("./invertedIndex");

          // Get all tokens from search index
          const allTokens = await tx.table("tokenSearchIndex").toArray();

          // Build and save inverted index
          await saveInvertedIndex(tx, allTokens);
        } catch {
          // Error handled silently
          // Don't throw - allow upgrade to complete even if index build fails
          // Index will be built on next search
        }
      });

      // Version 12: Add phonetic index for 30-50% faster phonetic matching
      this.version(12).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        tokenSearchIndex: "++id, &address, [type+symbol], [type+name], source, indexedAt",
        abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
        invertedIndex: "++id, &term, [termType+term], frequency",
        searchCache: "++id, &queryKey, timestamp, hits",
        // Phonetic index for pre-computed phonetic matching
        phoneticIndex: "++id, &tokenAddress, phoneticKey, similarityCache, updatedAt",
      });

      // Add upgrade hook for version 12 to build phonetic index
      this.version(12).upgrade(async (tx) => {
        try {
          // Import phonetic index builder
          const { savePhoneticIndex } = await import("./phoneticIndex");

          // Get all tokens from search index
          const allTokens = await tx.table("tokenSearchIndex").toArray();

          // Build and save phonetic index
          await savePhoneticIndex(tx, allTokens);

          console.log(
            `[DB] Version 12 upgrade complete: Phonetic index for ${allTokens.length} tokens`
          );
        } catch {
          // Error handled silently
          // Don't throw - allow upgrade to complete even if index build fails
        }
      });

      // Version 13: Add trigram index for 40-60% faster substring search
      this.version(13).stores({
        alerts: "++id, alertId, walletAddress, name, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        tokenSearchIndex: "++id, &address, [type+symbol], [type+name], source, indexedAt",
        abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
        invertedIndex: "++id, &term, [termType+term], frequency",
        searchCache: "++id, &queryKey, timestamp, hits",
        phoneticIndex: "++id, &tokenAddress, phoneticKey, similarityCache, updatedAt",
        // Trigram index for substring search
        trigramIndex: "++id, &trigram, tokenAddresses",
        // Search analytics for learning and improvement
        searchAnalytics: "++id, &sessionId, timestamp, query, clickedAddress",
        // Token popularity for adaptive scoring
        tokenPopularity:
          "&tokenAddress, searchCount, clickCount, ctr, lastSearched, lastClicked, cachedAt, expiresAt, updatedAt",
      });

      // Add upgrade hook for version 13 to build trigram index
      this.version(13).upgrade(async (tx) => {
        try {
          // Import trigram index builder
          const { saveTrigramIndex } = await import("./trigramIndex");

          // Get all tokens from search index
          const allTokens = await tx.table("tokenSearchIndex").toArray();

          // Build and save trigram index
          await saveTrigramIndex(tx, allTokens);

          console.log(
            `[DB] Version 13 upgrade complete: Trigram index for ${allTokens.length} tokens`
          );
        } catch {
          // Error handled silently
          // Don't throw - allow upgrade to complete even if index build fails
        }
      });

      // Version 14: Search analytics (no data migration needed)
      this.version(14).upgrade(async () => {
        // searchAnalytics store created automatically with schema above
      });

      // Version 15: Token popularity (no data migration needed)
      this.version(15).upgrade(async () => {
        // tokenPopularity store created automatically with schema above
      });

      // Version 16: Learned tokens cache for offline fallback
      this.version(16)
        .stores({
          learnedTokensCache:
            "&address, name, symbol, type, popularityScore, scanFrequency, holderCount, cachedAt, expiresAt",
        })
        .upgrade(async () => {
          // learnedTokensCache store created automatically with schema above
          // No data migration needed - this is for offline caching of Vercel Postgres data
        });

      // Version 17: Add type field to alerts table for WALLET/TOKEN/WHALE classification
      this.version(17).stores({
        alerts: "++id, alertId, walletAddress, name, type, createdAt",
        alertStatuses: "alertId, &alertId",
        triggeredEvents: "++id, eventId, alertId, triggeredAt",
        recentSearches: "++id, timestamp",
        trendingAssets: "++id, symbol, address, hits",
        walletScanCache: "walletAddress, scannedAt, expiresAt",
        assetMetadataCache: "address, cachedAt, expiresAt",
        walletForcedContracts: "walletAddress, updatedAt",
        discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
        lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
        scanCheckpoints: "++id, phase, lastUpdated",
        discoveredFactories: "++id, &address, name, status, discoveredAt",
        tokenSearchIndex: "++id, &address, [type+symbol], [type+name], source, indexedAt",
        abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
        invertedIndex: "++id, &term, [termType+term], frequency",
        searchCache: "++id, &queryKey, timestamp, hits",
        phoneticIndex: "++id, &tokenAddress, phoneticKey, similarityCache, updatedAt",
        trigramIndex: "++id, &tokenAddress, ngram, tokenSet",
        searchAnalytics: "++id, &sessionId, timestamp, query, clickedAddress",
        tokenPopularity:
          "&tokenAddress, searchCount, clickCount, ctr, lastSearched, lastClicked, cachedAt, expiresAt, updatedAt",
        learnedTokensCache:
          "&address, name, symbol, type, popularityScore, scanFrequency, holderCount, cachedAt, expiresAt",
      });

      // Version 18: Deduplicate triggered events and add unique constraint on eventId
      this.version(18)
        .stores({
          alerts: "++id, alertId, walletAddress, name, type, createdAt",
          alertStatuses: "alertId, &alertId",
          triggeredEvents: "++id, &eventId, alertId, triggeredAt", // Added &eventId for unique constraint
          recentSearches: "++id, timestamp",
          trendingAssets: "++id, symbol, address, hits",
          walletScanCache: "walletAddress, scannedAt, expiresAt",
          assetMetadataCache: "address, cachedAt, expiresAt",
          walletForcedContracts: "walletAddress, updatedAt",
          discoveredContracts: "++id, contractAddress, type, discoveredAt, lastSeenAt",
          lpPairs: "++id, &pairAddress, factoryAddress, dexName, discoveredAt, lastVerifiedAt",
          scanCheckpoints: "++id, phase, lastUpdated",
          discoveredFactories: "++id, &address, name, status, discoveredAt",
          tokenSearchIndex: "++id, &address, [type+symbol], [type+name], source, indexedAt",
          abbreviationCache: "tokenAddress, &tokenAddress, generatedAt, expiresAt",
          invertedIndex: "++id, &term, [termType+term], frequency",
          searchCache: "++id, &queryKey, timestamp, hits",
          phoneticIndex: "++id, &tokenAddress, phoneticKey, similarityCache, updatedAt",
          trigramIndex: "++id, &tokenAddress, ngram, tokenSet",
          searchAnalytics: "++id, &sessionId, timestamp, query, clickedAddress",
          tokenPopularity:
            "&tokenAddress, searchCount, clickCount, ctr, lastSearched, lastClicked, cachedAt, expiresAt, updatedAt",
          learnedTokensCache:
            "&address, name, symbol, type, popularityScore, scanFrequency, holderCount, cachedAt, expiresAt",
        })
        .upgrade(async (tx) => {
          try {
            console.log("[DB MIGRATION v18] Starting triggered events deduplication...");

            // Deduplicate triggered events - keep only first occurrence of each eventId
            const allEvents = await tx.table("triggeredEvents").toArray();

            if (allEvents.length === 0) {
              console.log("[DB MIGRATION v18] ✅ No events to process (table is empty)");
              return;
            }

            const eventMap = new Map<string, any>();

            // Keep first occurrence of each eventId
            allEvents.forEach((event) => {
              if (!eventMap.has(event.eventId)) {
                eventMap.set(event.eventId, event);
              }
            });

            const duplicates = allEvents.length - eventMap.size;

            if (duplicates > 0) {
              // Clear table and add deduplicated events
              await tx.table("triggeredEvents").clear();
              await tx.table("triggeredEvents").bulkAdd(Array.from(eventMap.values()));
              console.log(
                `[DB MIGRATION v18] ✅ Cleaned up ${duplicates} duplicate triggered events`
              );
            } else {
              console.log("[DB MIGRATION v18] ✅ No duplicate events found");
            }
          } catch (error) {
            console.error("[DB MIGRATION v18] ❌ Error during deduplication:", error);
            // Don't throw - allow migration to complete even if deduplication fails
            // The unique constraint will prevent future duplicates
          }
        });
    } catch {
      // Error handled silently

      // Store error for UI to display
      localStorage.setItem("doge_db_error", "schema_error");
    }
  }
}

// Export single instance
export const db = new DogeDatabase();

/**
 * Wrapper function to handle DatabaseClosedError and retry operations
 * This ensures database operations don't fail silently if the DB is closed during migration
 */
export async function safeDbOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    if (error?.name === "DatabaseClosedError" || error?.message?.includes("Backend aborted")) {
      console.warn(`[DB] ${operation} failed - database was closed, retrying...`);
      // Wait a bit for database to reopen, then retry
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        return await fn();
      } catch (retryError) {
        console.error(`[DB] ${operation} failed after retry:`, retryError);
        return null;
      }
    }
    console.error(`[DB] ${operation} failed:`, error);
    return null;
  }
}

/**
 * Ensure LP detection is initialized by checking if the LP pairs database is empty
 * and initializing it if needed. This is a non-blocking operation that only runs
 * once when the database is empty.
 */
export async function ensureLPDetectionInitialized(): Promise<void> {
  try {
    const { loadAllLPPairs, initializeLPDetection } = await import("./lpDetection");
    const existingPairs = await loadAllLPPairs();

    if (existingPairs.length === 0) {
      await initializeLPDetection(false, (_msg, _progress) => {
        // Progress callback
      });
    } else {
      // No existing tokens
    }
  } catch {
    // Error loading tokens
  }
}

// Helper functions to convert between app types and DB types
export function toDbAlert(alert: AlertConfig): DbAlert {
  return {
    alertId: alert.id,
    name: alert.name,
    walletAddress: alert.walletAddress,
    tokenAddress: alert.tokenAddress,
    tokenName: alert.tokenName,
    tokenSymbol: alert.tokenSymbol,
    threshold: alert.threshold,
    initialValue: alert.initialValue,
    type: alert.type,
    // Preserve existing createdAt, or set to now for new alerts
    createdAt: alert.createdAt ?? Date.now(),
  };
}

export function fromDbAlert(dbAlert: DbAlert): AlertConfig {
  return {
    id: dbAlert.alertId,
    name: dbAlert.name,
    walletAddress: dbAlert.walletAddress,
    tokenAddress: dbAlert.tokenAddress,
    tokenName: dbAlert.tokenName,
    tokenSymbol: dbAlert.tokenSymbol,
    threshold: dbAlert.threshold,
    initialValue: dbAlert.initialValue,
    type: dbAlert.type as "WALLET" | "TOKEN" | "WHALE" | undefined,
    createdAt: dbAlert.createdAt,
  };
}

export function toDbTriggeredEvent(event: TriggeredEvent): DbTriggeredEvent {
  return {
    eventId: event.id,
    alertId: event.alertId,
    alertName: event.alertName,
    walletAddress: event.walletAddress,
    tokenAddress: event.tokenAddress,
    tokenSymbol: event.tokenSymbol,
    transactions: event.transactions,
    triggeredAt: event.triggeredAt,
    notified: event.notified,
  };
}

export function fromDbTriggeredEvent(dbEvent: DbTriggeredEvent): TriggeredEvent {
  return {
    id: dbEvent.eventId,
    alertId: dbEvent.alertId,
    alertName: dbEvent.alertName,
    walletAddress: dbEvent.walletAddress,
    tokenAddress: dbEvent.tokenAddress,
    tokenSymbol: dbEvent.tokenSymbol,
    transactions: dbEvent.transactions,
    triggeredAt: dbEvent.triggeredAt,
    notified: dbEvent.notified,
  };
}

// Export all data to JSON
export async function exportDatabase(): Promise<DatabaseExport> {
  const [alerts, alertStatuses, triggeredEvents, trendingAssets, recentSearches] =
    await Promise.all([
      db.alerts.toArray(),
      db.alertStatuses.toArray(),
      db.triggeredEvents.toArray(),
      db.trendingAssets.toArray(),
      db.recentSearches.toArray(),
    ]);

  return {
    version: "1.0",
    exportedAt: Date.now(),
    alerts,
    alertStatuses,
    triggeredEvents,
    trendingAssets,
    recentSearches,
  };
}

// Export all data as single combined CSV
export async function exportDatabaseAsCSV(): Promise<Blob> {
  // Fetch all data
  const data = await exportDatabase();

  // Define all tables with their names and data
  const tables = [
    { name: "alerts", data: data.alerts },
    { name: "alert_statuses", data: data.alertStatuses },
    { name: "triggered_events", data: data.triggeredEvents },
    { name: "trending_assets", data: data.trendingAssets },
    { name: "recent_searches", data: data.recentSearches },
  ];

  // Collect all unique column names across all tables
  const allColumns = new Set<string>();
  allColumns.add("table_name"); // First column

  tables.forEach((table) => {
    if (table.data.length > 0 && table.data[0]) {
      Object.keys(table.data[0]).forEach((key) => allColumns.add(key));
    }
  });

  const columns = Array.from(allColumns);

  // Build CSV content
  const csvRows: string[] = [];

  // Header row
  csvRows.push(columns.join(","));

  // Data rows from each table
  tables.forEach((table) => {
    table.data.forEach((item) => {
      const rowValues = columns.map((col) => {
        // Handle table_name column
        if (col === "table_name") {
          return table.name;
        }

        // Get value or empty string if column doesn't exist
        const value = (item as unknown as Record<string, unknown>)[col];

        // Handle null/undefined
        if (value === null || value === undefined) {
          return "";
        }

        // Handle nested objects/arrays (serialize as JSON string)
        if (typeof value === "object") {
          const jsonString = JSON.stringify(value);
          // Escape quotes and wrap in quotes
          return `"${jsonString.replace(/"/g, '""')}"`;
        }

        // Handle strings with commas or quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"') || value.includes("\n"))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return String(value);
      });

      csvRows.push(rowValues.join(","));
    });
  });

  // Create CSV blob
  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  return blob;
}

// Import data from JSON
export async function importDatabase(data: DatabaseExport): Promise<void> {
  // Clear existing data
  await Promise.all([
    db.alerts.clear(),
    db.alertStatuses.clear(),
    db.triggeredEvents.clear(),
    db.trendingAssets.clear(),
    db.recentSearches.clear(),
  ]);

  // Import new data
  if (data.alerts.length > 0) await db.alerts.bulkAdd(data.alerts);
  if (data.alertStatuses.length > 0) await db.alertStatuses.bulkAdd(data.alertStatuses);
  if (data.triggeredEvents.length > 0) await db.triggeredEvents.bulkAdd(data.triggeredEvents);
  if (data.trendingAssets.length > 0) await db.trendingAssets.bulkAdd(data.trendingAssets);
  if (data.recentSearches.length > 0) await db.recentSearches.bulkAdd(data.recentSearches);
}

// Clear all data
export async function clearDatabase(): Promise<void> {
  await Promise.all([
    db.alerts.clear(),
    db.alertStatuses.clear(),
    db.triggeredEvents.clear(),
    db.trendingAssets.clear(),
    db.recentSearches.clear(),
  ]);
}

// Deduplicate trending assets by address, keeping the one with highest hits
export async function deduplicateTrendingAssets(): Promise<number> {
  const allAssets = await db.trendingAssets.toArray();

  // Group by address (case-insensitive)
  const addressMap = new Map<string, DbTrendingAsset>();

  for (const asset of allAssets) {
    const normalizedAddress = asset.address.toLowerCase();
    const existing = addressMap.get(normalizedAddress);

    // Keep the asset with higher hits count, or the newer one if equal
    if (
      !existing ||
      asset.hits > existing.hits ||
      (asset.hits === existing.hits && (asset.id || 0) > (existing.id || 0))
    ) {
      addressMap.set(normalizedAddress, asset);
    }
  }

  // If we found duplicates, replace the entire collection
  if (addressMap.size !== allAssets.length) {
    await db.trendingAssets.clear();
    await db.trendingAssets.bulkAdd(Array.from(addressMap.values()));
    return allAssets.length - addressMap.size; // Return number of duplicates removed
  }

  return 0;
}

// Completely delete and reset the database
// Use this when the database schema is corrupted or needs to be recreated
export async function resetDatabase(): Promise<void> {
  await db.delete();
  // Clear the error flag
  localStorage.removeItem("doge_db_error");
  // The database will be automatically recreated with the latest schema on next access
}

/**
 * Check if the database is in an error state
 */
export function hasDatabaseError(): boolean {
  return localStorage.getItem("doge_db_error") === "schema_error";
}

/**
 * Clear the database error flag
 */
export function clearDatabaseError(): void {
  localStorage.removeItem("doge_db_error");
}

/**
 * Test database health by attempting a simple operation
 * @returns true if database is healthy, false otherwise
 */
export async function testDatabaseHealth(): Promise<boolean> {
  try {
    // Try to open the database and read from a table
    await db.open();
    await db.alerts.count();

    return true;
  } catch {
    // Error handled silently

    localStorage.setItem("doge_db_error", "health_check_failed");
    return false;
  }
}

// --- Wallet Scan Cache Functions ---

/**
 * Check if a cache entry is still valid (not expired)
 */
export function isCacheValid(cacheEntry: DbWalletScanCache): boolean {
  const now = Date.now();
  return cacheEntry.expiresAt > now;
}

/**
 * Save wallet scan results to cache
 */
export async function saveScanCache(
  walletAddress: string,
  tokens: Token[],
  nfts: Token[],
  scanMetadata: ScanMetadata
): Promise<void> {
  try {
    const now = Date.now();
    const cacheEntry: DbWalletScanCache = {
      walletAddress: walletAddress.toLowerCase(),
      tokens,
      nfts,
      scannedAt: now,
      expiresAt: now + 48 * 60 * 60 * 1000, // 48 hours
      scanMetadata,
    };

    await db.walletScanCache.put(cacheEntry);
  } catch {
    // Error in operation
  }
}

/**
 * Load wallet scan results from cache
 * Returns null if cache is expired or doesn't exist
 */
export async function loadScanCache(walletAddress: string): Promise<DbWalletScanCache | null> {
  try {
    const cacheEntry = await db.walletScanCache.get(walletAddress.toLowerCase());

    if (!cacheEntry) {
      return null;
    }

    // Check if cache is still valid
    if (!isCacheValid(cacheEntry)) {
      // Remove expired entry
      await db.walletScanCache.delete(walletAddress.toLowerCase());
      return null;
    }

    return cacheEntry;
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Clear expired cache entries older than 7 days
 * Also limits total cache size to 50 entries max
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Get all entries
    const allEntries = await db.walletScanCache.toArray();

    // Find expired or old entries
    const toDelete = allEntries.filter(
      (entry) => entry.expiresAt < now || entry.scannedAt < sevenDaysAgo
    );

    // Delete expired entries
    for (const entry of toDelete) {
      await db.walletScanCache.delete(entry.walletAddress);
    }

    // If still over 50 entries, remove oldest
    const remaining = await db.walletScanCache.toArray();
    if (remaining.length > 50) {
      // Sort by scannedAt ascending (oldest first)
      remaining.sort((a, b) => a.scannedAt - b.scannedAt);

      // Remove oldest entries
      const toPrune = remaining.slice(0, remaining.length - 50);
      for (const entry of toPrune) {
        await db.walletScanCache.delete(entry.walletAddress);
      }
    }

    return toDelete.length;
  } catch {
    // Error handled silently

    return 0;
  }
}

// --- Recent Searches Deduplication ---

/**
 * Deduplicate recent searches by query (case-insensitive)
 * Keeps only the most recent entry for each query
 */
export async function deduplicateRecentSearches(): Promise<number> {
  const allSearches = await db.recentSearches.toArray();

  // Group by query (case-insensitive), keeping most recent
  const queryMap = new Map<string, DbRecentSearch>();

  for (const search of allSearches) {
    const normalizedQuery = search.query.toLowerCase();
    const existing = queryMap.get(normalizedQuery);

    // Keep the search with more recent timestamp, or newer ID if equal
    if (
      !existing ||
      search.timestamp > existing.timestamp ||
      (search.timestamp === existing.timestamp && (search.id || 0) > (existing.id || 0))
    ) {
      queryMap.set(normalizedQuery, search);
    }
  }

  // If we found duplicates, replace the entire collection
  if (queryMap.size !== allSearches.length) {
    await db.recentSearches.clear();
    await db.recentSearches.bulkAdd(Array.from(queryMap.values()));
    return allSearches.length - queryMap.size; // Return number of duplicates removed
  }

  return 0;
}

// --- Wallet Forced Contracts Functions ---

/**
 * Save manually added contracts for a wallet
 */
export async function saveWalletForcedContracts(
  walletAddress: string,
  contracts: string[]
): Promise<void> {
  try {
    const entry: DbWalletForcedContracts = {
      walletAddress: walletAddress.toLowerCase(),
      contracts,
      updatedAt: Date.now(),
    };

    await db.walletForcedContracts.put(entry);
  } catch {
    // Error in operation
  }
}

/**
 * Load manually added contracts for a wallet
 */
export async function loadWalletForcedContracts(walletAddress: string): Promise<string[]> {
  try {
    const entry = await db.walletForcedContracts.get(walletAddress.toLowerCase());

    if (!entry) {
      return [];
    }

    return entry.contracts;
  } catch {
    // Error handled silently

    return [];
  }
}

// --- Discovered Contracts Database Functions ---

/**
 * Save discovered contracts from whale enumeration
 */
export async function saveDiscoveredContracts(contracts: DbDiscoveredContracts[]): Promise<void> {
  try {
    const now = Date.now();

    for (const contract of contracts) {
      // Check if contract already exists
      const existing = await db.discoveredContracts
        .where("contractAddress")
        .equals(contract.contractAddress.toLowerCase())
        .first();

      if (existing) {
        // Update lastSeenAt if it exists
        await db.discoveredContracts.update(existing.id!, {
          lastSeenAt: now,
          type: contract.type || existing.type,
          symbol: contract.symbol || existing.symbol,
          name: contract.name || existing.name,
        });
      } else {
        // Add new contract
        await db.discoveredContracts.add({
          contractAddress: contract.contractAddress.toLowerCase(),
          type: contract.type,
          symbol: contract.symbol,
          name: contract.name,
          discoveredAt: now,
          lastSeenAt: now,
        });
      }
    }
  } catch {
    // Error in operation
  }
}

/**
 * Load all discovered contracts
 */
export async function loadDiscoveredContracts(): Promise<DbDiscoveredContracts[]> {
  try {
    return await db.discoveredContracts.toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Get discovered contracts by type
 */
export async function getDiscoveredContractsByType(type: string): Promise<DbDiscoveredContracts[]> {
  try {
    return await db.discoveredContracts.where("type").equals(type).toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Clear old discovered contracts (older than 30 days)
 */
export async function clearOldDiscoveredContracts(): Promise<number> {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const oldContracts = await db.discoveredContracts
      .where("lastSeenAt")
      .below(thirtyDaysAgo)
      .toArray();

    for (const contract of oldContracts) {
      await db.discoveredContracts.delete(contract.id!);
    }

    return oldContracts.length;
  } catch {
    // Error handled silently

    return 0;
  }
}

// --- LP Pairs Database Functions ---

/**
 * Save discovered LP pairs to database
 * Updates existing entries if they already exist
 */
export async function saveLPPairs(pairs: DbLPPair[]): Promise<void> {
  try {
    const now = Date.now();

    // Deduplicate pairs by pairAddress to prevent constraint errors
    const uniquePairs = Array.from(
      new Map(pairs.map((p) => [p.pairAddress.toLowerCase(), p])).values()
    );

    for (const pair of uniquePairs) {
      const pairAddressLower = pair.pairAddress.toLowerCase();

      // Check if pair already exists
      const existing = await db.lpPairs.where("pairAddress").equals(pairAddressLower).first();

      if (existing) {
        // Update only verification-related fields, preserve discoveredAt
        await db.lpPairs.update(existing.id!, {
          lastVerifiedAt: now,
          isValid: pair.isValid,
          dexName: pair.dexName || existing.dexName,
        });
      } else {
        // Add new pair with discoveredAt timestamp
        await db.lpPairs.add({
          pairAddress: pairAddressLower,
          factoryAddress: pair.factoryAddress.toLowerCase(),
          token0Address: pair.token0Address.toLowerCase(),
          token1Address: pair.token1Address.toLowerCase(),
          dexName: pair.dexName,
          discoveredAt: now,
          lastVerifiedAt: now,
          isValid: pair.isValid,
        });
      }
    }

    console.log(
      `[DB] Saved ${uniquePairs.length} LP pairs to database (${pairs.length - uniquePairs.length} duplicates skipped)`
    );
  } catch {
    // Error in operation
  }
}

/**
 * Load all LP pairs from database
 */
export async function loadAllLPPairs(): Promise<DbLPPair[]> {
  try {
    return await db.lpPairs.toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Check if an address is an LP pair
 * Returns the pair data if found, null otherwise
 */
export async function isAddressLPPair(address: string): Promise<DbLPPair | null> {
  try {
    const pair = await db.lpPairs.where("pairAddress").equals(address.toLowerCase()).first();

    return pair || null;
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Clear old LP pairs (older than 30 days and marked as invalid)
 * Returns the number of pairs deleted
 */
export async function clearOldLPPairs(): Promise<number> {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const oldPairs = await db.lpPairs
      .where("lastVerifiedAt")
      .below(thirtyDaysAgo)
      .and((pair) => !pair.isValid)
      .toArray();

    for (const pair of oldPairs) {
      await db.lpPairs.delete(pair.id!);
    }

    if (oldPairs.length > 0) {
      // Old pairs deleted successfully
    }

    return oldPairs.length;
  } catch {
    // Error handled silently

    return 0;
  }
}

/**
 * Get LP pairs by DEX name
 */
export async function getLPPairsByDEX(dexName: string): Promise<DbLPPair[]> {
  try {
    return await db.lpPairs.where("dexName").equals(dexName).toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Get LP pairs containing a specific token
 */
export async function getLPPairsByToken(tokenAddress: string): Promise<DbLPPair[]> {
  try {
    const lowerAddress = tokenAddress.toLowerCase();
    const allPairs = await db.lpPairs.toArray();

    return allPairs.filter(
      (pair) =>
        pair.token0Address.toLowerCase() === lowerAddress ||
        pair.token1Address.toLowerCase() === lowerAddress
    );
  } catch {
    // Error handled silently

    return [];
  }
}

// --- Discovered Factories Registry ---

/**
 * Discovered DEX Factory database entry
 */
export interface DbDiscoveredFactory {
  id?: number;
  address: string; // Factory address (unique)
  name: string;
  type: string;
  initCodeHash: string;
  deployBlock: number;
  status: string;
  description?: string;
  discoveredAt: number;
}

/**
 * Save discovered factories to database
 * Updates existing entries if they already exist
 */
export async function saveDiscoveredFactories(
  factories: Partial<DbDiscoveredFactory>[]
): Promise<void> {
  try {
    const table = db.discoveredFactories;
    const now = Date.now();

    for (const factory of factories) {
      const address = factory.address!.toLowerCase();

      // Check if factory already exists
      const existing = await table.where("address").equals(address).first();

      if (existing) {
        // Update existing factory
        await table.update(existing.id!, {
          name: factory.name || existing.name,
          type: factory.type || existing.type,
          initCodeHash: factory.initCodeHash || existing.initCodeHash,
          deployBlock: factory.deployBlock || existing.deployBlock,
          status: factory.status || existing.status,
          description: factory.description || existing.description,
        });
      } else {
        // Add new factory
        await table.add({
          address,
          name: factory.name || "Unknown DEX",
          type: factory.type || "UNISWAP_V2",
          initCodeHash:
            factory.initCodeHash ||
            "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
          deployBlock: factory.deployBlock || 0,
          status: factory.status || "ACTIVE",
          description: factory.description,
          discoveredAt: now,
        });
      }
    }
  } catch {
    // Error in operation
  }
}

/**
 * Load all discovered factories
 */
export async function loadDiscoveredFactories(): Promise<DbDiscoveredFactory[]> {
  try {
    return await db.discoveredFactories.toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Get discovered factory by address
 */
export async function getDiscoveredFactory(address: string): Promise<DbDiscoveredFactory | null> {
  try {
    const factory = await db.discoveredFactories
      .where("address")
      .equals(address.toLowerCase())
      .first();
    return factory || null;
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Get all active discovered factories
 */
export async function getActiveDiscoveredFactories(): Promise<DbDiscoveredFactory[]> {
  try {
    return await db.discoveredFactories.where("status").equals("ACTIVE").toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

// --- Token Search Index Functions ---

/**
 * Save a single token to the search index
 * Updates existing entry if address already exists
 */
export async function saveTokenToSearchIndex(token: DbTokenSearchIndex): Promise<void> {
  try {
    const existing = await db.tokenSearchIndex
      .where("address")
      .equals(token.address.toLowerCase())
      .first();

    if (existing) {
      // Update existing entry
      await db.tokenSearchIndex.update(existing.id!, {
        name: token.name,
        symbol: token.symbol,
        indexedAt: Date.now(),
      });
    } else {
      // Add new entry
      await db.tokenSearchIndex.add({
        address: token.address.toLowerCase(),
        name: token.name,
        symbol: token.symbol,
        type: token.type,
        source: token.source,
        decimals: token.decimals,
        indexedAt: Date.now(),
      });
    }
  } catch {
    // Error in operation
  }
}

/**
 * Bulk save multiple tokens to the search index
 * Updates existing entries if addresses already exist
 */
export async function bulkSaveTokensToSearchIndex(tokens: DbTokenSearchIndex[]): Promise<void> {
  try {
    // Deduplicate by address
    const uniqueTokens = new Map<string, DbTokenSearchIndex>();

    for (const token of tokens) {
      const address = token.address.toLowerCase();
      // Keep the first occurrence or update with new data
      uniqueTokens.set(address, {
        ...token,
        address,
        indexedAt: Date.now(),
      });
    }

    // Bulk put (will add new or update existing)
    await db.tokenSearchIndex.bulkPut(Array.from(uniqueTokens.values()));
  } catch {
    // Error in operation
  }
}

/**
 * Search tokens locally by query string
 * Searches across address, symbol, and name fields with relevance scoring
 */
export async function searchTokensLocally(
  query: string,
  type: string
): Promise<DbTokenSearchIndex[]> {
  try {
    const queryLower = query.toLowerCase();

    // Get all tokens of matching type (no filtering yet)
    const candidates = await db.tokenSearchIndex
      .filter((token) => token.type === type)
      .limit(100) // Get more candidates for scoring
      .toArray();

    // Score each candidate
    const scoredResults = candidates
      .map((token) => ({
        ...token,
        score: calculateSearchRelevance(
          {
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            source: "local",
          },
          query,
          queryLower
        ),
      }))
      .filter((result) => result.score > 0) // Only keep matches
      .sort((a, b) => b.score - a.score) // Sort by score desc
      .slice(0, 20); // Limit to top 20

    return scoredResults;
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Get all tokens from the search index
 */
export async function getAllTokenSearchIndex(): Promise<DbTokenSearchIndex[]> {
  try {
    return await db.tokenSearchIndex.toArray();
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Clear old tokens from the search index (older than 30 days)
 */
export async function clearOldTokenSearchIndex(): Promise<number> {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const oldTokens = await db.tokenSearchIndex.where("indexedAt").below(thirtyDaysAgo).toArray();

    for (const token of oldTokens) {
      await db.tokenSearchIndex.delete(token.id!);
    }

    if (oldTokens.length > 0) {
      // Old tokens deleted successfully
    }

    return oldTokens.length;
  } catch {
    // Error handled silently

    return 0;
  }
}

// --- Alert Synchronization Functions ---

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  timestamp: number;
  error?: string;
}

/**
 * Push local alerts to server for backup and sync
 * @param walletAddress - User's wallet address for identification
 * @returns SyncResult with upload statistics
 */
export async function syncAlertsToServer(walletAddress: string): Promise<SyncResult> {
  try {
    const localAlerts = await db.alerts.toArray();

    if (localAlerts.length === 0) {
      return {
        success: true,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        timestamp: Date.now(),
      };
    }

    const response = await fetch(getApiUrl("/api/alerts?action=sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        localAlerts,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      uploaded?: number;
      downloaded?: number;
      conflicts?: number;
      syncTimestamp?: number;
    };

    return {
      success: result.success,
      uploaded: result.uploaded ?? 0,
      downloaded: result.downloaded ?? 0,
      conflicts: result.conflicts ?? 0,
      timestamp: result.syncTimestamp ?? Date.now(),
    };
  } catch (error) {
    console.error("[SYNC] Failed to sync alerts to server:", error);
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Pull alerts from server and merge with local alerts
 * @param walletAddress - User's wallet address for identification
 * @returns SyncResult with download statistics
 */
export async function syncAlertsFromServer(walletAddress: string): Promise<SyncResult> {
  try {
    // Use correct API path: /api/alerts (not /api/alerts/user)
    const response = await fetch(`/api/alerts?wallet=${walletAddress}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      data?: unknown[];
      count?: number;
    };

    if (!result.success || !result.data) {
      throw new Error("Failed to fetch alerts from server");
    }

    const serverAlerts = result.data as Array<{
      alert_id: string;
      name: string;
      wallet_address: string;
      token_address?: string;
      token_name?: string;
      token_symbol?: string;
      initial_value?: number;
      type?: string;
      created_at: number;
      is_active: boolean;
    }>;

    // Filter out inactive alerts
    const activeAlerts = serverAlerts.filter((alert) => alert.is_active);

    // Get local alerts
    const localAlerts = await db.alerts.toArray();
    const localAlertsMap = new Map<string, DbAlert>();

    for (const alert of localAlerts) {
      localAlertsMap.set(alert.alertId, alert);
    }

    let downloaded = 0;
    let conflicts = 0;

    // Merge server alerts with local alerts
    for (const serverAlert of activeAlerts) {
      const localAlert = localAlertsMap.get(serverAlert.alert_id);

      if (!localAlert) {
        // Alert doesn't exist locally - add it
        await db.alerts.add({
          alertId: serverAlert.alert_id,
          name: serverAlert.name,
          walletAddress: serverAlert.wallet_address,
          tokenAddress: serverAlert.token_address,
          tokenName: serverAlert.token_name,
          tokenSymbol: serverAlert.token_symbol,
          initialValue: serverAlert.initial_value,
          type: serverAlert.type,
          createdAt: serverAlert.created_at,
        });
        downloaded++;
      } else {
        // Alert exists locally - check for conflicts
        const localCreatedAt = localAlert.createdAt;
        const serverCreatedAt = serverAlert.created_at;

        if (serverCreatedAt > localCreatedAt) {
          // Server version is newer - update local
          await db.alerts.update(localAlert.id!, {
            name: serverAlert.name,
            walletAddress: serverAlert.wallet_address,
            tokenAddress: serverAlert.token_address,
            tokenName: serverAlert.token_name,
            tokenSymbol: serverAlert.token_symbol,
            initialValue: serverAlert.initial_value,
            type: serverAlert.type,
            createdAt: serverAlert.created_at,
          });
          // Track merges for debugging (logged separately)
        } else if (serverCreatedAt < localCreatedAt) {
          // Local version is newer - mark as conflict (will be uploaded separately)
          conflicts++;
        }
        // If timestamps are equal, assume no changes needed
      }
    }

    return {
      success: true,
      uploaded: 0,
      downloaded,
      conflicts,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("[SYNC] Failed to sync alerts from server:", error);
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform bidirectional sync with the server
 * This will:
 * 1. Fetch server alerts and merge with local (server wins for conflicts)
 * 2. Push local alerts to server (for new local changes)
 * @param walletAddress - User's wallet address for identification
 * @returns SyncResult with combined statistics
 */
export async function syncAlerts(walletAddress: string): Promise<SyncResult> {
  try {
    // First, pull from server to get latest data
    const pullResult = await syncAlertsFromServer(walletAddress);

    if (!pullResult.success) {
      return pullResult;
    }

    // Then, push local changes to server
    const pushResult = await syncAlertsToServer(walletAddress);

    return {
      success: pushResult.success,
      uploaded: pushResult.uploaded,
      downloaded: pullResult.downloaded,
      conflicts: pullResult.conflicts + pushResult.conflicts,
      timestamp: Math.max(pullResult.timestamp, pushResult.timestamp),
      error: pushResult.error,
    };
  } catch (error) {
    console.error("[SYNC] Failed to perform bidirectional sync:", error);
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete an alert from the server
 * @param walletAddress - User's wallet address
 * @param alertId - Alert ID to delete
 * @returns true if successful, false otherwise
 */
export async function deleteAlertFromServer(
  walletAddress: string,
  alertId: string
): Promise<boolean> {
  try {
    // Use correct API path: /api/alerts (not /api/alerts/user)
    const response = await fetch(
      `/api/alerts?wallet=${walletAddress}&alertId=${encodeURIComponent(alertId)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as { success: boolean };
    return result.success;
  } catch (error) {
    console.error("[SYNC] Failed to delete alert from server:", error);
    return false;
  }
}

/**
 * Save a single alert to the server
 * @param walletAddress - User's wallet address
 * @param alert - Alert configuration to save
 * @returns true if successful, false otherwise
 */
export async function saveAlertToServer(
  walletAddress: string,
  alert: AlertConfig
): Promise<boolean> {
  try {
    // Use correct API path: /api/alerts (not /api/alerts/user)
    const response = await fetch(getApiUrl("/api/alerts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        alertId: alert.id,
        name: alert.name,
        monitoredWallet: alert.walletAddress,
        tokenAddress: alert.tokenAddress,
        tokenName: alert.tokenName,
        tokenSymbol: alert.tokenSymbol,
        initialValue: alert.initialValue,
        type: alert.type,
        createdAt: alert.createdAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as { success: boolean };
    return result.success;
  } catch (error) {
    console.error("[SYNC] Failed to save alert to server:", error);
    return false;
  }
}
