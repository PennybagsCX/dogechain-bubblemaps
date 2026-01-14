# Known Issues - Dexscreener Chart Integration

**Last Updated:** January 12, 2026
**Feature:** Embedded Dexscreener Charts in Dashboard
**Status:** Documented Limitations

## Critical Issues

### 1. GeckoTerminal Completely Blocked by X-Frame-Options

**Severity:** Critical (Feature Removed)
**Status:** By Design - GeckoTerminal fallback removed

**Description:**
GeckoTerminal cannot be embedded in iframes due to `X-Frame-Options: sameorigin` HTTP header. All iframe embedding attempts are blocked by the browser's security policy.

**Console Error:**

```
Refused to display 'https://www.geckoterminal.com/' in a frame because it set 'X-Frame-Options' to 'sameorigin'.
```

**Impact:**

- GeckoTerminal fallback mechanism was completely non-functional
- Charts are Dexscreener-only implementation
- No alternative chart source available

**Resolution:**

- Removed all GeckoTerminal code from EmbeddedChart component
- Simplified to Dexscreener-only approach (working solution)
- See: `components/EmbeddedChart.tsx` (Dexscreener-only implementation)

**Related Files:**

- `components/EmbeddedChart.tsx` - Simplified to single source
- `utils/chartUrls.ts` - GeckoTerminal utilities unused but available for future

---

## Console Warnings (Cosmetic - Safe to Ignore)

### 2. Dexscreener React Hydration Warnings

**Severity:** Cosmetic (Console flooding only)
**Status:** Cannot fix from our side (cross-origin iframe limitation)

**Description:**
Dexscreener's internal React app throws hydration warnings when loaded in iframe context. This is internal to Dexscreener's code and does not affect chart functionality.

**Console Errors:**

```
Warning: Expected server HTML to contain a matching <main> in <div>.
Warning: An error occurred during hydration. The server HTML was replaced with client content in <div>.
Uncaught Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

**Impact:**

- Console flooded with warnings during chart load
- Charts display correctly despite warnings
- No functional impact on users
- Visual rendering is unaffected

**Root Cause:**
Dexscreener uses Next.js with server-side rendering. When loaded in a cross-origin iframe, the server-rendered HTML doesn't match the client-side React hydration.

**Resolution:**

- Document as known issue
- Cannot suppress from our side (cross-origin iframe)
- Accept as cosmetic limitation of iframe embedding

**Verification:**
Charts load and display correctly. Open browser DevTools Console to verify warnings are cosmetic only.

---

### 3. WebSocket 403 Errors (Live Updates May Not Work)

**Severity:** Minor (Feature limitation)
**Status:** Acceptable - static chart still displays

**Description:**
Dexscreener's WebSocket connection fails with 403 authentication error when embedded in cross-origin iframe. Real-time price updates may not function.

**Console Error:**

```
WebSocket connection to 'wss://io.dexscreener.com/dex/screener/v6/pair/dogechain/...' failed:
Error during WebSocket handshake: Unexpected response code: 403
```

**Impact:**

- Real-time price updates may not work in iframe context
- Static price chart still displays correctly
- Historical data is visible
- Users can click "External Link" button to see live updates on Dexscreener

**Root Cause:**
WebSocket authentication fails when Dexscreener is embedded in cross-origin iframe. The WebSocket server expects requests from dexscreener.com origin only.

**Resolution:**

- Accept as limitation of iframe embedding
- Provide "External Link" button for full Dexscreener experience
- Static chart provides sufficient value for quick glance

**Workaround:**
Users can click the external link button to open Dexscreener in a new tab for live updates.

---

### 4. Cross-Origin Frame Access Warnings (Expected Security Behavior)

**Severity:** Informational (By design)
**Status:** Expected browser security behavior

**Description:**
Browser prevents cross-origin frame access between parent app and Dexscreener iframe. This is expected and correct security behavior.

**Console Warnings:**

```
Blocked a frame with origin "http://localhost:3000" from accessing a cross-origin frame
```

**Impact:**

- None - this is expected security behavior
- Our app doesn't need to access iframe contents
- All communication is one-way (parent → iframe via URL)

**Resolution:**

- By design - not an issue
- Browser security working as intended
- No action needed

---

## Testing Limitations

### 5. Dashboard Requires Wallet Connection

**Severity:** Testing limitation
**Status:** By design - app requires wallet for dashboard access

**Description:**
The Dashboard view requires wallet connection (`userAddress` state) before displaying. This prevents automated testing without wallet connection.

**Code Location:**
`App.tsx` lines 2662-2684:

```tsx
{view === ViewState.DASHBOARD && (
  <div className="flex flex-col min-h-full">
    {!userAddress ? (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Wallet Connection Required</h2>
        <p className="text-slate-400 max-w-md mb-8">
          Please connect your wallet to access the Dashboard and manage your alerts.
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    ) : (
      <Dashboard
        alerts={alerts}
        statuses={alertStatuses}
        ...
      />
    )}
  </div>
)}
```

**Impact:**

- Cannot test chart integration without connecting wallet
- Test alerts can be added to IndexedDB, but Dashboard won't display
- Manual testing requires wallet connection

**Resolution:**

- Use manual testing with real wallet connection
- See `CHART_TESTING_GUIDE.md` for testing instructions
- Test alerts script provided for post-connection testing

**Testing Approach:**

1. Connect wallet (use testnet or burner wallet)
2. Run browser console script to add test alerts
3. Refresh Dashboard to see charts
4. See `CHART_TESTING_GUIDE.md` for detailed testing checklist

---

## Performance Considerations

### 6. Multiple Charts Impact Page Performance

**Severity:** Minor (Performance consideration)
**Status:** Monitoring needed

**Description:**
Loading multiple Dexscreener iframes simultaneously impacts page performance. Each iframe:

- Loads ~2-5MB of JavaScript (Dexscreener's React app)
- Establishes separate network connections
- Consumes memory for iframe isolation

**Observed Behavior:**

- 1-2 charts: Smooth performance
- 3+ charts: Noticeable page weight increase
- 5+ charts: Potential scroll lag on low-end devices

**Mitigation:**

- Charts are collapsed by default (no iframe load until expanded)
- Only one iframe loads at a time per chart
- Users can collapse charts to free resources

**Recommendation:**

- Monitor user feedback on performance with multiple charts
- Consider adding "Collapse All Charts" button if issues reported
- Lazy loading already implemented (charts only load when expanded)

---

## Security Considerations

### 7. Iframe Sandbox Configuration

**Severity:** Informational (Security by design)
**Status:** Properly configured

**Current Configuration:**

```tsx
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  referrerPolicy="no-referrer"
  ...
