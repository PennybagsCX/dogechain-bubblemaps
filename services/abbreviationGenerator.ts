/**
 * Abbreviation Generator
 *
 * Auto-generates abbreviations from token names and symbols using multi-pattern
 * word boundary detection. Supports common crypto token naming patterns.
 *
 * Examples:
 * - "Baby Yoda" → ["by", "ba yo"]
 * - "Wrapped Ethereum" → ["we", "weth", "ethereum"]
 * - "USDT" → ["usdt"]
 */

/**
 * Common prefixes to remove from token names
 */
const PREFIXES_TO_REMOVE = ["wrapped ", "wrapped", "baby ", "mini ", "staking ", "liquid "];

/**
 * Special characters that should be replaced with spaces
 */
const SPECIAL_CHARS = /[^a-zA-Z0-9\s]/g;

/**
 * Emoji pattern to strip
 */
const EMOJI_PATTERN = /\p{Emoji}/u;

/**
 * Token interface for abbreviation generation
 */
export interface TokenInfo {
  name: string;
  symbol: string;
}

/**
 * Generate abbreviations from token name and symbol
 *
 * Patterns applied:
 * 1. First letters of each word: "Baby Yoda" → "by"
 * 2. First two letters of each word: "Baby Yoda" → "ba yo"
 * 3. Symbol-based: "WETH" → "weth", "we"
 * 4. Prefix removal: "Wrapped Ethereum" → "ethereum"
 *
 * @param token - Token info with name and symbol
 * @returns Array of generated abbreviations (unique, lowercase)
 */
export function generateAbbreviations(token: TokenInfo): string[] {
  const abbreviations = new Set<string>();

  // Skip very short tokens (< 3 chars)
  if (token.name.length < 3 && token.symbol.length < 3) {
    return [];
  }

  // Sanitize input: remove emojis and special characters
  const sanitizedName = sanitizeTokenName(token.name);
  const sanitizedSymbol = sanitizeTokenName(token.symbol);

  // Pattern 1: First letters of each word (name)
  const nameWords = sanitizedName.split(/\s+/).filter((w) => w.length > 0);
  if (nameWords.length >= 2) {
    // "Baby Yoda" → "by"
    const firstLetters = nameWords.map((w) => w[0]).join("");
    if (firstLetters.length >= 2) {
      abbreviations.add(firstLetters.toLowerCase());
    }

    // "Baby Yoda" → "ba yo" (first 2 letters of each word)
    const firstTwo = nameWords.map((w) => w.slice(0, Math.min(2, w.length))).join(" ");
    if (firstTwo.length >= 2) {
      abbreviations.add(firstTwo.toLowerCase());
    }
  }

  // Pattern 2: Symbol-based abbreviations
  if (sanitizedSymbol.length >= 2 && sanitizedSymbol.length <= 10) {
    // "WETH" → "weth"
    abbreviations.add(sanitizedSymbol.toLowerCase());

    // "WETH" → "we" (first letters of symbol if all caps)
    if (/^[A-Z]{2,}$/.test(token.symbol)) {
      const symbolAbbr = sanitizedSymbol.toLowerCase();
      if (symbolAbbr.length >= 2) {
        abbreviations.add(symbolAbbr);
      }
    }
  }

  // Pattern 3: Remove common prefixes/suffixes
  const nameLower = sanitizedName.toLowerCase();
  for (const prefix of PREFIXES_TO_REMOVE) {
    if (nameLower.startsWith(prefix)) {
      const coreName = nameLower.slice(prefix.length).trim();
      if (coreName.length >= 3) {
        abbreviations.add(coreName);
      }
    }
  }

  // Pattern 4: Handle common contractions (e.g., "DogeCoin" → "doge")
  const contractions = generateContractions(sanitizedName);
  contractions.forEach((c) => abbreviations.add(c));

  // Convert Set to Array and filter out very short/long abbreviations
  return Array.from(abbreviations).filter((abbr) => {
    const len = abbr.length;
    return len >= 2 && len <= 10;
  });
}

/**
 * Sanitize token name by removing emojis and special characters
 */
function sanitizeTokenName(name: string): string {
  return name
    .replace(EMOJI_PATTERN, "") // Remove emojis
    .replace(SPECIAL_CHARS, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Generate common contractions from token name
 * e.g., "DogeCoin" → "doge", "Ethereum" → "eth"
 */
function generateContractions(name: string): string[] {
  const contractions: string[] = [];
  const nameLower = name.toLowerCase();

  // Common crypto contractions
  const contractionMap: Record<string, string[]> = {
    dogecoin: ["doge"],
    ethereum: ["eth"],
    bitcoin: ["btc"],
    polygon: ["matic"],
    avalanche: ["avax"],
    binance: ["bnb"],
    uniswap: ["uni"],
    tether: ["usdt"],
    "usd coin": ["usdc"],
  };

  // Check if name matches any contraction pattern
  for (const [fullName, shorts] of Object.entries(contractionMap)) {
    if (nameLower.includes(fullName)) {
      contractions.push(...shorts);
    }
  }

  return contractions;
}

/**
 * Generate abbreviations in bulk for multiple tokens
 *
 * @param tokens - Array of token info objects
 * @returns Map of token address to abbreviations
 */
export function generateAbbreviationsBulk(
  tokens: Array<{ address: string; name: string; symbol: string }>
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const token of tokens) {
    const abbrs = generateAbbreviations({
      name: token.name,
      symbol: token.symbol,
    });
    if (abbrs.length > 0) {
      result.set(token.address.toLowerCase(), abbrs);
    }
  }

  return result;
}

/**
 * Check if a query is a potential abbreviation
 * (short, lowercase, no spaces)
 */
export function isLikelyAbbreviation(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  return trimmed.length >= 2 && trimmed.length <= 6 && !trimmed.includes(" ");
}
