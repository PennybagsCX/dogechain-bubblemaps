# Arc Mobile Diagnostic Build - Testing Instructions

**Build**: #129
**Date**: 2026-01-10
**Status**: 🧪 Ready for Testing
**Production URL**: https://dogechain-bubblemaps.vercel.app

---

## Overview

Build #129 is a **diagnostic build** designed to identify the root cause of the Arc Browser mobile token search failure. This build includes comprehensive logging to trace exactly what happens when you search for a token on Arc mobile.

---

## Problem Summary

**User Issue**: Token search fails on Arc Browser mobile only, showing error "No active holders found or API limit reached"

**Working Platforms**: Desktop Arc, Chrome, Safari, and all other tested browsers

**What We Know**:

- ✅ Token search API works when tested directly (returns results)
- ✅ Token holder API works when tested directly (returns 10 holders)
- ✅ CSP allows all required API endpoints
- ❌ Arc mobile still shows the error

**Hypothesis**: Browser cache or Service Worker serving old JavaScript bundle

---

## What's New in Build #129

### Diagnostic Logging

The app now logs detailed information to the browser console:

1. **Browser Detection** 📱
   - Detects Arc Browser mobile specifically
   - Logs platform, vendor, and user agent
   - Identifies mobile vs desktop

2. **Token Search Flow** 🔍
   - Logs search query and type
   - Shows token data response (address, symbol, name, decimals, totalSupply)
   - Indicates if token data is NULL

3. **Token Holder Fetch** 🔄
   - Logs when fetching holders starts
   - Shows results count (wallets and links)
   - Displays first 3 wallets with address, balance, and label

4. **Arc Mobile Specific** 🎯
   - Special error message for Arc mobile users
   - Helpful cache-clearing instructions
   - Additional debug context when error occurs

---

## Testing Instructions

### Step 1: Clear Browser Cache (CRITICAL!)

**Before testing, you MUST clear your browser cache on Arc mobile:**

1. Open Arc Browser on mobile
2. Tap the Arc menu (three dots or hamburger menu)
3. Go to **Settings** or **History**
4. Find **"Clear Browsing Data"** or **"Clear Cache"**
5. Select **"Cached images and files"**
6. Tap **"Clear"** or **"Delete"**

**Alternative**: Force refresh the page

- Visit the site
- Pull down to refresh (hard refresh)
- Or close and reopen Arc completely

### Step 2: Open Developer Console

**Note**: Arc mobile may not have a built-in DevTools console. If not available:

- Use a remote debugging tool (if available)
- Or proceed with testing and report what you see on screen

### Step 3: Test Token Search

1. Open: https://dogechain-bubblemaps.vercel.app
2. Click in the search box
3. Type: "DOGE"
4. **Wait for search results to appear in dropdown**
5. Select a token (e.g., "Wrapped WDOGE (WWDOGE)")
6. **Wait for token page to load**

### Step 4: Check Console Logs

If you have access to the console, look for these log messages:

```
[App] 🔍 Fetching token data for query: "0x...", type: TOKEN
[App] 📱 Browser Info: {
  userAgent: "Mozilla/5.0 ...",
  isArcMobile: true,
  isArc: true,
  isMobile: true,
  platform: "iPhone",
  vendor: "Apple Computer, Inc."
}
[App] 📦 Token data response: {
  address: "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
  symbol: "WWDOGE",
  name: "Wrapped WDOGE",
  type: "TOKEN",
  decimals: 18,
  totalSupply: 6508188.356
}
[App] 🔄 Fetching token holders for WWDOGE...
[App] 📊 Token holders result: {
  walletsCount: 10,
  linksCount: 0,
  wallets: [
    { address: "0x...", balance: 1234.56, label: "LP Pool (DogeSwap)" },
    ...
  ]
}
```

### Step 5: Report Back

**Please provide the following information:**

1. **Did token search work?**
   - ✅ Search dropdown appeared
   - ✅ Shows tokens like "Wrapped WDOGE (WWDOGE)", "Shiba Inu (SHIB)", etc.
   - ❌ No search results appeared
   - ❌ Error appeared immediately

