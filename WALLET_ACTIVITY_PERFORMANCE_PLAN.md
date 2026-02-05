# Wallet Activity Analytics Performance Issues & Fix Plan

## Status: ✅ P0-P1 Fixes Implemented

**Last Updated**: 2026-02-04
**Completed Fixes**:

- ✅ Fix 1.1: Removed duplicate fetchTokenHolders
- ✅ Fix 2.1: Reduced batch size from 50 to 15
- ✅ Fix 2.2: Added 200ms delay between batches
- ✅ Fix 3.1: Pre-filter inactive wallets
- ✅ Fix 4.1: Reduced timeline wallets from 25 to 15

---

## Console Log Analysis Summary

Based on `/console.md`, here are the critical issues identified:

---

## Issue #1: API Rate Limiting (429 Errors) - CRITICAL

### Problem

```
rateLimit.ts:200 GET .../api/dogechain-proxy?module=account&action=tokentx... 429 (Too Many Requests)
[RateLimit] ⚠️ 429 Too Many Requests - Attempt 1/4 ... Retrying in 1s...
```

**Root Cause**: Processing 50 wallets in parallel immediately triggers the 60 requests/minute rate limiter.

**Impact**: Each 429 error causes:

- 1 second retry delay
- Up to 4 retry attempts
- For 100 wallets: ~20-30 requests hit 429 = 20-30 seconds of delays

---

## Issue #2: Duplicate fetchTokenHolders Calls - HIGH

### Problem

```
[LP Detection] ===== fetchTokenHolders called for DC =====
[LP Detection] ===== fetchTokenHolders called for DC =====  (immediately after)
```

**Root Cause**: In `WalletActivityAnalytics.tsx`, the component fetches holders twice:

1. Once in the `Promise.all` (line 109)
2. Again inside the analytics function (line 112)

**Impact**: Doubles the initial API load time unnecessarily.

---

## Issue #3: All Wallets Being Analyzed Even Inactive Ones - MEDIUM

### Problem

The service fetches transactions for ALL 100 wallets, including many with no activity.

**Evidence**: Many wallets return `No transactions found at offset 1000` after wasting API calls.

**Impact**:

- Unnecessary API calls for wallets with no activity
- Could reduce API calls by 60-80% by pre-filtering

---

## Issue #4: Sequential Batching Within Parallel Batches - LOW

### Problem

After processing 50 wallets in parallel, another 25 are fetched in parallel for the timeline.

**Impact**: This two-phase approach means 75 total parallel API calls, which still triggers rate limiting.

---

## Fix Plan

### Phase 1: Eliminate Redundant API Calls (Immediate Impact)

#### Fix 1.1: Remove Duplicate fetchTokenHolders

**File**: `components/WalletActivityAnalytics.tsx`
**Lines**: ~109-118

**Current Code**:

```typescript
const [{ wallets }, analytics] = await Promise.all([
  fetchTokenHolders(token),
  (async () => {
    const { wallets: holderWallets } = await fetchTokenHolders(token); // DUPLICATE!
    ...
  })(),
]);
```

**Fix**:

```typescript
// Single fetch of holders
const { wallets } = await fetchTokenHolders(token);
if (wallets.length === 0) {
  setLoading(false);
  return;
}

// Then fetch analytics using those wallets
const analytics = await fetchWalletActivityStats(token, wallets, timeRange, onProgress);
```

**Expected Savings**: 1-2 seconds

---

### Phase 2: Reduce Rate Limiting (High Impact)

#### Fix 2.1: Reduce Batch Size to Stay Within Rate Limits

**File**: `services/walletActivityService.ts`
**Line**: 318

**Change**: Reduce `BATCH_SIZE` from 50 to **15**

**Rationale**:

- Rate limiter: 60 requests/minute = 1 request/second
- With 15 wallets per batch: ~15 seconds per batch
- 100 wallets = 7 batches × 15 seconds = ~105 seconds (better than 429 retries)

