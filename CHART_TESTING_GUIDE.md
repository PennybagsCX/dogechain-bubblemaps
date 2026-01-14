# Embedded Chart Testing Guide

**Created:** January 12, 2026
**Feature:** Dexscreener Chart Integration
**Status:** Ready for Testing

## Overview

This guide provides instructions for testing the embedded Dexscreener chart integration with mock test alerts, since real alerts may not have fired yet.

## Quick Start (3 Minutes)

### Step 1: Add Test Alerts

Open your browser's Developer Console (F12 or Cmd+Option+I) and paste the following script:

```javascript
(async () => {
  const DB_NAME = "DogechainBubbleMapsDB";
  const DB_VERSION = 16;

  const testAlerts = [
    {
      alertId: "test-wdoge-001",
      name: "wDOGE Test Alert",
      walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      tokenAddress: "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
      tokenSymbol: "wDOGE",
      tokenName: "Wrapped Doge",
      threshold: 5000000000,
      initialValue: 10000000000,
      createdAt: Date.now(),
    },
    {
      alertId: "test-doge-002",
      name: "DOGE Bridge Pool Alert",
      walletAddress: "0x3525ed5f48eb3a3a0442dbb72a5ee48f749f7b07",
      tokenAddress: "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
      tokenSymbol: "wDOGE",
      tokenName: "Wrapped Doge",
      threshold: 10000000000,
      initialValue: 50000000000,
      createdAt: Date.now(),
    },
    {
      alertId: "test-eth-003",
      name: "wETH Test Alert",
      walletAddress: "0x73b5298c6c1a31b29b2234ab19d3a4a5a0810149",
      tokenAddress: "0xb65043c45b24122b0b7984ffed87fd7bcf9fdf68",
      tokenSymbol: "wETH",
      tokenName: "Wrapped Ethereum",
      threshold: 1000000000000000000,
      initialValue: 5000000000000000000,
      createdAt: Date.now(),
    },
  ];

  try {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => console.warn("[Test] Database open blocked - close other tabs");
    });

    const tx = db.transaction(["alerts", "alertStatuses"], "readwrite");
    const alertsStore = tx.objectStore("alerts");
    const statusesStore = tx.objectStore("alertStatuses");

    // Clear existing test alerts
    const existingAlerts = await new Promise((resolve, reject) => {
      const request = alertsStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const alert of existingAlerts) {
      if (alert.alertId.startsWith("test-")) {
        alertsStore.delete(alert.id);
        statusesStore.delete(alert.alertId);
      }
    }

    // Add test alerts
    for (const alert of testAlerts) {
      await new Promise((resolve, reject) => {
        const request = alertsStore.put(alert);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise((resolve, reject) => {
        const request = statusesStore.put({
          alertId: alert.alertId,
          currentValue: alert.initialValue || 0,
          triggered: false,
          checkedAt: Date.now(),
          notified: false,
          lastSeenTransactions: [],
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      console.log(`[Test] Added: ${alert.name} (${alert.tokenSymbol})`);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    console.log("[Test] ✓ Successfully added 3 test alerts!");
    console.log("[Test] Refresh the Dashboard to see charts.");
  } catch (error) {
    console.error("[Test] ✗ Failed to add test alerts:", error);
  }
})();
```

### Step 2: Navigate to Dashboard

1. Click on the **Dashboard** button in the navigation
2. You should see 3 test alerts displayed in the alert table
3. Each alert row should have a **"View [Token] Chart"** button below it

### Step 3: Test Chart Expansion

1. Click the **"View wDOGE Chart"** button on the first alert
2. The chart should expand with a smooth slide-in animation
3. You should see:
   - Loading spinner while Dexscreener iframe loads
   - Dexscreener price chart embedded in the page
   - Toolbar with **Reload**, **External Link**, and **Copy** buttons
   - "Dexscreener" label in the toolbar

## Testing Checklist

### UI/UX Tests

- [ ] **Chart Expansion**
  - [ ] Click "View Chart" button - chart expands smoothly
  - [ ] Loading spinner appears during iframe load
  - [ ] Chart displays after loading completes
  - [ ] Button text changes to "Hide Chart" with up chevron icon

- [ ] **Chart Collapse**
  - [ ] Click "Hide Chart" button - chart collapses smoothly
  - [ ] Button text changes to "View Chart" with down chevron icon
  - [ ] Chart height is responsive on mobile/tablet/desktop

- [ ] **Toolbar Buttons**
  - [ ] **Reload button**: Click to reload the iframe (shows loading spinner)
  - [ ] **External Link button**: Opens Dexscreener in new tab
  - [ ] **Copy button**: Copies pair address to clipboard, shows "Copied!" feedback

- [ ] **Keyboard Shortcuts**
  - [ ] Press **Escape** key when chart is expanded - chart collapses
  - [ ] Press Escape when chart is collapsed - nothing happens

- [ ] **Multiple Charts**
  - [ ] Expand multiple charts simultaneously - all should display correctly
  - [ ] Collapse individual charts - others remain expanded
  - [ ] Page performance should remain smooth with 3+ charts

### Functional Tests

- [ ] **Iframe Loading**
  - [ ] Dexscreener chart loads successfully
  - [ ] No visible errors or broken UI elements
  - [ ] Chart displays price data and trading information

