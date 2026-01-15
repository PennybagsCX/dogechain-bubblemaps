# Alert System - Manual Test Checklist

**Test Date**: **\*\***\_**\*\***
**Tester**: **\*\***\_**\*\***
**Browser**: **\*\***\_**\*\***

---

## 🧪 Critical Tests (Must Pass)

### Test 1: Fresh Alert Creation (Primary Test)

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Open the app in browser
2. Navigate to Dashboard
3. Click "Create Alert" button
4. Fill in form:
   - Name: `Manual Test 1`
   - Wallet Address: `0xc1efe7aa280f7c63a4b1da26ae0f7e64ce7f2a8a`
   - Token Address: `0x7b4328c127b85369d9f82ca0503b000d09cf9180`
   - Alert Type: `Wallet Watch`
5. Click "Create Alert" button
6. Wait for completion

**Expected Results**:

- [ ] Progress toasts appear during creation
- [ ] Button shows "Creating..." state
- [ ] Creation completes in <30 seconds
- [ ] Success toast: "New alert saved"
- [ ] Alert appears in dashboard list
- [ ] Button resets to "Create Alert"

**Actual Results**:

```
Completion time: _____ seconds
Console errors: _____
```

**Console Log Check**:

- [ ] `[DB MIGRATION v18]` message present (first load only)
- [ ] `[fetchWalletTransactions] Starting transaction fetch`
- [ ] `[fetchWalletTransactions] ✅ Found XX transactions`
- [ ] `[fetchWalletTransactions] 💾 Cached XX transactions`
- [ ] `[ALERT CREATE] ✅ Alert creation flow complete`
- [ ] NO React key errors: "Encountered two children with the same key"

**Notes**: **\*\***\_**\*\***

---

---

### Test 2: Cached Alert Creation (Performance Test)

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Create another alert with SAME wallet address as Test 1
2. Name: `Manual Test 2`
3. Use same wallet and token addresses
4. Click "Create Alert"

**Expected Results**:

- [ ] Creation completes in <2 seconds (should use cache)
- [ ] Toast: "Using cached transaction data..."
- [ ] Console: `[fetchWalletTransactions] 🎯 Cache hit`

**Actual Results**:

```
Completion time: _____ seconds (should be <2s)
Used cache: ⬜ Yes | ⬜ No
```

**Notes**: **\*\***\_**\*\***

---

---

### Test 3: React Key Error Check

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Open DevTools → Console
2. Clear console
3. Create an alert (or refresh page if alerts exist)
4. Check console for errors

**Expected Results**:

- [ ] NO "Encountered two children with the same key" errors
- [ ] NO duplicate event ID warnings

**Actual Results**:

```
React key errors found: ⬜ Yes | ⬜ No
If yes, error message: _____
```

**Notes**: **\*\***\_**\*\***

---

---

### Test 4: Database Cleanup Verification

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Open DevTools → Application → Storage → IndexedDB
2. Find `DogeDatabase` → `triggeredEvents` table
3. Browse through event IDs

**Expected Results**:

- [ ] All event IDs are unique
- [ ] NO duplicate IDs in the list
- [ ] IDs should look like: `event-<uuid>` (e.g., `event-550e8400-e29b-41d4-a716-446655440000`)

**Actual Results**:

```
Duplicate events found: ⬜ Yes | ⬜ No
If yes, count: _____
```

**Console Check**:

- [ ] Look for: `[DB MIGRATION v18] ✅ Cleaned up X duplicate triggered events`
- [ ] Note number of duplicates cleaned up: **\_**

**Notes**: **\*\***\_**\*\***

---

---

### Test 5: Timeout Handling

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Create alert for a wallet with NO transactions
2. Wallet: `0x0000000000000000000000000000000000000001` (unlikely to have activity)
3. Wait for completion

**Expected Results**:

- [ ] System tries all 4 offsets (100, 500, 1000, 2500)
- [ ] Completes in <2 minutes (4 attempts × 30s timeout + waits)
- [ ] Toast: "No transactions found"
- [ ] Alert created successfully (even with no transactions)
- [ ] NO infinite hanging

