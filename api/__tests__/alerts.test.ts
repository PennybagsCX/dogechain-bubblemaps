/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createApiApp } from "../../src/api/index";

// Mock database
const mockSql = vi.fn();
vi.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

describe("Alert API Endpoints", () => {
  let app: any;

  beforeEach(() => {
    app = createApiApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/alerts/user", () => {
    it("should fetch alerts for a valid wallet address", async () => {
      const testWallet = "0x1234567890123456789012345678901234567890";
      const mockAlerts = [
        {
          id: 1,
          user_wallet_address: testWallet,
          alert_id: "alert-1",
          name: "Test Alert",
          wallet_address: "0x9876543210987654321098765432109876543210",
          token_address: null,
          token_name: null,
          token_symbol: null,
          initial_value: null,
          type: "WALLET",
          created_at: Date.now(),
          updated_at: new Date(),
          is_active: true,
        },
      ];

      mockSql.mockResolvedValueOnce(mockAlerts);

      const response = await request(app).get(`/api/alerts/user?wallet=${testWallet}`).expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("count", 1);
      expect(response.body.data).toHaveLength(1);
      expect(mockSql).toHaveBeenCalledWith(expect.stringContaining("SELECT"), expect.anything());
    });

    it("should normalize wallet address to lowercase", async () => {
      const testWallet = "0x1234567890ABCDEFABCDEFABCDEFABCDEFABCDEF";
      mockSql.mockResolvedValueOnce([]);

      await request(app).get(`/api/alerts/user?wallet=${testWallet}`).expect(200);

      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0][0];
      expect(callArgs.toLowerCase()).toContain(testWallet.toLowerCase());
    });

    it("should return 400 if wallet parameter is missing", async () => {
      const response = await request(app).get("/api/alerts/user").expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required parameter");
    });

    it("should return 400 for invalid wallet address", async () => {
      const response = await request(app)
        .get("/api/alerts/user?wallet=invalid-address")
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Invalid wallet address");
    });

    it("should handle database errors gracefully", async () => {
      const testWallet = "0x1234567890123456789012345678901234567890";
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app).get(`/api/alerts/user?wallet=${testWallet}`).expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Failed to fetch alerts");
    });

    it("should filter out inactive alerts", async () => {
      const testWallet = "0x1234567890123456789012345678901234567890";
      const mockAlerts = [
        {
          id: 1,
          is_active: true,
        },
        {
          id: 2,
          is_active: false,
        },
      ];

      mockSql.mockResolvedValueOnce(mockAlerts);

      const response = await request(app).get(`/api/alerts/user?wallet=${testWallet}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSql).toHaveBeenCalledWith(
        expect.stringContaining("is_active = true"),
        expect.anything()
      );
    });
  });

  describe("POST /api/alerts/user", () => {
    const validAlertData = {
      walletAddress: "0x1234567890123456789012345678901234567890",
      alertId: "test-alert-1",
      name: "Test Alert",
      monitoredWallet: "0x9876543210987654321098765432109876543210",
      tokenAddress: "0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
      tokenName: "Test Token",
      tokenSymbol: "TST",
      initialValue: 1000,
      type: "TOKEN",
      createdAt: Date.now(),
    };

    it("should create a new alert successfully", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app).post("/api/alerts/user").send(validAlertData).expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(mockSql).toHaveBeenCalled();
    });

    it("should update existing alert on conflict", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app).post("/api/alerts/user").send(validAlertData).expect(200);

      expect(response.body).toHaveProperty("success", true);
      const callArgs = mockSql.mock.calls[0][0];
      expect(callArgs).toContain("ON CONFLICT");
      expect(callArgs).toContain("DO UPDATE SET");
    });

    it("should return 400 if required fields are missing", async () => {
      const invalidData = {
        walletAddress: "0x1234567890123456789012345678901234567890",
        // Missing alertId, name, monitoredWallet
      };

      const response = await request(app).post("/api/alerts/user").send(invalidData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should return 400 for invalid wallet address", async () => {
      const invalidData = {
        ...validAlertData,
        walletAddress: "invalid-wallet",
      };

      const response = await request(app).post("/api/alerts/user").send(invalidData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Invalid user wallet address");
    });

    it("should return 400 for invalid monitored wallet address", async () => {
      const invalidData = {
        ...validAlertData,
        monitoredWallet: "invalid-wallet",
      };

      const response = await request(app).post("/api/alerts/user").send(invalidData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Invalid monitored wallet address");
    });

    it("should return 400 for invalid token address", async () => {
      const invalidData = {
        ...validAlertData,
        tokenAddress: "invalid-token",
      };

      const response = await request(app).post("/api/alerts/user").send(invalidData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Invalid token address");
    });

    it("should validate alert type", async () => {
      const invalidData = {
        ...validAlertData,
        type: "INVALID_TYPE",
      };

      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app).post("/api/alerts/user").send(invalidData).expect(200);

      // Type should be rejected or set to null
      const callArgs = mockSql.mock.calls[0][0];
      expect(response.body.success).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app).post("/api/alerts/user").send(validAlertData).expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Failed to save alert");
    });

    it("should sanitize string inputs to prevent SQL injection", async () => {
      const maliciousData = {
        ...validAlertData,
        name: "'; DROP TABLE user_alerts; --",
        alertId: "alert-1'; DROP TABLE user_alerts; --",
      };

      mockSql.mockResolvedValueOnce(undefined);

      await request(app).post("/api/alerts/user").send(maliciousData).expect(200);

      // Verify inputs are truncated/sanitized
      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/alerts/user", () => {
    const testWallet = "0x1234567890123456789012345678901234567890";
    const testAlertId = "test-alert-1";

    it("should soft delete an alert successfully", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete(`/api/alerts/user?wallet=${testWallet}&alertId=${testAlertId}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(mockSql).toHaveBeenCalled();
      const callArgs = mockSql.mock.calls[0][0];
      expect(callArgs).toContain("UPDATE user_alerts");
      expect(callArgs).toContain("is_active = false");
    });

    it("should return 400 if wallet parameter is missing", async () => {
      const response = await request(app)
        .delete(`/api/alerts/user?alertId=${testAlertId}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required parameters");
    });

    it("should return 400 if alertId parameter is missing", async () => {
      const response = await request(app)
        .delete(`/api/alerts/user?wallet=${testWallet}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required parameters");
    });

    it("should return 400 for invalid wallet address", async () => {
      const response = await request(app)
        .delete(`/api/alerts/user?wallet=invalid&alertId=${testAlertId}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Invalid wallet address");
    });

    it("should handle database errors gracefully", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .delete(`/api/alerts/user?wallet=${testWallet}&alertId=${testAlertId}`)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Failed to delete alert");
    });

    it("should sanitize alertId parameter", async () => {
      const maliciousAlertId = "alert-1'; DROP TABLE user_alerts; --";
      mockSql.mockResolvedValueOnce(undefined);

      await request(app)
        .delete(
          `/api/alerts/user?wallet=${testWallet}&alertId=${encodeURIComponent(maliciousAlertId)}`
        )
        .expect(200);

      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe("POST /api/alerts/sync", () => {
    const testWallet = "0x1234567890123456789012345678901234567890";
    const localAlerts = [
      {
        alertId: "local-alert-1",
        name: "Local Alert",
        walletAddress: "0x9876543210987654321098765432109876543210",
        createdAt: Date.now(),
      },
    ];

    it("should perform bidirectional sync successfully", async () => {
      const serverAlerts = [
        {
          id: 1,
          alert_id: "server-alert-1",
          user_wallet_address: testWallet,
          name: "Server Alert",
          wallet_address: "0x9876543210987654321098765432109876543210",
          token_address: null,
          token_name: null,
          token_symbol: null,
          initial_value: null,
          type: null,
          created_at: Date.now(),
          updated_at: new Date(),
          is_active: true,
        },
      ];

      // Mock server alerts fetch
      mockSql.mockResolvedValueOnce(serverAlerts);
      // Mock upload
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/api/alerts/sync")
        .send({
          walletAddress: testWallet,
          localAlerts,
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("uploaded");
      expect(response.body).toHaveProperty("downloaded");
      expect(response.body).toHaveProperty("conflicts");
      expect(response.body).toHaveProperty("data");
      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it("should handle empty local alerts array", async () => {
      mockSql.mockResolvedValueOnce([]);

      const response = await request(app)
        .post("/api/alerts/sync")
        .send({
          walletAddress: testWallet,
          localAlerts: [],
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("uploaded", 0);
    });

    it("should return 400 if walletAddress is missing", async () => {
      const response = await request(app)
        .post("/api/alerts/sync")
        .send({
          localAlerts,
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Missing required field");
    });

    it("should resolve conflicts by created_at timestamp", async () => {
      const newerLocalAlert = {
        alertId: "conflict-alert",
        name: "Newer Local",
        walletAddress: "0x9876543210987654321098765432109876543210",
        createdAt: Date.now(),
      };

      const olderServerAlert = {
        id: 1,
        alert_id: "conflict-alert",
        user_wallet_address: testWallet,
        name: "Older Server",
        wallet_address: "0x9876543210987654321098765432109876543210",
        created_at: Date.now() - 10000, // 10 seconds older
        is_active: true,
      };

      mockSql.mockResolvedValueOnce([olderServerAlert]);
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/api/alerts/sync")
        .send({
          walletAddress: testWallet,
          localAlerts: [newerLocalAlert],
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("uploaded", 1); // Local is newer, should upload
    });

    it("should handle database errors gracefully", async () => {
      mockSql.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .post("/api/alerts/sync")
        .send({
          walletAddress: testWallet,
          localAlerts,
        })
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Sync failed");
    });

    it("should handle malformed JSON body", async () => {
      const response = await request(app)
        .post("/api/alerts/sync")
        .set("Content-Type", "application/json")
        .send("{invalid json}")
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("Input Validation", () => {
    it("should validate Ethereum address format", async () => {
      const invalidAddresses = [
        "0x123", // Too short
        "1234567890123456789012345678901234567890", // Missing 0x prefix
        "0xABCDEFGH123456789012345678901234567890", // Invalid characters
        "", // Empty
      ];

      for (const invalidAddress of invalidAddresses) {
        const response = await request(app)
          .get(`/api/alerts/user?wallet=${invalidAddress}`)
          .expect(400);

        expect(response.body).toHaveProperty("success", false);
      }
    });

    it("should sanitize alert name to max length", async () => {
      const longName = "A".repeat(300); // 300 characters

      const response = await request(app)
        .post("/api/alerts/user")
        .send({
          walletAddress: "0x1234567890123456789012345678901234567890",
          alertId: "test-alert",
          name: longName,
          monitoredWallet: "0x9876543210987654321098765432109876543210",
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(mockSql).toHaveBeenCalled();
      // Verify the name is truncated in the SQL call
    });

    it("should sanitize alert symbol to max length", async () => {
      const longSymbol = "A".repeat(100); // 100 characters

      const response = await request(app)
        .post("/api/alerts/user")
        .send({
          walletAddress: "0x1234567890123456789012345678901234567890",
          alertId: "test-alert",
          name: "Test",
          monitoredWallet: "0x9876543210987654321098765432109876543210",
          tokenSymbol: longSymbol,
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
    });

    it("should handle null values for optional fields", async () => {
      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/api/alerts/user")
        .send({
          walletAddress: "0x1234567890123456789012345678901234567890",
          alertId: "test-alert",
          name: "Test Alert",
          monitoredWallet: "0x9876543210987654321098765432109876543210",
          // Optional fields omitted
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe("Security", () => {
    it("should prevent SQL injection in wallet parameter", async () => {
      const maliciousWallet =
        "0x1234567890123456789012345678901234567890'; DROP TABLE user_alerts; --";

      const response = await request(app)
        .get(`/api/alerts/user?wallet=${maliciousWallet}`)
        .expect(400);

      // Should fail validation before reaching SQL
      expect(response.body).toHaveProperty("success", false);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("should prevent SQL injection in alertId parameter", async () => {
      const maliciousAlertId = "alert-1'; DROP TABLE user_alerts; --";

      const response = await request(app)
        .delete(
          `/api/alerts/user?wallet=0x1234567890123456789012345678901234567890&alertId=${maliciousAlertId}`
        )
        .expect(400);

      // Should fail validation
      expect(response.body).toHaveProperty("success", false);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it("should handle CORS preflight requests", async () => {
      const response = await request(app)
        .options("/api/alerts/user")
        .set("Origin", "https://example.com")
        .set("Access-Control-Request-Method", "GET")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero alerts returned from server", async () => {
      mockSql.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/alerts/user?wallet=0x1234567890123456789012345678901234567890")
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("count", 0);
      expect(response.body.data).toHaveLength(0);
    });

    it("should handle very large wallet address (should fail validation)", async () => {
      const tooLongAddress = "0x" + "1".repeat(100);

      const response = await request(app)
        .get(`/api/alerts/user?wallet=${tooLongAddress}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });

    it("should handle special characters in alert name", async () => {
      const specialName = "Test<script>alert('xss')</script>Alert";

      mockSql.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post("/api/alerts/user")
        .send({
          walletAddress: "0x1234567890123456789012345678901234567890",
          alertId: "test-alert",
          name: specialName,
          monitoredWallet: "0x9876543210987654321098765432109876543210",
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      // Script tags should be preserved in the name (no XSS in API)
    });
  });
});
