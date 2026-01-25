/**
 * Test Setup for Alert System Tests
 *
 * This file provides shared utilities, mocks, and helpers for testing
 * the alert creation, scanning, trigger detection, and integration flows.
 */

import { expect, beforeEach, afterEach, vi } from "vitest";
import { AlertConfig, AlertStatus, Transaction, TriggeredEvent } from "../types";

// ============================================================================
// MOCK DATA
// ============================================================================

export const MOCK_WALLET_ADDRESSES = {
  valid: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  invalid: "invalid-address",
  short: "0x123",
} as const;

export const MOCK_TOKEN_ADDRESSES = {
  wDOGE: "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
  USDT: "0x6C0966f383253Be43BC72B7A488B1fB94A6A0E98",
  invalid: "not-an-address",
} as const;

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    to: MOCK_WALLET_ADDRESSES.valid,
    value: 100000,
    timestamp: Date.now() - 3600000, // 1 hour ago
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenSymbol: "wDOGE",
  },
  {
    hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    from: MOCK_WALLET_ADDRESSES.valid,
    to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    value: 50000,
    timestamp: Date.now() - 1800000, // 30 minutes ago
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenSymbol: "wDOGE",
  },
  {
    hash: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
    from: "0xcccccccccccccccccccccccccccccccccccccccc",
    to: MOCK_WALLET_ADDRESSES.valid,
    value: 75000,
    timestamp: Date.now() - 900000, // 15 minutes ago
    tokenAddress: MOCK_TOKEN_ADDRESSES.USDT,
    tokenSymbol: "USDT",
  },
];

export const MOCK_HISTORICAL_TRANSACTIONS: Transaction[] = [
  {
    hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    from: "0x1111111111111111111111111111111111111111",
    to: MOCK_WALLET_ADDRESSES.valid,
    value: 1000,
    timestamp: Date.now() - 86400000, // 1 day ago (before alert creation)
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenSymbol: "wDOGE",
  },
  {
    hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    from: MOCK_WALLET_ADDRESSES.valid,
    to: "0x2222222222222222222222222222222222222222",
    value: 500,
    timestamp: Date.now() - 172800000, // 2 days ago (before alert creation)
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenSymbol: "wDOGE",
  },
];

export const MOCK_ALERT_CONFIGS: AlertConfig[] = [
  {
    id: "alert-1",
    name: "Wallet Watch Test",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    type: "WALLET",
    createdAt: Date.now() - 3600000, // Created 1 hour ago
  },
  {
    id: "alert-2",
    name: "Token Movement Test",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenName: "Wrapped Doge",
    tokenSymbol: "wDOGE",
    type: "TOKEN",
    createdAt: Date.now() - 3600000,
  },
  {
    id: "alert-3",
    name: "Whale Watch Test",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenName: "Wrapped Doge",
    tokenSymbol: "wDOGE",
    type: "WHALE",
    createdAt: Date.now() - 3600000,
  },
];

// ============================================================================
// MOCK FUNCTIONS
// ============================================================================

export const mockFetchTokenBalance = vi.fn();
export const mockFetchWalletTransactions = vi.fn();
export const mockFetchTokenData = vi.fn();
export const mockValidateWalletAddress = vi.fn();
export const mockValidateTokenAddress = vi.fn();
export const mockGetApiUrl = vi.fn();

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock alert config with custom properties
 */
export function createMockAlert(overrides?: Partial<AlertConfig>): AlertConfig {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Alert",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    type: "WALLET",
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock alert status with custom properties
 */
export function createMockAlertStatus(overrides?: Partial<AlertStatus>): AlertStatus {
  return {
    currentValue: 0,
    triggered: false,
    checkedAt: Date.now(),
    lastSeenTransactions: [],
    baselineEstablished: true,
    baselineTimestamp: Date.now(),
    pendingInitialScan: false,
    ...overrides,
  };
}

/**
 * Create a mock transaction with custom properties
 */
export function createMockTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
    from: `0x${Math.random().toString(16).slice(2).padStart(40, "0")}`,
    to: MOCK_WALLET_ADDRESSES.valid,
    value: 1000,
    timestamp: Date.now(),
    tokenAddress: MOCK_TOKEN_ADDRESSES.wDOGE,
    tokenSymbol: "wDOGE",
    ...overrides,
  };
}

/**
 * Create a mock triggered event
 */
export function createMockTriggeredEvent(overrides?: Partial<TriggeredEvent>): TriggeredEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    alertId: "alert-1",
    alertName: "Test Alert",
    walletAddress: MOCK_WALLET_ADDRESSES.valid,
    transactions: [createMockTransaction()],
    triggeredAt: Date.now(),
    notified: true,
    ...overrides,
  };
}

/**
 * Reset all mocks to their default state
 */
