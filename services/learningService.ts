/**
 * Learning Search Service
 *
 * Aggregates wallet scanner data from all users to improve token/NFT discovery globally.
 * Uses a "trust then verify" approach with smart merging and background validation.
 *
 * Features:
 * - Crowdsourced discovery submission
 * - Learned data fetching from server
 * - Background sync with local search index
 * - Privacy-preserving contributor hashing
 * - Async non-blocking operations
 */

import { Token, AssetType, DiscoveredToken, ScanMetadata } from "../types";

// =====================================================
// CONFIGURATION
// =====================================================

const LEARNING_ENABLED = import.meta.env.VITE_LEARNING_ENABLED !== "false";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const MAX_RETRIES = 3;
const BATCH_SIZE = 100;
const SUBMISSION_TIMEOUT = 30000; // 30 seconds

// Feature flags
const FEATURE_FLAGS = {
  submission: LEARNING_ENABLED,
  fetching: LEARNING_ENABLED,
  syncing: LEARNING_ENABLED,
};

// =====================================================
// DISCOVERY SUBMISSION
// =====================================================

/**
 * Submit wallet scan discoveries to the learning system
 *
 * @param tokens - Discovered tokens from wallet scan
 * @param nfts - Discovered NFTs from wallet scan
 * @param scanMetadata - Scan metadata (duration, phases, etc.)
 */
export async function submitWalletScanDiscoveries(
  tokens: Token[],
  nfts: Token[],
  scanMetadata: ScanMetadata
): Promise<void> {
  if (!FEATURE_FLAGS.submission) {
    return;
  }

  try {
    // Convert tokens to discovery format
    const discoveries: DiscoveredToken[] = [
      ...tokens.map((t) => ({
        address: t.address,
        name: t.name || "Unknown Token",
        symbol: t.symbol || "TOKEN",
        decimals: t.decimals || 18,
        type: AssetType.TOKEN,
        source: "wallet_scan" as const,
        confidence: 0.8, // High confidence from direct scan
        holderCount: t.holderCount,
        discoveredAt: Date.now(),
      })),
      ...nfts.map((n) => ({
        address: n.address,
        name: n.name || "Unknown NFT",
        symbol: n.symbol || "NFT",
        decimals: 0,
        type: AssetType.NFT,
        source: "wallet_scan" as const,
        confidence: 0.8,
        holderCount: n.holderCount,
        discoveredAt: Date.now(),
      })),
    ];

    // Filter out low-quality discoveries
    const qualityDiscoveries = discoveries.filter(
      (d) =>
        d.address &&
        d.address.length === 42 &&
        d.address.startsWith("0x") &&
        d.name &&
        d.name !== "Unknown Token" &&
        d.symbol &&
        d.symbol !== "TOKEN" &&
        d.symbol !== "NFT"
    );

    if (qualityDiscoveries.length === 0) {
      console.debug("[Learning] No quality discoveries to submit");
      return;
    }

    // Submit in batches
    const batches = chunkArray(qualityDiscoveries, BATCH_SIZE);

    for (const batch of batches) {
      await submitDiscoveriesBatch(batch, scanMetadata);
    }

    console.log(
      `[Learning] Submitted ${qualityDiscoveries.length} discoveries (${discoveries.length - qualityDiscoveries.length} filtered)`
    );
  } catch (error) {
    // Silent fail - don't block user experience
    console.warn("[Learning] Failed to submit discoveries:", error);
  }
}

/**
 * Submit a batch of discoveries to the server
 *
 * @param discoveries - Array of discovered tokens
 * @param scanMetadata - Scan metadata
 * @returns Promise<boolean> - True if successful
 */
async function submitDiscoveriesBatch(
  discoveries: DiscoveredToken[],
  scanMetadata: ScanMetadata
): Promise<boolean> {
  const apiEndpoint = `${API_BASE}/api/discovery/batch`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SUBMISSION_TIMEOUT);

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          discoveries,
          metadata: {
            totalRequests: scanMetadata.totalRequests,
            phasesCompleted: scanMetadata.phasesCompleted,
            duration: scanMetadata.duration,
          },
          contributorHash: await generateContributorHash(),
          timestamp: Date.now(),
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        console.warn(`[Learning] Submission rejected: ${response.status} ${response.statusText}`);
        return false;
      }

      // Retry on server errors (5xx) with exponential backoff
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(delay);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[Learning] Submission timeout");
        return false;
      }

      if (attempt >= MAX_RETRIES - 1) {
        throw error;
      }

      // Network error - retry with backoff
      await sleep(1000);
    }
  }

  return false;
}

