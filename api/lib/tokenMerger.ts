/**
 * Token Merger Library
 *
 * Smart token merging with source priority and quality scoring.
 * Merges multiple metadata records into single best version.
 */

import {
  TokenMetadata,
  DiscoverySource,
  SourceWeight,
  MergeHistoryEntry,
  DEFAULT_SOURCE_WEIGHTS,
} from "./types";

// =====================================================
// QUALITY SCORING
// =====================================================

/**
 * Calculate record quality score
 * Higher = better quality
 *
 * Scoring components:
 * 1. Source weight (0-100 points)
 * 2. Completeness bonus (0-20 points)
 * 3. Quality checks (0-10 points)
 *
 * @param record - Token metadata record
 * @param weightMap - Map of source weights
 * @returns Quality score (0-130)
 */
export function calculateRecordScore(
  record: TokenMetadata,
  weightMap: Map<string, number>
): number {
  let score = 0;

  // 1. Source weight (0-100 points)
  const sourceWeight = weightMap.get(record.source) || 50;
  score += sourceWeight;

  // 2. Completeness bonus (0-20 points)
  let completeness = 0;
  if (record.name && record.name !== "Unknown Token") completeness += 5;
  if (record.symbol && record.symbol !== "TOKEN" && record.symbol !== "NFT") completeness += 5;
  if (record.decimals !== undefined && record.decimals >= 0) completeness += 3;
  if (record.holderCount !== undefined && record.holderCount > 0) completeness += 4;
  if (record.isVerified) completeness += 3;
  score += completeness;

  // 3. Quality checks (0-10 points)
  if (record.name && !record.name.startsWith("Token from")) score += 3;
  if (record.symbol && record.symbol.length >= 2 && record.symbol.length <= 10) score += 2;
  if (record.decimals !== undefined && record.decimals >= 0 && record.decimals <= 18) score += 2;

  // Confidence bonus (up to 3 points)
  if (record.confidence && record.confidence > 0.8) {
    score += Math.round(record.confidence * 3);
  }

  return score;
}

/**
 * Get source weight map
 * Loads from database or uses defaults
 *
 * @param weights - Optional array of source weights
 * @returns Map of source name to weight
 */
export function getSourceWeightMap(weights?: SourceWeight[]): Map<string, number> {
  const weightMap = new Map<string, number>();

  // Add defaults
  Object.entries(DEFAULT_SOURCE_WEIGHTS).forEach(([source, weight]) => {
    weightMap.set(source, weight);
  });

  // Override with provided weights
  if (weights) {
    weights.forEach((w) => {
      weightMap.set(w.sourceName, w.weight);
    });
  }

  return weightMap;
}

// =====================================================
// TOKEN MERGING
// =====================================================

/**
 * Smart token merging with source priority
 * Merges multiple metadata records into single best version
 *
 * Algorithm:
 * 1. Score each record by source weight and quality
 * 2. Select winner as base (highest score)
 * 3. Fill missing fields from runners-up
 * 4. Calculate overall confidence
 *
 * @param records - Array of token metadata records
 * @param weights - Optional source weights
 * @returns Merged token metadata
 */
export async function mergeTokenMetadata(
  records: TokenMetadata[],
  weights?: SourceWeight[]
): Promise<TokenMetadata> {
  if (records.length === 0) {
    throw new Error("No records to merge");
  }

  if (records.length === 1) {
    return records[0];
  }

  // Get source weight map
  const weightMap = getSourceWeightMap(weights);

  // Score each record
  const scoredRecords = records.map((record) => ({
    record,
    score: calculateRecordScore(record, weightMap),
  }));

  // Sort by score descending
  scoredRecords.sort((a, b) => b.score - a.score);

  // Select winner as base
  const winner = scoredRecords[0].record;

  // Create merged record
  const merged: TokenMetadata = { ...winner };

  // Enrich with missing fields from runners-up
  for (const { record } of scoredRecords.slice(1)) {
    // Fill missing fields
    if (!merged.name && record.name) merged.name = record.name;
    if (!merged.symbol && record.symbol) merged.symbol = record.symbol;
    if (merged.decimals === undefined && record.decimals !== undefined) {
      merged.decimals = record.decimals;
    }
    if (!merged.holderCount && record.holderCount) {
      merged.holderCount = record.holderCount;
    }
    if (!merged.isVerified && record.isVerified) {
      merged.isVerified = record.isVerified;
    }

    // Update confidence (use max)
    if (record.confidence && (!merged.confidence || record.confidence > merged.confidence)) {
      merged.confidence = record.confidence;
    }
  }

  // Calculate overall confidence based on sources
  const sources = records.map((r) => r.source);
  merged.confidence = calculateMergedConfidence(sources, weightMap);

  return merged;
}

/**
 * Calculate merged confidence score
 * Based on source diversity and weights
 *
 * @param sources - Array of sources
 * @param weightMap - Source weight map
 * @returns Confidence score (0-1)
 */
