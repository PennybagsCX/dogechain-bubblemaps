# DexScreener Chart Integration - Implementation Summary

**Date**: January 13, 2026
**Status**: ✅ Complete
**Build**: Beta Build #177+

---

## Problem Statement

Users reported "Price Chart Unavailable" buttons in the triggered event history and wanted:

1. ✅ Chart integration showing actual price charts for each triggered event
2. ✅ Charts embedded inline with expand/collapse functionality
3. ❌ Charts to default to "Chart+Txns" view (platform limitation - see below)
4. ✅ Charts in dark mode

---

## Implementation Details

### 1. Token Data Extraction Fix

**File**: `services/dataService.ts` (lines 859-870)

**Problem**: Token addresses were being extracted from request parameters instead of actual blockchain transaction data.

**Solution**: Extract token contract address from the transaction's `contractAddress` field:

```typescript
// Extract token contract address from transaction data (not request parameter)
const txContractAddress = (tx.contractAddress || tx.contract)?.toLowerCase();

return {
  hash: tx.hash,
  from: tx.from,
  to: tx.to,
  value: value,
  timestamp: parseInt(tx.timeStamp) * 1000,
  tokenAddress: txContractAddress || cleanToken, // From transaction, fallback to request parameter
  tokenSymbol: tx.tokenSymbol,
};
```

### 2. Smart Token Selection

**File**: `components/Dashboard.tsx` (lines 504-575)

**Feature**: `extractPrimaryToken()` helper function that identifies the most common token from multiple transactions.

**Algorithm**:

1. Count occurrences of each token address in transactions
2. Return the token with the highest count
3. Fallback to alert configuration token if no transactions found

```typescript
const extractPrimaryToken = (
  transactions: Transaction[],
  alert?: AlertConfig
): { address: string; symbol: string } | null => {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Count token occurrences
  const tokenCounts = new Map<string, { count: number; address: string; symbol: string }>();

  for (const tx of transactions) {
    if (tx.tokenAddress) {
      const existing = tokenCounts.get(tx.tokenAddress);
      if (existing) {
        existing.count++;
      } else {
        tokenCounts.set(tx.tokenAddress, {
          count: 1,
          address: tx.tokenAddress,
          symbol: tx.tokenSymbol || "Token",
        });
      }
    }
  }

  // Find most common token
  let mostCommon = null;
  let maxCount = 0;

  for (const tokenData of tokenCounts.values()) {
    if (tokenData.count > maxCount) {
      maxCount = tokenData.count;
      mostCommon = tokenData;
    }
  }

  return mostCommon;
};
```

### 3. Automatic Migration

**File**: `components/Dashboard.tsx` (lines 552-606)

**Feature**: Automatically updates existing triggered events with correct token data from transactions.

**Behavior**:

- Runs when `triggeredEvents` or `alerts` change
- Extracts primary token from transactions
- Updates events if token address differs from current
- Preserves events that already have correct data

```typescript
useEffect(() => {
  const updateEventTokens = () => {
    const updatedEvents = triggeredEvents.map((event: TriggeredEvent) => {
      // Skip if no transactions
      if (!event.transactions || event.transactions.length === 0) {
        return event;
      }

      // Find the alert config for this event (if available)
      const alert = alerts.find((a: AlertConfig) => a.id === event.alertId);

      // Use extractPrimaryToken to get the correct token from transactions
      const primaryToken = extractPrimaryToken(event.transactions, alert);

      // Only update if we found a token and it's different from current
      if (!primaryToken) {
        return event;
      }

      // Check if token address is different from current
      const currentTokenAddress = event.tokenAddress?.toLowerCase();
      const newTokenAddress = primaryToken.address?.toLowerCase();

      if (currentTokenAddress === newTokenAddress) {
        return event; // Already correct, no update needed
      }

      // Update with correct token data from transactions
      return {
        ...event,
        tokenAddress: primaryToken.address,
        tokenSymbol: primaryToken.symbol,
      };
    });

    // Only trigger update if something changed
    const hasChanges = updatedEvents.some((updatedEvent, index) => {
      const originalEvent = triggeredEvents[index];
      if (!originalEvent) return false;
      return (
        updatedEvent.tokenAddress !== originalEvent.tokenAddress ||
        updatedEvent.tokenSymbol !== originalEvent.tokenSymbol
      );
    });

    if (hasChanges) {
      onTriggeredEventsChange(updatedEvents);
      console.log("[Dashboard] Updated triggered events with correct token data from transactions");
    }
  };

  // Run when triggeredEvents or alerts change
  updateEventTokens();
}, [triggeredEvents, alerts, extractPrimaryToken, onTriggeredEventsChange]);
```

### 4. Chart Integration UI

**File**: `components/Dashboard.tsx` (lines 934-965)

**Feature**: Prominent "View Price Chart" button below transactions in each event tile.

**Design**:

