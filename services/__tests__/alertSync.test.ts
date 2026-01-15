import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  syncAlerts,
  syncAlertsToServer,
  syncAlertsFromServer,
  deleteAlertFromServer,
  type SyncResult,
} from "../db";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Alert Sync Functions", () => {
  const testWallet = "0x1234567890123456789012345678901234567890";
  const testAlert = {
    alertId: "test-alert-1",
    name: "Test Alert",
    walletAddress: "0x9876543210987654321098765432109876543210",
    tokenAddress: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
    tokenName: "Test Token",
    tokenSymbol: "TST",
    initialValue: 1000,
    type: "TOKEN" as const,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncAlertsToServer", () => {
    it("should successfully push alerts to server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          uploaded: 1,
          downloaded: 0,
          conflicts: 0,
          syncTimestamp: Date.now(),
        }),
      });

      // Mock db.alerts.toArray
      const mockToArray = vi.fn().mockResolvedValue([testAlert]);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray },
        },
      }));

      const result = await syncAlertsToServer(testWallet);

      expect(result.success).toBe(true);
      expect(result.uploaded).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/alerts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining(testWallet),
      });
    });

    it("should handle empty alert list", async () => {
      const result = await syncAlertsToServer(testWallet);

      expect(result.success).toBe(true);
      expect(result.uploaded).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle server errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await syncAlertsToServer(testWallet);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await syncAlertsToServer(testWallet);

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });
  });

  describe("syncAlertsFromServer", () => {
    it("should successfully pull alerts from server", async () => {
      const serverAlerts = [
        {
          alert_id: "server-alert-1",
          name: "Server Alert",
          wallet_address: "0x9876543210987654321098765432109876543210",
          token_address: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
          token_name: "Server Token",
          token_symbol: "SRV",
          initial_value: 2000,
          type: "TOKEN",
          created_at: Date.now(),
          is_active: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: serverAlerts,
          count: 1,
        }),
      });

      // Mock db.alerts.toArray and db.alerts.add
      const mockToArray = vi.fn().mockResolvedValue([]);
      const mockAdd = vi.fn().mockResolvedValue(undefined);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray, add: mockAdd },
        },
      }));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(true);
      expect(result.downloaded).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/alerts/user?wallet=${testWallet}`,
        expect.any(Object)
      );
    });

    it("should merge server alerts with local alerts (server wins)", async () => {
      const serverAlerts = [
        {
          alert_id: "shared-alert",
          name: "Updated Name",
          wallet_address: "0x9876543210987654321098765432109876543210",
          created_at: Date.now(), // Newer
          is_active: true,
        },
      ];

      const localAlerts = [
        {
          id: 1,
          alertId: "shared-alert",
          name: "Old Name",
          walletAddress: "0x9876543210987654321098765432109876543210",
          createdAt: Date.now() - 10000, // Older
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: serverAlerts,
          count: 1,
        }),
      });

      // Mock db operations
      const mockToArray = vi.fn().mockResolvedValue(localAlerts);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray, update: mockUpdate },
        },
      }));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should filter out inactive alerts", async () => {
      const serverAlerts = [
        {
          alert_id: "inactive-alert",
          name: "Inactive Alert",
          wallet_address: "0x9876543210987654321098765432109876543210",
          created_at: Date.now(),
          is_active: false, // Inactive
        },
        {
          alert_id: "active-alert",
          name: "Active Alert",
          wallet_address: "0x9876543210987654321098765432109876543210",
          created_at: Date.now(),
          is_active: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: serverAlerts,
          count: 2,
        }),
      });

      const mockToArray = vi.fn().mockResolvedValue([]);
      const mockAdd = vi.fn().mockResolvedValue(undefined);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray, add: mockAdd },
        },
      }));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(true);
      expect(result.downloaded).toBe(1); // Only active alert
    });

    it("should handle server errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("syncAlerts (bidirectional)", () => {
    it("should perform full bidirectional sync", async () => {
      // Mock pull (from server)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
            count: 0,
          }),
        })
        // Mock push (to server)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            uploaded: 1,
            downloaded: 0,
            conflicts: 0,
            syncTimestamp: Date.now(),
          }),
        });

      const result = await syncAlerts(testWallet);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should fail if pull fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await syncAlerts(testWallet);

      expect(result.success).toBe(false);
    });
  });

  describe("deleteAlertFromServer", () => {
    it("should successfully delete alert from server", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await deleteAlertFromServer(testWallet, "test-alert-id");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/alerts/user?wallet=${testWallet}&alertId=test-alert-id`,
        { method: "DELETE" }
      );
    });

    it("should handle delete errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await deleteAlertFromServer(testWallet, "test-alert-id");

      expect(result).toBe(false);
    });

    it("should handle HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await deleteAlertFromServer(testWallet, "test-alert-id");

      expect(result).toBe(false);
    });
  });

  describe("Sync Result Interface", () => {
    it("should have correct structure", () => {
      const result: SyncResult = {
        success: true,
        uploaded: 1,
        downloaded: 2,
        conflicts: 0,
        timestamp: Date.now(),
      };

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("uploaded");
      expect(result).toHaveProperty("downloaded");
      expect(result).toHaveProperty("conflicts");
      expect(result).toHaveProperty("timestamp");
    });

    it("should allow optional error field", () => {
      const result: SyncResult = {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        timestamp: Date.now(),
        error: "Something went wrong",
      };

      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("Conflict Resolution", () => {
    it("should use last write wins strategy (server newer)", async () => {
      const serverTime = Date.now();
      const localTime = serverTime - 10000; // 10 seconds older

      const serverAlerts = [
        {
          alert_id: "conflict-alert",
          name: "Server Version",
          wallet_address: "0x9876543210987654321098765432109876543210",
          created_at: serverTime,
          is_active: true,
        },
      ];

      const localAlerts = [
        {
          id: 1,
          alertId: "conflict-alert",
          name: "Local Version",
          walletAddress: "0x9876543210987654321098765432109876543210",
          createdAt: localTime,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: serverAlerts,
          count: 1,
        }),
      });

      const mockToArray = vi.fn().mockResolvedValue(localAlerts);
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray, update: mockUpdate },
        },
      }));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should use last write wins strategy (local newer)", async () => {
      const localTime = Date.now();
      const serverTime = localTime - 10000; // 10 seconds older

      const serverAlerts = [
        {
          alert_id: "conflict-alert",
          name: "Server Version",
          wallet_address: "0x9876543210987654321098765432109876543210",
          created_at: serverTime,
          is_active: true,
        },
      ];

      const localAlerts = [
        {
          id: 1,
          alertId: "conflict-alert",
          name: "Local Version",
          walletAddress: "0x9876543210987654321098765432109876543210",
          createdAt: localTime,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: serverAlerts,
          count: 1,
        }),
      });

      const mockToArray = vi.fn().mockResolvedValue(localAlerts);
      vi.doMock("../db", () => ({
        db: {
          alerts: { toArray: mockToArray },
        },
      }));

      const result = await syncAlertsFromServer(testWallet);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBe(1); // Local is newer, marked as conflict
    });
  });
});
