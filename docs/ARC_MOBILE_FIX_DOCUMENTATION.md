# Arc Browser Mobile Token Search Fix - Complete Documentation

**Date**: January 11, 2026
**Build**: #141-142
**Status**: ✅ Resolved

## Executive Summary

Fixed critical issues preventing token search, trending tokens, and token holder data from loading on Arc Browser mobile (iOS). The root cause was **missing API endpoints** and **incorrect API URL configurations**.

## Problem Description

### Symptoms

1. **Token Search Failed**: Searching for tokens (e.g., "DOGE") returned "No tokens found"
2. **Trending Tokens Empty**: Trending section showed dummy/fallback data instead of real tokens
3. **Holder Fetch Failed**: Clicking tokens showed "No active holders found or API limit reached"
4. **Platform Specific**: Issues occurred **only** on Arc Browser mobile (iOS)
   - Safari mobile: ✅ Working
   - Arc desktop: ✅ Working
   - Chrome desktop: ✅ Working
   - Arc mobile iOS: ❌ Broken

### User Impact

- Users couldn't search for tokens
- No trending token data visible
- Token visualization completely broken on Arc mobile
- API calls failing silently with network errors

## Root Cause Analysis

### Issue 1: Missing `/api/dogechain-proxy` Endpoint

**Problem**:

```typescript
// dataService.ts was calling:
const EXPLORER_API_V1 = `${API_BASE}/api/dogechain-proxy`;
// Where API_BASE = https://dogechain-bubblemaps-api.vercel.app
// Result: 404 Not Found
```

**Why It Failed**:

- The `/api/dogechain-proxy` endpoint **didn't exist** anywhere
- App was calling the API server instead of the frontend app
- All token metadata, transfers, and holder fetches failed

**Evidence from Logs**:

```json
{
  "consoleLogs": [
    { "level": "warn", "message": "Network error on attempt 1. Retrying after 1000ms..." },
    { "level": "warn", "message": "Network error on attempt 2. Retrying after 2000ms..." },
    { "level": "warn", "message": "fetchMetadataFromTokenList failed: {}" },
    { "level": "warn", "message": "fetchMetadataFromTransfers failed: {}" }
  ]
}
```

### Issue 2: Wrong Database Table in `/api/trending`

**Problem**:

```typescript
// api/trending.ts was querying:
SELECT * FROM trending_tokens  // ❌ Table doesn't exist
// Should be:
SELECT * FROM learned_tokens     // ✅ Has 235 tokens
```

**Impact**:

- Trending API returned empty array
- Search index initialized with 0 tokens
- No search suggestions available

### Issue 3: Wrong API Base URL for Trending

**Problem**:

```typescript
// services/trendingService.ts:
const apiBase = getApiBaseUrl();
fetch(`${apiBase}/api/trending`); // Called API server
// Should be:
fetch(`/api/trending`); // Relative to same app
```

**Impact**:

- Trending tokens endpoint called wrong domain
- 404 errors on every trending fetch
- Fallback to dummy INITIAL_TRENDING data

## Solution Implemented

### Fix 1: Created `/api/dogechain-proxy` Endpoint

**File**: `api/dogechain-proxy.ts` (new)

**Purpose**: Proxy requests to Dogechain Blockscout Explorer APIs to bypass CORS restrictions

**Implementation**:

```typescript
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Get proxy parameters
  const module = url.searchParams.get("module");
  const action = url.searchParams.get("action");
  const path = url.searchParams.get("path");

  // Build target URL
  let targetUrl = "";

  if (path) {
    // V2 API with path parameter
    targetUrl = `${BLOCKSCOUT_API_BASE}${path}`;
  } else if (module && action) {
    // V1 API with module/action
    targetUrl = `${BLOCKSCOUT_API_BASE}/api?module=${module}&action=${action}`;
  }

  // Forward request to Blockscout
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0...",
      Accept: "*/*",
    },
  });

  return Response.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
```

**Features**:

- ✅ Proxies V1 API (module/action format)
- ✅ Proxies V2 API (path format)
- ✅ Adds CORS headers for mobile browsers
- ✅ Caches responses for 60 seconds
- ✅ Proper error handling

### Fix 2: Fixed `dataService.ts` URLs

**File**: `services/dataService.ts`

**Changed**:

```typescript
// ❌ BEFORE (wrong):
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const EXPLORER_API_V1 = `${API_BASE}/api/dogechain-proxy`;
const EXPLORER_API_V2 = `${API_BASE}/api/dogechain-proxy`;

// ✅ AFTER (correct):
const EXPLORER_API_V1 = "/api/dogechain-proxy";
const EXPLORER_API_V2 = "/api/dogechain-proxy";
```

**Why This Matters**:

- Uses relative URL (same app) instead of absolute URL (API server)
- Endpoint exists in the frontend app, not the API server
- Works on all browsers including mobile

### Fix 3: Fixed `/api/trending` Database Query

**File**: `api/trending.ts`

**Changed**:

```typescript
// ❌ BEFORE:
assets = await sql`
  SELECT * FROM trending_tokens  // Doesn't exist
  ORDER BY popularity_score DESC
  LIMIT ${limit.toString()}