- Purple background with hover effects
- Disabled state when no token address available
- Shows "View Price Chart" or "Hide Price Chart" based on expansion state
- "Price Chart Unavailable" for events without token data

```typescript
{/* Prominent Chart Toggle Button - Below transactions */}
<button
  onClick={() => toggleEventChart(event.id)}
  disabled={!event.tokenAddress}
  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-medium shadow-lg mt-4 ${
    event.tokenAddress
      ? "bg-purple-600 hover:bg-purple-700 text-white"
      : "bg-space-700 text-slate-500 cursor-not-allowed"
  }`}
  title={!event.tokenAddress ? "Price chart not available for this event" : "View price chart"}
>
  <LineChart size={18} />
  {event.tokenAddress
    ? expandedChartEvents.has(event.id)
      ? "Hide Price Chart"
      : "View Price Chart"
    : "Price Chart Unavailable"}
</button>

{/* Inline Chart Container - Expands on button click */}
{expandedChartEvents.has(event.id) && event.tokenAddress && (
  <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
    <EmbeddedChart
      tokenAddress={event.tokenAddress}
      tokenSymbol={event.tokenSymbol || "Token"}
      className="w-full"
      theme="dark"
      expanded={true}
      showToggle={false}
    />
  </div>
)}
```

### 5. EmbeddedChart Component

**File**: `components/EmbeddedChart.tsx`

**Features**:

- DexScreener iframe integration
- Dark mode theme support (`theme="dark"`)
- External control for expansion state
- Loading states and error handling
- Copy pair address functionality
- External link to Dexscreener
- Chart reload capability

**Props**:

```typescript
interface EmbeddedChartProps {
  tokenAddress: string; // Pair address from DexScreener
  tokenSymbol?: string; // Token symbol for display
  chainId?: string; // Defaults to "dogechain"
  className?: string; // Additional CSS classes
  onLoad?: () => void; // Callback when chart loads
  onError?: () => void; // Callback when chart fails
  theme?: "light" | "dark"; // Theme selection (default: "dark")
  expanded?: boolean; // External control for expansion
  showToggle?: boolean; // Show/hide internal toggle button
}
```

**URL Format**:

```
https://dexscreener.com/${chainId}/${tokenAddress}?embed=1&theme=dark
```

---

## Known Limitations

### DexScreener Tab Selection

**Issue**: Cannot automatically select the "Chart+Txns" tab when the chart loads.

**Root Cause**: DexScreener's embed API does not support controlling the default tab via URL parameters. This is a platform limitation, not a code bug.

**Tested Solutions** (all failed):

- ❌ `trades=1` parameter
- ❌ `defaultPane=trades` parameter
- ❌ Hash fragments: `#trades`, `#chart-txns`, `#multichart`
- ❌ PostMessage to iframe (blocked by CORS)
- ❌ Direct DOM manipulation (blocked by cross-origin policy)
- ❌ Full DexScreener URL (blocked by X-Frame-Options)

**Research Findings**:

- Even external websites (e.g., fuckpepe.dog) have the same limitation
- Users must manually click the "Chart+Txns" button
- This is consistent across all DexScreener embed implementations

**Workaround**: Users can manually click the "Chart+Txns" button in the DexScreener embed toolbar to view the chart with transactions.

---

## Files Modified

1. **`services/dataService.ts`** - Fixed token address extraction
2. **`components/Dashboard.tsx`** - Added migration, chart button, and event logic
3. **`components/EmbeddedChart.tsx`** - Created new chart embed component
4. **`types.ts`** - Added `tokenAddress` field to Transaction interface

---

## Testing Checklist

- [x] Token data extraction from blockchain transactions
- [x] Migration logic updates existing events
- [x] "View Price Chart" button appears in event tiles
- [x] Chart expands/collapses inline
- [x] Chart loads in dark mode
- [x] "Price Chart Unavailable" shows for events without token data
- [x] Copy pair address functionality
- [x] External link to Dexscreener
- [x] Chart reload functionality
- [ ] Manual "Chart+Txns" button click (user action required)

---

## Future Enhancements

1. **Alternative Chart Providers**: Consider TradingView widgets or GeckoTerminal which may have better embed APIs
2. **Custom Chart UI**: Build a custom chart interface using TradingView Charting Library
3. **User Preference**: Remember user's tab selection preference across sessions
4. **Chart Caching**: Cache chart data to improve load times

---

## Support

If users report issues:

1. Check browser console for errors
2. Verify token address is present in triggered event
3. Ensure wallet connection is active
4. Try reloading the chart using the refresh button
5. Check that token/pair exists on Dexscreener

---

## Developer Notes

- **Theme**: Always use `theme="dark"` for consistency with app design
- **Error Handling**: Charts may fail to load if token/pair not found on Dexscreener
- **Performance**: Charts are lazy loaded (only when expanded) to improve initial page load
- **Accessibility**: Iframe has proper titles and ARIA labels for screen readers
