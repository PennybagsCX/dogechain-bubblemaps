/**
 * Alert Scanning Tests
 *
 * Tests the alert scanning logic including:
 * - Scanning single alert
 * - Batch processing multiple alerts
 * - Scanning with no transactions
 * - Scanning with new transactions
 * - Baseline establishment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertConfig, AlertStatus, Transaction } from "../types";
import {
  MOCK_WALLET_ADDRESSES,
  MOCK_TOKEN_ADDRESSES,
  MOCK_TRANSACTIONS,
  MOCK_HISTORICAL_TRANSACTIONS,
  createMockAlert,
  createMockAlertStatus,
  createMockTransaction,
  resetAllMocks,
} from "./alert-setup";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Simulate the alert scanning logic from Dashboard.tsx
 */
async function simulateAlertScan(
  alert: AlertConfig,
  existingStatus: AlertStatus | undefined,
  transactions: Transaction[],
  currentBalance: number
): Promise<AlertStatus> {
  // Validate addresses
  try {
    if (!/^0x[a-f0-9]{40}$/i.test(alert.walletAddress)) {
      throw new Error("Invalid wallet address");
    }
    if (alert.tokenAddress && !/^0x[a-f0-9]{40}$/i.test(alert.tokenAddress)) {
      throw new Error("Invalid token address");
    }
  } catch {
    return {
      currentValue: 0,
      triggered: false,
      checkedAt: Date.now(),
    };
  }

  // Check if baseline already established
  const isBaselineEstablished = existingStatus?.baselineEstablished || false;
  const alertCreatedAt = alert.createdAt || Date.now();

  // For new alerts, filter to only transactions AFTER alert creation
  let transactionsForBaseline = transactions;
  if (!isBaselineEstablished) {
    transactionsForBaseline = transactions.filter((tx) => tx.timestamp >= alertCreatedAt);
  }

  // Get previously seen transactions or initialize baseline
  const previousTxs =
    existingStatus?.lastSeenTransactions || transactionsForBaseline.map((tx) => tx.hash);
  const previousTxSet = new Set(previousTxs);

  // Find new transactions
  const newTransactions = transactions.filter((tx) => !previousTxSet.has(tx.hash));

  // Apply type-specific filtering
  let filteredNewTransactions = newTransactions;

  if (alert.type === "WHALE" && newTransactions.length > 0) {
    const whaleThreshold = Math.max(10000, currentBalance * 0.01);
    filteredNewTransactions = newTransactions.filter((tx) => tx.value > whaleThreshold);
  }

  // Create new set of all seen transactions
  const allSeenTxs = [...new Set([...previousTxs, ...transactions.map((tx) => tx.hash)])];

  // Determine if alert should trigger
  const hasNewActivity = isBaselineEstablished
    ? filteredNewTransactions.length > 0
    : transactionsForBaseline.length > 0;

  const wasTriggered = existingStatus?.triggered || false;
  const shouldTrigger = hasNewActivity || wasTriggered;

  return {
    currentValue: currentBalance,
    triggered: shouldTrigger,
    checkedAt: Date.now(),
    lastSeenTransactions: allSeenTxs,
    newTransactions: hasNewActivity
      ? isBaselineEstablished
        ? filteredNewTransactions
        : transactionsForBaseline
      : undefined,
    baselineEstablished: true,
    pendingInitialScan: false,
    baselineTimestamp: isBaselineEstablished ? existingStatus?.baselineTimestamp : Date.now(),
  };
}

/**
 * Simulate batch scanning of multiple alerts
 */
