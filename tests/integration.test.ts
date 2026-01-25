/**
 * Integration Tests
 *
 * Tests full integration flows including:
 * - Full flow: create alert -> transaction occurs -> scan -> trigger
 * - Full flow: create alert -> edit -> scan
 * - Full flow: create alert -> delete -> verify removed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertConfig, AlertStatus, Transaction, TriggeredEvent } from "../types";
import {
  MOCK_WALLET_ADDRESSES,
  MOCK_TOKEN_ADDRESSES,
  resetAllMocks,
  mockFetchTokenBalance,
  mockFetchWalletTransactions,
  mockGetApiUrl,
} from "./alert-setup";

// ============================================================================
// MOCK SERVICE FUNCTIONS
// ============================================================================

// Mock data service functions
const mockSaveAlertToServer = vi.fn();
const mockSyncAlertsToServer = vi.fn();
const mockSyncAlertsFromServer = vi.fn();

// ============================================================================
// TEST HELPERS
// ============================================================================

interface AlertSystemState {
  alerts: AlertConfig[];
  statuses: Record<string, AlertStatus>;
  triggeredEvents: TriggeredEvent[];
}

/**
 * Simulate the full alert system from App.tsx
 */
class AlertSystemSimulator {
  private state: AlertSystemState;

  constructor() {
    this.state = {
      alerts: [],
      statuses: {},
      triggeredEvents: [],
    };
  }

  getState(): AlertSystemState {
    return { ...this.state };
  }

  // -------------------------------------------------------------------------
  // ALERT CREATION
  // -------------------------------------------------------------------------

  async createAlert(data: {
    name: string;
    walletAddress: string;
    tokenAddress?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  }): Promise<void> {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();

    const newAlert: AlertConfig = {
      id: alertId,
      name: data.name,
      walletAddress: data.walletAddress.toLowerCase(),
      tokenAddress: data.tokenAddress?.toLowerCase(),
      type: data.alertType || "WALLET",
      createdAt,
    };

    // Initialize status with pendingInitialScan flag BEFORE adding to alerts list
    const initialStatus: AlertStatus = {
      currentValue: 0,
      triggered: false,
      checkedAt: undefined,
      pendingInitialScan: true,
      baselineEstablished: false,
    };

    // Update state
    this.state.statuses[alertId] = initialStatus;
    this.state.alerts = [...this.state.alerts, newAlert];

    // Sync to server
    await mockSaveAlertToServer("user-wallet", newAlert);
  }

  // -------------------------------------------------------------------------
  // ALERT EDITING
  // -------------------------------------------------------------------------

  async updateAlert(
    alertId: string,
    data: {
      name: string;
      walletAddress: string;
      tokenAddress?: string;
      alertType?: "WALLET" | "TOKEN" | "WHALE";
    }
  ): Promise<void> {
    const alertIndex = this.state.alerts.findIndex((a) => a.id === alertId);
    if (alertIndex === -1) throw new Error("Alert not found");

    const updatedAlert: AlertConfig = {
      ...this.state.alerts[alertIndex],
      name: data.name,
      walletAddress: data.walletAddress.toLowerCase(),
      tokenAddress: data.tokenAddress?.toLowerCase(),
      type: data.alertType || "WALLET",
      createdAt: this.state.alerts[alertIndex].createdAt, // Preserve original creation time
    };

    this.state.alerts[alertIndex] = updatedAlert;

    // Reset status to trigger re-scan
    this.state.statuses[alertId] = {
      ...this.state.statuses[alertId],
      pendingInitialScan: true,
      baselineEstablished: false,
    };

    // Sync to server
    await mockSaveAlertToServer("user-wallet", updatedAlert);
  }

  // -------------------------------------------------------------------------
  // ALERT DELETION
  // -------------------------------------------------------------------------

  async deleteAlert(alertId: string): Promise<void> {
    // Remove alert
    this.state.alerts = this.state.alerts.filter((a) => a.id !== alertId);

    // Remove status
    delete this.state.statuses[alertId];

    // Remove triggered events for this alert
    this.state.triggeredEvents = this.state.triggeredEvents.filter((e) => e.alertId !== alertId);
  }

  // -------------------------------------------------------------------------
  // ALERT SCANNING
  // -------------------------------------------------------------------------