/>
```

**Description:**
Iframe sandbox restricts Dexscreener's capabilities to:

- `allow-scripts`: Required for chart rendering
- `allow-same-origin`: Required for Dexscreener's internal API calls
- `allow-forms`: Required for Dexscreener's interactive features
- `allow-popups`: Required for Dexscreener's external links

**Security Trade-offs:**

- `allow-same-origin` gives Dexscreener full same-origin access within its iframe
- This is necessary for Dexscreener to function
- Our app's origin is isolated from iframe content

**Resolution:**

- Current configuration is appropriate for third-party embedding
- `referrerPolicy="no-referrer"` prevents leaking our app's URL
- No sensitive data is passed to Dexscreener via URL (only public pair addresses)

---

## Future Enhancements

### Potential Improvements

1. **Add Chart Timeframe Selector**
   - Allow users to select chart timeframe (1H, 4H, 1D, 1W)
   - Would require Dexscreener URL parameter support
   - Check Dexscreener embedding documentation for available options

2. **Fullscreen Chart Mode**
   - Add button to expand chart to fullscreen overlay
   - Better for detailed analysis
   - Consider mobile UX (already responsive)

3. **Chart Caching**
   - Cache iframe state to prevent reload on collapse/expand
   - Trade-off: higher memory usage vs. faster UX
   - Consider user preference setting

4. **Alternative Chart Sources**
   - Research other platforms that allow iframe embedding
   - DEXTools, TradingView (if API available)
   - Keep GeckoTerminal code in `chartUrls.ts` for future use

5. **Error Recovery UI**
   - Add user-friendly error messages when Dexscreener is down
   - Provide "Report Issue" button for tracking outages
   - Consider retry mechanism with exponential backoff

---

## Documentation

### Related Files

- `components/EmbeddedChart.tsx` - Main chart component (Dexscreener-only)
- `components/Dashboard.tsx` - Integration with alert table
- `utils/chartUrls.ts` - URL construction utilities (GeckoTerminal code retained for future)
- `CHART_TESTING_GUIDE.md` - Comprehensive testing instructions
- `TOOLTIP_POSITIONING_FIX.md` - Tooltip positioning fixes (related UI work)

### Testing Resources

- `utils/testData.ts` - Mock test alerts generator
- `CHART_TESTING_GUIDE.md` - Step-by-step testing checklist
- Browser console script in `CHART_TESTING_GUIDE.md` for adding test alerts

---

## Summary

The Dexscreener chart integration is **functionally complete** with the following status:

| Issue                        | Severity | Status     | Action Required                    |
| ---------------------------- | -------- | ---------- | ---------------------------------- |
| GeckoTerminal blocked        | Critical | Resolved   | Removed fallback, Dexscreener-only |
| React hydration warnings     | Cosmetic | Accepted   | Document as known issue            |
| WebSocket 403 errors         | Minor    | Accepted   | Static chart still works           |
| Cross-origin warnings        | Info     | Expected   | By design, not an issue            |
| Dashboard wallet requirement | Testing  | By design  | Manual testing required            |
| Multiple charts performance  | Minor    | Monitoring | Acceptable for current use         |

**Overall Assessment:** The feature works as intended. Console warnings are cosmetic and do not affect functionality. The primary limitation (no GeckoTerminal fallback) is resolved with a working Dexscreener-only implementation.

**Recommendation:** Proceed with production deployment. Monitor user feedback for performance issues with multiple charts. Consider future enhancements listed above based on user demand.
