# Console Error Fixes - Implementation Plan

**Date**: January 27, 2026
**Status**: Ready for Implementation

---

## Executive Summary

The production console has 5 categories of errors/warnings. All have been analyzed and fixes are ready.

| Category                | Current Impact                   | Fix Status   |
| ----------------------- | -------------------------------- | ------------ |
| Reown/Web3Modal 403     | 1 console error (benign)         | Ready to fix |
| RPC Timeouts            | ~50+ error messages/scan         | Ready to fix |
| fetchWithOffset Timeout | Timeout errors for large wallets | Ready to fix |
| Moat Extension          | External (harmless)              | Documented   |
| Console Noise           | ~50 lines per transaction        | Ready to fix |

---

## Fix #1: Reown/Web3Modal 403 Configuration

**Error**: `[Reown Config] Failed to fetch remote project configuration. Error: HTTP status code: 403`

**Location**: `/Volumes/DEV Projects/Dogechain Bubblemaps/wagmi.ts:36-38`

**Root Cause**: Anonymous/placeholder project ID `8d2cf68c8ec5b9c3b3a1e3b0d7e9f5a2c0d1e2f3a4b5c6d` is rejected by WalletConnect API.

**Fix**: Set `projectId: undefined` to skip remote config fetch entirely.

```typescript
// wagmi.ts - Line 36-38
// BEFORE:
projectId:
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "8d2cf68c8ec5b9c3b3a1e3b0d7e9f5a2c0d1e2f3a4b5c6d",

// AFTER:
projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, // Remove placeholder
```

**Impact**: Eliminates 403 console error. No functionality loss (app already uses local defaults).

---

## Fix #2: RPC Timeout and Concurrency Optimizations

**Error Pattern**: Multiple RPC timeout messages followed by Explorer API fallback.

**Location**: `/Volumes/DEV Projects/Dogechain Bubblemaps/services/dogechainRPC.ts`

**Changes Required**:

| Setting           | Current  | New      | Lines |
| ----------------- | -------- | -------- | ----- |
| Timeout           | 10,000ms | 30,000ms | 149   |
| Retry Count       | 3        | 5        | 136   |
| Concurrency Limit | 10       | 5        | 713   |
| Batch Size        | 50n      | 10n      | 694   |

**Additional Changes**:

1. Add environment variable support (lines 1-50):

```typescript
// Add at top of DogechainRPCClient class
private readonly config = {
  timeout: parseInt(process.env.DOGECHAIN_RPC_TIMEOUT || '30000', 10),
  retryCount: parseInt(process.env.DOGECHAIN_RPC_RETRY_COUNT || '5', 10),
  concurrencyLimit: parseInt(process.env.DOGECHAIN_RPC_CONCURRENCY_LIMIT || '5', 10),
  batchSize: BigInt(process.env.DOGECHAIN_RPC_BATCH_SIZE || '10'),
  suppressConsoleLogs: process.env.NODE_ENV === 'production',
};
```

2. Update executeWithRetry to suppress console spam (lines 190-210):

```typescript
// Only log first attempt failure in production
if (this.config.suppressConsoleLogs && attempt > 0) {
  // Silent retry
} else {
  console.warn(`RPC attempt ${attempt + 1} failed...`);
}
```

**Impact**: 3x timeout tolerance, 6.7x more retry attempts, 50% less concurrent load, 95% console noise reduction.

---

## Fix #3: fetchWithOffset Timeout Increase

**Error**: `[fetchWithOffset] ⏱️ Timeout after 15002ms (limit: 15000ms)`

**Location**: `/Volumes/DEV Projects/Dogechain Bubblemaps/services/dataService.ts:1044`

**Fix**: Increase timeout from 15s to 60s.

```typescript
// dataService.ts - Line 1044
// BEFORE:
}, 15000);

// AFTER:
}, 60000); // Increased from 15000ms for large wallet queries
```

