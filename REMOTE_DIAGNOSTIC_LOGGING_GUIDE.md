# Remote Diagnostic Logging - User Guide

**Build**: #131
**Date**: 2026-01-10
**Status**: ✅ Deployed to Production
**Production URL**: https://dogechain-bubblemaps.vercel.app

---

## Overview

Build #131 implements a remote diagnostic logging system that automatically captures console output and diagnostic data from users' browsers without requiring manual console access. This is especially useful for debugging issues on mobile devices where console access is limited or unavailable.

---

## How It Works

### Data Flow

```
1. User opens site on Arc mobile
   ↓
2. Diagnostic logger initializes
   - Generates unique session ID
   - Starts capturing console output
   ↓
3. User performs actions (search, load token)
   ↓
4. Logger captures:
   - All console.log/warn/error calls
   - Token search attempts
   - Token holder fetches
   - JavaScript errors
   ↓
5. Logs auto-send every 30 seconds
   - Also sends on errors immediately
   - Sends on page close using sendBeacon
   ↓
6. Server stores logs in Vercel KV (7-day retention)
   ↓
7. Admin retrieves logs via API
```

---

## What Data Is Captured

### Browser Information

- **Session ID**: Unique identifier for the visit
- **User Agent**: Full browser user agent string
- **Platform**: iOS, Android, Windows, Mac, etc.
- **Vendor**: Apple, Google, etc.
- **isArcMobile**: Boolean (Arc Browser mobile detection)
- **isArc**: Boolean (Arc Browser detection)
- **isMobile**: Boolean (Mobile device detection)
- **Screen Resolution**: e.g., "390x844"
- **Viewport**: e.g., "390x680"
- **Network Status**: e.g., "4g", "3g", "unknown"
- **Language**: Browser language setting
- **URL**: Current page URL

### Console Output

- **All** console.log, console.error, console.warn, console.info calls
- Timestamps for each log entry
- Full arguments/objects logged

### Token Search Attempts

- Query string
- Token type (TOKEN/NFT)
- Timestamp
- Success/failure status
- Result count
- Error message (if failed)

### Token Holder Fetches

- Token address
- Token symbol
- Timestamp
- Success/failure status
- Wallets count
- Links count
- Error message (if failed)

### JavaScript Errors

- Error message
- Stack trace
- Timestamp
- Context (where it occurred)

---

## User Experience

### Visual Indicator

Users will see a small indicator in the bottom-left corner:

```
● Diagnostic Mode Active
```

- Green pulsing dot indicates active logging
- Text: "Diagnostic Mode Active"
- Semi-transparent black background
- Purple border

This transparency ensures users are aware their diagnostic data is being collected.

### What Users See

When users visit the site:

1. Logger initializes silently in background
2. "Diagnostic Mode Active" indicator appears
3. All console output is captured automatically
4. When they search for tokens or load a token page:
   - Actions are logged with full context
   - Logs auto-send to server every 30 seconds
   - If errors occur, logs send immediately
5. When they leave the page:
   - Final logs sent using sendBeacon
   - No data loss on page close

---

## Retrieving Diagnostic Logs

### Method 1: Get Recent Logs

```bash
curl "https://dogechain-bubblemaps.vercel.app/api/get-diagnostics?limit=50&offset=0"
```

**Parameters:**

- `limit`: Number of logs to return (default: 50, max: 100)
- `offset`: Number of logs to skip (for pagination)

**Response:**

```json
{
  "success": true,
  "count": 50,
  "logs": [
    {
      "data": {
        "sessionId": "session_1234567890_abc123",
        "timestamp": 1736500000000,
        "userAgent": "Mozilla/5.0...",
        "platform": "iPhone",
        "vendor": "Apple Computer, Inc.",
        "isArcMobile": true,
        "isArc": true,
        "isMobile": true,
        "consoleLogs": [...],
        "tokenSearches": [...],
        "tokenHolderFetches": [...],
        "errors": [...],
        "screenResolution": "390x844",
        "viewport": "390x680",
        "networkStatus": "4g",
        "language": "en-US",
        "url": "https://dogechain-bubblemaps.vercel.app/"
      },
      "receivedAt": "2026-01-10T12:00:00.000Z"
    }
  ]
}
```

