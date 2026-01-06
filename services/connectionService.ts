import { Transaction, Connection, ConnectionStats, Wallet, Link } from "../types";
import { fetchWalletTransactions } from "./dataService";

// Cache for connection data
const connectionCache = new Map<string, Connection>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCacheKey(wallet1: string, wallet2: string): string {
  return [wallet1, wallet2].sort().join("-");
}

export async function fetchConnectionDetails(
  link: Link,
  tokenAddress: string,
  assetType: "TOKEN" | "NFT"
): Promise<Connection> {
  const sourceId = typeof link.source === "string" ? link.source : link.source.id;
  const targetId = typeof link.target === "string" ? link.target : link.target.id;

  const cacheKey = getCacheKey(sourceId, targetId);
  const cached = connectionCache.get(cacheKey);

  // Return cached data if fresh
  if (cached && cached.transactions && Date.now() - (cached as any).cachedAt < CACHE_DURATION) {
    return cached;
  }

  try {
    // Fetch transactions from both wallets
    const [sourceTxs, targetTxs] = await Promise.all([
      fetchWalletTransactions(sourceId, tokenAddress, assetType),
      fetchWalletTransactions(targetId, tokenAddress, assetType),
    ]);

    // Filter to only transactions between these two wallets
    const filteredTxs = [
      ...sourceTxs.filter(
        (tx) =>
          tx.to.toLowerCase() === targetId.toLowerCase() ||
          tx.from.toLowerCase() === targetId.toLowerCase()
      ),
      ...targetTxs.filter(
        (tx) =>
          tx.to.toLowerCase() === sourceId.toLowerCase() ||
          tx.from.toLowerCase() === sourceId.toLowerCase()
      ),
    ];

    // Deduplicate by hash
    const uniqueTxs = Array.from(new Map(filteredTxs.map((tx) => [tx.hash, tx])).values());

    // Sort by timestamp desc
    uniqueTxs.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate statistics
    const stats = calculateConnectionStats(uniqueTxs, sourceId, targetId);

    const connection: Connection = {
      ...link,
      transactions: uniqueTxs,
      stats,
      loading: false,
      cachedAt: Date.now(),
    } as any;

    // Cache the result
    connectionCache.set(cacheKey, connection);

    return connection;
  } catch (error) {
    console.error("[ConnectionService] Failed to fetch connection details:", error);
    return {
      ...link,
      transactions: [],
      stats: undefined,
      loading: false,
      error: "Failed to load transactions",
    };
  }
}

function calculateConnectionStats(
  transactions: Transaction[],
  sourceId: string,
  targetId: string
): ConnectionStats {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0,
      totalVolume: 0,
      averageAmount: 0,
      flowDirection: "balanced",
      fromCount: 0,
      toCount: 0,
      fromVolume: 0,
      toVolume: 0,
    };
  }

  // Count and sum transactions in each direction
  let fromCount = 0;
  let toCount = 0;
  let fromVolume = 0;
  let toVolume = 0;
  let totalVolume = 0;

  transactions.forEach((tx) => {
    const isFromSource = tx.from.toLowerCase() === sourceId.toLowerCase();
    const amount = tx.value;

    if (isFromSource) {
      fromCount++;
      fromVolume += amount;
    } else {
      toCount++;
      toVolume += amount;
    }
    totalVolume += amount;
  });

  // Determine flow direction
  const ratio = fromVolume / (toVolume || 1);
  let flowDirection: "balanced" | "source_to_target" | "target_to_source";
  if (ratio > 1.5) {
    flowDirection = "source_to_target";
  } else if (ratio < 0.67) {
    flowDirection = "target_to_source";
  } else {
    flowDirection = "balanced";
  }

  // Find first and last transactions
  const timestamps = transactions.map((tx) => tx.timestamp).sort((a, b) => a - b);
  const firstTransaction = timestamps[0];
  const lastTransaction = timestamps[timestamps.length - 1];

  return {
    totalTransactions: transactions.length,
    totalVolume,
    firstTransaction,
    lastTransaction,
    averageAmount: totalVolume / transactions.length,
    flowDirection,
    fromCount,
    toCount,
    fromVolume,
    toVolume,
  };
}
