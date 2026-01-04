import Dexie, { Table } from 'dexie';
import { AlertConfig, TriggeredEvent, Transaction, Token, ScanMetadata } from '../types';

// Database interface definitions
export interface DbAlert {
  id?: number; // Auto-incremented primary key
  alertId: string; // String ID from app
  name: string;
  walletAddress: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  threshold: number;
  initialValue?: number;
  createdAt: number;
}

export interface DbAlertStatus {
  alertId: string; // Primary key
  currentValue: number;
  triggered: boolean;
  checkedAt: number;
  notified?: boolean;
  lastSeenTransactions?: string[];
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

  constructor() {
    super('DogechainBubbleMapsDB');

    // Add error handler for database migration failures
    this.on('blocked', () => {
      console.warn('[DB] Database upgrade blocked. Other tabs may be open.');
    });

    this.on('versionchange', () => {
      console.log('[DB] Database version changed. Reloading page.');
      window.location.reload();
    });

    try {
      // Define database schema with indexes
      this.version(1).stores({
        alerts: '++id, alertId, walletAddress, name, createdAt',
        alertStatuses: 'alertId, &alertId', // alertId is primary key
        triggeredEvents: '++id, eventId, alertId, triggeredAt',
        recentSearches: '++id, timestamp',
        trendingAssets: '++id, symbol, address, hits'
      });

      // Version 2: Simplified approach - remove unique constraint to prevent issues
      // Deduplication will be handled at the application level
      this.version(2).stores({
        alerts: '++id, alertId, walletAddress, name, createdAt',
        alertStatuses: 'alertId, &alertId',
        triggeredEvents: '++id, eventId, alertId, triggeredAt',
        recentSearches: '++id, timestamp',
        trendingAssets: '++id, symbol, address, hits'  // Removed & constraint
      });

      // Version 3: Add wallet scan cache for 48-hour intelligent caching
      this.version(3).stores({
        alerts: '++id, alertId, walletAddress, name, createdAt',
        alertStatuses: 'alertId, &alertId',
        triggeredEvents: '++id, eventId, alertId, triggeredAt',
        recentSearches: '++id, timestamp',
        trendingAssets: '++id, symbol, address, hits',
        walletScanCache: 'walletAddress, &walletAddress, scannedAt, expiresAt',
        assetMetadataCache: 'address, &address, cachedAt, expiresAt'
      });

      // Version 4: Add per-wallet forced contracts persistence
      this.version(4).stores({
        alerts: '++id, alertId, walletAddress, name, createdAt',
        alertStatuses: 'alertId, &alertId',
        triggeredEvents: '++id, eventId, alertId, triggeredAt',
        recentSearches: '++id, timestamp',
        trendingAssets: '++id, symbol, address, hits',
        walletScanCache: 'walletAddress, &walletAddress, scannedAt, expiresAt',
        assetMetadataCache: 'address, &address, cachedAt, expiresAt',
        walletForcedContracts: 'walletAddress, &walletAddress, updatedAt'
      });

      // Version 5: Add discovered contracts database for whale enumeration
      // Note: Fixed to avoid ConstraintError by removing duplicate index syntax
      this.version(5).stores({
        alerts: '++id, alertId, walletAddress, name, createdAt',
        alertStatuses: 'alertId, &alertId',
        triggeredEvents: '++id, eventId, alertId, triggeredAt',
        recentSearches: '++id, timestamp',
        trendingAssets: '++id, symbol, address, hits',
        walletScanCache: 'walletAddress, scannedAt, expiresAt',
        assetMetadataCache: 'address, cachedAt, expiresAt',
        walletForcedContracts: 'walletAddress, updatedAt',
        discoveredContracts: '++id, contractAddress, type, discoveredAt, lastSeenAt'
      });
    } catch (error) {
      console.error('[DB] Database schema error:', error);
      console.error('[DB] Please clear IndexedDB and reload the page.');
      // Store error for UI to display
      localStorage.setItem('doge_db_error', 'schema_error');
    }
  }
}

// Export single instance
export const db = new DogeDatabase();

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
    createdAt: Date.now()
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
    initialValue: dbAlert.initialValue
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
    notified: event.notified
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
    notified: dbEvent.notified
  };
}

// Export all data to JSON
export async function exportDatabase(): Promise<DatabaseExport> {
  const [alerts, alertStatuses, triggeredEvents, trendingAssets, recentSearches] = await Promise.all([
    db.alerts.toArray(),
    db.alertStatuses.toArray(),
    db.triggeredEvents.toArray(),
    db.trendingAssets.toArray(),
    db.recentSearches.toArray()
  ]);

  return {
    version: '1.0',
    exportedAt: Date.now(),
    alerts,
    alertStatuses,
    triggeredEvents,
    trendingAssets,
    recentSearches
  };
}

