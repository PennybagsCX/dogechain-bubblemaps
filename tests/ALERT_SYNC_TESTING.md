# Alert Sync Testing Guide

This guide provides comprehensive testing procedures for the alert synchronization feature.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Manual Testing](#manual-testing)
5. [Multi-Device Sync Testing](#multi-device-sync-testing)
6. [Performance Testing](#performance-testing)
7. [Edge Cases](#edge-cases)

---

## Prerequisites

### Environment Setup

- Node.js installed
- Project dependencies installed: `npm install`
- Test database available (Neon PostgreSQL)
- Wallet connection enabled (MetaMask, RainbowKit, etc.)

### Test Wallet Addresses

Create or use test wallets:

- **Wallet A**: `0x1234567890123456789012345678901234567890`
- **Wallet B**: `0x9876543210987654321098765432109876543210`

---

## Unit Testing

### Run All Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:ui
```

### Run Specific Test Files

```bash
# Alert sync unit tests
npx vitest run services/__tests__/alertSync.test.ts

# Alert API integration tests
npx vitest run api/__tests__/alerts.test.ts
```

### Expected Results

- All unit tests should pass
- Code coverage > 80% for sync functions
- No TypeScript errors

---

## Integration Testing

### API Endpoint Testing

#### 1. Test GET /api/alerts/user

**Setup**:

```bash
# Ensure server is running
npm run dev
```

**Test Cases**:

```bash
# Valid wallet address
curl "http://localhost:3000/api/alerts/user?wallet=0x1234567890123456789012345678901234567890"

# Invalid wallet address (should return 400)
curl "http://localhost:3000/api/alerts/user?wallet=invalid"

# Missing wallet parameter (should return 400)
curl "http://localhost:3000/api/alerts/user"
```

**Expected Results**:

- Valid wallet: 200 status, JSON response with alerts array
- Invalid wallet: 400 status, error message
- Missing param: 400 status, error message

#### 2. Test POST /api/alerts/user

```bash
# Create new alert
curl -X POST http://localhost:3000/api/alerts/user \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "alertId": "test-alert-1",
    "name": "Test Alert",
    "monitoredWallet": "0x9876543210987654321098765432109876543210",
    "type": "WALLET",
    "createdAt": 1704067200000
  }'

# Update existing alert (same alertId)
curl -X POST http://localhost:3000/api/alerts/user \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "alertId": "test-alert-1",
    "name": "Updated Test Alert",
    "monitoredWallet": "0x9876543210987654321098765432109876543210",
    "type": "WALLET"
  }'

# Missing required fields (should return 400)
curl -X POST http://localhost:3000/api/alerts/user \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "alertId": "test-alert-2"
  }'
```

#### 3. Test DELETE /api/alerts/user

```bash
# Delete alert
curl -X DELETE "http://localhost:3000/api/alerts/user?wallet=0x1234567890123456789012345678901234567890&alertId=test-alert-1"

# Missing parameters (should return 400)
curl -X DELETE "http://localhost:3000/api/alerts/user?wallet=0x1234567890123456789012345678901234567890"
```

#### 4. Test POST /api/alerts/sync

```bash
# Bidirectional sync
curl -X POST http://localhost:3000/api/alerts/sync \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "localAlerts": [
      {
        "alertId": "local-1",
        "name": "Local Alert",
        "walletAddress": "0x9876543210987654321098765432109876543210",
        "createdAt": 1704067200000
      }
    ]
  }'
```

---

## Manual Testing

### Test Setup

1. Open browser to `http://localhost:3000`
2. Open browser DevTools (F12)
3. Go to Console tab
4. Connect wallet

### Test Case 1: Create Alert and Verify Sync

**Steps**:

1. Connect wallet
2. Navigate to Dashboard
3. Click "Add Alert"
4. Fill in alert details:
   - Name: "Manual Test Alert"
   - Wallet: `0x9876543210987654321098765432109876543210`
   - Type: WALLET
5. Save alert

**Expected Results**:

- Alert appears in Dashboard
- Console shows: `[DB SAVE] Saving 1 alerts to IndexedDB...`
- Console shows: `[SYNC] ✅ Alerts synced to server`
- No error messages in console

**Verify**:

