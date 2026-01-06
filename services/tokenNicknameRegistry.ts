/**
 * Token Nickname Registry
 *
 * Maps common abbreviations and nicknames to their corresponding token names/symbols.
 * This allows users to search for tokens using familiar abbreviations like "bb" for "Baby Yoda"
 * or "usd" for various stablecoins (USDT, USDC, DAI).
 */

/**
 * Abbreviation → Array of possible token name/symbol expansions
 */
const NICKNAME_MAP: Record<string, string[]> = {
  // Baby tokens
  bb: ["baby", "baby yoda", "bby"],
  by: ["baby yoda", "baby"],
  baby: ["baby yoda", "baby doge", "baby token"],

  // Doge ecosystem
  doge: ["dogecoin", "doge"],
  wd: ["wrapped doge", "wdoge"],
  wwd: ["wrapped wdoge", "wwdoge"],

  // Stablecoins
  usd: ["usdt", "usdc", "dai", "tether usd", "usd coin", "tether", "usd tether"],
  usdt: ["tether", "tether usd", "usd tether"],
  usdc: ["usd coin", "circle usd"],

  // Major cryptocurrencies
  eth: ["ethereum", "eth"],
  btc: ["bitcoin", "btc"],
  avax: ["avalanche", "avax"],
  matic: ["polygon", "matic"],
  bnb: ["binance", "bnb", "binance coin"],

  // DeFi tokens
  uni: ["uniswap", "uni"],
  aave: ["aave"],
  comp: ["compound", "comp"],
  crv: ["curve", "crv", "curve dao"],

  // Common meme tokens
  shib: ["shiba", "shib inu", "shiba inu"],
  elon: ["elon doge", "elon mars", "elon"],
  pepe: ["pepe"],
  wojak: ["wojak"],
  safe: ["safe moon", "safemoon"],

  // Layer 2s
  arb: ["arbitrum", "arb"],
  op: ["optimism", "op", "optimism token"],

  // Exchange tokens
  cro: ["crypto.com", "cro", "crypto.com coin"],
  gt: ["gate", "gate token"],

  // Dogechain specific
  dc: ["dogechain", "dc"],
  kibo: ["kibo"],
  rino: ["rino"],
  bone: ["bone shibaswap", "bone"],

  // NFT collections
  punk: ["punk", "crypto punk", "cryptopunk"],
  ape: ["bored ape", "bored ape yacht club", "bayc", "ape"],
  doodle: ["doodle", "doodles"],

  // Common abbreviations
  lp: ["liquidity", "lp token"],
  nft: ["non-fungible token", "nft"],

  // Bridge tokens
  any: ["any swap", "anyswap"],
  mult: ["multichain", "multichain token"],
};

/**
 * Get nickname expansions for a query
 *
 * @param query - The search query (e.g., "bb", "usd")
 * @returns Array of possible token name/symbol expansions, or empty array if no mapping exists
 *
 * @example
 * getNicknameExpansions("bb") // ["baby", "baby yoda", "bby"]
 * getNicknameExpansions("usd") // ["usdt", "usdc", "dai", "tether usd", "usd coin"]
 * getNicknameExpansions("xyz") // []
 */
export function getNicknameExpansions(query: string): string[] {
  const key = query.toLowerCase().trim();
  return NICKNAME_MAP[key] || [];
}

/**
 * Check if a query has a known nickname mapping
 *
 * @param query - The search query
 * @returns true if the query has a nickname mapping
 */
export function hasNicknameMapping(query: string): boolean {
  const key = query.toLowerCase().trim();
  return key in NICKNAME_MAP;
}

/**
 * Get all available nickname mappings
 *
 * @returns Object containing all nickname mappings
 */
export function getAllNicknames(): Record<string, string[]> {
  return { ...NICKNAME_MAP };
}

/**
 * Add a custom nickname mapping at runtime
 *
 * @param abbreviation - The abbreviation (e.g., "bb")
 * @param expansions - Array of token name/symbol expansions
 */
export function addNicknameMapping(abbreviation: string, expansions: string[]): void {
  const key = abbreviation.toLowerCase().trim();
  NICKNAME_MAP[key] = expansions;
}
