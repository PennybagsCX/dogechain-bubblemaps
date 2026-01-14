import { SearchResult, AssetType, Token } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://dogechain-bubblemaps-api.vercel.app";

export interface LearnedToken {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  type: "TOKEN" | "NFT";
  popularity_score: number;
  scan_frequency: number;
  holder_count: number;
  discovery_timestamp: string;
  last_seen_at: string;
}

/**
 * Fetch learned tokens from Vercel Postgres
 * High-priority tokens that users have scanned
 */
export async function fetchLearnedTokens(
  type: AssetType,
  limit: number = 50
): Promise<SearchResult[]> {
  try {
    const typeParam = type === AssetType.NFT ? "NFT" : "TOKEN";
    const url = `${API_BASE}/api/learned-tokens?type=${typeParam}&limit=${limit}&min_popularity=10`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.tokens) {
      return [];
    }

    // Convert to SearchResult format
    return data.tokens.map((token: LearnedToken) => ({
      address: token.address,
      name: token.name || (type === AssetType.NFT ? "NFT Collection" : "Token"),
      symbol: token.symbol || (type === AssetType.NFT ? "NFT" : "TOKEN"),
      type: type,
      source: "learned" as const,
      decimals: token.decimals ?? (type === AssetType.NFT ? 0 : 18),
      score: token.popularity_score, // Use popularity as initial score
      popularityScore: token.popularity_score, // Additional metadata
    }));
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Submit wallet scan results to learning database
 * Call this after successful wallet scan
 */
export async function submitWalletScanResults(
  walletAddress: string,
  tokens: Token[],
  nfts: Token[]
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/wallet-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        tokens: tokens.map((t) => ({
          address: t.address,
          name: t.name,
          symbol: t.symbol,
          decimals: t.decimals,
        })),
        nfts: nfts.map((n) => ({
          address: n.address,
          name: n.name,
          symbol: n.symbol,
          decimals: n.decimals,
        })),
      }),
    });

    if (!response.ok) {
      return false;
    }

    await response.json();

    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Log token interaction (search/click)
 * Improves popularity scoring
 */
export async function logTokenInteraction(
  tokenAddress: string,
  interactionType: "search" | "click" | "select",
  sessionId?: string,
  queryText?: string,
  resultPosition?: number
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenAddress,
        interactionType,
        sessionId,
        queryText,
        resultPosition,
      }),
    });
  } catch {
    // Silent fail - don't block UI for analytics
  }
}

/**
 * Get trending tokens with learned data priority
 */
export async function getTrendingLearnedTokens(
  type: AssetType,
  limit: number = 20
): Promise<SearchResult[]> {
  try {
    const typeParam = type === AssetType.NFT ? "NFT" : "TOKEN";
    const response = await fetch(
      `${API_BASE}/api/trending-wallet?type=${typeParam}&limit=${limit}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.assets) {
      return [];
    }

    return data.assets.map((asset: unknown) => {
      const a = asset as { address: string; name?: string; symbol?: string };
      return {
        address: a.address,
        name: a.name || "Unknown",
        symbol: a.symbol || "???",
        type: type,
        source: "learned" as const,
        decimals: 18, // Default
        score: (asset as { popularity_score?: number }).popularity_score,
        popularityScore: (asset as { popularity_score?: number }).popularity_score,
      };
    });
  } catch {
    // Error handled silently

    return [];
  }
}

/**
 * Generate anonymous session ID for tracking
 */
export function generateSessionId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