async function simulateBatchScan(
  alerts: AlertConfig[],
  statuses: Record<string, AlertStatus>,
  transactionsMap: Record<string, Transaction[]>,
  balanceMap: Record<string, number>,
  batchSize = 4
): Promise<Record<string, AlertStatus>> {
  const newStatuses: Record<string, AlertStatus> = { ...statuses };

  // Process alerts in batches
  for (let i = 0; i < alerts.length; i += batchSize) {
    const batch = alerts.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (alert) => {
        const transactions = transactionsMap[alert.id] || [];
        const balance = balanceMap[alert.id] || 0;
        const existingStatus = statuses[alert.id];

        newStatuses[alert.id] = await simulateAlertScan(
          alert,
          existingStatus,
          transactions,
          balance
        );
      })
    );

    // Simulate delay between batches
    if (i + batchSize < alerts.length) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced delay for tests
    }
  }

  return newStatuses;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Alert Scanning", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // SINGLE ALERT SCANNING
  // -------------------------------------------------------------------------

  describe("Single Alert Scanning", () => {
    it("should scan a single alert with transactions", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        type: "WALLET",
        createdAt: Date.now() - 3600000, // 1 hour ago
      });

      const existingStatus = createMockAlertStatus({
        pendingInitialScan: true,
        baselineEstablished: false,
      });

      // Use transactions that are after alert creation
      const recentTransactions = MOCK_TRANSACTIONS.map((tx) => ({
        ...tx,
        timestamp: Date.now() - 1800000, // 30 minutes ago (after alert creation)
      }));

      const result = await simulateAlertScan(alert, existingStatus, recentTransactions, 100000);

      expect(result.currentValue).toBe(100000);
      expect(result.checkedAt).toBeDefined();
      expect(result.baselineEstablished).toBe(true);
      expect(result.pendingInitialScan).toBe(false);
      expect(result.newTransactions).toBeDefined();
      expect(result.newTransactions?.length).toBe(recentTransactions.length);
      expect(result.triggered).toBe(true);
    });

    it("should scan a single alert with no transactions", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        pendingInitialScan: true,
        baselineEstablished: false,
      });

      const result = await simulateAlertScan(alert, existingStatus, [], 0);

      expect(result.currentValue).toBe(0);
      expect(result.triggered).toBe(false);
      expect(result.baselineEstablished).toBe(true);
      expect(result.pendingInitialScan).toBe(false);
      expect(result.newTransactions).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // BATCH PROCESSING
  // -------------------------------------------------------------------------

  describe("Batch Processing Multiple Alerts", () => {
    it("should scan multiple alerts in a batch", async () => {
      const alerts = [
        createMockAlert({ id: "alert-1", name: "Alert 1" }),
        createMockAlert({ id: "alert-2", name: "Alert 2" }),
        createMockAlert({ id: "alert-3", name: "Alert 3" }),
        createMockAlert({ id: "alert-4", name: "Alert 4" }),
      ];

      const statuses: Record<string, AlertStatus> = {};
      const transactionsMap: Record<string, Transaction[]> = {
        "alert-1": MOCK_TRANSACTIONS,
        "alert-2": MOCK_TRANSACTIONS,
        "alert-3": [],
        "alert-4": MOCK_TRANSACTIONS,
      };
      const balanceMap: Record<string, number> = {
        "alert-1": 100000,
        "alert-2": 50000,
        "alert-3": 0,
        "alert-4": 75000,
      };

      const result = await simulateBatchScan(alerts, statuses, transactionsMap, balanceMap);

      expect(result["alert-1"]).toBeDefined();
      expect(result["alert-2"]).toBeDefined();
      expect(result["alert-3"]).toBeDefined();
      expect(result["alert-4"]).toBeDefined();

      expect(result["alert-1"].triggered).toBe(true);
      expect(result["alert-2"].triggered).toBe(true);
      expect(result["alert-3"].triggered).toBe(false);
      expect(result["alert-4"].triggered).toBe(true);
    });

    it("should process alerts in batches when count exceeds batch size", async () => {
      const alerts = Array.from({ length: 10 }, (_, i) =>
        createMockAlert({ id: `alert-${i}`, name: `Alert ${i}` })
      );

      const statuses: Record<string, AlertStatus> = {};
      const transactionsMap = Object.fromEntries(
        alerts.map((alert) => [alert.id, MOCK_TRANSACTIONS])
      );
      const balanceMap = Object.fromEntries(alerts.map((alert) => [alert.id, 100000]));

      const result = await simulateBatchScan(alerts, statuses, transactionsMap, balanceMap, 4);

      // Verify all alerts were processed
      expect(Object.keys(result)).toHaveLength(10);
      alerts.forEach((alert) => {
        expect(result[alert.id]).toBeDefined();
        expect(result[alert.id].checkedAt).toBeDefined();
      });
    });

    it("should add delay between batches", async () => {
      const startTime = Date.now();

      const alerts = [
        createMockAlert({ id: "alert-1" }),
        createMockAlert({ id: "alert-2" }),
        createMockAlert({ id: "alert-3" }),
        createMockAlert({ id: "alert-4" }),
        createMockAlert({ id: "alert-5" }),
      ];

      const result = await simulateBatchScan(
        alerts,
        {},
        Object.fromEntries(alerts.map((a) => [a.id, MOCK_TRANSACTIONS])),
        Object.fromEntries(alerts.map((a) => [a.id, 100000])),
        2 // Small batch size to force multiple batches
      );

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least 50ms per batch gap (2 batches = 1 gap)
      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(Object.keys(result)).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // NO TRANSACTIONS SCENARIO
  // -------------------------------------------------------------------------

  describe("Scan with No Transactions", () => {
    it("should handle alert with no transactions", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        pendingInitialScan: true,
        baselineEstablished: false,
      });

      const result = await simulateAlertScan(alert, existingStatus, [], 0);

      expect(result.currentValue).toBe(0);
      expect(result.triggered).toBe(false);
      expect(result.newTransactions).toBeUndefined();
      expect(result.lastSeenTransactions).toEqual([]);
      expect(result.baselineEstablished).toBe(true);
    });

    it("should establish baseline even with no transactions", async () => {
      const alert = createMockAlert({ id: "alert-1" });
      const existingStatus = createMockAlertStatus({ baselineEstablished: false });

      const result = await simulateAlertScan(alert, existingStatus, [], 0);

      expect(result.baselineEstablished).toBe(true);
      expect(result.baselineTimestamp).toBeDefined();
      expect(result.baselineTimestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  // -------------------------------------------------------------------------
  // NEW TRANSACTIONS SCENARIO
  // -------------------------------------------------------------------------

  describe("Scan with New Transactions", () => {
    it("should detect new transactions after alert creation", async () => {
      const alertCreatedAt = Date.now() - 3600000; // 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        pendingInitialScan: true,
        baselineEstablished: false,
      });

      // Create transactions after alert creation
      const newTransactions = [
        createMockTransaction({
          timestamp: Date.now() - 1800000, // 30 minutes ago (after alert creation)
        }),
        createMockTransaction({
          timestamp: Date.now() - 900000, // 15 minutes ago
        }),
      ];

      const result = await simulateAlertScan(alert, existingStatus, newTransactions, 100000);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toBeDefined();
      expect(result.newTransactions?.length).toBe(2);
      expect(result.baselineEstablished).toBe(true);
    });

    it("should not trigger on historical transactions (before alert creation)", async () => {
      const alertCreatedAt = Date.now() - 3600000; // 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
      });

      // Use transactions that are before alert creation
      const historicalTransactions = MOCK_HISTORICAL_TRANSACTIONS;

      const result = await simulateAlertScan(alert, existingStatus, historicalTransactions, 0);

      // Should not trigger because all transactions are before alert creation
      expect(result.triggered).toBe(false);
      expect(result.newTransactions).toBeUndefined();
      expect(result.baselineEstablished).toBe(true);
    });

    it("should filter historical transactions on initial scan", async () => {
      const alertCreatedAt = Date.now() - 3600000; // 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
      });

      // Mix of historical and recent transactions
      const mixedTransactions = [
        ...MOCK_HISTORICAL_TRANSACTIONS, // Before alert creation
        ...MOCK_TRANSACTIONS.map((tx) => ({
          ...tx,
          timestamp: Date.now() - 1800000, // After alert creation
        })),
      ];

      const result = await simulateAlertScan(alert, existingStatus, mixedTransactions, 100000);

      // Should only trigger on recent transactions
      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(3); // Only MOCK_TRANSACTIONS count
      expect(result.newTransactions?.every((tx) => tx.timestamp >= alertCreatedAt)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // BASELINE ESTABLISHMENT
  // -------------------------------------------------------------------------

  describe("Baseline Establishment", () => {
    it("should establish baseline on first scan", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        pendingInitialScan: true,
      });

      const result = await simulateAlertScan(alert, existingStatus, MOCK_TRANSACTIONS, 100000);

      expect(result.baselineEstablished).toBe(true);
      expect(result.baselineTimestamp).toBeDefined();
      expect(result.lastSeenTransactions).toHaveLength(MOCK_TRANSACTIONS.length);
      expect(result.pendingInitialScan).toBe(false);
    });

    it("should preserve baseline on subsequent scans", async () => {
      const alert = createMockAlert({ id: "alert-1" });

      const firstScanStatus = createMockAlertStatus({
        baselineEstablished: true,
        baselineTimestamp: Date.now() - 3600000,
        lastSeenTransactions: MOCK_TRANSACTIONS.map((tx) => tx.hash),
      });

      // New transaction on second scan
      const newTransaction = createMockTransaction({
        hash: "0xnewtransactionhash",
        timestamp: Date.now() - 60000, // 1 minute ago
      });

      const result = await simulateAlertScan(
        alert,
        firstScanStatus,
        [...MOCK_TRANSACTIONS, newTransaction],
        100000
      );

      expect(result.baselineEstablished).toBe(true);
      expect(result.baselineTimestamp).toBe(firstScanStatus.baselineTimestamp);
      expect(result.lastSeenTransactions).toHaveLength(MOCK_TRANSACTIONS.length + 1);
      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toHaveLength(1);
      expect(result.newTransactions?.[0].hash).toBe("0xnewtransactionhash");
    });

    it("should track previously seen transactions", async () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        lastSeenTransactions: MOCK_TRANSACTIONS.map((tx) => tx.hash),
      });

      // Same transactions + one new
      const newTransaction = createMockTransaction({ hash: "0xnew" });
      const allTransactions = [...MOCK_TRANSACTIONS, newTransaction];

      const result = await simulateAlertScan(alert, existingStatus, allTransactions, 100000);

      // Should only trigger on the new transaction
      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toHaveLength(1);
      expect(result.newTransactions?.[0].hash).toBe("0xnew");
      expect(result.lastSeenTransactions).toHaveLength(allTransactions.length);
    });
  });

  // -------------------------------------------------------------------------
  // WHALE ALERT FILTERING
  // -------------------------------------------------------------------------

  describe("Whale Alert Filtering", () => {
    it("should filter small transactions for WHALE type", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WHALE",
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
      });

      // Mix of small and large transactions
      const mixedTransactions = [
        createMockTransaction({ value: 100 }), // Small
        createMockTransaction({ value: 50000 }), // Large
        createMockTransaction({ value: 1000 }), // Small
        createMockTransaction({ value: 150000 }), // Large
      ];

      const currentBalance = 1000000; // 1% threshold = 10000

      const result = await simulateAlertScan(
        alert,
        existingStatus,
        mixedTransactions,
        currentBalance
      );

      // Only large transactions should trigger
      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toHaveLength(2);
      expect(result.newTransactions?.[0].value).toBe(50000);
      expect(result.newTransactions?.[1].value).toBe(150000);
    });

    it("should use max(10000, 1% of balance) as whale threshold", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WHALE",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
      });

      const transactions = [
        createMockTransaction({ value: 5000 }), // Below 10000
        createMockTransaction({ value: 15000 }), // Above 10000
      ];

      // With low balance, should use 10000 threshold
      const lowBalanceResult = await simulateAlertScan(
        alert,
        existingStatus,
        transactions,
        100000 // 1% = 1000, so max(10000, 1000) = 10000
      );

      expect(lowBalanceResult.newTransactions).toHaveLength(1);
      expect(lowBalanceResult.newTransactions?.[0].value).toBe(15000);

      // With high balance, should use 1% threshold
      const highBalanceTransactions = [
        createMockTransaction({ value: 9000 }), // Below 1%
        createMockTransaction({ value: 12000 }), // Above 1%
      ];

      const highBalanceResult = await simulateAlertScan(
        alert,
        existingStatus,
        highBalanceTransactions,
        1000000 // 1% = 10000, so max(10000, 10000) = 10000
      );

      expect(highBalanceResult.newTransactions).toHaveLength(1);
      expect(highBalanceResult.newTransactions?.[0].value).toBe(12000);
    });
  });

  // -------------------------------------------------------------------------
  // TOKEN ALERT FILTERING
  // -------------------------------------------------------------------------

  describe("Token Alert Filtering", () => {
    it("should only return transactions for specified token", async () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "TOKEN",
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
      });

      // Mock dataService to filter by token
      const tokenTransactions = MOCK_TRANSACTIONS.filter(
        (tx) => tx.tokenAddress === MOCK_TOKEN_ADDRESSES.wDOGE
      );

      const result = await simulateAlertScan(alert, existingStatus, tokenTransactions, 100000);

      expect(
        result.newTransactions?.every((tx) => tx.tokenAddress === MOCK_TOKEN_ADDRESSES.wDOGE)
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------------------------

  describe("Error Handling", () => {
    it("should handle scan errors gracefully", async () => {
      const alert = createMockAlert({
        walletAddress: MOCK_WALLET_ADDRESSES.invalid, // Invalid address
      });

      const existingStatus = createMockAlertStatus();

      const result = await simulateAlertScan(alert, existingStatus, [], 0);

      // Should return error status
      expect(result.currentValue).toBe(0);
      expect(result.triggered).toBe(false);
      expect(result.checkedAt).toBeDefined();
    });

    it("should continue scanning other alerts if one fails", async () => {
      const alerts = [
        createMockAlert({ id: "alert-1", walletAddress: MOCK_WALLET_ADDRESSES.valid }),
        createMockAlert({ id: "alert-2", walletAddress: "invalid" }),
        createMockAlert({ id: "alert-3", walletAddress: MOCK_WALLET_ADDRESSES.valid }),
      ];

      const statuses: Record<string, AlertStatus> = {};
      const transactionsMap: Record<string, Transaction[]> = {
        "alert-1": MOCK_TRANSACTIONS,
        "alert-2": [],
        "alert-3": MOCK_TRANSACTIONS,
      };
      const balanceMap: Record<string, number> = {
        "alert-1": 100000,
        "alert-2": 0,
        "alert-3": 50000,
      };

      const result = await simulateBatchScan(alerts, statuses, transactionsMap, balanceMap);

      // First and third alerts should be scanned successfully
      expect(result["alert-1"].triggered).toBe(true);
      expect(result["alert-3"].triggered).toBe(true);

      // Second alert should have error status
      expect(result["alert-2"]).toBeDefined();
      expect(result["alert-2"].triggered).toBe(false);
    });
  });
});