export function resetAllMocks(): void {
  mockFetchTokenBalance.mockReset();
  mockFetchWalletTransactions.mockReset();
  mockFetchTokenData.mockReset();
  mockValidateWalletAddress.mockReset();
  mockValidateTokenAddress.mockReset();
  mockGetApiUrl.mockReset();

  // Set default mock behaviors
  mockValidateWalletAddress.mockImplementation((address: string) => {
    if (!/^0x[a-f0-9]{40}$/i.test(address)) {
      throw new Error("Invalid wallet address");
    }
  });

  mockValidateTokenAddress.mockImplementation((address: string) => {
    if (!/^0x[a-f0-9]{40}$/i.test(address)) {
      throw new Error("Invalid token address");
    }
  });

  mockFetchTokenBalance.mockResolvedValue(100000);

  mockFetchWalletTransactions.mockResolvedValue([]);

  mockFetchTokenData.mockResolvedValue({
    address: MOCK_TOKEN_ADDRESSES.wDOGE,
    name: "Wrapped Doge",
    symbol: "wDOGE",
    decimals: 18,
  });

  mockGetApiUrl.mockImplementation((path: string) => path);
}

/**
 * Advance timers by a specified amount of milliseconds
 */
export function advanceTimers(ms: number): void {
  vi.advanceTimersByTime(ms);
}

/**
 * Wait for all promises to resolve
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create a test context with common setup/teardown
 */
export function createTestContext(setupFn?: () => void, teardownFn?: () => void) {
  beforeEach(async () => {
    vi.useFakeTimers();
    resetAllMocks();
    setupFn?.();
  });

  afterEach(() => {
    teardownFn?.();
    vi.useRealTimers();
  });
}

// ============================================================================
// MOCK DATA SERVICE
// ============================================================================

/**
 * Create a mock data service for testing
 */
export function createMockDataService() {
  return {
    fetchTokenBalance: mockFetchTokenBalance,
    fetchWalletTransactions: mockFetchWalletTransactions,
    fetchTokenData: mockFetchTokenData,
  };
}

// ============================================================================
// MOCK API RESPONSES
// ============================================================================

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, success = true): Response {
  return {
    ok: success,
    json: async () => ({ success, data }),
  } as Response;
}

/**
 * Create a mock API error response
 */
export function createMockApiErrorResponse(error: string, status = 500): Response {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, error }),
  } as Response;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that an alert has the expected properties
 */
export function assertAlertValid(alert: AlertConfig, expected?: Partial<AlertConfig>): void {
  expect(alert).toBeDefined();
  expect(alert.id).toBeDefined();
  expect(alert.name).toBeDefined();
  expect(alert.walletAddress).toMatch(/^0x[a-f0-9]{40}$/i);
  expect(alert.createdAt).toBeDefined();
  expect(alert.createdAt).toBeLessThanOrEqual(Date.now());

  if (expected) {
    if (expected.name) expect(alert.name).toBe(expected.name);
    if (expected.walletAddress) expect(alert.walletAddress).toBe(expected.walletAddress);
    if (expected.tokenAddress) expect(alert.tokenAddress).toBe(expected.tokenAddress);
    if (expected.type) expect(alert.type).toBe(expected.type);
  }
}

/**
 * Assert that an alert status has the expected properties
 */
export function assertAlertStatusValid(status: AlertStatus, expected?: Partial<AlertStatus>): void {
  expect(status).toBeDefined();
  expect(status.currentValue).toBeDefined();
  expect(typeof status.triggered).toBe("boolean");
  expect(status.checkedAt).toBeDefined();
  expect(status.checkedAt).toBeLessThanOrEqual(Date.now());

  if (expected) {
    if (expected.triggered !== undefined) expect(status.triggered).toBe(expected.triggered);
    if (expected.baselineEstablished !== undefined) {
      expect(status.baselineEstablished).toBe(expected.baselineEstablished);
    }
    if (expected.pendingInitialScan !== undefined) {
      expect(status.pendingInitialScan).toBe(expected.pendingInitialScan);
    }
  }
}

/**
 * Assert that a transaction has the expected properties
 */
export function assertTransactionValid(tx: Transaction): void {
  expect(tx).toBeDefined();
  expect(tx.hash).toMatch(/^0x[a-f0-9]{64}$/i);
  expect(tx.from).toMatch(/^0x[a-f0-9]{40}$/i);
  expect(tx.to).toMatch(/^0x[a-f0-9]{40}$/i);
  expect(tx.value).toBeGreaterThan(0);
  expect(tx.timestamp).toBeDefined();
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export const testUtils = {
  createMockAlert,
  createMockAlertStatus,
  createMockTransaction,
  createMockTriggeredEvent,
  resetAllMocks,
  advanceTimers,
  flushPromises,
  createTestContext,
  createMockDataService,
  createMockApiResponse,
  createMockApiErrorResponse,
  assertAlertValid,
  assertAlertStatusValid,
  assertTransactionValid,
};