// Export all data as single combined CSV
export async function exportDatabaseAsCSV(): Promise<Blob> {
  // Fetch all data
  const data = await exportDatabase();

  // Define all tables with their names and data
  const tables = [
    { name: 'alerts', data: data.alerts },
    { name: 'alert_statuses', data: data.alertStatuses },
    { name: 'triggered_events', data: data.triggeredEvents },
    { name: 'trending_assets', data: data.trendingAssets },
    { name: 'recent_searches', data: data.recentSearches }
  ];

  // Collect all unique column names across all tables
  const allColumns = new Set<string>();
  allColumns.add('table_name'); // First column

  tables.forEach(table => {
    if (table.data.length > 0) {
      Object.keys(table.data[0]).forEach(key => allColumns.add(key));
    }
  });

  const columns = Array.from(allColumns);

  // Build CSV content
  const csvRows: string[] = [];

  // Header row
  csvRows.push(columns.join(','));

  // Data rows from each table
  tables.forEach(table => {
    table.data.forEach(item => {
      const rowValues = columns.map(col => {
        // Handle table_name column
        if (col === 'table_name') {
          return table.name;
        }

        // Get value or empty string if column doesn't exist
        const value = item[col];

        // Handle null/undefined
        if (value === null || value === undefined) {
          return '';
        }

        // Handle nested objects/arrays (serialize as JSON string)
        if (typeof value === 'object') {
          const jsonString = JSON.stringify(value);
          // Escape quotes and wrap in quotes
          return `"${jsonString.replace(/"/g, '""')}"`;
        }

        // Handle strings with commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return String(value);
      });

      csvRows.push(rowValues.join(','));
    });
  });

  // Create CSV blob
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

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
    db.recentSearches.clear()
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
    db.recentSearches.clear()
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
    if (!existing || asset.hits > existing.hits ||
        (asset.hits === existing.hits && (asset.id || 0) > (existing.id || 0))) {
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
  localStorage.removeItem('doge_db_error');
  // The database will be automatically recreated with the latest schema on next access
}

/**
 * Check if the database is in an error state
 */
export function hasDatabaseError(): boolean {
  return localStorage.getItem('doge_db_error') === 'schema_error';
}

/**
 * Clear the database error flag
 */
export function clearDatabaseError(): void {
  localStorage.removeItem('doge_db_error');
}

/**
 * Test database health by attempting a simple operation
 * @returns true if database is healthy, false otherwise
 */
export async function testDatabaseHealth(): Promise<boolean> {
  try {
    // Try to open the database and read from a table
    await db.open();
    const count = await db.alerts.count();
    console.log('[DB] Database health check passed. Alerts count:', count);
    return true;
  } catch (error) {
    console.error('[DB] Database health check failed:', error);
    localStorage.setItem('doge_db_error', 'health_check_failed');
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
      expiresAt: now + (48 * 60 * 60 * 1000), // 48 hours
      scanMetadata
    };

    await db.walletScanCache.put(cacheEntry);
  } catch (error) {
    console.error('Failed to save scan cache:', error);
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
  } catch (error) {
    console.error('Failed to load scan cache:', error);
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
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Get all entries
    const allEntries = await db.walletScanCache.toArray();

    // Find expired or old entries
    const toDelete = allEntries.filter(entry =>
      entry.expiresAt < now || entry.scannedAt < sevenDaysAgo
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
  } catch (error) {
    console.error('Failed to clear expired cache:', error);
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
    if (!existing || search.timestamp > existing.timestamp ||
        (search.timestamp === existing.timestamp && (search.id || 0) > (existing.id || 0))) {
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
export async function saveWalletForcedContracts(walletAddress: string, contracts: string[]): Promise<void> {
  try {
    const entry: DbWalletForcedContracts = {
      walletAddress: walletAddress.toLowerCase(),
      contracts,
      updatedAt: Date.now()
    };

    await db.walletForcedContracts.put(entry);
  } catch (error) {
    console.error('Failed to save wallet forced contracts:', error);
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
  } catch (error) {
    console.error('Failed to load wallet forced contracts:', error);
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
      const existing = await db.discoveredContracts.where('contractAddress').equals(contract.contractAddress.toLowerCase()).first();

      if (existing) {
        // Update lastSeenAt if it exists
        await db.discoveredContracts.update(existing.id!, {
          lastSeenAt: now,
          type: contract.type || existing.type,
          symbol: contract.symbol || existing.symbol,
          name: contract.name || existing.name
        });
      } else {
        // Add new contract
        await db.discoveredContracts.add({
          contractAddress: contract.contractAddress.toLowerCase(),
          type: contract.type,
          symbol: contract.symbol,
          name: contract.name,
          discoveredAt: now,
          lastSeenAt: now
        });
      }
    }
  } catch (error) {
    console.error('Failed to save discovered contracts:', error);
  }
}

/**
 * Load all discovered contracts
 */
export async function loadDiscoveredContracts(): Promise<DbDiscoveredContracts[]> {
  try {
    return await db.discoveredContracts.toArray();
  } catch (error) {
    console.error('Failed to load discovered contracts:', error);
    return [];
  }
}

/**
 * Get discovered contracts by type
 */
export async function getDiscoveredContractsByType(type: string): Promise<DbDiscoveredContracts[]> {
  try {
    return await db.discoveredContracts.where('type').equals(type).toArray();
  } catch (error) {
    console.error('Failed to get discovered contracts by type:', error);
    return [];
  }
}

/**
 * Clear old discovered contracts (older than 30 days)
 */
export async function clearOldDiscoveredContracts(): Promise<number> {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    const oldContracts = await db.discoveredContracts.where('lastSeenAt').below(thirtyDaysAgo).toArray();

    for (const contract of oldContracts) {
      await db.discoveredContracts.delete(contract.id!);
    }

    return oldContracts.length;
  } catch (error) {
    console.error('Failed to clear old discovered contracts:', error);
    return 0;
  }
}