`;

// ✅ AFTER:
assets = await sql`
  SELECT
    address,
    symbol,
    name,
    type,
    COALESCE(popularity_score, 0) as velocity_score,
    holder_count,
    source
  FROM learned_tokens  // Has 235 tokens!
  ORDER BY popularity_score DESC NULLS LAST, last_seen_at DESC
  LIMIT ${limit.toString()}
`;
```

**Impact**:

- Returns 235 real tokens from database
- Populates search index properly
- Aliases `popularity_score` to `velocity_score` for frontend compatibility

### Fix 4: Fixed Trending API URL

**File**: `services/trendingService.ts`

**Changed**:

```typescript
// ❌ BEFORE:
const apiBase = getApiBaseUrl();
const response = await fetch(`${apiBase}/api/trending?...`);

// ✅ AFTER:
const response = await fetch(`/api/trending?...`);
```

**Why**:

- Endpoint is in the same app, not on API server
- Relative URL ensures correct routing

## Technical Details

### API Architecture

```
Frontend App (dogechain-bubblemaps.vercel.app)
│
├── /api/trending          → Queries learned_tokens table (PostgreSQL)
├── /api/dogechain-proxy  → Proxies to Blockscout Explorer API
└── /api/log-diagnostics  → Stores diagnostic logs (PostgreSQL)
    /api/get-diagnostics  → Retrieves diagnostic logs

API Server (dogechain-bubblemaps-api.vercel.app)
│
└── (No API endpoints used by frontend)
```

### Database Schema

**Table: `learned_tokens`**

```sql
CREATE TABLE learned_tokens (
  id SERIAL PRIMARY KEY,
  address VARCHAR NOT NULL,
  name VARCHAR,
  symbol VARCHAR,
  decimals INTEGER,
  type VARCHAR,  -- 'TOKEN' or 'NFT'
  scan_frequency INTEGER,
  holder_count INTEGER,
  discovery_timestamp TIMESTAMP,
  last_seen_at TIMESTAMP,
  popularity_score NUMERIC,
  source VARCHAR,
  is_verified BOOLEAN
);
-- 235 tokens stored
```

### API Call Flow (After Fix)

```
User clicks token → Frontend App
    ↓
fetchMetadataFromTokenList()
    ↓
GET /api/dogechain-proxy?module=token&action=getToken&contractaddress=...
    ↓
Dogechain Proxy (api/dogechain-proxy.ts)
    ↓
Fetches https://explorer.dogechain.dog/api?module=token&...
    ↓
Returns token metadata to frontend
    ↓
Token data displayed ✅
```

## Testing & Verification

### Manual Testing Steps

1. **Clear Browser Cache**
   - Arc menu → Clear Browsing Data
   - Critical: Removes old broken JavaScript

2. **Load Application**
   - Visit: https://dogechain-bubblemaps.vercel.app
   - Wait 5-10 seconds for initialization

3. **Verify Trending Tokens**
   - Should see 235 real tokens
   - Should not show dummy data

4. **Test Token Search**
   - Type "FUCKPEPE" or "TEST"
   - Should see autocomplete suggestions
   - Select token → should load

5. **Verify Holder Data**
   - Click any trending token
   - Should see wallet connections
   - Should not see "No holders found" error

### API Endpoint Testing

```bash
# Test proxy endpoint
curl "https://dogechain-bubblemaps.vercel.app/api/dogechain-proxy?module=token&action=getToken&contractaddress=0xa6d7137af64280e3eb8715ab6766740984dd35e7"

# Expected response:
{
  "message": "OK",
  "result": {
    "name": "FUCK PEPE",
    "symbol": "FUCKPEPE",
    "decimals": "9",
    "type": "ERC-20"
  },
  "status": "1"
}

# Test trending endpoint
curl "https://dogechain-bubblemaps.vercel.app/api/trending?type=ALL&limit=3"

# Expected response:
{
  "success": true,
  "assets": [
    {
      "address": "0xa6d7137af64280e3eb8715ab6766740984dd35e7",
      "symbol": "FUCKPEPE",
      "name": "FUCK PEPE",
      "type": "TOKEN",
      "velocity_score": "8.00"
    }
  ]
}
```

## Prevention Guidelines

### 1. API Endpoint Checklist

When adding new API endpoints:

- ✅ **Create endpoint file** in `/api` directory
- ✅ **Use relative URLs** in service files (not `API_BASE`)
- ✅ **Test endpoint** returns data (not 404)
- ✅ **Add CORS headers** if accessed from browser
- ✅ **Document database tables** used

### 2. Database Query Checklist

When writing database queries:

- ✅ **Verify table exists** before querying
- ✅ **Use correct table names** (check schema)
- ✅ **Handle NULL values** with COALESCE
- ✅ **Add proper indexes** for performance
- ✅ **Test query** returns real data

### 3. URL Configuration Checklist

When configuring API URLs:

