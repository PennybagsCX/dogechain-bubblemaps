# RPC Wallet Scanning Implementation

## Overview

The Dogechain Bubblemaps alert system uses RPC-based wallet scanning for fast, reliable transaction detection. This document describes the implementation and optimizations made to achieve instant alert notifications.

## Architecture

### Alert Types

| Alert Type | Description                              | RPC Method                 |
| ---------- | ---------------------------------------- | -------------------------- |
| **WALLET** | Monitor all token transfers for a wallet | `getWalletTransfersFast()` |
| **TOKEN**  | Monitor transfers for a specific token   | `getTransferEvents()`      |
| **WHALE**  | Monitor large transfers for a wallet     | `getWalletTransfersFast()` |

### Hybrid Fetch System

The `fetchTransactionsHybrid()` function in `Dashboard.tsx` routes alerts to the appropriate RPC method:

```typescript
const shouldUseRPC =
  (alert.type === "TOKEN" && alert.tokenAddress) ||
  alert.type === "WALLET" ||
  alert.type === "WHALE";
```

## Fast Scanning Method

### `getWalletTransfersFast()`

**Location**: `services/dogechainRPC.ts`

**Method**: Uses `getLogs` with Transfer event signature instead of fetching blocks and receipts.

**Why it's faster**:

- **Old method (`getWalletTransactions`)**:
  1. Fetch full blocks with `includeTransactions: true`
  2. For each transaction, fetch the receipt to get Transfer events
  3. Extremely slow - 45-60s for 500 blocks

- **New method (`getWalletTransfersFast`)**:
  1. Use `getLogs` with Transfer event signature
  2. Filter logs by wallet address
  3. Only fetch block timestamps (lightweight)
  4. **10-20x faster** - completes in seconds

### Event Signature

```typescript
const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
```

This is the keccak256 hash of `Transfer(address,address,uint256)`.

## Configuration

### RPC Client Settings

| Setting               | Value     | Purpose                        |
| --------------------- | --------- | ------------------------------ |
| `timeout`             | 8000ms    | Individual RPC request timeout |
| `retryCount`          | 3         | Retries per provider           |
| `maxRetries`          | 2         | Max retries before giving up   |
| `concurrencyLimit`    | 10        | Parallel requests              |
| `batchSize`           | 50 blocks | For old block-fetching method  |
| `suppressConsoleLogs` | true      | Clean production output        |

### Dashboard Settings

| Setting            | Value | Purpose                                 |
| ------------------ | ----- | --------------------------------------- |
| `maxBlocks`        | 2000  | Max blocks per scan (~80 min lookback)  |
| `alert batch size` | 4     | Wallets scanned in parallel             |
| `scan timeout`     | 60s   | Hard timeout for entire scan            |
| `polling interval` | 10s   | How often to check for new transactions |

## Block Range Calculation

The `calculateFromBlock()` function determines the starting block for each scan:

```typescript
// For new alerts (no baseline)
const lookbackBlocks = BigInt(2000);

// For established alerts
const blocksToFetch = rpcClient.estimateBlocksForTimeframe(minutesSinceCheck);
const actualBlocks = Math.min(blocksToFetch, 2000);
```

**Dogechain block time**: ~2.5 seconds per block

| Blocks | Time Coverage |
| ------ | ------------- |
| 500    | ~20 minutes   |
| 1000   | ~40 minutes   |
| 2000   | ~80 minutes   |

## Scan Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Polling trigger (every 10s)                               │
│    - Check if already scanning                               │
│    - Check if in grace period                                │
│    - Check if alerts exist                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Scan start                                                │
│    - Set isScanning=true                                     │
│    - Start 60s timeout timer                                 │
│    - Batch alerts (4 at a time)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Process each alert                                        │
│    - Calculate block range                                   │
│    - Call getWalletTransfersFast()                           │
│    - Filter for new transactions                             │
│    - Check thresholds (for WHALE alerts)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Handle results                                            │
│    - New transactions found?                                 │
│      → Trigger alert                                         │
│      → Show browser notification                              │
│      → Save to database                                      │
│    - Update alert status                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Scan completion                                           │
│    - Set isScanning=false                                    │
│    - Next poll in 10s                                        │
└─────────────────────────────────────────────────────────────┘
```

## Grace Period

After manual clear operations, the system enters a 30-second grace period where scans are paused:

```typescript
const isInGracePeriod = () => {
  const lastClear = localStorage.getItem("lastAllClear");
  if (!lastClear) return false;
  const gracePeriodEnd = parseInt(lastClear) + 30000; // 30s
  return Date.now() < gracePeriodEnd;
};
```

## Console Logging

Diagnostic logs are now properly suppressed in production:

- **`console.log()`** - Suppressed in production (used for diagnostics)
- **`console.warn()`** - Visible (used for important warnings like timeouts)
- **`console.error()`** - Visible (used for actual errors)

To enable diagnostic logging in production:

```typescript
// In services/dogechainRPC.ts
suppressConsoleLogs: false;
```

## Performance

### Before Optimization (Block Fetching Method)

- **500 blocks**: 45-60 seconds
- **1000 blocks**: Timeout
- **RPC calls**: ~100 (10 blocks/batch × 10 batches + receipts)

### After Optimization (getLogs Method)

- **500 blocks**: 2-5 seconds
- **2000 blocks**: 5-15 seconds
- **RPC calls**: ~5 (getLogs + block timestamps)

### Alert Detection Speed

| Scenario                  | Time to Detect                |
| ------------------------- | ----------------------------- |
| Transaction during scan   | Instant (within current scan) |
| Transaction between scans | 10-30 seconds (next poll)     |
| New alert created         | 10-30 seconds (first scan)    |

## Troubleshooting

### Alerts Not Firing

1. **Check if scanning is running**:

   ```javascript
   // Look for: [Polling] willScan=true
   ```

2. **Check for timeout errors**:

   ```javascript
   // Look for: [Scan] ⚠️ TIMEOUT after 60s
   ```

3. **Check RPC errors**:

   ```javascript
   // Look for: RPC attempt X failed
   ```

4. **Verify block range includes transaction**:
   ```javascript
   // Look for: block range: X to Y
   // Transaction block should be between X and Y
   ```

### High CPU Usage

- Reduce `alert batch size` from 4 to 2
- Reduce `maxBlocks` from 2000 to 1000

### RPC Timeout Errors

- Increase `timeout` from 8000 to 12000
- Reduce `concurrencyLimit` from 10 to 5

## Files Modified

| File                       | Changes                                        |
| -------------------------- | ---------------------------------------------- |
| `services/dogechainRPC.ts` | Added `getWalletTransfersFast()` method        |
| `components/Dashboard.tsx` | Updated WALLET/WHALE alerts to use fast method |
| `wagmi.ts`                 | Wallet connection configuration                |

## Deployment

**Current Build**: #2563

**Key Changes**:

- Fast getLogs-based wallet scanning
- Console log suppression enabled
- 2000 block lookback window
- 10-second polling interval

---

_Last Updated: 2026-01-27_
