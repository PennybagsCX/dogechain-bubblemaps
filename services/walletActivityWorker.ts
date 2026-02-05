/**
 * Wallet Activity Worker - Background processing for analytics
 *
 * This Web Worker handles expensive operations off the main thread:
 * - Activity timeline generation
 * - Flow pattern calculations
 *
 * Benefits: Zero UI blocking during analytics computation
 */

// =====================================================
// Types (re-defined for worker context)
// =====================================================

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";

enum WalletBehaviorType {
  WHALE = "WHALE",
  RETAIL = "RETAIL",
  SMART_MONEY = "SMART_MONEY",
  HODLER = "HODLER",
  TRADER = "TRADER",
  SNIPER = "SNIPER",
  UNKNOWN = "UNKNOWN",
}

interface Transaction {
  from: string;
  to: string;
  value: number;
  timestamp: number;
}

interface WalletActivityWorker {
  walletAddress: string;
  label?: string;
  behaviorType: WalletBehaviorType;
}

interface ActivityTimelinePoint {
  timestamp: number;
  date: string;
  transactions: number;
  volume: number;
  activeWallets: number;
  buys: number;
  sells: number;
}

interface FlowPattern {
  fromCluster: WalletBehaviorType;
  toCluster: WalletBehaviorType;
  volume: number;
  transactionCount: number;
}

type WorkerMessageType = "BUILD_TIMELINE" | "CALCULATE_FLOWS";

interface WorkerMessage {
  type: WorkerMessageType;
  requestId: string;
  data: {
    transactions: Transaction[];
    timeRange?: TimeRange;
    activities?: WalletActivityWorker[];
    holderAddresses?: string[];
  };
}

interface WorkerResponse {
  type: WorkerMessageType;
  requestId: string;
  result?: ActivityTimelinePoint[] | FlowPattern[];
  error?: string;
}

// =====================================================
// Time Range Utilities
// =====================================================

function getTimeRangeFilter(timeRange: TimeRange): number {
  const now = Date.now();
  switch (timeRange) {
    case "1h":
      return now - 60 * 60 * 1000;
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
      return 0;
    default:
      return 0;
  }
}

function formatTimelineDate(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  switch (timeRange) {
    case "1h":
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    case "24h":
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    case "7d":
    case "30d":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "all":
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
    default:
      return date.toISOString();
  }
}

// =====================================================
// Activity Timeline Generation
// =====================================================

function buildActivityTimeline(
  transactions: Transaction[],
  timeRange: TimeRange,
  holderAddresses: Set<string>
): ActivityTimelinePoint[] {
  const cutoffTime = getTimeRangeFilter(timeRange);
  const filteredTxs = transactions.filter((tx) => tx.timestamp >= cutoffTime);

  if (filteredTxs.length === 0) {
    return [];
  }

  // Group transactions by time period based on timeRange
  const timelineMap = new Map<string, ActivityTimelinePoint>();

  filteredTxs.forEach((tx) => {
    const dateKey = formatTimelineDate(tx.timestamp, timeRange);
    const existing = timelineMap.get(dateKey);

    // Classify transaction as buy or sell
    const toLower = tx.to.toLowerCase();
    const fromLower = tx.from.toLowerCase();
    const toIsHolder = holderAddresses.has(toLower);
    const fromIsHolder = holderAddresses.has(fromLower);

    let isBuy = false;
    let isSell = false;

    // If TO is a holder (and FROM is not), it's likely a buy
    if (toIsHolder && !fromIsHolder) {
      isBuy = true;
    }
    // If FROM is a holder (and TO is not), it's likely a sell
    else if (fromIsHolder && !toIsHolder) {
      isSell = true;
    }

    if (existing) {
      existing.transactions += 1;
      existing.volume += tx.value;
      if (isBuy) existing.buys += 1;
      if (isSell) existing.sells += 1;
    } else {
      timelineMap.set(dateKey, {
        timestamp: tx.timestamp,
        date: dateKey,
        transactions: 1,
        volume: tx.value,
        activeWallets: 0,
        buys: isBuy ? 1 : 0,
        sells: isSell ? 1 : 0,
      });
    }
  });

  // Convert to array and sort by timestamp
  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // Calculate active wallets for each time point
  const uniqueWalletsPerPeriod = new Map<string, Set<string>>();
  filteredTxs.forEach((tx) => {
    const dateKey = formatTimelineDate(tx.timestamp, timeRange);
    if (!uniqueWalletsPerPeriod.has(dateKey)) {
      uniqueWalletsPerPeriod.set(dateKey, new Set());
    }
    uniqueWalletsPerPeriod.get(dateKey)!.add(tx.from);
    uniqueWalletsPerPeriod.get(dateKey)!.add(tx.to);
  });

  timeline.forEach((point) => {
    const uniqueWallets = uniqueWalletsPerPeriod.get(point.date);
    point.activeWallets = uniqueWallets?.size ?? 0;
  });

  return timeline;
}

// =====================================================
// Flow Pattern Calculation
// =====================================================

function calculateFlowPatterns(
  activities: WalletActivityWorker[],
  transactions: Transaction[]
): FlowPattern[] {
  // Create address -> behavior mapping
  const addressToBehavior = new Map<string, WalletBehaviorType>();
  activities.forEach((activity) => {
    addressToBehavior.set(activity.walletAddress.toLowerCase(), activity.behaviorType);
  });

  // Track flows between behavior types
  const flowMap = new Map<string, FlowPattern>();

  transactions.forEach((tx) => {
    const fromBehavior = addressToBehavior.get(tx.from.toLowerCase()) ?? WalletBehaviorType.UNKNOWN;
    const toBehavior = addressToBehavior.get(tx.to.toLowerCase()) ?? WalletBehaviorType.UNKNOWN;

    if (fromBehavior === toBehavior) return; // Skip internal flows

    const key = `${fromBehavior}->${toBehavior}`;
    const existing = flowMap.get(key);

    if (existing) {
      existing.volume += tx.value;
      existing.transactionCount += 1;
    } else {
      flowMap.set(key, {
        fromCluster: fromBehavior,
        toCluster: toBehavior,
        volume: tx.value,
        transactionCount: 1,
      });
    }
  });

  return Array.from(flowMap.values()).sort((a, b) => b.volume - a.volume);
}

// =====================================================
// Worker Message Handler
// =====================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, requestId, data } = event.data;

  try {
    let result: ActivityTimelinePoint[] | FlowPattern[];

    switch (type) {
      case "BUILD_TIMELINE":
        if (!data.timeRange || !data.holderAddresses) {
          throw new Error("Missing required data for BUILD_TIMELINE");
        }
        result = buildActivityTimeline(
          data.transactions,
          data.timeRange,
          new Set(data.holderAddresses)
        );
        break;

      case "CALCULATE_FLOWS":
        if (!data.activities) {
          throw new Error("Missing required data for CALCULATE_FLOWS");
        }
        result = calculateFlowPatterns(data.activities, data.transactions);
        break;

      default:
        throw new Error(`Unknown worker message type: ${type as string}`);
    }

    // Send success response
    const response: WorkerResponse = {
      type,
      requestId,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    // Send error response
    const response: WorkerResponse = {
      type,
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    self.postMessage(response);
  }
};

// Export empty object for module compatibility
export {};