- ✅ **Use relative URLs** for same-app endpoints
- ✅ **Use absolute URLs** only for external APIs
- ✅ **Never assume API_BASE** points to correct server
- ✅ **Test on mobile browsers** (iOS/Android)
- ✅ **Check CSP headers** allow the domain

### 4. Common Pitfalls to Avoid

❌ **Don't**:

```typescript
// Calling API server for frontend endpoints
const url = `${API_BASE}/api/endpoint`;

// Querying non-existent tables
SELECT * FROM table_that_doesnt_exist;

// Assuming environment variables are set
const url = process.env.API_URL;  // Might be undefined
```

✅ **Do**:

```typescript
// Use relative URLs for same-app endpoints
const url = "/api/endpoint";

// Query verified tables
SELECT * FROM learned_tokens;  // Verified to exist

// Add fallbacks for undefined values
const url = apiBase || "/api/endpoint";
```

## Related Issues & Solutions

### Issue: "Network Error" on Mobile Browsers

**Symptoms**: Generic network errors, CORS failures, silent fetch failures

**Root Causes**:

1. Missing CORS headers
2. Calling wrong domain (API server vs frontend)
3. Endpoint doesn't exist (404)
4. CSP blocking the request

**Solutions**:

1. Add proper CORS headers:

   ```typescript
   headers: {
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Methods": "GET, OPTIONS",
     "Access-Control-Allow-Headers": "Content-Type, Authorization",
   }
   ```

2. Use relative URLs for same-app endpoints
3. Create missing endpoints
4. Add domains to CSP in `vercel.json`

### Issue: Token Search Returns No Results

**Symptoms**: "No tokens found", empty search results

**Root Causes**:

1. Search index empty (0 tokens indexed)
2. Trending API returning empty array
3. Database table has no data
4. Wrong table queried

**Solutions**:

1. Populate search index with real tokens
2. Fix trending API to return data
3. Verify database has data
4. Use correct table names in queries

## Monitoring & Maintenance

### Diagnostic Logging

The app includes comprehensive diagnostic logging:

**Logger**: `lib/consoleLogger.ts`

- Captures all console output
- Tracks token searches
- Monitors holder fetch attempts
- Records errors
- Auto-sends logs every 30 seconds

**Viewing Logs**:

```bash
curl "https://dogechain-bubblemaps.vercel.app/api/get-diagnostics?limit=10"
```

**Database**: `diagnostic_logs` table

- 7-day automatic cleanup
- Indexed by session_id and timestamp
- Stores console logs, searches, fetches, errors

### Health Checks

Regular monitoring tasks:

1. **Check API endpoints**:

   ```bash
   curl "https://dogechain-bubblemaps.vercel.app/api/trending"
   curl "https://dogechain-bubblemaps.vercel.app/api/dogechain-proxy?..."
   ```

2. **Check database tables**:

   ```sql
   SELECT COUNT(*) FROM learned_tokens;
   SELECT COUNT(*) FROM diagnostic_logs;
   ```

3. **Check recent diagnostic logs**:
   - Look for "Network error" patterns
   - Check for 404 errors
   - Monitor token search success rate

## Files Changed

### Build #141 (Critical Fixes)

1. **Created**: `api/dogechain-proxy.ts`
   - New proxy endpoint for Blockscout Explorer API
   - Handles V1 and V2 API formats
   - Adds CORS headers

2. **Modified**: `services/dataService.ts`
   - Changed EXPLORER_API_V1/V2 to use relative URLs
   - Removed dependency on API_BASE

3. **Modified**: `api/trending.ts`
   - Changed table from `trending_tokens` to `learned_tokens`
   - Added velocity_score alias
   - Added NULL handling with COALESCE
   - Added Edge runtime URL parsing fallback

4. **Modified**: `services/trendingService.ts`
   - Changed from `${apiBase}/api/trending` to `/api/trending`
   - Uses relative URL for same-app endpoint

### Build #142 (CI Fix)

1. **Modified**: `api/dogechain-proxy.ts`
   - Removed unused `limit` variable (TypeScript error)

## References

### Documentation

- [Remote Diagnostic Logging Guide](./REMOTE_DIAGNOSTIC_LOGGING_GUIDE.md)
- [CSP Configuration](../vercel.json)
- [API Reference](./docs/API_REFERENCE.md)

### Related Commits

- `feat: Migrate diagnostic logging from Vercel KV to PostgreSQL` (Build #136)
- `fix: Add Web3Modal URLs to CSP` (Build #134)
- `fix: Fix Prettier formatting issues` (Build #132)

### External Resources

- [Vercel Edge Runtime Documentation](https://vercel.com/docs/functions/edge-runtime)
- [CORS MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Arc Browser iOS](https://arc.net/)

## Conclusion

This fix resolved multiple interconnected issues:

1. Missing proxy endpoint causing all API failures
2. Wrong database table causing empty trending data
3. Incorrect URL configurations causing 404 errors

**Key Takeaway**: Always verify that:

- API endpoints exist before calling them
- Database tables exist before querying them
- URLs point to the correct server (frontend vs API)
- Changes work on mobile browsers, not just desktop

**Status**: ✅ Resolved - All functionality working on Arc Browser mobile