/**
 * Generate anonymous contributor hash
 * Privacy-preserving identifier for quality tracking
 *
 * @returns Promise<string> - SHA-256 hash
 */
async function generateContributorHash(): Promise<string> {
  try {
    // Use session ID from search analytics (already anonymous)
    const { getSessionId } = await import("./searchAnalytics");
    const sessionId = getSessionId();

    // Hash with timestamp to make it unique per submission batch
    const data = `${sessionId}-${Date.now()}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    console.warn("[Learning] Failed to generate contributor hash:", error);
    // Fallback to random hash
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

// =====================================================
// LEARNED DATA FETCHING
// =====================================================

/**
 * Fetch merged token index from server
 * Combines verified contracts + crowdsourced discoveries
 *
 * @param type - Token type (TOKEN or NFT)
 * @param lastSync - Optional timestamp for incremental updates
 * @returns Promise<DbTokenSearchIndex[]> - Array of learned tokens
 */
export async function fetchMergedTokenIndex(type: AssetType, lastSync?: number): Promise<any[]> {
  if (!FEATURE_FLAGS.fetching) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      type: type === AssetType.TOKEN ? "TOKEN" : "NFT",
    });

    if (lastSync) {
      params.append("since", lastSync.toString());
    }

    const apiEndpoint = `${API_BASE}/api/merged/tokens?${params}`;

    const response = await fetch(apiEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      // API not configured yet
      return [];
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tokens || [];
  } catch (error) {
    console.warn("[Learning] Failed to fetch merged index:", error);
    return [];
  }
}

/**
 * Sync learned data with local search index
 * Updates IndexedDB with validated crowdsourced tokens
 *
 * @returns Promise<number> - Number of tokens synced
 */
export async function syncLearnedData(): Promise<number> {
  if (!FEATURE_FLAGS.syncing) {
    return 0;
  }

  try {
    const { bulkSaveTokensToSearchIndex, db } = await import("./db");

    // Get last sync timestamp
    const lastSyncKey = "learning_last_sync";
    let lastSync = 0;

    try {
      const metadata = await db.metadata.get(lastSyncKey);
      if (metadata) {
        lastSync = metadata.value || 0;
      }
    } catch {
      // metadata store might not exist yet
    }

    // Fetch both tokens and NFTs
    const [tokens, nfts] = await Promise.all([
      fetchMergedTokenIndex(AssetType.TOKEN, lastSync),
      fetchMergedTokenIndex(AssetType.NFT, lastSync),
    ]);

    const allTokens = [...tokens, ...nfts];

    if (allTokens.length === 0) {
      console.debug("[Learning] No new learned tokens to sync");
      return 0;
    }

    // Save to IndexedDB
    await bulkSaveTokensToSearchIndex(allTokens);

    // Update last sync timestamp
    try {
      await db.metadata.put({
        key: lastSyncKey,
        value: Date.now(),
      });
    } catch {
      // metadata store might not exist yet
    }

    console.log(`[Learning] Synced ${allTokens.length} learned tokens from server`);

    return allTokens.length;
  } catch (error) {
    console.error("[Learning] Failed to sync learned data:", error);
    return 0;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Split array into chunks
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after timeout
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize learning service
 */
export function initializeLearningService(): void {
  if (!LEARNING_ENABLED) {
    console.log("[Learning] Learning service disabled via feature flag");
    return;
  }

  console.log("[Learning] Learning service initialized");
}

/**
 * Get feature flag status
 */
export function getLearningFeatureFlags(): typeof FEATURE_FLAGS {
  return { ...FEATURE_FLAGS };
}

// Auto-initialize
if (typeof window !== "undefined") {
  initializeLearningService();
}
