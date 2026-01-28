/**
 * Search Input Type Detector
 *
 * Automatically detects the type of search input to optimize search strategy.
 * This allows for faster searches by skipping unnecessary fuzzy matching
 * when a contract address is entered.
 */

/**
 * Detected input types for search queries
 */
export enum SearchInputType {
  CONTRACT_ADDRESS = "contract_address",
  TICKER = "ticker",
  NAME = "name",
  UNKNOWN = "unknown",
}

/**
 * Detect the type of search input
 *
 * @param input - User's search query
 * @returns Detected input type
 *
 * Detection Logic:
 * 1. Contract Address: Starts with "0x" followed by exactly 40 hexadecimal characters
 * 2. Ticker: 2-6 uppercase letters (common for crypto symbols like BTC, ETH, USDT)
 * 3. Name: Everything else (assumed to be a token name)
 *
 * Examples:
 * - "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101" → CONTRACT_ADDRESS
 * - "USDT" → TICKER
 * - "wDOGE" → TICKER
 * - "Wrapped DOGE" → NAME
 * - "doge" → NAME
 */
export function detectSearchInputType(input: string): SearchInputType {
  const trimmed = input.trim();

  // Empty input
  if (!trimmed) {
    return SearchInputType.UNKNOWN;
  }

  // Check for contract address (0x + 40 hex chars)
  // This is the standard format for Ethereum-compatible addresses
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return SearchInputType.CONTRACT_ADDRESS;
  }

  // Check for ticker symbol
  // Most crypto tickers are:
  // - 2-6 characters long (e.g., BTC, ETH, USDT, wDOGE)
  // - Usually all caps (but we'll accept mixed case and normalize in search)
  // - No spaces or special characters
  if (/^[A-Za-z]{2,6}$/.test(trimmed)) {
    return SearchInputType.TICKER;
  }

  // Otherwise assume it's a name search
  return SearchInputType.NAME;
}

/**
 * Check if input is a valid contract address
 *
 * @param input - User's search query
 * @returns true if input is a valid contract address
 */
export function isContractAddress(input: string): boolean {
  return detectSearchInputType(input) === SearchInputType.CONTRACT_ADDRESS;
}

/**
 * Check if input is likely a ticker symbol
 *
 * @param input - User's search query
 * @returns true if input is likely a ticker
 */
export function isTickerSymbol(input: string): boolean {
  return detectSearchInputType(input) === SearchInputType.TICKER;
}
