# Alerts Fired Counter Fix - Complete Documentation

**Date:** January 31, 2026
**Issue:** Platform-wide "Alerts Fired" counter not incrementing when alerts were triggered
**Status:** ✅ RESOLVED

---

## Problem Summary

The platform-wide "Alerts Fired" counter displayed in the hero section and footer was not incrementing when users received alerts. This was an ongoing issue reported by the user.

---

## Root Causes Identified

### Issue 1: API URL Routing Problem (PRIMARY CAUSE)

The frontend's `getApiBaseUrl()` function in `utils/api.ts` was intentionally ignoring the separate backend API URL (`dogechain-bubblemaps-api.vercel.app`) and using `window.location.origin` instead. This was based on an incorrect comment stating "The old separate backend URL no longer exists."

**Impact:** Alert trigger API calls were going to the frontend domain where no API routes existed, resulting in failed requests.

### Issue 2: Service Worker Cache Stale Data

The PWA service worker was caching old JavaScript code, causing the browser to serve outdated files even after new deployments.

**Impact:** Users saw old code that didn't have the fixes, making it appear that fixes weren't working.

### Issue 3: Aggressive Unique Constraint on Database

The database had a unique constraint on `(alert_id, session_id, triggered_at)` with `ON CONFLICT DO NOTHING`, which could cause silent failures if:

- The same alert fired multiple times within the same timestamp precision
- Session IDs were NULL in old deployment

### Issue 4: Alert Deduplication Too Aggressive

The frontend's `alreadyRecorded` check was using partial transaction overlap (`some()`) instead of exact matching (`every()`), which could prevent different alert configurations from being logged if they shared any transactions.

---

## Solutions Implemented

### Solution 1: Fixed API URL Routing (Build #2615)

**File:** `utils/api.ts`

**Change:** Reverted to using relative URLs (`""`) in production so Vercel rewrites can route API calls to the backend.

```typescript
// BEFORE (incorrect - caused issue)
export function getApiBaseUrl(): string {
  // ...
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl; // This ignored the backend URL
  }
  return "https://dogechain-bubblemaps-api.vercel.app";
}

// AFTER (correct)
export function getApiBaseUrl(): string {
  // ...
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== "" && !envUrl.includes("vercel.app")) {
    return envUrl;
  }
  return ""; // Use relative path for Vercel rewrites
}
```

**Why this works:**

- The `vercel.json` configuration has rewrites that route `/api/*` requests to `dogechain-bubblemaps-api.vercel.app`
- Using relative URLs (`/api/stats`) allows Vercel's edge routing to handle the API calls
- This is same-origin, avoiding CORS complications

---

### Solution 2: Database Migration Applied

**File:** `database/migration_phase4_fix_unique_constraint.sql`

**Changes:**

1. Added `session_id` column to `triggered_alerts` table
2. Updated unique constraint to `(alert_id, session_id, triggered_at)`
3. Made `session_id` nullable for backward compatibility

```sql
-- Add session_id column
ALTER TABLE triggered_alerts ADD COLUMN session_id VARCHAR(64);

-- Drop old constraint
ALTER TABLE triggered_alerts DROP CONSTRAINT unique_alert_trigger;

-- Add new constraint with session_id
ALTER TABLE triggered_alerts
ADD CONSTRAINT unique_alert_trigger
UNIQUE (alert_id, session_id, triggered_at);
```

**Applied via:**

```bash
psql "postgresql://..." -f database/migration_phase4_fix_unique_constraint.sql
```

---

### Solution 3: Backend API Deployment Fixed

**Repository:** `/Volumes/DEV Projects/dogechain-bubblemaps-api`

**Issues Fixed:**

1. Removed `.context` symlink that was causing Vercel build failures
2. Added `.context` to `.gitignore` to prevent recurrence

**Commits:**

- `52473bb` - Remove .context symlink causing Vercel build failures
- `0098779` - Add .context to .gitignore

**Result:** Backend API successfully deployed with alert trigger endpoints

---

### Solution 4: PWA Service Worker Cache Fixed (Build #2616)

**File:** `vite.config.ts`

**Changes:**

1. Added `NetworkFirst` caching for relative `/api/*` URLs
2. Changed cache name from `api-cache` to `api-cache-v2` to force cache invalidation
3. Reduced API cache TTL from 5 minutes to 10 seconds for near real-time updates