### Method 2: Get Specific Session

```bash
curl "https://dogechain-bubblemaps.vercel.app/api/get-diagnostics?sessionId=session_1234567890_abc123"
```

**Use case:** When a user provides their session ID for debugging

### Method 3: Using Browser DevTools

1. Open https://dogechain-bubblemaps.vercel.app/api/get-diagnostics
2. Browser will display JSON response
3. Use DevTools JSON viewer for formatted output
4. Copy relevant session data

---

## Analyzing Diagnostic Logs

### Step 1: Identify the Session

Look for:

1. **Recent timestamp** (within last hour)
2. **Arc Mobile detection** (`isArcMobile: true`)
3. **Failed token holder fetch** (`walletsCount: 0`)

### Step 2: Review Console Logs

Look for:

```json
"consoleLogs": [
  {
    "level": "log",
    "message": "[App] 📊 Diagnostic logger initialized:",
    "timestamp": 1736500000000,
    "data": { "sessionId": "...", "browser": {...} }
  },
  {
    "level": "log",
    "message": "[App] 🔍 Fetching token data for query: \"0x...\"",
    "timestamp": 1736500050000
  },
  {
    "level": "error",
    "message": "[App] ❌ No wallets found. Token holders API returned empty result.",
    "timestamp": 1736500100000,
    "data": {...}
  }
]
```

### Step 3: Check Token Searches

```json
"tokenSearches": [
  {
    "query": "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
    "type": "TOKEN",
    "timestamp": 1736500050000,
    "success": true,
    "resultCount": 1
  }
]
```

### Step 4: Check Token Holder Fetches

```json
"tokenHolderFetches": [
  {
    "tokenAddress": "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
    "tokenSymbol": "WWDOGE",
    "timestamp": 1736500100000,
    "success": false,
    "walletsCount": 0,
    "linksCount": 0,
    "error": "No wallets found"
  }
]
```

### Step 5: Check for Errors

```json
"errors": [
  {
    "message": "No wallets found. Token holders API returned empty result.",
    "stack": "...",
    "timestamp": 1736500100000,
    "context": "App.tsx:994"
  }
]
```

---

## Common Patterns and Solutions

### Pattern 1: Token Search Fails

**Symptoms:**

```json
{
  "tokenSearches": [
    {
      "success": false,
      "error": "Token data is NULL"
    }
  ]
}
```

**Cause:** Token not found in API
**Solution:** Check token address is valid

### Pattern 2: Token Holder Fetch Returns Empty

**Symptoms:**

```json
{
  "tokenHolderFetches": [
    {
      "success": false,
      "walletsCount": 0,
      "error": "No wallets found"
    }
  ]
}
```

**Cause:** API returns empty holders
**Solution:**

- If Arc mobile only: Cache issue (clear cache)
- If all browsers: API issue (check backend)

### Pattern 3: Network Error

**Symptoms:**

```json
{
  "errors": [
    {
      "message": "Failed to fetch"
    }
  ],
  "networkStatus": "3g"
}
```

**Cause:** Poor network connectivity
**Solution:** User needs better connection

### Pattern 4: CSP Violation

**Symptoms:**

```json
{
  "consoleLogs": [
    {
      "level": "error",
      "message": "Refused to connect because it violates CSP"
    }
  ]
}
```

**Cause:** CSP blocking API calls
**Solution:** Update CSP in vercel.json

---

## Privacy and Data Retention

### What We Collect

- ✅ Browser type and version
- ✅ Screen resolution and viewport
- ✅ Platform (iOS/Android/Desktop)
- ✅ Console output
- ✅ Token search/fetch attempts
- ✅ JavaScript errors

### What We DON'T Collect

- ❌ IP addresses
- ❌ Location data
- ❌ Personal identifiers
- ❌ Wallet addresses (unless in search)
- ❌ Transaction history

### Data Retention

- **Retention Period**: 7 days
- **Auto-Delete**: Logs automatically deleted after 7 days
- **Manual Delete**: Can delete via KV dashboard

### User Consent

- Visual indicator shows "Diagnostic Mode Active"
- Users can opt-out by not using the site
- No sensitive data collected

---

## Troubleshooting