**Actual Results**:

```
Completion time: _____ seconds
Alert created: ⬜ Yes | ⬜ No
```

**Notes**: **\*\***\_**\*\***

---

---

## 🧪 Edge Case Tests

### Test 6: Invalid Wallet Address

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Try to create alert with invalid address: `0xinvalid`
2. Click "Create Alert"

**Expected Results**:

- [ ] Validation error shown
- [ ] Alert NOT created
- [ ] Clear error message

**Actual Results**: **\*\***\_**\*\***

---

### Test 7: Rapid Button Clicking

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Fill out alert form
2. Click "Create Alert" button 5 times rapidly
3. Wait for completion

**Expected Results**:

- [ ] Only ONE alert created
- [ ] Console shows: `[ALERT CREATE] ⚠️ Already creating alert, skipping duplicate call`
- [ ] NO duplicate alerts in list

**Actual Results**:

```
Alerts created: _____ (should be 1)
Duplicate call warnings in console: ⬜ Yes | ⬜ No
```

---

### Test 8: Browser Refresh During Creation

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Start creating an alert
2. Immediately refresh page (F5 or Ctrl+R)
3. Check if alert was created

**Expected Results**:

- [ ] Either: Alert created successfully OR
- [ ] Alert creation aborted cleanly
- [ ] NO database corruption
- [ ] NO partial/incomplete alerts

**Actual Results**: **\*\***\_**\*\***

---

### Test 9: Multiple Alert Types

**Status**: ⬜ Pass | ⬜ Fail

**Steps**:

1. Create 3 alerts with different types:
   - WALLET (general monitoring)
   - TOKEN (specific token)
   - WHALE (large transfers only)
2. Use same wallet for all 3

**Expected Results**:

- [ ] All 3 alerts created successfully
- [ ] Each alert shows correct type in dashboard
- [ ] NO React key errors
- [ ] All alerts persist after page refresh

**Actual Results**:

```
Alerts created: _____ / 3
Types correct: ⬜ Yes | ⬜ No
```

---

### Test 10: Cache Expiration (After 5 Minutes)

**Status**: ⬜ Pass | ⬜ Fail (Optional - takes 5+ minutes)

**Steps**:

1. Create an alert
2. Wait 5+ minutes
3. Create another alert with same wallet
4. Check if cache was used

**Expected Results**:

- [ ] First alert: <30 seconds
- [ ] Second alert (after 5min): <30 seconds (cache expired)
- [ ] Console: NO "Cache hit" message
- [ ] New API call made

**Actual Results**: **\*\***\_**\*\***

---

## 📊 Performance Metrics

**Test 1 (Fresh Wallet)**:

- Start time: **\_**
- End time: **\_**
- Duration: **\_** seconds
- Target: <30 seconds ⬜ Met | ⬜ Not Met

**Test 2 (Cached Wallet)**:

- Start time: **\_**
- End time: **\_**
- Duration: **\_** seconds
- Target: <2 seconds ⬜ Met | ⬜ Not Met

---

## 🐛 Bug Report Template

**If any test fails, fill this out**:

**Test Number**: **\_**
**Browser**: **\_**
**Description**: **\_**
**Steps to Reproduce**:

1. ***
2. ***
3. ***

**Expected Behavior**: **\_**
**Actual Behavior**: **\_**
**Console Errors**: **\_**
**Screenshot**: (attach if possible)

---

## ✅ Test Summary

**Total Tests**: 10
**Passed**: **\_**
**Failed**: **\_**
**Skipped**: **\_**

**Overall Status**: ⬜ READY FOR PRODUCTION | ⬜ NEEDS FIXES

**Recommendations**: **\*\***\_**\*\***

---

---

---

---

**Test Completed By**: **\*\***\_**\*\***
**Date**: **\*\***\_**\*\***
**Signature**: **\*\***\_**\*\***
