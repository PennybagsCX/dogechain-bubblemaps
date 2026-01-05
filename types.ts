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

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: number;
  timestamp: number;
  tokenSymbol?: string; // New: Capture symbol directly from TX logs
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
  threshold: number;
  initialValue?: number; // New: For delta tracking
  name: string;
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
  phase: "quick" | "deep-v2" | "deep-v1" | "balance-check" | "whale-scan";
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
