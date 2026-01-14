/* eslint-disable no-console */
import { Link, Connection, Transaction, ConnectionStats, AssetType } from "../types";
import { fetchWalletTransactions } from "./dataService";

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Connection cache
const connectionCache = new Map<string, Connection & { cachedAt: number }>();

function getCacheKey(sourceId: string, targetId: string): string {
  return `${sourceId.toLowerCase()}-${targetId.toLowerCase()}`;
}

/**
 * Calculate statistics for transactions between two wallets
 */
function calculateConnectionStats(transactions: Transaction[], sourceId: string): ConnectionStats {
  const totalTransactions = transactions.length;

  // Calculate total volume in each direction
  let fromVolume = 0;
  let toVolume = 0;
  let fromCount = 0;
  let toCount = 0;

  transactions.forEach((tx) => {
    const isFromSource = tx.from.toLowerCase() === sourceId.toLowerCase();
    if (isFromSource) {
      fromVolume += tx.value;
      fromCount++;
    } else {
      toVolume += tx.value;
      toCount++;
    }
  });

  const totalVolume = fromVolume + toVolume;
  const averageAmount = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

  // Determine flow direction
  let flowDirection: "balanced" | "source_to_target" | "target_to_source";
  const volumeRatio = fromVolume / (toVolume || 1); // Avoid division by zero

  if (totalTransactions < 3 || Math.abs(volumeRatio - 1) < 0.3) {
    flowDirection = "balanced";
  } else if (fromVolume > toVolume) {
    flowDirection = "source_to_target";
  } else {
    flowDirection = "target_to_source";
  }

  // Find first and last transactions (timestamps are in milliseconds)
  const timestamps = transactions.map((tx) => tx.timestamp);
  const firstTransaction = Math.min(...timestamps);
  const lastTransaction = Math.max(...timestamps);

  return {
    totalTransactions,
    totalVolume,
    averageAmount,
    flowDirection,
    fromCount,
    toCount,
    fromVolume,
    toVolume,
    firstTransaction,
    lastTransaction,
  };
}

/**
 * Fetch connection details between two wallets
 * This fetches transactions from both wallets and filters to only those
 * that occurred between the two wallets
 */
export async function fetchConnectionDetails(
  link: Link,
  tokenAddress: string,
  assetType: AssetType
): Promise<Connection> {
  const sourceId = typeof link.source === "string" ? link.source : link.source.id;
  const targetId = typeof link.target === "string" ? link.target : link.target.id;

  // Check cache first
  const cacheKey = getCacheKey(sourceId, targetId);
  const cached = connectionCache.get(cacheKey);
  if (cached && cached.transactions && Date.now() - cached.cachedAt < CACHE_DURATION) {
    return cached;
  }

  try {
    // Fetch transactions from both wallets in parallel
    const [sourceTxs, targetTxs] = await Promise.all([
      fetchWalletTransactions(sourceId, tokenAddress, assetType),
      fetchWalletTransactions(targetId, tokenAddress, assetType),
    ]);

    // Filter to only transactions between these two wallets
    const sourceIdLower = sourceId.toLowerCase();
    const targetIdLower = targetId.toLowerCase();

    const filteredFromSource = sourceTxs.filter(
      (tx) => tx.to.toLowerCase() === targetIdLower || tx.from.toLowerCase() === targetIdLower
    );

    const filteredFromTarget = targetTxs.filter(
      (tx) => tx.to.toLowerCase() === sourceIdLower || tx.from.toLowerCase() === sourceIdLower
    );

    // Combine and deduplicate by transaction hash
    const allTransactions = [...filteredFromSource, ...filteredFromTarget];
    const uniqueTransactionsMap = new Map<string, Transaction>();

    allTransactions.forEach((tx) => {
      if (!uniqueTransactionsMap.has(tx.hash)) {
        uniqueTransactionsMap.set(tx.hash, tx);
      }
    });

    const uniqueTransactions = Array.from(uniqueTransactionsMap.values());

    // Sort by timestamp (newest first)
    uniqueTransactions.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate statistics
    const stats = calculateConnectionStats(uniqueTransactions, sourceId);

    const connection: Connection = {
      ...link,
      transactions: uniqueTransactions,
      stats,
      loading: false,
    };

    // Cache the result
    connectionCache.set(cacheKey, { ...connection, cachedAt: Date.now() });

    console.log(
      `[ConnectionService] Fetched ${uniqueTransactions.length} transactions for ${cacheKey}`
    );

    return connection;
  } catch (error) {
    // Error handled silently

    return {
      ...link,
      loading: false,
      error: error instanceof Error ? error.message : "Failed to fetch connection details",
    };
  }
}

/**
 * Clear the connection cache
 */
export function clearConnectionCache(): void {
  connectionCache.clear();
}
