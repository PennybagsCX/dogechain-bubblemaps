/**
 * Minimal alert test setup stub
 * This file provides stub exports for the alert test utilities
 */

export const MOCK_WALLET_ADDRESSES = {
  valid: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  invalid: "invalid-address",
  short: "0x123",
} as const;

export const MOCK_TOKEN_ADDRESSES = {
  wDOGE: "0xB7Ddc6414bf4f5515b52d8Bdd69973ae205ff101",
  USDT: "0xa38845E24F0269b33DBfef0E18f96a631CF7F43b",
} as const;

export const MOCK_TRANSACTIONS: any[] = [];
export const MOCK_HISTORICAL_TRANSACTIONS: any[] = [];
export const MOCK_ALERT_CONFIGS: any = {};

export function createMockAlert(_: any = {}): any {
  return {};
}

export function createMockAlertStatus(_: any = {}): any {
  return {};
}

export function createMockTransaction(_: any = {}): any {
  return {};
}

export function createMockTriggeredEvent(_: any = {}): any {
  return {};
}

export function resetAllMocks(): void {
  // Stub
}

export function mockFetchTokenBalance(): Promise<number> {
  return Promise.resolve(0);
}

export function mockFetchWalletTransactions(): Promise<any[]> {
  return Promise.resolve([]);
}

export function mockFetchTokenData(): Promise<any> {
  return Promise.resolve(null);
}

export function mockValidateWalletAddress(_address: string): void {
  // Stub
}

export function mockValidateTokenAddress(_address: string): void {
  // Stub
}

export function mockGetApiUrl(): string {
  return "";
}

export const testUtils = {};