### Issue: No logs appearing

**Check:**

1. Is the site deployed? (https://dogechain-bubblemaps.vercel.app)
2. Are Vercel KV credentials configured?
3. Check server logs for errors

### Issue: Logs but no console output

**Check:**

1. Did user perform any actions? (search, load token)
2. Has it been 30 seconds since last action? (auto-send interval)
3. Did user close page immediately? (check for sendBeacon logs)

### Issue: Incomplete logs

**Check:**

1. Did page crash? (errors might not have sent)
2. Network issues? (logs might not have reached server)
3. CORS blocking? (check API endpoint accessibility)

---

## Testing the Diagnostic System

### Step 1: Deploy to Production

```bash
git push origin main
# Vercel auto-deploys on push
```

### Step 2: Test on Desktop

1. Open https://dogechain-bubblemaps.vercel.app
2. Check for "Diagnostic Mode Active" indicator
3. Open DevTools Console
4. Search for token "DOGE"
5. Wait 30 seconds or close page
6. Retrieve logs: `curl "https://dogechain-bubblemaps.vercel.app/api/get-diagnostics?limit=1"`
7. Verify your session appears in logs

### Step 3: Test on Arc Mobile

1. Open Arc mobile browser
2. Visit https://dogechain-bubblemaps.vercel.app
3. Check for "Diagnostic Mode Active" indicator
4. Search for token "DOGE"
5. Wait 30 seconds or close page
6. Report session ID to admin
7. Admin retrieves logs

### Step 4: Analyze Logs

1. Get logs from `/api/get-diagnostics`
2. Find the session by timestamp or user-provided ID
3. Review console logs, token searches, holder fetches
4. Identify failure point
5. Implement fix

---

## API Endpoints Reference

### POST /api/log-diagnostics

**Purpose:** Receive diagnostic logs from client

**Request:**

```json
{
  "sessionId": "session_1234567890_abc123",
  "timestamp": 1736500000000,
  "userAgent": "Mozilla/5.0...",
  "platform": "iPhone",
  "isArcMobile": true,
  "consoleLogs": [...],
  "tokenSearches": [...],
  "tokenHolderFetches": [...],
  "errors": [...]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Logs received successfully",
  "sessionId": "session_1234567890_abc123"
}
```

### GET /api/get-diagnostics

**Purpose:** Retrieve stored diagnostic logs

**Parameters:**

- `sessionId` (optional): Filter by session ID
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**

```json
{
  "success": true,
  "count": 10,
  "logs": [...]
}
```

---

## Next Steps After Analysis

### Based on Log Analysis

#### Scenario A: Cache Issue

**Evidence:**

- Console shows old code paths
- Token search uses old API endpoints
- `isArcMobile: true` but using old JavaScript

**Solution:**

1. User needs to clear browser cache
2. Implement cache-busting headers
3. Add version query parameter to JS bundle

#### Scenario B: API Issue

**Evidence:**

- `tokenHolderFetches` shows `walletsCount: 0` consistently
- API endpoints return 404 or 500 errors
- Network errors in console

**Solution:**

1. Check backend API health
2. Verify API rate limiting
3. Check for Arc mobile User-Agent blocking

#### Scenario C: JavaScript Error

**Evidence:**

- `errors` array has JavaScript exceptions
- Stack trace shows specific line numbers
- App crashes or freezes

**Solution:**

1. Fix JavaScript compatibility issue
2. Add polyfills for Arc mobile
3. Implement better error handling

---

## Files Reference

| File                     | Purpose                               |
| ------------------------ | ------------------------------------- |
| `lib/consoleLogger.ts`   | Console capture and remote logging    |
| `api/log-diagnostics.ts` | Server endpoint to receive logs       |
| `api/get-diagnostics.ts` | Server endpoint to retrieve logs      |
| `_types/diagnostics.ts`  | TypeScript types for diagnostic data  |
| `App.tsx`                | Integrated logger, added UI indicator |

---

## Support

For issues or questions:

1. Check this guide first
2. Review server logs for API errors
3. Test endpoints manually with curl
4. Check Vercel KV dashboard for stored data

---

**Implementation by**: Claude (AI Assistant)
**Date**: 2026-01-10
**Build**: #131