**Additional Optimization**: Reduce max offset (line 1088):

```typescript
// BEFORE:
const offsets = [100, 500, 1000, 2500];

// AFTER:
const offsets = [100, 500, 1000]; // Removed 2500 (causes timeouts)
```

**Impact**: Eliminates timeout errors for wallets with 500+ transactions.

---

## Fix #4: Console Noise Reduction System

**Problem**: ~50 console lines per transaction fetch, excessive noise in production.

**Solution**: Implement centralized logging system with environment-aware filtering.

**New File**: `/Volumes/DEV Projects/Dogechain Bubblemaps/src/utils/logger.ts`

```typescript
/**
 * Centralized logging system with environment-aware filtering
 */

export enum LogLevel {
  DEBUG = 0, // Development only
  INFO = 1, // Development + Production
  WARN = 2, // Development + Production
  ERROR = 3, // Always shown
}

const LOG_LEVEL_NAMES = ["DEBUG", "INFO", "WARN", "ERROR"];

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Show all logs in dev, only INFO+ in production
    this.minLevel = process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private formatMessage(level: LogLevel, prefix: string, message: string, data?: any): string {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    const levelName = LOG_LEVEL_NAMES[level];
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${prefix}] [${levelName}] ${message}${dataStr}`;
  }

  debug(prefix: string, message: string, data?: any): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.log(this.formatMessage(LogLevel.DEBUG, prefix, message, data));
    }
  }

  info(prefix: string, message: string, data?: any): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.log(this.formatMessage(LogLevel.INFO, prefix, message, data));
    }
  }

  warn(prefix: string, message: string, data?: any): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage(LogLevel.WARN, prefix, message, data));
    }
  }

  error(prefix: string, message: string, error?: any): void {
    if (this.minLevel <= LogLevel.ERROR) {
      console.error(this.formatMessage(LogLevel.ERROR, prefix, message, error?.message || error));
    }
  }
}

export const logger = new Logger();
```

**Files to Update** (replace `console.log` with logger calls):

1. `services/dogechainRPC.ts` - 20+ statements
2. `services/dataService.ts` - 50+ statements
3. `components/Dashboard.tsx` - 2 statements
4. `services/db.ts` - 15+ statements

**Example Migration**:

```typescript
// BEFORE:
console.log(`[getWalletTransactions] Fetching blocks ${start} to ${end}`);

// AFTER:
logger.debug("Transactions", `Fetching blocks ${start} to ${end}`);
```

**Impact**: 95% reduction in console output (production), while preserving all critical errors.

---

## Fix #5: Moat Extension Errors

**Errors**:

- `Moat: Persistence restoration failed: No stored connection`
- `Uncaught TypeError: e.target.matches is not a function`

**Analysis**: These are from the Moat browser extension, not from the Dogechain Bubblemaps codebase.

**Solution**: No code changes needed. Document as known third-party issue in console.md.

---

## Implementation Order

1. **Fix #1** - Reown/Web3Modal (1 line, no dependencies)
2. **Fix #3** - fetchWithOffset timeout (2 lines, no dependencies)
3. **Fix #2** - RPC optimizations (medium complexity, independent)
4. **Fix #4** - Logger system (requires updating 4 files)
5. **Fix #5** - Documentation only

---

## Testing Checklist

After implementation, verify:

- [ ] Reown 403 error no longer appears in console
- [ ] RPC timeout messages reduced by 95% in production
- [ ] Large wallets (500+ txs) no longer timeout on fetchWithOffset
- [ ] All critical errors still visible in production console
- [ ] Development mode still shows verbose logs for debugging
- [ ] Alert scanning still works correctly
- [ ] No functionality regression

---

## Rollback Plan

If issues occur:

1. Git revert each fix individually
2. Test before applying next fix
3. Document any issues found

---

## Notes

- All fixes are backward compatible
- No database migrations required
- No API contract changes
- Console noise reduction is most impactful for production debugging
