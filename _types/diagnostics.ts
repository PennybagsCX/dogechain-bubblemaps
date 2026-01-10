/**
 * Diagnostic Logging Types
 * Remote diagnostic system for troubleshooting Arc Browser mobile issues
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConsoleEntry {
  level: "log" | "error" | "warn" | "info";
  message: string;
  timestamp: number;
  data?: any;
}

export interface TokenSearchAttempt {
  query: string;
  type: string;
  timestamp: number;
  success: boolean;
  resultCount?: number;
  error?: string;
}

export interface HolderFetchAttempt {
  tokenAddress: string;
  tokenSymbol: string;
  timestamp: number;
  success: boolean;
  walletsCount: number;
  linksCount: number;
  error?: string;
}

export interface ErrorEntry {
  message: string;
  stack?: string;
  timestamp: number;
  context?: string;
}

export interface DiagnosticLog {
  sessionId: string;
  timestamp: number;
  userAgent: string;
  platform: string;
  vendor: string;
  isArcMobile: boolean;
  isArc: boolean;
  isMobile: boolean;
  consoleLogs: ConsoleEntry[];
  tokenSearches: TokenSearchAttempt[];
  tokenHolderFetches: HolderFetchAttempt[];
  errors: ErrorEntry[];
  screenResolution: string;
  viewport: string;
  networkStatus: string;
  language: string;
  url: string;
}

export interface LogDiagnosticsResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}
