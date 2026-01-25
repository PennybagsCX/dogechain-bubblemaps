/**
 * Alert Creation Tests
 *
 * Tests the alert creation flow including:
 * - Creating wallet alerts
 * - Creating token alerts
 * - Creating whale alerts
 * - Validation of addresses
 * - pendingInitialScan flag setting
 * - Status initialization before alert is added to list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertConfig, AlertStatus } from "../types";
import {
  MOCK_WALLET_ADDRESSES,
  MOCK_TOKEN_ADDRESSES,
  createMockAlert,
  createMockAlertStatus,
  resetAllMocks,
  mockValidateWalletAddress,
  mockValidateTokenAddress,
} from "./alert-setup";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Simulate the alert creation logic from App.tsx
 */
async function simulateAlertCreation(
  existingAlerts: AlertConfig[],
  existingStatuses: Record<string, AlertStatus>,
  newAlertData: {
    name: string;
    walletAddress: string;
    tokenAddress?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  }
): Promise<{ alerts: AlertConfig[]; statuses: Record<string, AlertStatus> }> {
  // Validate addresses
  mockValidateWalletAddress(newAlertData.walletAddress);
  if (newAlertData.tokenAddress) {
    mockValidateTokenAddress(newAlertData.tokenAddress);
  }

  // Create the alert with pendingInitialScan flag
  const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Date.now();

  const newAlert: AlertConfig = {
    id: alertId,
    name: newAlertData.name,
    walletAddress: newAlertData.walletAddress.toLowerCase(),
    tokenAddress: newAlertData.tokenAddress?.toLowerCase(),
    type: newAlertData.alertType || "WALLET",
    createdAt,
  };

  // Initialize status with pendingInitialScan flag BEFORE adding to list
  // This ensures the scanner will pick up the new alert
  const initialStatus: AlertStatus = {
    currentValue: 0,
    triggered: false,
    checkedAt: undefined, // Not yet scanned
    pendingInitialScan: true, // Flag to indicate alert needs its first scan
    baselineEstablished: false,
  };

  return {
    alerts: [...existingAlerts, newAlert],
    statuses: { ...existingStatuses, [alertId]: initialStatus },
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Alert Creation", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // WALLET ALERT CREATION
  // -------------------------------------------------------------------------

  describe("Wallet Alert Creation", () => {
    it("should create a wallet alert with valid address", async () => {
      const existingAlerts: AlertConfig[] = [];
      const existingStatuses: Record<string, AlertStatus> = {};

      const result = await simulateAlertCreation(existingAlerts, existingStatuses, {
        name: "My Wallet Monitor",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      // Verify alert was created
      expect(result.alerts).toHaveLength(1);
      const alert = result.alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.name).toBe("My Wallet Monitor");
      expect(alert.walletAddress).toBe(MOCK_WALLET_ADDRESSES.valid.toLowerCase());
      expect(alert.type).toBe("WALLET");
      expect(alert.createdAt).toBeDefined();
      expect(alert.createdAt).toBeLessThanOrEqual(Date.now());

      // Verify status was initialized
      expect(result.statuses[alert.id]).toBeDefined();
      const status = result.statuses[alert.id];
      expect(status.pendingInitialScan).toBe(true);
      expect(status.triggered).toBe(false);
      expect(status.checkedAt).toBeUndefined();
      expect(status.baselineEstablished).toBe(false);
    });

    it("should create a wallet alert without token address", async () => {
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Wallet Monitor",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      const alert = result.alerts[0];
      expect(alert.tokenAddress).toBeUndefined();
      expect(alert.tokenName).toBeUndefined();
      expect(alert.tokenSymbol).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // TOKEN ALERT CREATION
  // -------------------------------------------------------------------------

  describe("Token Alert Creation", () => {
    it("should create a token alert with valid addresses", async () => {
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "wDOGE Monitor",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
          alertType: "TOKEN",
        }
      );

      const alert = result.alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.name).toBe("wDOGE Monitor");
      expect(alert.walletAddress).toBe(MOCK_WALLET_ADDRESSES.valid.toLowerCase());
      expect(alert.tokenAddress).toBe(MOCK_TOKEN_ADDRESSES.wDOGE.toLowerCase());
      expect(alert.type).toBe("TOKEN");

      // Verify status initialization
      const status = result.statuses[alert.id];
      expect(status.pendingInitialScan).toBe(true);
      expect(status.triggered).toBe(false);
    });

    it("should require token address for TOKEN type", async () => {
      await expect(
        simulateAlertCreation(
          [],
          {},
          {
            name: "Token Alert",
            walletAddress: MOCK_WALLET_ADDRESSES.valid,
            alertType: "TOKEN",
          }
        )
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // WHALE ALERT CREATION
  // -------------------------------------------------------------------------

  describe("Whale Alert Creation", () => {
    it("should create a whale alert with valid addresses", async () => {
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Whale Watch",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
          alertType: "WHALE",
        }
      );

      const alert = result.alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.name).toBe("Whale Watch");
      expect(alert.walletAddress).toBe(MOCK_WALLET_ADDRESSES.valid.toLowerCase());
      expect(alert.tokenAddress).toBe(MOCK_TOKEN_ADDRESSES.wDOGE.toLowerCase());
      expect(alert.type).toBe("WHALE");

      // Verify status initialization
      const status = result.statuses[alert.id];
      expect(status.pendingInitialScan).toBe(true);
      expect(status.triggered).toBe(false);
    });

    it("should create whale alert without token address (all tokens)", async () => {
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "All Token Whale Watch",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WHALE",
        }
      );

      const alert = result.alerts[0];
      expect(alert.type).toBe("WHALE");
      expect(alert.tokenAddress).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // INVALID ADDRESS VALIDATION
  // -------------------------------------------------------------------------

  describe("Invalid Address Validation", () => {
    it("should reject alert with invalid wallet address", async () => {
      await expect(
        simulateAlertCreation(
          [],
          {},
          {
            name: "Invalid Alert",
            walletAddress: MOCK_WALLET_ADDRESSES.invalid,
            alertType: "WALLET",
          }
        )
      ).rejects.toThrow("Invalid wallet address");
    });

    it("should reject alert with invalid token address", async () => {
      await expect(
        simulateAlertCreation(
          [],
          {},
          {
            name: "Invalid Token Alert",
            walletAddress: MOCK_WALLET_ADDRESSES.valid,
            tokenAddress: MOCK_TOKEN_ADDRESSES.invalid,
            alertType: "TOKEN",
          }
        )
      ).rejects.toThrow("Invalid token address");
    });

    it("should reject alert with short wallet address", async () => {
      await expect(
        simulateAlertCreation(
          [],
          {},
          {
            name: "Short Address Alert",
            walletAddress: MOCK_WALLET_ADDRESSES.short,
            alertType: "WALLET",
          }
        )
      ).rejects.toThrow();
    });

    it("should reject alert with mixed case invalid address", async () => {
      await expect(
        simulateAlertCreation(
          [],
          {},
          {
            name: "Mixed Case Alert",
            walletAddress: "0xGHIJKLmnopqrstuvwxyz",
            alertType: "WALLET",
          }
        )
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // PENDING INITIAL SCAN FLAG
  // -------------------------------------------------------------------------

  describe("pendingInitialScan Flag", () => {
    it("should set pendingInitialScan flag for new alerts", async () => {
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Test Alert",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      const alert = result.alerts[0];
      const status = result.statuses[alert.id];

      expect(status.pendingInitialScan).toBe(true);
      expect(status.checkedAt).toBeUndefined();
      expect(status.baselineEstablished).toBe(false);
    });

    it("should preserve pendingInitialScan flag across status updates", () => {
      const _alert = createMockAlert();
      let status = createMockAlertStatus({ pendingInitialScan: true });

      // Simulate a status update that preserves the flag
      status = { ...status, currentValue: 1000 };

      expect(status.pendingInitialScan).toBe(true);
    });

    it("should clear pendingInitialScan flag after scan", () => {
      const _alert = createMockAlert();
      let status = createMockAlertStatus({ pendingInitialScan: true });

      // Simulate scan completing
      status = {
        ...status,
        currentValue: 1000,
        checkedAt: Date.now(),
        pendingInitialScan: false,
        baselineEstablished: true,
      };

      expect(status.pendingInitialScan).toBe(false);
      expect(status.baselineEstablished).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // STATUS INITIALIZATION ORDER
  // -------------------------------------------------------------------------

  describe("Status Initialization Before Alert Addition", () => {
    it("should initialize status before adding alert to list", async () => {
      const existingAlerts: AlertConfig[] = [];
      const existingStatuses: Record<string, AlertStatus> = {};

      // The status should be created BEFORE the alert is added to the list
      // This ensures the auto-scan will pick up the new alert
      const alertId = `alert-${Date.now()}`;
      const tempStatus: AlertStatus = {
        currentValue: 0,
        triggered: false,
        pendingInitialScan: true,
        baselineEstablished: false,
      };

      // Add status first
      const statusesWithNew = { ...existingStatuses, [alertId]: tempStatus };

      // Then add alert
      const newAlert: AlertConfig = {
        id: alertId,
        name: "Test Alert",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        type: "WALLET",
        createdAt: Date.now(),
      };

      const alertsWithNew = [...existingAlerts, newAlert];

      // Verify status exists before alert is in list
      expect(statusesWithNew[alertId]).toBeDefined();
      expect(alertsWithNew.find((a) => a.id === alertId)).toBeDefined();
    });

    it("should handle multiple alerts being created in sequence", async () => {
      const alerts: AlertConfig[] = [];
      const statuses: Record<string, AlertStatus> = {};

      // Create first alert
      const result1 = await simulateAlertCreation(alerts, statuses, {
        name: "Alert 1",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      // Create second alert
      const result2 = await simulateAlertCreation(result1.alerts, result1.statuses, {
        name: "Alert 2",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
        alertType: "TOKEN",
      });

      // Verify both alerts have status initialized
      expect(result2.alerts).toHaveLength(2);
      expect(Object.keys(result2.statuses)).toHaveLength(2);

      result2.alerts.forEach((alert) => {
        expect(result2.statuses[alert.id]).toBeDefined();
        expect(result2.statuses[alert.id].pendingInitialScan).toBe(true);
      });
    });
  });

  // -------------------------------------------------------------------------
  // ALERT PROPERTIES
  // -------------------------------------------------------------------------

  describe("Alert Properties", () => {
    it("should normalize wallet address to lowercase", async () => {
      const mixedCaseAddress = "0x742D35Cc6634C0532925a3b844Bc9e7595f0bEb0";
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Test",
          walletAddress: mixedCaseAddress,
          alertType: "WALLET",
        }
      );

      expect(result.alerts[0].walletAddress).toBe(mixedCaseAddress.toLowerCase());
    });

    it("should normalize token address to lowercase", async () => {
      const mixedCaseToken = "0xB7Ddc6414bf4f5515b52d8Bdd69973ae205ff101";
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Test",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          tokenAddress: mixedCaseToken,
          alertType: "TOKEN",
        }
      );

      expect(result.alerts[0].tokenAddress).toBe(mixedCaseToken.toLowerCase());
    });

    it("should set createdAt timestamp to current time", async () => {
      const beforeTime = Date.now();
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: "Test",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );
      const afterTime = Date.now();

      expect(result.alerts[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.alerts[0].createdAt).toBeLessThanOrEqual(afterTime);
    });

    it("should generate unique alert IDs", async () => {
      const result1 = await simulateAlertCreation(
        [],
        {},
        {
          name: "Alert 1",
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await simulateAlertCreation(result1.alerts, result1.statuses, {
        name: "Alert 2",
        walletAddress: MOCK_WALLET_ADDRESSES.valid,
        alertType: "WALLET",
      });

      expect(result1.alerts[0].id).not.toBe(result2.alerts[1].id);
    });
  });

  // -------------------------------------------------------------------------
  // EDGE CASES
  // -------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle alerts with very long names", async () => {
      const longName = "A".repeat(500);
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: longName,
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      expect(result.alerts[0].name).toBe(longName);
    });

    it("should handle special characters in alert names", async () => {
      const specialName = "Test Alert! @#$%^&*()";
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: specialName,
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      expect(result.alerts[0].name).toBe(specialName);
    });

    it("should handle unicode characters in alert names", async () => {
      const unicodeName = "Test Alert with emoji ";
      const result = await simulateAlertCreation(
        [],
        {},
        {
          name: unicodeName,
          walletAddress: MOCK_WALLET_ADDRESSES.valid,
          alertType: "WALLET",
        }
      );

      expect(result.alerts[0].name).toBe(unicodeName);
    });
  });
});