```javascript
// In browser console
await db.alerts.toArray();
// Should show the created alert

// Verify server storage
fetch("/api/alerts/user?wallet=YOUR_WALLET_ADDRESS")
  .then((r) => r.json())
  .then((data) => console.log(data));
// Should show the same alert
```

### Test Case 2: Update Alert

**Steps**:

1. Click on existing alert
2. Modify alert name
3. Save changes

**Expected Results**:

- Alert updates in UI
- Console shows sync activity
- Server reflects updated name

### Test Case 3: Delete Alert

**Steps**:

1. Click delete on alert
2. Confirm deletion

**Expected Results**:

- Alert removed from UI
- Console shows sync activity
- Server no longer returns deleted alert

### Test Case 4: Browser Data Clearing

**Steps**:

1. Create multiple alerts (3-5)
2. Open DevTools → Application → Storage → IndexedDB
3. Note the alerts stored
4. Clear site data: DevTools → Application → Clear storage → Clear site data
5. Refresh page
6. Connect wallet

**Expected Results**:

- Alerts restore from server
- Console shows: `[SYNC] Syncing alerts with server...`
- Console shows: `[SYNC] ✅ Sync complete: X downloaded, 0 uploaded`
- All previously created alerts appear in Dashboard

### Test Case 5: Offline Behavior

**Steps**:

1. Create alert while online
2. Disconnect network (DevTools → Network → Offline)
3. Try to create new alert

**Expected Results**:

- Alert saves to IndexedDB locally
- Console shows: `[SYNC] ⚠️ Failed to sync alerts to server: Failed to fetch`
- Alert appears in UI
- Reconnect network
- Console shows: `[SYNC] ✅ Alerts synced to server`

---

## Multi-Device Sync Testing

### Scenario 1: Desktop to Mobile Sync

**Setup**:

- Device A: Desktop computer
- Device B: Mobile phone (same wallet)

**Steps**:

1. **Desktop**: Create 2-3 alerts
2. **Mobile**: Connect same wallet
3. **Mobile**: Open Dashboard

**Expected Results**:

- Mobile shows all alerts created on desktop
- Console logs show sync activity
- Alerts appear immediately on mobile

### Scenario 2: Simultaneous Edit Conflict

**Setup**:

- Device A: Desktop (online)
- Device B: Laptop (same wallet, different browser)

**Steps**:

1. **Desktop**: Create alert named "Alert A"
2. **Laptop**: Create alert named "Alert B" (different alerts, no conflict)
3. Wait 10 seconds
4. Both devices refresh

**Expected Results**:

- Both devices show both alerts
- No data loss

**Conflict Test**:

1. **Desktop**: Edit Alert A name to "Desktop Edit"
2. **Laptop** Edit Alert A name to "Laptop Edit" (within 30 seconds)
3. Both devices refresh

**Expected Results**:

- Last edit wins (based on timestamp)
- Console logs show conflict resolution
- No duplicate alerts

### Scenario 3: Delete Propagation

**Steps**:

1. **Desktop**: Delete Alert A
2. **Laptop**: Refresh Dashboard

**Expected Results**:

- Alert A removed from Laptop
- No errors in console

---

## Performance Testing

### Test Case 1: Large Alert Set

**Steps**:

1. Create 100 alerts via script
2. Measure sync time
3. Verify all alerts synced

**Script**:

```javascript
// Run in browser console with wallet connected
for (let i = 0; i < 100; i++) {
  const alert = {
    id: `bulk-alert-${i}`,
    name: `Bulk Alert ${i}`,
    walletAddress: `0x${String(i).padStart(40, "0")}`,
    createdAt: Date.now(),
  };
  // Trigger alert creation through your app's API
}
```

**Expected Results**:

- Sync completes within 10 seconds
- No memory leaks
- UI remains responsive

### Test Case 2: Sync Latency

**Steps**:

1. Measure time from alert creation to server sync
2. Use browser DevTools Performance tab

**Expected Results**:

- Local IndexedDB save: < 100ms
- Server sync: < 2 seconds
- Total time: < 2.5 seconds

---

## Edge Cases

### Test Case 1: Invalid Wallet Address

**Steps**:

1. Attempt to sync with invalid wallet
2. Try to create alert without wallet connected

**Expected Results**:

- Graceful error handling
- User-friendly error messages
- No app crashes

### Test Case 2: Network Interruption

**Steps**:

1. Start creating alert
2. Disconnect network mid-creation
3. Reconnect network

**Expected Results**:

- Alert saves locally
- Sync retries automatically on reconnect
- No data loss

### Test Case 3: Concurrent Syncs

**Steps**:

1. Trigger multiple sync operations simultaneously
2. Monitor for race conditions

**Script**:

```javascript
// Run in browser console
const promises = [];
for (let i = 0; i < 10; i++) {
  promises.push(syncAlerts(YOUR_WALLET_ADDRESS));
}
await Promise.all(promises);
```

**Expected Results**:

- All syncs complete successfully
- No duplicate alerts created
- No database corruption

### Test Case 4: Malformed Data

**Steps**:

1. Inject malformed data into IndexedDB
2. Trigger sync

**Expected Results**:

- Malformed data skipped gracefully
- Valid data still syncs
- No app crashes

---

## Troubleshooting

### Common Issues

**Issue**: Alerts not syncing
**Solutions**:

- Check wallet connection
- Verify API endpoints are accessible
- Check console for errors
- Verify DATABASE_URL is set

**Issue**: Duplicate alerts after sync
**Solutions**:

- Check alert ID uniqueness
- Verify conflict resolution logic
- Check console for sync details

**Issue**: Slow sync performance
**Solutions**:

- Check network speed
- Verify database indexes
- Check Neon database performance

### Debug Logging

Enable detailed logging:

```javascript
// In browser console
localStorage.setItem("debug_sync", "true");
```

View sync state:

```javascript
// Check IndexedDB
await db.alerts.toArray();

// Check server state
fetch("/api/alerts/user?wallet=YOUR_WALLET")
  .then((r) => r.json())
  .then(console.log);
```

---

## Test Results Checklist

Use this checklist to track testing progress:

### Unit Tests

- [ ] All sync function tests pass
- [ ] Conflict resolution tests pass
- [ ] Error handling tests pass
- [ ] Edge case tests pass

### Integration Tests

- [ ] GET /api/alerts/user passes
- [ ] POST /api/alerts/user passes
- [ ] DELETE /api/alerts/user passes
- [ ] POST /api/alerts/sync passes
- [ ] Input validation works
- [ ] SQL injection protection works

### Manual Tests

- [ ] Create alert syncs to server
- [ ] Update alert syncs to server
- [ ] Delete alert syncs to server
- [ ] Browser data clearing restores alerts
- [ ] Offline mode works correctly

### Multi-Device Tests

- [ ] Desktop to mobile sync works
- [ ] Conflict resolution works
- [ ] Delete propagation works
- [ ] Cross-browser sync works

### Performance Tests

- [ ] 100 alerts sync in < 10 seconds
- [ ] Single alert syncs in < 2 seconds
- [ ] UI remains responsive during sync
- [ ] No memory leaks

---

## Sign-Off Criteria

The alert sync feature is ready for production when:

1. **All Tests Pass**: 100% of unit and integration tests pass
2. **Manual Tests Pass**: All manual test cases pass successfully
3. **Performance Meets Requirements**: Sync times within specified limits
4. **No Critical Bugs**: No data loss, corruption, or security vulnerabilities
5. **Documentation Complete**: This testing guide is complete and accurate
6. **Code Review Passed**: Code has been reviewed and approved

---

## Reporting Bugs

When reporting bugs, include:

1. **Environment**: Browser, OS, wallet provider
2. **Steps to Reproduce**: Detailed reproduction steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happened
5. **Console Logs**: Error messages and warnings
6. **Network Requests**: Failed API calls (from Network tab)
7. **Screenshots**: If applicable

**Bug Report Template**:

```markdown
### Environment

- Browser: Chrome 120
- OS: macOS 14
- Wallet: MetaMask

### Steps to Reproduce

1. Connect wallet
2. Create alert
3. Disconnect network
4. Reconnect network

### Expected Behavior

Alert should sync to server on reconnect

### Actual Behavior

Alert remains local only

### Console Logs

[ERROR] SYNC: Failed to sync alerts to server: NetworkError

### Network Requests

POST /api/alerts/sync - 500 Internal Server Error
```