function calculateMergedConfidence(
  sources: DiscoverySource[],
  weightMap: Map<string, number>
): number {
  // Higher confidence with multiple diverse sources
  const uniqueSources = new Set(sources);
  const sourceBonus = Math.min(uniqueSources.size * 0.1, 0.3); // Max 0.3 bonus

  // Average source weight (normalized to 0-1)
  const avgWeight = sources.reduce((sum, s) => sum + (weightMap.get(s) || 50), 0) / sources.length;
  const normalizedWeight = avgWeight / 100;

  // Combine base weight with diversity bonus
  return Math.min(normalizedWeight + sourceBonus, 1);
}

// =====================================================
// DEDUPLICATION
// =====================================================

/**
 * Deduplicate tokens by address
 * Keeps highest quality version based on source priority
 *
 * @param tokens - Array of tokens (may contain duplicates)
 * @param weights - Optional source weights
 * @returns Deduplicated tokens
 */
export async function deduplicateTokens(
  tokens: TokenMetadata[],
  weights?: SourceWeight[]
): Promise<TokenMetadata[]> {
  // Group by address (case-insensitive)
  const addressMap = new Map<string, TokenMetadata[]>();

  for (const token of tokens) {
    const normalized = token.address.toLowerCase();
    const existing = addressMap.get(normalized) || [];
    existing.push(token);
    addressMap.set(normalized, existing);
  }

  // Merge each group
  const mergedTokens: TokenMetadata[] = [];
  for (const [address, records] of addressMap) {
    const merged = await mergeTokenMetadata(records, weights);
    mergedTokens.push(merged);
  }

  return mergedTokens;
}

/**
 * Find duplicate tokens in an array
 * Returns groups of potentially duplicate tokens
 *
 * @param tokens - Array of tokens
 * @returns Map of normalized address to array of tokens
 */
export function findDuplicateTokens(tokens: TokenMetadata[]): Map<string, TokenMetadata[]> {
  const addressMap = new Map<string, TokenMetadata[]>();

  for (const token of tokens) {
    const normalized = token.address.toLowerCase();
    const existing = addressMap.get(normalized) || [];
    existing.push(token);
    addressMap.set(normalized, existing);
  }

  // Return only groups with duplicates
  const duplicates = new Map<string, TokenMetadata[]>();
  for (const [_address, records] of addressMap) {
    if (records.length > 1) {
      duplicates.set(_address, records);
    }
  }

  return duplicates;
}

// =====================================================
// MERGE HISTORY
// =====================================================

/**
 * Create merge history entry
 * Records merge for transparency and debugging
 *
 * @param tokenAddress - Token address
 * @param source - Source of merge
 * @param sourceMetadata - Original metadata
 * @param mergedMetadata - Merged metadata
 * @param contributorHash - Contributor hash
 * @returns Merge history entry
 */
export function createMergeHistoryEntry(
  tokenAddress: string,
  source: DiscoverySource,
  sourceMetadata: TokenMetadata,
  mergedMetadata: TokenMetadata,
  contributorHash: string
): Omit<MergeHistoryEntry, "id" | "mergedAt"> {
  const weightMap = getSourceWeightMap();
  const score = calculateRecordScore(mergedMetadata, weightMap);
  const confidence = score / 130; // Normalize to 0-1

  return {
    tokenAddress,
    source,
    sourceMetadata,
    mergedMetadata,
    confidenceScore: confidence,
    contributorHash,
  };
}

// =====================================================
// UTILITIES
// =====================================================

/**
 * Check if token metadata is valid
 * Basic validation checks
 *
 * @param metadata - Token metadata
 * @returns True if valid
 */
export function isValidTokenMetadata(metadata: TokenMetadata): boolean {
  // Check required fields
  if (!metadata.address || !metadata.name || !metadata.symbol) {
    return false;
  }

  // Check address format
  if (!metadata.address.startsWith("0x") || metadata.address.length !== 42) {
    return false;
  }

  // Check for generic names
  if (
    metadata.name === "Unknown Token" ||
    metadata.name === "Unverified Token" ||
    metadata.symbol === "TOKEN" ||
    metadata.symbol === "NFT"
  ) {
    return false;
  }

  // Check decimals
  if (
    metadata.type === "TOKEN" &&
    (metadata.decimals === undefined || metadata.decimals < 0 || metadata.decimals > 18)
  ) {
    return false;
  }

  return true;
}

/**
 * Normalize token metadata
 * Cleans and standardizes metadata
 *
 * @param metadata - Token metadata
 * @returns Normalized metadata
 */
export function normalizeTokenMetadata(metadata: TokenMetadata): TokenMetadata {
  return {
    address: metadata.address.toLowerCase(),
    name: metadata.name.trim(),
    symbol: metadata.symbol.trim().toUpperCase(),
    decimals: metadata.decimals ?? 18,
    type: metadata.type,
    source: metadata.source,
    holderCount: metadata.holderCount,
    isVerified: metadata.isVerified ?? false,
    confidence: metadata.confidence ?? 0.5,
  };
}
