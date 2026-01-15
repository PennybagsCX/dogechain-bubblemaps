export enum AssetType {
  TOKEN = "TOKEN",
  NFT = "NFT",
}

export interface Token {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number;
  decimals?: number; // Added to ensure consistent normalization
  priceUsd?: number;
  type: AssetType;
  isVerified?: boolean; // New: Contract verification status
  holderCount?: number; // New: Total count of holders on chain
  iconUrl?: string; // New: Official Token Logo
}

export interface Wallet {
  address: string;
  balance: number;
  percentage: number;
  isWhale: boolean;
  isContract: boolean;
  label?: string; // New: Identified name (e.g. "Burn Address", "Binance")
  // Simulation for visualization
  id: string;
  r?: number; // radius for d3
  x?: number; // x coord for d3
  y?: number; // y coord for d3
  connections: string[]; // Array of wallet IDs this wallet interacted with
}

export interface Link {
  source: string | Wallet;
  target: string | Wallet;
  value: number;
}

export interface Connection extends Link {
  // Transaction data fetched between wallets
  transactions?: Transaction[];
  stats?: ConnectionStats;
  loading?: boolean;
  error?: string;
}

export interface ConnectionStats {
  totalTransactions: number;
  totalVolume: number;
  firstTransaction?: number; // timestamp
  lastTransaction?: number; // timestamp
  averageAmount: number;
  flowDirection: "balanced" | "source_to_target" | "target_to_source";
  fromCount: number; // transactions from source to target
  toCount: number; // transactions from target to source
  fromVolume: number;
  toVolume: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: number;
  timestamp: number;
  tokenSymbol?: string; // New: Capture symbol directly from TX logs
  tokenAddress?: string; // Token contract address from transaction data
}

export enum ViewState {
  HOME = "HOME",
  ANALYSIS = "ANALYSIS",
  DASHBOARD = "DASHBOARD",
}

export interface AlertConfig {
  id: string;
  walletAddress: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  threshold?: number; // Deprecated: Alerts monitor transactions, not balance changes
  initialValue?: number; // For delta tracking
  name: string;
  type?: "WALLET" | "TOKEN" | "WHALE"; // Alert type for different monitoring strategies
  createdAt?: number; // Timestamp when alert was created
}

export interface TriggeredEvent {
  id: string;
  alertId: string;
  alertName: string;
  walletAddress: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  transactions: Transaction[];
  triggeredAt: number;
  notified: boolean;
}

export interface AlertStatus {
  currentValue: number;
  triggered: boolean;
  checkedAt: number;
  notified?: boolean; // Whether user has been notified about this trigger
  // Transaction tracking
  lastSeenTransactions?: string[]; // Array of transaction hashes we've already seen
  newTransactions?: Transaction[]; // New transactions detected in latest scan
}

// Wallet Scanner Types
export interface ScanProgressUpdate {
  phase: "quick" | "deep-v1" | "whale-scan" | "lp-detection" | "complete";
  progress: number; // 0-100
  tokens: Token[];
  nfts: Token[];
  currentOperation: string;
  totalRequests: number;
}

export interface ScanMetadata {
  totalRequests: number;
  phasesCompleted: string[];
  totalPages: number;
  duration: number;
}

// Token Search Types
export interface SearchResult {
  address: string;
  name: string;
  symbol: string;
  type: AssetType;
  source: "local" | "remote" | "recent" | "peer" | "learned";
  decimals?: number;
  score?: number; // For temporary sorting during search (removed before display)
  popularityScore?: number; // Learned token popularity score
  priority?: "high" | "medium" | "low"; // Priority level for sorting
}

export interface TokenSearchInputProps {
  searchType: AssetType;
  onSearch: (address: string, type: AssetType) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  // Support controlled pattern
  value?: string;
  onChange?: (query: string) => void;
}

// =====================================================
// Search Analytics Types
// =====================================================

export interface SearchAnalyticsEvent {
  sessionId: string;
  query: string;
  results: string[]; // Token addresses
  resultCount: number;
  timestamp: number;
}

export interface ClickAnalyticsEvent {
  sessionId: string;
  query: string;
  clickedAddress: string;
  resultRank: number;
  resultScore: number;
  timeToClickMs: number;
  timestamp: number;
}

export interface SearchSession {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  searchCount: number;
  clickCount: number;
}

export interface TokenPopularity {
  tokenAddress: string;
  searchCount: number;
  clickCount: number;
  ctr: number; // Click-through rate (0-1)
  lastSearched: number | null;
  lastClicked: number | null;
}

export interface AnalyticsSummary {
  date: string;
  totalSearches: number;
  totalClicks: number;
  uniqueSessions: number;
  avgCtr: number;
  topQueries: Array<{ query: string; count: number }>;
  topTokens: Array<{ address: string; clicks: number }>;
}

export interface PeerRecommendation {
  address: string;
  name: string;
  symbol: string;
  score: number;
  reason: string;
}

// =====================================================
// Learning Search System Types
// =====================================================

export type DiscoverySource =
  | "wallet_scan"
  | "whale_enumeration"
  | "lp_detection"
  | "user_submission"
  | "verified_contract"
  | "blockscout_api";

export interface DiscoveredToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: AssetType;
  source: DiscoverySource;
  confidence: number; // 0-1
  holderCount?: number;
  discoveredAt: number;
}

export interface PendingValidation {
  id: number;
  tokenAddress: string;
  source: DiscoverySource;
  metadata: DiscoveredToken;
  priority: number; // 0-10
  submittedAt: number;
  validationAttempts: number;
  lastAttemptAt?: number;
  status: "pending" | "validating" | "validated" | "rejected";
}

export interface TokenMergeHistory {
  id: number;
  tokenAddress: string;
  source: DiscoverySource;
  sourceMetadata: DiscoveredToken;
  mergedMetadata: DiscoveredToken;
  mergedAt: number;
  confidenceScore: number; // 0-1
  contributorHash: string;
}
