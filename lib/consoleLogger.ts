/**
 * Remote Diagnostic Logger
 * Captures console output and diagnostic data for remote analysis
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  ConsoleEntry,
  TokenSearchAttempt,
  HolderFetchAttempt,
  ErrorEntry,
  DiagnosticLog,
  LogDiagnosticsResponse,
} from "../_types/diagnostics";

class DiagnosticLogger {
  private sessionId: string;
  private consoleBuffer: ConsoleEntry[] = [];
  private tokenSearches: TokenSearchAttempt[] = [];
  private tokenHolderFetches: HolderFetchAttempt[] = [];
  private errors: ErrorEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };
  private isInitialized = false;
  private autoSendInterval: number | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public getBrowserInfo() {
    const userAgent = navigator.userAgent;
    return {
      userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      isArcMobile: /Arc\/.*Mobile/.test(userAgent),
      isArc: /Arc\//.test(userAgent),
      isMobile: /Mobile|Android|iPhone|iPad|iPod/.test(userAgent),
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      networkStatus: (navigator as any).connection?.effectiveType || "unknown",
      url: window.location.href,
    };
  }

  private captureConsole(level: "log" | "error" | "warn" | "info", args: any[]): void {
    const entry: ConsoleEntry = {
      level,
      message: args
        .map((arg) => {
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(" "),
      timestamp: Date.now(),
      data: args.length > 1 ? args : undefined,
    };

    this.consoleBuffer.push(entry);

    // Keep buffer size manageable
    if (this.consoleBuffer.length > 500) {
      this.consoleBuffer = this.consoleBuffer.slice(-400);
    }
  }

  public initialize(): void {
    if (this.isInitialized) {
      this.originalConsole.warn("[DiagnosticLogger] Already initialized");
      return;
    }

    // Override console methods
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.captureConsole("log", args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.captureConsole("error", args);
      this.logError(args.join(" "));
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.captureConsole("warn", args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.captureConsole("info", args);
    };

    // Set up global error handler
    window.addEventListener("error", (event) => {
      this.logError(event.message, event.error?.stack);
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.logError(`Unhandled promise rejection: ${event.reason}`, event.reason?.stack);
    });

    // Auto-send logs every 30 seconds
    this.autoSendInterval = window.setInterval(() => {
      this.sendLogs().catch((err) =>
        this.originalConsole.error("[DiagnosticLogger] Auto-send failed:", err)
      );
    }, 30000);

    this.isInitialized = true;
    this.originalConsole.log("[DiagnosticLogger] Initialized with session:", this.sessionId);
  }

  public logTokenSearch(
    query: string,
    type: string,
    success: boolean,
    resultCount?: number,
    error?: string
  ): void {
    this.tokenSearches.push({
      query,
      type,
      timestamp: Date.now(),
      success,
      resultCount,
      error,
    });
  }

  public logTokenHolderFetch(
    tokenAddress: string,
    tokenSymbol: string,
    success: boolean,
    walletsCount: number,
    linksCount: number,
    error?: string
  ): void {
    this.tokenHolderFetches.push({
      tokenAddress,
      tokenSymbol,
      timestamp: Date.now(),
      success,
      walletsCount,
      linksCount,
      error,
    });
  }

  public logError(message: string, stack?: string, context?: string): void {
    this.errors.push({
      message,
      stack,
      timestamp: Date.now(),
      context,
    });
  }

  private prepareLogData(): DiagnosticLog {
    const browserInfo = this.getBrowserInfo();

    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      ...browserInfo,
      consoleLogs: [...this.consoleBuffer],
      tokenSearches: [...this.tokenSearches],
      tokenHolderFetches: [...this.tokenHolderFetches],
      errors: [...this.errors],
    };
  }

  public async sendLogs(): Promise<LogDiagnosticsResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        message: "Logger not initialized",
      };
    }

    try {
      const data = this.prepareLogData();

      const response = await fetch("/api/log-diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Clear buffers after successful send
      this.consoleBuffer = [];
      this.errors = [];

      return result;
    } catch (error) {
      this.originalConsole.error("[DiagnosticLogger] Failed to send logs:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public sendLogsOnKeyEvents(): void {
    // Send on page hide (user navigates away)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Use sendBeacon for more reliable delivery during page unload
        const data = this.prepareLogData();
        const blob = new Blob([JSON.stringify(data)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/log-diagnostics", blob);
      }
    });

    // Send on page unload
    window.addEventListener("beforeunload", () => {
      const data = this.prepareLogData();
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/log-diagnostics", blob);
    });
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public destroy(): void {
    if (this.autoSendInterval) {
      clearInterval(this.autoSendInterval);
    }

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    this.isInitialized = false;
  }
}

// Singleton instance
let loggerInstance: DiagnosticLogger | null = null;

export function getDiagnosticLogger(): DiagnosticLogger {
  if (!loggerInstance) {
    loggerInstance = new DiagnosticLogger();
  }
  return loggerInstance;
}

export function initializeDiagnosticLogger(): DiagnosticLogger {
  const logger = getDiagnosticLogger();
  logger.initialize();
  logger.sendLogsOnKeyEvents();
  return logger;
}