**Expected Improvement**: Eliminates most 429 errors

#### Fix 2.2: Add Delay Between Batches

**File**: `services/walletActivityService.ts`
**Line**: After line 322

**Add**:

```typescript
// Add small delay between batches to respect rate limiter
if (batchStart + BATCH_SIZE < wallets.length) {
  await sleep(200); // 200ms between batches
}
```

---

### Phase 3: Smart Wallet Pre-Filtering (Medium Impact)

#### Fix 3.1: Skip Inactive Wallets Early

**File**: `services/walletActivityService.ts`

**Add Before Loop**:

```typescript
// Pre-filter: Skip wallets with 0 balance (likely inactive)
const activeWallets = wallets.filter((w) => w.balance > 0);
console.log(
  `[analyzeWalletActivities] Filtered to ${activeWallets.length} active wallets from ${wallets.length} total`
);
```

**Expected Savings**: 20-40% fewer API calls

---

### Phase 4: Optimize Timeline Transaction Fetching (Low-Medium Impact)

#### Fix 4.1: Reduce Timeline Wallet Count

**File**: `services/walletActivityService.ts`
**Line**: ~465

**Change**: Reduce from 25 to **15** wallets for timeline

**Rationale**: Timeline visualization doesn't need data from all wallets, and reducing this saves significant API time.

---

### Phase 5: Progressive Data Display (UX Improvement)

#### Fix 5.1: Show Data as It Loads

**File**: `components/WalletActivityAnalytics.tsx`

**Strategy**: Instead of waiting for everything, show:

1. First display basic metrics (holders count) - immediately available
2. Then show charts as data completes
3. Finally show wallet lists

**Implementation**: Stream the rendering instead of waiting for full completion.

---

## Implementation Priority

| Priority | Fix                                         | Impact          | Effort | Target Time |
| -------- | ------------------------------------------- | --------------- | ------ | ----------- |
| **P0**   | Fix 1.1: Remove duplicate fetchTokenHolders | 2s              | 5 min  | Now         |
| **P0**   | Fix 2.1: Reduce batch size to 15            | Eliminates 429s | 2 min  | Now         |
| **P1**   | Fix 2.2: Add 200ms delay between batches    | Prevents 429s   | 2 min  | Now         |
| **P1**   | Fix 3.1: Pre-filter inactive wallets        | 30% fewer calls | 5 min  | Now         |
| **P2**   | Fix 4.1: Reduce timeline wallets to 15      | 10s savings     | 1 min  | Later       |
| **P3**   | Fix 5.1: Progressive display                | UX improvement  | 30 min | Later       |

---

## Expected Results After Fixes

| Metric                    | Before       | After P0-P1 Fixes | After All Fixes    |
| ------------------------- | ------------ | ----------------- | ------------------ |
| **Initial holders fetch** | 2 calls      | 1 call            | 1 call             |
| **429 Rate limit errors** | 20-30 errors | 0-2 errors        | 0 errors           |
| **Batch processing time** | Trigger 429s | Smooth processing | Smooth             |
| **Wallets analyzed**      | 100 all      | ~60 active        | ~60 active         |
| **Total loading time**    | ~60 seconds  | ~20-25 seconds    | ~15-20 seconds     |
| **User perception**       | Long wait    | Moderate wait     | Fast with progress |

---

## Files to Modify

1. **`components/WalletActivityAnalytics.tsx`** - Remove duplicate fetchTokenHolders
2. **`services/walletActivityService.ts`** - Batch sizes, delays, pre-filtering

---

## Testing Checklist

- [ ] Verify no duplicate `fetchTokenHolders called for` logs
- [ ] Verify minimal or no 429 errors in console
- [ ] Check loading time is under 30 seconds
- [ ] Verify progress UI updates correctly
- [ ] Test with tokens having different wallet counts (10, 50, 100)
