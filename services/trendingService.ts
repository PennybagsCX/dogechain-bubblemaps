/**
 * Server-side trending service
 * Handles communication with trending aggregation API
 */

export interface TrendingAsset {
  address: string;
  symbol: string | null;
  name: string | null;
  type: "TOKEN" | "NFT";
  velocityScore: number;
  totalSearches: number;
  recentSearches: number;
  previousSearches: number;
  rank: number;
}

export interface TrendingApiResponse {
  assets: TrendingAsset[];
  cached: boolean;
  stale?: boolean;
  timestamp: string;
}

/**
 * Log a search query to the server (anonymous, no user tracking)
 * This is fire-and-forget and won't block the UI if it fails
 *
 * @param address - Contract address
 * @param assetType - 'TOKEN' or 'NFT'
 * @param symbol - Token symbol (optional)
 * @param name - Token name (optional)
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function logSearchQuery(
  address: string,
  assetType: "TOKEN" | "NFT",
  symbol?: string,
  name?: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/trending/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, assetType, symbol, name }),
    });

    if (!response.ok) {
      // Silently skip logging in development if API doesn't exist
      if (response.status === 404) {
        return false;
      }
      // Try to parse error message, but don't fail if it's not JSON
      try {
        const error = await response.json();
        console.warn("[Trending] Failed to log search:", error.error || response.statusText);
      } catch {
        console.warn("[Trending] Failed to log search:", response.statusText);
      }
      return false;
    }

    return true;
  } catch (error) {
    // Silent fail - don't block UI if logging fails
    console.warn("[Trending] Error logging search:", error);
    return false;
  }
}

/**
 * Fetch trending assets from server
 * Falls back to empty array on error (caller should use local trending as backup)
 *
 * @param type - 'TOKEN', 'NFT', or 'ALL' (default: 'ALL')
 * @param limit - Maximum number of assets to return (default: 20, max: 100)
 * @returns Promise<TrendingAsset[]> - Array of trending assets
 */
export async function getTrendingAssets(
  type: "TOKEN" | "NFT" | "ALL" = "ALL",
  limit: number = 20
): Promise<TrendingAsset[]> {
  try {
    const response = await fetch(`/api/trending?type=${type}&limit=${limit}&cache=true`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: TrendingApiResponse = await response.json();
    return data.assets || [];
  } catch (error) {
    console.warn("[Trending] Server fetch failed, falling back to local trending:", error);
    return []; // Return empty array - caller should fall back to local trending
  }
}

/**
 * Fetch trending assets with automatic local fallback
 * This is the recommended function for most use cases
 *
 * @param localTrending - Local trending assets to use as fallback
 * @param type - 'TOKEN', 'NFT', or 'ALL' (default: 'ALL')
 * @param limit - Maximum number of assets to return (default: 20)
 * @returns Promise<TrendingAsset[]> - Server trending or local fallback
 */
export async function getTrendingAssetsWithFallback<T extends { hits: number }>(
  localTrending: T[],
  type: "TOKEN" | "NFT" | "ALL" = "ALL",
  limit: number = 20
): Promise<T[]> {
  try {
    const serverAssets = await getTrendingAssets(type, limit);

    if (serverAssets.length > 0) {
      // Convert server format to local format
      return serverAssets.map((asset) => ({
        symbol: asset.symbol || (asset.type === "NFT" ? "NFT" : "TOKEN"),
        name: asset.name || (asset.type === "NFT" ? "NFT Collection" : "Token"),
        address: asset.address,
        type: asset.type,
        hits: Math.round(asset.velocityScore),
      })) as T[];
    }
  } catch (error) {
    console.warn("[Trending] Server fetch failed, using local trending");
  }

  // Fallback to local trending
  return localTrending.slice(0, limit);
}
