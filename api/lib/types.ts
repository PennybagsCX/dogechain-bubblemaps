/**
 * Server-Side Type Definitions for Learning Search System
 *
 * These types are used by Vercel serverless functions and the backend API.
 */

// =====================================================
// TOKEN METADATA
// =====================================================

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: "TOKEN" | "NFT";
  source: DiscoverySource;
  holderCount?: number;
  isVerified?: boolean;
  confidence?: number; // 0-1
}

export type DiscoverySource =
  | "wallet_scan"
  | "whale_enumeration"
  | "lp_detection"
  | "user_submission"
  | "verified_contract"
  | "blockscout_api";

// =====================================================
// DISCOVERY SUBMISSION
// =====================================================

export interface DiscoverySubmission {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: "TOKEN" | "NFT";
  source: DiscoverySource;
  confidence: number; // 0-1
  holderCount?: number;
}

export interface BatchDiscoveryRequest {
  discoveries: DiscoverySubmission[];
  metadata: {
    totalRequests: number;
    phasesCompleted: string[];
    duration: number;
  };
  contributorHash: string;
  timestamp: number;
}

export interface BatchDiscoveryResponse {
  success: boolean;
  queued: number;
  message: string;
  errors?: string[];
}

// =====================================================
// VALIDATION QUEUE
// =====================================================

export interface PendingValidation {
  id: number;
  tokenAddress: string;
  source: DiscoverySource;
  metadata: TokenMetadata;
  priority: number; // 0-10
  submittedAt: Date;
  validationAttempts: number;
  lastAttemptAt?: Date;
  status: "pending" | "validating" | "validated" | "rejected";
  contributorHash?: string;
}

export interface ValidationResult {
  address: string;
  isValid: boolean;
  errors?: string[];
  metadata?: TokenMetadata;
}

// =====================================================
// TOKEN MERGING
// =====================================================

export interface TokenMergeResult {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: "TOKEN" | "NFT";
  source: DiscoverySource;
  confidence: number; // 0-1
  sources: DiscoverySource[]; // All sources that contributed
  mergedAt: Date;
}

export interface MergeHistoryEntry {
  id: number;
  tokenAddress: string;
  source: DiscoverySource;
  sourceMetadata: TokenMetadata;
  mergedMetadata: TokenMetadata;
  mergedAt: Date;
  confidenceScore: number; // 0-1
  contributorHash: string;
}

// =====================================================
// SOURCE WEIGHTS
// =====================================================

export interface SourceWeight {
  sourceName: DiscoverySource;
  weight: number; // 1-100, higher = more trusted
  lastUpdated: Date;
}

export const DEFAULT_SOURCE_WEIGHTS: Record<DiscoverySource, number> = {
  verified_contract: 100,
  whale_transfer: 80,
  lp_pair: 70,
  wallet_scan: 50,
  user_submission: 30,
  blockscout_api: 40,
};

// =====================================================
// CROWDSOURCED TOKEN INDEX
// =====================================================

export interface CrowdsourcedToken {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  type: "TOKEN" | "NFT";
  source: DiscoverySource;
  holderCount?: number;
  isVerified: boolean;
  confidenceScore: number; // 0-1
  discoveryCount: number;
  firstDiscoveredAt: Date;
  lastDiscoveredAt: Date;
  indexedAt: Date;
}

export interface MergedTokensResponse {
  tokens: CrowdsourcedToken[];
  count: number;
  timestamp: string;
}

// =====================================================
// VALIDATION CRITERIA
// =====================================================

export interface ValidationCriteria {
  minNameLength: number;
  maxNameLength: number;
  minSymbolLength: number;
  maxSymbolLength: number;
  validDecimalsRange: [number, number];
  requiredNameQuality: "exact" | "fuzzy";
}

export const DEFAULT_VALIDATION_CRITERIA: ValidationCriteria = {
  minNameLength: 2,
  maxNameLength: 100,
  minSymbolLength: 2,
  maxSymbolLength: 20,
  validDecimalsRange: [0, 18],
  requiredNameQuality: "fuzzy",
};

// =====================================================
// API ERROR TYPES
// =====================================================

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitError extends ApiError {
  constructor(details?: any) {
    super(429, "Rate limit exceeded", details);
    this.name = "RateLimitError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(400, message, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}
