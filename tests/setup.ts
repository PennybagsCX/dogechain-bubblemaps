/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi, beforeEach } from "vitest";

// Import alert test setup utilities
import * as alertTestSetup from "./alert-setup";

// Export alert test utilities for easy access in test files
export const {
  MOCK_WALLET_ADDRESSES,
  MOCK_TOKEN_ADDRESSES,
  MOCK_TRANSACTIONS,
  MOCK_HISTORICAL_TRANSACTIONS,
  MOCK_ALERT_CONFIGS,
  createMockAlert,
  createMockAlertStatus,
  createMockTransaction,
  createMockTriggeredEvent,
  resetAllMocks,
  mockFetchTokenBalance,
  mockFetchWalletTransactions,
  mockFetchTokenData,
  mockValidateWalletAddress,
  mockValidateTokenAddress,
  mockGetApiUrl,
  testUtils,
} = alertTestSetup;

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock crypto.randomUUID for Node.js environment
if (typeof crypto === "undefined" || !crypto.randomUUID) {
  (global as any).crypto = {
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  };
}

// Reset alert test mocks before each test
beforeEach(() => {
  alertTestSetup.resetAllMocks();
});