2. **What console logs do you see?**
   - Copy and paste ALL console output
   - Include red errors
   - Include the `[App]` diagnostic logs

3. **What error message appears on screen?**
   - Screenshot if possible
   - Exact text of the toast message

4. **Did you clear your cache?**
   - Yes/No
   - Which method did you use?

---

## Expected Behavior

### ✅ GOOD - Working Correctly

**Console Logs**:

```
[App] 📱 Browser Info: { isArcMobile: true, isMobile: true }
[App] 📦 Token data response: { address: "0x...", symbol: "WWDOGE", ... }
[App] 🔄 Fetching token holders for WWDOGE...
[App] 📊 Token holders result: { walletsCount: 10, linksCount: 0 }
```

**On Screen**: Token visualization appears with bubbles showing token holders

### ❌ BAD - Error Occurred

**Console Logs**:

```
[App] 📱 Browser Info: { isArcMobile: true, isMobile: true }
[App] 📦 Token data response: { address: "0x...", symbol: "WWDOGE", ... }
[App] 🔄 Fetching token holders for WWDOGE...
[App] 📊 Token holders result: { walletsCount: 0, linksCount: 0 }
[App] ❌ No wallets found. Token holders API returned empty result.
[App] 📋 Debug info: {
  tokenAddress: "0x...",
  tokenSymbol: "WWDOGE",
  isArcMobile: true,
  originalWalletsCount: 0,
  finalWalletsCount: 0
}
```

**On Screen**: Toast message says:

> "No active holders found. If you're on Arc mobile, please clear your browser cache and refresh (Arc menu → Clear Browsing Data)."

---

## Troubleshooting

### Issue: Still seeing error after clearing cache

**Try these steps in order:**

1. **Force close Arc app**
   - Swipe up from bottom (iOS) or use recent apps (Android)
   - Swipe Arc away to close completely
   - Reopen Arc and try again

2. **Use incognito/private mode**
   - Open a new incognito tab in Arc
   - Visit the site and try searching
   - If this works, it's definitely a cache issue

3. **Check network connection**
   - Make sure you have a stable internet connection
   - Try on WiFi if on mobile data
   - Try on mobile data if on WiFi

4. **Uninstall and reinstall Arc** (last resort)
   - This will clear ALL data including service workers
   - Test the site immediately after reinstalling

---

## What the Logs Will Tell Us

Based on the console logs you provide, I can identify:

1. **Is the browser detection working?**
   - If `isArcMobile: false`, detection failed
   - If `isArcMobile: true`, detection worked

2. **Is token data being fetched correctly?**
   - If token data is NULL, the issue is in token search
   - If token data has valid values, search is working

3. **Is the token holder API returning data?**
   - If `walletsCount: 0`, the API is returning empty results
   - If `walletsCount: > 0`, the API is working

4. **Is this a caching issue?**
   - If incognito mode works, it's a cache problem
   - If all browsers fail, it's an API issue

---

## Next Steps After Testing

### Scenario A: Cache Issue (Most Likely)

**If incognito works but normal mode doesn't:**

- The fix is to clear cache or use incognito
- I can add cache-busting headers to prevent this in the future

### Scenario B: API Issue

**If console shows `walletsCount: 0`:**

- The API is returning empty results
- Need to investigate the backend API
- May need to check API rate limiting or blocking

### Scenario C: JavaScript Error

**If console shows red errors:**

- There's a JavaScript error preventing the app from working
- Need the exact error message to fix it
- May be Arc-specific compatibility issue

---

## Contact & Support

Please report back with:

1. Console log output (full text)
2. Screenshots of any errors
3. Whether cache clearing helped
4. Whether incognito mode works

This will help me identify the exact issue and implement a proper fix.

---

**Implementation by**: Claude (AI Assistant)
**Date**: 2026-01-10
**Build**: #129 (Diagnostic)