- [ ] **External Links**
  - [ ] External link button opens correct Dexscreener pair page
  - [ ] URL format: `https://dexscreener.com/dogechain/{pairAddress}`
  - [ ] Opens in new tab (noopener, noreferrer for security)

- [ ] **Copy Address**
  - [ ] Copy button copies pair address to clipboard
  - [ ] Button shows "Copied!" text for 2 seconds
  - [ ] Button text changes back to "Copy" after 2 seconds
  - [ ] Console log confirms successful copy

### Performance Tests

- [ ] **Load Time**
  - [ ] Initial chart expansion takes < 3 seconds
  - [ ] Subsequent expansions use cached iframe (instant)

- [ ] **Multiple Charts**
  - [ ] Expand 3+ charts - page remains responsive
  - [ ] Scroll smoothly with multiple charts expanded
  - [ ] No memory leaks or performance degradation

- [ ] **Memory**
  - [ ] Collapsed charts don't leak memory
  - [ ] Re-expanding charts doesn't duplicate iframes

### Edge Cases

- [ ] **Error Handling**
  - [ ] If Dexscreener fails to load, error indicator appears
  - [ ] Reload button attempts to recover from errors
  - [ ] User can still collapse an errored chart

- [ ] **Network Issues**
  - [ ] If offline, chart shows loading state indefinitely
  - [ ] Reload button retries connection when back online

## Known Issues (Expected Behavior)

### Console Warnings (Cosmetic - Safe to Ignore)

1. **Dexscreener React Hydration Warnings**

   ```
   Warning: Expected server HTML to contain a matching <main> in <div>
   Warning: An error occurred during hydration
   ```

   - **Cause**: Internal to Dexscreener's React app
   - **Impact**: Console warnings only, chart displays correctly
   - **Status**: Cannot fix from our side (cross-origin iframe)

2. **WebSocket 403 Errors**

   ```
   WebSocket connection to 'wss://io.dexscreener.com/...' failed: Error during WebSocket handshake: Unexpected response code: 403
   ```

   - **Cause**: WebSocket auth fails in cross-origin iframe
   - **Impact**: Real-time price updates may not work
   - **Status**: Static chart still displays, live updates are iframe limitation

3. **Cross-Origin Frame Access**

   ```
   Blocked a frame with origin "http://localhost:3000" from accessing a cross-origin frame
   ```

   - **Cause**: Browser security prevents cross-origin iframe access
   - **Impact**: None - expected security behavior
   - **Status**: By design, not an error

### GeckoTerminal Removed

- **Status**: GeckoTerminal fallback has been completely removed
- **Reason**: X-Frame-Options: sameorigin blocks all iframe embedding
- **Impact**: Charts are Dexscreener-only (working solution)
- **Documentation**: See `/docs/KNOWN_ISSUES.md` for details

## Test Data Details

### Mock Test Alerts

| Alert Name             | Token Symbol | Pair Address                               | Wallet Address                             |
| ---------------------- | ------------ | ------------------------------------------ | ------------------------------------------ |
| wDOGE Test Alert       | wDOGE        | 0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101 | 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb  |
| DOGE Bridge Pool Alert | wDOGE        | 0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101 | 0x3525ed5f48eb3a3a0442dbb72a5ee48f749f7b07 |
| wETH Test Alert        | wETH         | 0xb65043c45b24122b0b7984ffed87fd7bcf9fdf68 | 0x73b5298c6c1a31b29b2234ab19d3a4a5a0810149 |

### Dexscreener URLs

Charts load from:

```
https://dexscreener.com/dogechain/{pairAddress}
```

Example:

```
https://dexscreener.com/dogechain/0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101
```

## Cleanup

To remove test alerts after testing:

```javascript
(async () => {
  const DB_NAME = "DogechainBubbleMapsDB";
  const DB_VERSION = 16;

  try {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const tx = db.transaction(["alerts", "alertStatuses"], "readwrite");
    const alertsStore = tx.objectStore("alerts");
    const statusesStore = tx.objectStore("alertStatuses");

    // Get and delete all test alerts
    const allAlerts = await new Promise((resolve, reject) => {
      const request = alertsStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    let deletedCount = 0;
    for (const alert of allAlerts) {
      if (alert.alertId.startsWith("test-")) {
        alertsStore.delete(alert.id);
        statusesStore.delete(alert.alertId);
        deletedCount++;
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    console.log(`[Cleanup] ✓ Removed ${deletedCount} test alerts`);
  } catch (error) {
    console.error("[Cleanup] ✗ Failed:", error);
  }
})();
```

## Bug Reporting

If you find issues during testing, please report:

1. **Browser and version** (Chrome/Firefox/Safari + version)
2. **Screen size** (mobile/tablet/desktop)
3. **Steps to reproduce** the issue
4. **Expected vs actual behavior**
5. **Console errors** (copy full error messages)
6. **Screenshot** if visual issue

## Next Steps

After testing is complete:

1. Document any new issues found in `/docs/KNOWN_ISSUES.md`
2. Prioritize bug fixes vs. documentation updates
3. Consider if additional features are needed (e.g., chart timeframe selector, fullscreen mode)
4. Update this guide with any new test cases
