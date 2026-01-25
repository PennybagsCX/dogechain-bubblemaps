/**
 * Trigger Detection Tests
 *
 * Tests the trigger detection logic including:
 * - New alert with post-creation transactions (should trigger)
 * - Existing alert with new transactions (should trigger)
 * - Alert with no new transactions (should not trigger)
 * - Triggered state persistence across scans
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertConfig, AlertStatus, Transaction } from "../types";
import {
  MOCK_TOKEN_ADDRESSES,
  createMockAlert,
  createMockAlertStatus,
  createMockTransaction,
  resetAllMocks,
} from "./alert-setup";

// ============================================================================
// TEST HELPERS
// ============================================================================

interface ScanResult {
  status: AlertStatus;
  triggered: boolean;
  newTransactions?: Transaction[];
}

/**
 * Simulate a scan for trigger detection
 */
function simulateScanForTriggerDetection(
  alert: AlertConfig,
  existingStatus: AlertStatus,
  transactions: Transaction[]
): ScanResult {
  const alertCreatedAt = alert.createdAt || Date.now();
  const isBaselineEstablished = existingStatus.baselineEstablished || false;

  // For new alerts, filter to only transactions AFTER alert creation
  let transactionsForBaseline = transactions;
  if (!isBaselineEstablished) {
    transactionsForBaseline = transactions.filter((tx) => tx.timestamp >= alertCreatedAt);
  }

  // Get previously seen transactions
  const previousTxs = existingStatus.lastSeenTransactions || [];
  const previousTxSet = new Set(previousTxs);

  // Find new transactions
  const newTransactions = transactions.filter((tx) => !previousTxSet.has(tx.hash));

  // Determine if alert should trigger
  const hasNewActivity = isBaselineEstablished
    ? newTransactions.length > 0
    : transactionsForBaseline.length > 0;

  // Keep triggered state persistent
  const wasTriggered = existingStatus.triggered || false;
  const shouldTrigger = hasNewActivity || wasTriggered;

  return {
    status: {
      ...existingStatus,
      currentValue: 100000,
      triggered: shouldTrigger,
      checkedAt: Date.now(),
      newTransactions: hasNewActivity
        ? isBaselineEstablished
          ? newTransactions
          : transactionsForBaseline
        : undefined,
      baselineEstablished: true,
      pendingInitialScan: false,
    },
    triggered: shouldTrigger,
    newTransactions: hasNewActivity
      ? isBaselineEstablished
        ? newTransactions
        : transactionsForBaseline
      : undefined,
  };
}

/**
 * Simulate a periodic scan (like the 30-second auto-scan)
 */
