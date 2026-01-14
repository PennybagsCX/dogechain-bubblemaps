/**
 * Peer Trending Service
 *
 * Collaborative filtering: "Others who searched X also found Y"
 * Uses server-side aggregation to find tokens frequently clicked by users with similar search patterns.
 *
 * Environment Variables Required:
 * - VITE_ANALYTICS_API_ENDPOINT: Base URL for analytics API
 */

import { PeerRecommendation, SearchResult, AssetType } from "../types";

/**
 * Get peer recommendations for a query
 *
 * @param query - Search query
 * @param type - Asset type (TOKEN or NFT)
 * @param limit - Maximum number of recommendations
 * @returns Array of peer recommendations
 */
export async function getPeerRecommendations(
  query: string,
  type: AssetType,
  limit: number = 5
): Promise<PeerRecommendation[]> {
  try {
    const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT || "/api/recommendations/peers";

    const response = await fetch(
      `${apiEndpoint}?query=${encodeURIComponent(query)}&type=${type}&limit=${limit}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint not configured, return empty
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    // Error handled silently

    return [];
  }
}

/**
 * Enhance search results with peer recommendations
 *
 * @param query - Search query
 * @param currentResults - Current search results
 * @param type - Asset type
 * @param limit - Max peer recommendations to add
 * @returns Enhanced results with peer recommendations
 */
export async function enhanceWithPeerRecommendations(
  query: string,
  currentResults: SearchResult[],
  type: AssetType,
  limit: number = 3
): Promise<{ enhanced: SearchResult[]; peerOnly: SearchResult[] }> {
  try {
    // Get peer recommendations
    const peerRecs = await getPeerRecommendations(query, type, limit * 2);

    if (peerRecs.length === 0) {
      return {
        enhanced: currentResults,
        peerOnly: [],
      };
    }

    // Filter out already shown results
    const currentAddresses = new Set(currentResults.map((r) => r.address.toLowerCase()));
    const newRecs = peerRecs.filter((rec) => !currentAddresses.has(rec.address.toLowerCase()));

    // Convert peer recommendations to SearchResult format
    const peerResults: SearchResult[] = newRecs.slice(0, limit).map((rec) => ({
      address: rec.address,
      name: rec.name,
      symbol: rec.symbol,
      type,
      source: "peer" as const,
      score: rec.score * 100, // Convert 0-1 to 0-100
    }));

    return {
      enhanced: [...currentResults, ...peerResults],
      peerOnly: peerResults,
    };
  } catch (error) {
    // Error handled silently

    return {
      enhanced: currentResults,
      peerOnly: [],
    };
  }
}

/**
 * Format recommendation reason for display
 */
export function formatRecommendationReason(reason: string): string {
  switch (reason) {
    case "Popular with users who searched similar queries":
      return "Popular with similar searches";
    case "Frequently clicked result":
      return "Trending result";
    case "High click-through rate":
      return "High CTR";
    default:
      return reason;
  }
}