  async scanAlerts(transactionsMap: Record<string, Transaction[]>): Promise<void> {
    const alertsToScan = this.state.alerts.filter(
      (a) => !this.state.statuses[a.id] || this.state.statuses[a.id]?.pendingInitialScan
    );

    for (const alert of alertsToScan) {
      const existingStatus = this.state.statuses[alert.id];
      const _transactions = transactionsMap[alert.id] || [];

      // Simulate fetching balance
      const balance = await mockFetchTokenBalance(
        alert.walletAddress,
        alert.tokenAddress || MOCK_TOKEN_ADDRESSES.wDOGE
      );

      // Simulate fetching transactions
      const allTransactions = await mockFetchWalletTransactions(
        alert.walletAddress,
        alert.type === "WALLET" ? undefined : alert.tokenAddress
      );

      // Check baseline
      const isBaselineEstablished = existingStatus?.baselineEstablished || false;
      const alertCreatedAt = alert.createdAt || Date.now();

      let transactionsForBaseline = allTransactions;
      if (!isBaselineEstablished) {
        transactionsForBaseline = allTransactions.filter((tx) => tx.timestamp >= alertCreatedAt);
      }

      const previousTxs =
        existingStatus?.lastSeenTransactions || transactionsForBaseline.map((tx) => tx.hash);
      const previousTxSet = new Set(previousTxs);

      const newTransactions = allTransactions.filter((tx) => !previousTxSet.has(tx.hash));

      // Apply type-specific filtering
      let filteredNewTransactions = newTransactions;
      if (alert.type === "WHALE" && newTransactions.length > 0) {
        const whaleThreshold = Math.max(10000, balance * 0.01);
        filteredNewTransactions = newTransactions.filter((tx) => tx.value > whaleThreshold);
      }

      const allSeenTxs = [...new Set([...previousTxs, ...allTransactions.map((tx) => tx.hash)])];

      const hasNewActivity = isBaselineEstablished
        ? filteredNewTransactions.length > 0
        : transactionsForBaseline.length > 0;

      const wasTriggered = existingStatus?.triggered || false;
      const shouldTrigger = hasNewActivity || wasTriggered;

      this.state.statuses[alert.id] = {
        currentValue: balance,
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

      // Create triggered event if new transactions detected
      if (hasNewActivity && this.state.statuses[alert.id].newTransactions) {
        const newTxs: Transaction[] = this.state.statuses[alert.id].newTransactions;
        const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const triggeredEvent: TriggeredEvent = {
          id: eventId,
          alertId: alert.id,
          alertName: alert.name,
          walletAddress: alert.walletAddress,
          tokenAddress: alert.tokenAddress,
          tokenSymbol: alert.tokenSymbol,
          transactions: newTxs,
          triggeredAt: Date.now(),
          notified: true,
        };

        this.state.triggeredEvents = [triggeredEvent, ...this.state.triggeredEvents];
      }
    }
  }

  // -------------------------------------------------------------------------
  // TRIGGER DISMISSAL
  // -------------------------------------------------------------------------

  dismissTrigger(alertId: string): void {
    const status = this.state.statuses[alertId];
    if (!status) return;

    this.state.statuses[alertId] = {
      ...status,
      triggered: false,
      checkedAt: Date.now(),
    };
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Alert System Integration Tests", () => {
  let system: AlertSystemSimulator;

  beforeEach(() => {
    system = new AlertSystemSimulator();
    resetAllMocks();

    // Setup mock defaults
    mockFetchTokenBalance.mockResolvedValue(100000);
    mockFetchWalletTransactions.mockResolvedValue([]);
    mockGetApiUrl.mockImplementation((path) => path);
    mockSaveAlertToServer.mockResolvedValue(true);
    mockSyncAlertsToServer.mockResolvedValue({
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      timestamp: Date.now(),
    });
    mockSyncAlertsFromServer.mockResolvedValue({
      success: true,
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      timestamp: Date.now(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // FULL FLOW: CREATE -> TRANSACTION -> SCAN -> TRIGGER
  // -------------------------------------------------------------------------

  describe("Full Flow: Create Alert -> Transaction Occurs -> Scan -> Trigger", () => {
    it("should complete full trigger detection flow", async () => {
      // Step 1: Create alert
      await system.createAlert({
        name: "Integration Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      let state = system.getState();
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].name).toBe("Integration Test Alert");
      expect(state.statuses[state.alerts[0].id].pendingInitialScan).toBe(true);

      // Step 2: Simulate transaction occurring
      const alertId = state.alerts[0].id;
      const newTransaction = createMockTransaction({
        timestamp: Date.now() - 60000, // 1 minute ago
      });

      mockFetchWalletTransactions.mockResolvedValue([newTransaction]);

      // Step 3: Scan alerts
      await system.scanAlerts({ [alertId]: [newTransaction] });

      // Step 4: Verify trigger
      state = system.getState();
      const status = state.statuses[alertId];

      expect(status.triggered).toBe(true);
      expect(status.newTransactions).toBeDefined();
      expect(status.newTransactions?.length).toBe(1);
      expect(status.baselineEstablished).toBe(true);
      expect(status.pendingInitialScan).toBe(false);

      // Verify triggered event was created
      expect(state.triggeredEvents).toHaveLength(1);
      expect(state.triggeredEvents[0].alertId).toBe(alertId);
      expect(state.triggeredEvents[0].transactions).toHaveLength(1);
    });

    it("should trigger on transactions after alert creation time", async () => {
      // Create alert at specific time
      const creationTime = Date.now() - 3600000; // 1 hour ago

      await system.createAlert({
        name: "Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      // Manually set creation time for testing
      const alert = system.getState().alerts[0];
      alert.createdAt = creationTime;

      // Transaction after creation
      const postCreationTx = createMockTransaction({
        timestamp: Date.now() - 1800000, // 30 min ago (after alert creation)
      });

      // Transaction before creation
      const preCreationTx = createMockTransaction({
        hash: "0xhistorical",
        timestamp: Date.now() - 86400000, // 1 day ago (before alert creation)
      });

      mockFetchWalletTransactions.mockResolvedValue([preCreationTx, postCreationTx]);

      await system.scanAlerts({
        [alert.id]: [preCreationTx, postCreationTx],
      });

      const state = system.getState();
      const status = state.statuses[alert.id];

      // Should only trigger on post-creation transaction
      expect(status.triggered).toBe(true);
      expect(status.newTransactions?.length).toBe(1);
      expect(status.newTransactions?.[0].hash).toBe(postCreationTx.hash);
    });

    it("should not trigger on historical transactions only", async () => {
      await system.createAlert({
        name: "Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const alert = system.getState().alerts[0];

      // Only historical transactions (before alert creation)
      const historicalTxs = [
        createMockTransaction({
          hash: "0xold1",
          timestamp: Date.now() - 86400000,
        }),
        createMockTransaction({
          hash: "0xold2",
          timestamp: Date.now() - 172800000,
        }),
      ];

      mockFetchWalletTransactions.mockResolvedValue(historicalTxs);

      await system.scanAlerts({ [alert.id]: historicalTxs });

      const state = system.getState();
      const status = state.statuses[alert.id];

      expect(status.triggered).toBe(false);
      expect(status.newTransactions).toBeUndefined();
      expect(status.baselineEstablished).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // FULL FLOW: CREATE -> EDIT -> SCAN
  // -------------------------------------------------------------------------

  describe("Full Flow: Create Alert -> Edit -> Scan", () => {
    it("should update alert and rescan", async () => {
      // Step 1: Create initial alert
      await system.createAlert({
        name: "Original Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      let state = system.getState();
      const alertId = state.alerts[0].id;

      expect(state.alerts[0].name).toBe("Original Alert");
      expect(state.alerts[0].type).toBe("WALLET");

      // Step 2: Edit alert
      await system.updateAlert(alertId, {
        name: "Updated Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
        alertType: "TOKEN",
      });

      state = system.getState();
      expect(state.alerts[0].name).toBe("Updated Alert");
      expect(state.alerts[0].type).toBe("TOKEN");
      expect(state.alerts[0].tokenAddress).toBe(MOCK_TOKEN_ADDRESSES.wDOGE.toLowerCase());

      // Status should be reset for re-scan
      expect(state.statuses[alertId].pendingInitialScan).toBe(true);
      expect(state.statuses[alertId].baselineEstablished).toBe(false);

      // Step 3: Scan after edit
      const transactions = [createMockTransaction()];
      mockFetchWalletTransactions.mockResolvedValue(transactions);

      await system.scanAlerts({ [alertId]: transactions });

      state = system.getState();
      expect(state.statuses[alertId].triggered).toBe(true);
      expect(state.statuses[alertId].pendingInitialScan).toBe(false);
      expect(state.statuses[alertId].baselineEstablished).toBe(true);
    });

    it("should preserve original creation time after edit", async () => {
      const originalCreationTime = Date.now() - 86400000; // 1 day ago

      await system.createAlert({
        name: "Original Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      // Manually set creation time
      const alert = system.getState().alerts[0];
      alert.createdAt = originalCreationTime;

      // Edit the alert
      await system.updateAlert(alert.id, {
        name: "Updated Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const updatedAlert = system.getState().alerts[0];
      expect(updatedAlert.createdAt).toBe(originalCreationTime);
      expect(updatedAlert.name).toBe("Updated Alert");
    });

    it("should trigger on new transactions after edit", async () => {
      // Create and scan initial alert
      await system.createAlert({
        name: "Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const alert = system.getState().alerts[0];

      const initialTxs = [createMockTransaction({ hash: "0xtx1" })];
      mockFetchWalletTransactions.mockResolvedValue(initialTxs);

      await system.scanAlerts({ [alert.id]: initialTxs });

      let state = system.getState();
      expect(state.statuses[alert.id].triggered).toBe(true);

      // Dismiss trigger
      system.dismissTrigger(alert.id);

      state = system.getState();
      expect(state.statuses[alert.id].triggered).toBe(false);

      // Edit alert (should reset baseline)
      await system.updateAlert(alert.id, {
        name: "Edited Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      // New transaction after edit
      const newTx = createMockTransaction({ hash: "0xtx2" });
      mockFetchWalletTransactions.mockResolvedValue([...initialTxs, newTx]);

      await system.scanAlerts({ [alert.id]: [...initialTxs, newTx] });

      state = system.getState();
      expect(state.statuses[alert.id].triggered).toBe(true);
      expect(state.triggeredEvents.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // FULL FLOW: CREATE -> DELETE -> VERIFY REMOVED
  // -------------------------------------------------------------------------

  describe("Full Flow: Create Alert -> Delete -> Verify Removed", () => {
    it("should completely remove alert and all associated data", async () => {
      // Step 1: Create alert
      await system.createAlert({
        name: "To Be Deleted",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      let state = system.getState();
      const alertId = state.alerts[0].id;

      expect(state.alerts).toHaveLength(1);
      expect(state.statuses[alertId]).toBeDefined();

      // Step 2: Trigger the alert to create event history
      const transactions = [createMockTransaction()];
      mockFetchWalletTransactions.mockResolvedValue(transactions);

      await system.scanAlerts({ [alertId]: transactions });

      state = system.getState();
      expect(state.triggeredEvents).toHaveLength(1);
      expect(state.statuses[alertId].triggered).toBe(true);

      // Step 3: Delete alert
      await system.deleteAlert(alertId);

      // Step 4: Verify removal
      state = system.getState();

      // Alert should be removed
      expect(state.alerts).toHaveLength(0);
      expect(state.alerts.find((a) => a.id === alertId)).toBeUndefined();

      // Status should be removed
      expect(state.statuses[alertId]).toBeUndefined();

      // Triggered events should be removed
      expect(state.triggeredEvents).toHaveLength(0);
      expect(state.triggeredEvents.find((e) => e.alertId === alertId)).toBeUndefined();
    });

    it("should handle deleting one of multiple alerts", async () => {
      // Create multiple alerts
      await system.createAlert({
        name: "Alert 1",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      await system.createAlert({
        name: "Alert 2",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
        alertType: "TOKEN",
      });

      await system.createAlert({
        name: "Alert 3",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WHALE",
      });

      let state = system.getState();
      expect(state.alerts).toHaveLength(3);

      const alertToDelete = state.alerts[1]; // Delete Alert 2

      // Delete middle alert
      await system.deleteAlert(alertToDelete.id);

      state = system.getState();

      // Verify correct alert was deleted
      expect(state.alerts).toHaveLength(2);
      expect(state.alerts.find((a) => a.id === alertToDelete.id)).toBeUndefined();
      expect(state.statuses[alertToDelete.id]).toBeUndefined();

      // Verify other alerts remain
      expect(state.alerts[0].name).toBe("Alert 1");
      expect(state.alerts[1].name).toBe("Alert 3");
    });

    it("should handle deleting alert with no triggered events", async () => {
      await system.createAlert({
        name: "No Events Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const state = system.getState();
      const alertId = state.alerts[0].id;

      // Don't scan - no triggered events
      expect(state.triggeredEvents).toHaveLength(0);

      // Delete alert
      await system.deleteAlert(alertId);

      const newState = system.getState();
      expect(newState.alerts).toHaveLength(0);
      expect(newState.statuses[alertId]).toBeUndefined();
    });

    it("should handle deleting alert with multiple triggered events", async () => {
      await system.createAlert({
        name: "Multi-Event Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const alert = system.getState().alerts[0];

      // Create multiple triggered events
      for (let i = 0; i < 5; i++) {
        const tx = createMockTransaction({ hash: `0xtx${i}` });
        mockFetchWalletTransactions.mockResolvedValue([tx]);

        await system.scanAlerts({ [alert.id]: [tx] });

        // Dismiss trigger to allow re-triggering
        system.dismissTrigger(alert.id);
      }

      let state = system.getState();
      expect(state.triggeredEvents.length).toBeGreaterThanOrEqual(5);

      // Delete alert
      await system.deleteAlert(alert.id);

      state = system.getState();

      // All events for this alert should be removed
      expect(state.alerts).toHaveLength(0);
      expect(state.statuses[alert.id]).toBeUndefined();
      expect(state.triggeredEvents.find((e) => e.alertId === alert.id)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // COMPLEX INTEGRATION SCENARIOS
  // -------------------------------------------------------------------------

  describe("Complex Integration Scenarios", () => {
    it("should handle rapid alert creation and deletion", async () => {
      // Create multiple alerts quickly
      const alertIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        await system.createAlert({
          name: `Rapid Alert ${i}`,
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: i % 2 === 0 ? "WALLET" : "TOKEN",
        });

        const state = system.getState();
        alertIds.push(state.alerts[state.alerts.length - 1].id);
      }

      let state = system.getState();
      expect(state.alerts).toHaveLength(10);

      // Delete half of them
      for (let i = 0; i < 5; i++) {
        await system.deleteAlert(alertIds[i]);
      }

      state = system.getState();
      expect(state.alerts).toHaveLength(5);
    });

    it("should handle server sync integration", async () => {
      await system.createAlert({
        name: "Sync Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      expect(mockSaveAlertToServer).toHaveBeenCalledWith(
        "user-wallet",
        expect.objectContaining({
          name: "Sync Test Alert",
        })
      );
    });

    it("should maintain data consistency through multiple operations", async () => {
      // Create
      await system.createAlert({
        name: "Consistency Test",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      let state = system.getState();
      const alertId = state.alerts[0].id;

      // Scan
      const tx1 = createMockTransaction({ hash: "0xtx1" });
      mockFetchWalletTransactions.mockResolvedValue([tx1]);
      await system.scanAlerts({ [alertId]: [tx1] });

      state = system.getState();
      expect(state.statuses[alertId].triggered).toBe(true);
      expect(state.triggeredEvents).toHaveLength(1);

      // Edit
      await system.updateAlert(alertId, {
        name: "Updated Consistency Test",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      state = system.getState();
      expect(state.alerts[0].name).toBe("Updated Consistency Test");

      // Scan again
      const tx2 = createMockTransaction({ hash: "0xtx2" });
      mockFetchWalletTransactions.mockResolvedValue([tx1, tx2]);
      await system.scanAlerts({ [alertId]: [tx1, tx2] });

      state = system.getState();
      expect(state.statuses[alertId].triggered).toBe(true);

      // Delete
      await system.deleteAlert(alertId);

      state = system.getState();
      expect(state.alerts).toHaveLength(0);
      expect(state.statuses[alertId]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // ERROR RECOVERY
  // -------------------------------------------------------------------------

  describe("Error Recovery", () => {
    it("should handle scan failure and retry", async () => {
      await system.createAlert({
        name: "Error Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      const alert = system.getState().alerts[0];

      // First scan fails
      mockFetchWalletTransactions.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw, but handle error gracefully
      await system.scanAlerts({ [alert.id]: [] });

      const state = system.getState();
      // Status should still be created even with error
      expect(state.statuses[alert.id]).toBeDefined();

      // Retry scan succeeds
      mockFetchWalletTransactions.mockResolvedValue([createMockTransaction()]);
      await system.scanAlerts({ [alert.id]: [createMockTransaction()] });

      const updatedState = system.getState();
      expect(updatedState.statuses[alert.id].checkedAt).toBeDefined();
    });
  });
});