function simulatePeriodicScan(
  alert: AlertConfig,
  previousStatus: AlertStatus,
  allTransactions: Transaction[]
): ScanResult {
  return simulateScanForTriggerDetection(alert, previousStatus, allTransactions);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Trigger Detection", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // NEW ALERT WITH POST-CREATION TRANSACTIONS
  // -------------------------------------------------------------------------

  describe("New Alert with Post-Creation Transactions", () => {
    it("should trigger new alert with transactions after creation", () => {
      const alertCreatedAt = Date.now() - 3600000; // Created 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        pendingInitialScan: true,
        triggered: false,
        lastSeenTransactions: [],
      });

      // Transactions that occurred AFTER alert creation
      const postCreationTransactions = [
        createMockTransaction({
          timestamp: Date.now() - 1800000, // 30 min ago
        }),
        createMockTransaction({
          timestamp: Date.now() - 900000, // 15 min ago
        }),
      ];

      const result = simulateScanForTriggerDetection(
        alert,
        existingStatus,
        postCreationTransactions
      );

      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toBeDefined();
      expect(result.newTransactions?.length).toBe(2);
      expect(result.status.baselineEstablished).toBe(true);
      expect(result.status.pendingInitialScan).toBe(false);
    });

    it("should not trigger new alert with only historical transactions", () => {
      const alertCreatedAt = Date.now() - 3600000; // Created 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        triggered: false,
        lastSeenTransactions: [],
      });

      // Transactions that occurred BEFORE alert creation
      const historicalTransactions = [
        createMockTransaction({
          timestamp: Date.now() - 86400000, // 1 day ago
        }),
        createMockTransaction({
          timestamp: Date.now() - 172800000, // 2 days ago
        }),
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, historicalTransactions);

      expect(result.triggered).toBe(false);
      expect(result.newTransactions).toBeUndefined();
      expect(result.status.baselineEstablished).toBe(true);
    });

    it("should filter transactions to only include post-creation transactions", () => {
      const alertCreatedAt = Date.now() - 3600000; // Created 1 hour ago

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        triggered: false,
        lastSeenTransactions: [],
      });

      // Mix of historical and post-creation transactions
      const mixedTransactions = [
        createMockTransaction({
          timestamp: Date.now() - 86400000, // Before alert creation
        }),
        createMockTransaction({
          timestamp: Date.now() - 1800000, // After alert creation
        }),
        createMockTransaction({
          timestamp: Date.now() - 172800000, // Before alert creation
        }),
        createMockTransaction({
          timestamp: Date.now() - 900000, // After alert creation
        }),
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, mixedTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(2); // Only post-creation transactions
      expect(result.newTransactions?.every((tx) => tx.timestamp >= alertCreatedAt)).toBe(true);
    });

    it("should establish baseline on first scan of new alert", () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        triggered: false,
      });

      const transactions = [createMockTransaction()];

      const result = simulateScanForTriggerDetection(alert, existingStatus, transactions);

      expect(result.status.baselineEstablished).toBe(true);
      expect(result.status.baselineTimestamp).toBeDefined();
      expect(result.status.lastSeenTransactions).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // EXISTING ALERT WITH NEW TRANSACTIONS
  // -------------------------------------------------------------------------

  describe("Existing Alert with New Transactions", () => {
    it("should trigger existing alert when new transactions detected", () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
        createdAt: Date.now() - 86400000, // Created 1 day ago
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        baselineTimestamp: Date.now() - 72000000, // 20 hours ago
        triggered: false,
        lastSeenTransactions: ["0xoldtransaction1", "0xoldtransaction2"],
      });

      // New transaction that wasn't seen before
      const newTransaction = createMockTransaction({
        hash: "0xnewtransaction",
        timestamp: Date.now() - 60000, // 1 minute ago
      });

      const allTransactions = [
        createMockTransaction({ hash: "0xoldtransaction1" }),
        createMockTransaction({ hash: "0xoldtransaction2" }),
        newTransaction,
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, allTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions).toBeDefined();
      expect(result.newTransactions?.length).toBe(1);
      expect(result.newTransactions?.[0].hash).toBe("0xnewtransaction");
    });

    it("should not trigger existing alert with no new transactions", () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: ["0xtx1", "0xtx2", "0xtx3"],
      });

      // Same transactions as before
      const sameTransactions = [
        createMockTransaction({ hash: "0xtx1" }),
        createMockTransaction({ hash: "0xtx2" }),
        createMockTransaction({ hash: "0xtx3" }),
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, sameTransactions);

      expect(result.triggered).toBe(false);
      expect(result.newTransactions).toBeUndefined();
    });

    it("should detect multiple new transactions", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: ["0xtx1"],
      });

      const allTransactions = [
        createMockTransaction({ hash: "0xtx1" }), // Seen
        createMockTransaction({ hash: "0xtx2" }), // New
        createMockTransaction({ hash: "0xtx3" }), // New
        createMockTransaction({ hash: "0xtx4" }), // New
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, allTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(3);
      expect(result.status.lastSeenTransactions?.length).toBe(4);
    });

    it("should update lastSeenTransactions with new transactions", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: ["0xtx1", "0xtx2"],
      });

      const allTransactions = [
        createMockTransaction({ hash: "0xtx1" }),
        createMockTransaction({ hash: "0xtx2" }),
        createMockTransaction({ hash: "0xtx3" }), // New
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, allTransactions);

      expect(result.status.lastSeenTransactions).toHaveLength(3);
      expect(result.status.lastSeenTransactions).toContain("0xtx1");
      expect(result.status.lastSeenTransactions).toContain("0xtx2");
      expect(result.status.lastSeenTransactions).toContain("0xtx3");
    });
  });

  // -------------------------------------------------------------------------
  // ALERT WITH NO NEW TRANSACTIONS
  // -------------------------------------------------------------------------

  describe("Alert with No New Transactions", () => {
    it("should not trigger when no transactions exist", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: [],
      });

      const result = simulateScanForTriggerDetection(alert, existingStatus, []);

      expect(result.triggered).toBe(false);
      expect(result.newTransactions).toBeUndefined();
      expect(result.status.lastSeenTransactions).toEqual([]);
    });

    it("should not trigger with empty transaction list", () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "TOKEN",
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: ["0xtx1"],
      });

      const result = simulateScanForTriggerDetection(alert, existingStatus, []);

      expect(result.triggered).toBe(false);
      expect(result.status.lastSeenTransactions).toEqual(["0xtx1"]);
    });

    it("should maintain baseline when no new transactions", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        baselineTimestamp: Date.now() - 3600000,
        triggered: false,
        lastSeenTransactions: ["0xtx1"],
      });

      const result = simulateScanForTriggerDetection(alert, existingStatus, []);

      expect(result.status.baselineEstablished).toBe(true);
      expect(result.status.baselineTimestamp).toBe(existingStatus.baselineTimestamp);
    });
  });

  // -------------------------------------------------------------------------
  // TRIGGERED STATE PERSISTENCE ACROSS SCANS
  // -------------------------------------------------------------------------

  describe("Triggered State Persistence", () => {
    it("should maintain triggered state across multiple scans", () => {
      const alert = createMockAlert({ id: "alert-1" });

      // First scan - alert triggers
      const initialStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: ["0xtx1"],
      });

      const firstScanTransactions = [
        createMockTransaction({ hash: "0xtx1" }),
        createMockTransaction({ hash: "0xtx2" }), // New
      ];

      const firstResult = simulateScanForTriggerDetection(
        alert,
        initialStatus,
        firstScanTransactions
      );

      expect(firstResult.triggered).toBe(true);

      // Second scan - no new transactions, but should stay triggered
      const secondResult = simulateScanForTriggerDetection(
        alert,
        firstResult.status,
        firstScanTransactions // Same transactions
      );

      expect(secondResult.triggered).toBe(true); // Still triggered!
      expect(secondResult.newTransactions).toBeUndefined();
    });

    it("should reset triggered state only when explicitly dismissed", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const triggeredStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: true,
        lastSeenTransactions: ["0xtx1", "0xtx2"],
      });

      // Simulate explicit dismissal (user clicks "Dismiss" button)
      const dismissedStatus = {
        ...triggeredStatus,
        triggered: false,
      };

      const result = simulateScanForTriggerDetection(alert, dismissedStatus, [
        createMockTransaction({ hash: "0xtx1" }),
        createMockTransaction({ hash: "0xtx2" }),
      ]);

      expect(result.triggered).toBe(false); // No longer triggered
    });

    it("should re-trigger after dismissal if new transactions occur", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const dismissedStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false, // Was dismissed
        lastSeenTransactions: ["0xtx1", "0xtx2"],
      });

      const transactionsWithNew = [
        createMockTransaction({ hash: "0xtx1" }),
        createMockTransaction({ hash: "0xtx2" }),
        createMockTransaction({ hash: "0xtx3" }), // New after dismissal
      ];

      const result = simulateScanForTriggerDetection(alert, dismissedStatus, transactionsWithNew);

      expect(result.triggered).toBe(true); // Re-triggered!
      expect(result.newTransactions?.length).toBe(1);
    });

    it("should persist triggered state through periodic scans", () => {
      const alert = createMockAlert({ id: "alert-1" });

      // Initial triggered state
      let status = createMockAlertStatus({
        baselineEstablished: true,
        triggered: true,
        lastSeenTransactions: ["0xtx1"],
      });

      const transactions = [createMockTransaction({ hash: "0xtx1" })];

      // Simulate multiple periodic scans (like 30-second auto-scan)
      for (let i = 0; i < 5; i++) {
        const result = simulatePeriodicScan(alert, status, transactions);
        expect(result.triggered).toBe(true); // Should stay triggered
        status = result.status;
      }

      // After 5 scans, should still be triggered
      expect(status.triggered).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // EDGE CASES
  // -------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle transactions at exact alert creation timestamp", () => {
      const alertCreatedAt = Date.now() - 3600000;

      const alert = createMockAlert({
        id: "alert-1",
        createdAt: alertCreatedAt,
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        triggered: false,
      });

      // Transaction at exactly alert creation time
      const exactTimeTransaction = createMockTransaction({
        timestamp: alertCreatedAt,
      });

      const result = simulateScanForTriggerDetection(alert, existingStatus, [exactTimeTransaction]);

      // Transaction at exact timestamp should be included (>= comparison)
      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(1);
    });

    it("should handle alert created very recently", () => {
      const alert = createMockAlert({
        id: "alert-1",
        createdAt: Date.now() - 1000, // Created 1 second ago
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: false,
        triggered: false,
      });

      const recentTransaction = createMockTransaction({
        timestamp: Date.now() - 500, // 500ms ago (after alert creation)
      });

      const result = simulateScanForTriggerDetection(alert, existingStatus, [recentTransaction]);

      expect(result.triggered).toBe(true);
    });

    it("should handle rapid transactions", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: [],
      });

      // Multiple transactions with the same timestamp
      const baseTimestamp = Date.now() - 60000;
      const rapidTransactions = [
        createMockTransaction({ timestamp: baseTimestamp, hash: "0xtx1" }),
        createMockTransaction({ timestamp: baseTimestamp, hash: "0xtx2" }),
        createMockTransaction({ timestamp: baseTimestamp, hash: "0xtx3" }),
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, rapidTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(3);
    });

    it("should handle large numbers of transactions", () => {
      const alert = createMockAlert({ id: "alert-1" });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: [],
      });

      // Create 1000 transactions
      const manyTransactions = Array.from({ length: 1000 }, (_, i) =>
        createMockTransaction({
          hash: `0xtx${i}`,
          timestamp: Date.now() - i * 1000,
        })
      );

      const result = simulateScanForTriggerDetection(alert, existingStatus, manyTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(1000);
    });
  });

  // -------------------------------------------------------------------------
  // TYPE-SPECIFIC TRIGGER BEHAVIOR
  // -------------------------------------------------------------------------

  describe("Type-Specific Trigger Behavior", () => {
    it("should trigger WALLET type on any token activity", () => {
      const alert = createMockAlert({
        id: "alert-1",
        type: "WALLET",
      });

      const existingStatus = createMockAlertStatus({
        baselineEstablished: true,
        triggered: false,
        lastSeenTransactions: [],
      });

      const mixedTokenTransactions = [
        createMockTransaction({
          tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
          tokenSymbol: "wDOGE",
        }),
        createMockTransaction({
          tokenAddress: MOCK_TOKEN_ADDRESSES.USDT,
          tokenSymbol: "USDT",
        }),
      ];

      const result = simulateScanForTriggerDetection(alert, existingStatus, mixedTokenTransactions);

      expect(result.triggered).toBe(true);
      expect(result.newTransactions?.length).toBe(2);
    });
  });
});