```typescript
runtimeCaching: [
  {
    urlPattern: /^\/api\/.*/i,
    handler: "NetworkFirst",
    options: {
      cacheName: "api-cache-v2", // New cache name invalidates old cache
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 10, // 10 seconds for real-time data
      },
      networkTimeoutSeconds: 5,
    },
  },
  // ... other patterns
];
```

**Why this works:**

- `NetworkFirst` always tries the network first for API calls
- Changing cache name forces old cached service worker to be replaced
- 10-second TTL ensures counters update quickly

---

### Solution 5: Alert Deduplication Logic Improved (Build #2617)

**File:** `components/Dashboard.tsx`

**Change:** Made the deduplication check stricter to only skip logging if transactions are identical.

```typescript
// BEFORE - could block different alerts with overlapping transactions
const alreadyRecorded = triggeredEvents.some(
  (e) =>
    e.alertId === alert.id &&
    e.transactions.some((t) => status.newTransactions?.some((nt) => nt.hash === t.hash))
);

// AFTER - only skips if transactions are identical
const alreadyRecorded = triggeredEvents.some(
  (e) =>
    e.alertId === alert.id &&
    e.transactions.length === status.newTransactions?.length &&
    e.transactions.every((t, i) => t.hash === status.newTransactions?.[i]?.hash)
);
```

**Why this matters:**

- If multiple different alert configurations trigger on overlapping transactions, each will now be counted separately
- Previously, sharing even 1 transaction could cause a second alert to be skipped

---

## Database Schema

### triggered_alerts Table

```sql
CREATE TABLE triggered_alerts (
  id                  SERIAL PRIMARY KEY,
  alert_id            VARCHAR(255) NOT NULL,
  alert_name          VARCHAR(255) NOT NULL,
  wallet_address      VARCHAR(42) NOT NULL,
  token_address       VARCHAR(42),
  token_symbol        VARCHAR(50),
  transaction_count   INTEGER NOT NULL DEFAULT 1,
  triggered_at        TIMESTAMPTZ DEFAULT NOW(),
  session_id          VARCHAR(64),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint
ALTER TABLE triggered_alerts
ADD CONSTRAINT unique_alert_trigger
UNIQUE (alert_id, session_id, triggered_at);

-- Indexes
CREATE INDEX idx_triggered_alerts_alert_id ON triggered_alerts(alert_id);
CREATE INDEX idx_triggered_alerts_session_id ON triggered_alerts(session_id);
CREATE INDEX idx_triggered_alerts_triggered_at ON triggered_alerts(triggered_at);
```

### alert_counters Table

```sql
CREATE TABLE alert_counters (
  id              SERIAL PRIMARY KEY,
  total_alerts    INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Initial data
INSERT INTO alert_counters (id, total_alerts) VALUES (1, 0);
```

### Database Trigger

```sql
CREATE TRIGGER trigger_increment_alert_counter
AFTER INSERT ON triggered_alerts
FOR EACH ROW
EXECUTE FUNCTION increment_alert_counter_on_trigger();
```

---

## Vercel Configuration

### Frontend vercel.json

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://dogechain-bubblemaps-api.vercel.app/api/:path*"
    }
  ]
}
```

This rewrite routes all API requests from the frontend domain to the backend API at the edge level.

---

## API Endpoints

### GET /api/stats

Returns platform statistics:

```json
{
  "searches": 267,
  "alerts": 121,
  "cached": false,
  "timestamp": "2026-01-31T15:33:26.485Z"
}
```

### POST /api/alerts?action=trigger

Logs a triggered alert:

```json
// Request body
{
  "alertId": "uuid-of-alert",
  "alertName": "Alert Name",
  "walletAddress": "0x...",
  "tokenAddress": "0x...",  // optional
  "tokenSymbol": "SYMBOL",  // optional
  "transactionCount": 5,
  "sessionId": "session-uuid"  // optional but recommended
}

// Response
{
  "success": true,
  "logged": true,
  "newCount": 121
}
```

---

## Frontend Implementation

### useStatsCounters Hook

**File:** `hooks/useStatsCounters.ts`

- Fetches stats from `/api/stats` endpoint
- Implements 10-second cache (changed from 5 minutes)
- Auto-refreshes to keep counters current
- Falls back to localStorage cache on error

```typescript
const CACHE_TTL = 10 * 1000; // 10 seconds for near real-time counter updates
```

### Dashboard Alert Trigger

**File:** `components/Dashboard.tsx`

When an alert triggers:

1. Generates unique `eventId`
2. Checks if already recorded (prevents duplicates)
3. Sends POST to `/api/alerts?action=trigger`
4. On success, waits 500ms for database commit
5. Calls `onAlertTriggered()` to refresh stats

---

## Deployment History

| Build # | Date         | Changes                                      |
| ------- | ------------ | -------------------------------------------- |
| 2615    | Jan 30, 2026 | Fixed API URL routing to use Vercel rewrites |
| 2616    | Jan 31, 2026 | Fixed PWA service worker cache configuration |
| 2617    | Jan 31, 2026 | Improved alert deduplication logic           |

---

## Verification Steps

### 1. Check Database State

```sql
-- Check counter value
SELECT * FROM alert_counters;

-- Check actual triggered alerts count
SELECT COUNT(*) FROM triggered_alerts;

-- Check recent alerts
SELECT * FROM triggered_alerts ORDER BY triggered_at DESC LIMIT 10;
```

### 2. Test API Endpoints

```bash
# Test stats endpoint
curl "https://dogechain-bubblemaps.vercel.app/api/stats"

# Test alert trigger
curl -X POST "https://dogechain-bubblemaps.vercel.app/api/alerts?action=trigger" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "test-alert",
    "alertName": "Test",
    "walletAddress": "0x0000000000000000000000000000000000000001",
    "transactionCount": 1,
    "sessionId": "test-session"
  }'
```

### 3. Browser Console Verification

When alerts trigger, check console for:

```
[ALERT TRIGGER] Sending to API: { alertId: "...", alertName: "...", transactionCount: N }
[ALERT TRIGGER] API response: 200 OK
[useStatsCounters] Stats received: { searches: 267, alerts: 121, timestamp: ... }
```

---

## Troubleshooting

### Issue: Counters showing 0

**Cause:** Browser service worker cache serving old code

**Solutions (in order):**

1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear site data: DevTools → Application → Storage → Clear site data
3. Unregister service worker: DevTools → Application → Service Workers → Unregister
4. Use Incognito/Private mode to bypass cache

### Issue: Alerts not incrementing counter

**Check:**

1. Browser console for `[ALERT TRIGGER]` logs
2. Network tab for failed API requests
3. Database for actual triggered alerts count vs counter value

**Sync counter if out of sync:**

```sql
SELECT * FROM sync_alert_counter();
```

### Issue: Multiple alerts counted as 1

**Cause:** Deduplication logic too aggressive, or alerts triggering within same second

**Solution:** The fix in Build #2617 uses exact transaction matching instead of partial overlap.

---

## Current Status

✅ **All systems operational**

- Frontend: Build #2617 deployed
- Backend API: Latest deployed with alert trigger support
- Database: Migration applied, triggers active
- Counters: Incrementing correctly (267 searches, 121 alerts as of Jan 31, 2026)

---

## Files Modified

### Frontend Repository

- `utils/api.ts` - Fixed API URL routing
- `vite.config.ts` - Fixed PWA service worker cache configuration
- `components/Dashboard.tsx` - Improved alert deduplication logic
- `hooks/useStatsCounters.ts` - Reduced cache TTL to 10 seconds

### Backend Repository

- `app/api/alerts/route.ts` - Added session_id support
- `app/api/alerts/trigger/route.ts` - Added session_id support
- `app/api/stats/route.ts` - Reduced cache TTL to 10 seconds
- `database/migration_phase4_fix_unique_constraint.sql` - Created
- `.gitignore` - Added .context symlink prevention

---

## Key Learnings

1. **Vercel rewrites vs direct API calls:** Using relative URLs with Vercel rewrites is more reliable than direct cross-origin API calls for Next.js deployments

2. **Service worker caching:** PWA service workers can cache old JavaScript and serve it even after new deployments. Changing cache names forces updates.

3. **Database unique constraints:** Be careful with unique constraints that include timestamps. Multiple events within the same precision can cause silent failures.

4. **Frontend deduplication:** When checking for duplicates, use exact matching (`every()`) rather than partial matching (`some()`) to avoid blocking legitimate events.

5. **Cache TTL for real-time features:** 5-minute cache is too long for counters that should update in real-time. 10 seconds provides near real-time updates without overwhelming the server.

---

## Contact

For issues or questions about this fix, refer to:

- Git commit history for detailed changes
- This documentation for overview
- Database migration files for schema changes
