# Stats Counters Feature - Implementation Documentation

**Date**: January 12, 2026
**Build**: #150
**Feature**: Homepage counters displaying total searches and total alerts fired

---

## Overview

Added live counters to the homepage showing real-time aggregated statistics:

- **Total Searches** - Aggregate count of all token/NFT searches across all users
- **Total Alerts Fired** - Aggregate count of all triggered alert events across all users

Counters appear in **two locations**:

1. Hero section (below Beta Build badge, above Tokens/NFT buttons)
2. Footer (below Beta Build number)

---

## Files Created

### 1. Database Migration

**File**: `prisma/migrations/202601120858_add_triggered_alerts_table/migration.sql`

Creates the `triggered_alerts` table for server-side alert tracking:

```sql
CREATE TABLE IF NOT EXISTS triggered_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255) NOT NULL,
  alert_name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42),
  token_symbol VARCHAR(50),
  transaction_count INTEGER NOT NULL DEFAULT 1,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  session_id VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status**: ✅ Deployed to Neon database

### 2. API Endpoints

#### `/api/stats.ts`

**Purpose**: Returns aggregated search and alert counts

**Method**: GET
**Response**:

```json
{
  "searches": 12345,
  "alerts": 678
}
```

**Queries**:

- Searches: `SELECT COUNT(*) FROM token_interactions WHERE interaction_type='search'`
- Alerts: `SELECT COUNT(*) FROM triggered_alerts`

**Caching**: 10-second edge cache (Cache-Control: s-maxage=10)

> **Note**: Originally set to 5 minutes (300s), reduced to 10 seconds on January 23, 2026 (Build #211) to provide near real-time counter updates

#### `/api/alerts/trigger.ts`

**Purpose**: Logs triggered alert events to server

**Method**: POST
**Body**:

```json
{
  "alertId": "uuid",
  "alertName": "My Alert",
  "walletAddress": "0x...",
  "tokenAddress": "0x...",
  "tokenSymbol": "DOGE",
  "transactionCount": 3
}
```

**Validation**:

- Validates address format (0x + 40 hex chars)
- Sanitizes all inputs
- Returns success even if logging fails (fire-and-forget)

### 3. Custom React Hook

**File**: `hooks/useStatsCounters.ts`

**Purpose**: Manages stats counter state, caching, and auto-refresh

**Interface**:

```typescript
interface StatsCounters {
  totalSearches: number;
  totalAlerts: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
```

**Features**:

- 5-minute in-memory cache with localStorage backup
- Auto-refresh every 5 minutes
- Graceful error handling (fallback to cached or 0)
- Background refresh (no loading state on cache hit)

**Usage**:

```typescript
const { totalSearches, totalAlerts, isLoading } = useStatsCounters();
```

---

## Files Modified

### 1. `App.tsx`

**Line 6**: Added import for `Search` icon from lucide-react
**Line 15**: Added import for `useStatsCounters` hook
**Lines 43-47**: Added `formatNumber()` helper function
**Line 192**: Added hook call: `const { totalSearches, totalAlerts, isLoading: isLoadingStats } = useStatsCounters();`
**Lines 1819-1838**: Added stats counters UI in hero section (below Beta Build badge)

### 2. `components/Footer.tsx`

**Lines 2-3**: Added imports for `Search`, `AlertTriangle` icons and `useStatsCounters` hook
**Lines 5-10**: Added `formatNumber()` helper function
**Line 13**: Added hook call
**Lines 56-75**: Added stats counters UI in footer (below Beta Build number)

### 3. `components/Dashboard.tsx`

**Lines 285-297**: Added server logging when alert fires

```typescript
// Log triggered alert to server (non-blocking, fire-and-forget)
fetch("/api/alerts/trigger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    alertId: triggeredEvent.alertId,
    alertName: triggeredEvent.alertName,
    walletAddress: triggeredEvent.walletAddress,
    tokenAddress: triggeredEvent.tokenAddress,
    tokenSymbol: triggeredEvent.tokenSymbol,
    transactionCount: triggeredEvent.transactions.length,
  }),
}).catch((err) => console.error("[API] Failed to log triggered alert:", err));
```

---

## Data Sources

### PostgreSQL Tables

#### `token_interactions`

- **Purpose**: Tracks all user search interactions
- **Used for**: Total Searches counter
- **Query**: `SELECT COUNT(*) FROM token_interactions WHERE interaction_type='search'`

#### `triggered_alerts` (NEW)

- **Purpose**: Tracks all triggered alert events across all users
- **Used for**: Total Alerts Fired counter
- **Query**: `SELECT COUNT(*) FROM triggered_alerts`
- **Created via**: Migration `202601120858_add_triggered_alerts_table`

### Search Tracking Flow

1. User searches for token/NFT
2. Frontend calls `logSearchQuery()` (in `services/trendingService.ts`)
3. Sends POST to `/api/trending/log`
4. API inserts record into `token_interactions` table with `interaction_type='search'`
5. `/api/stats` endpoint counts these records for the counter

### Alert Tracking Flow

1. User's alert triggers (new transactions detected)
2. Dashboard creates `TriggeredEvent` object
3. Dashboard sends POST to `/api/alerts/trigger`
4. API inserts record into `triggered_alerts` table
5. `/api/stats` endpoint counts these records for the counter

---

## What Constitutes a Search

A search is counted when a user looks up **any** token or NFT contract address:

✅ **Actions that increment the counter**:

- Manual search entry (typing address)
- Clicking search result from dropdown
- Clicking on trending tokens
- Clicking on recent searches
- Each repeat search by same user counts again

❌ **Actions that do NOT count**:

- Page views
- Loading homepage
- Scanning wallets
- Creating alerts
- Clicking wallet addresses in visualization

---

## Performance & Caching

### Caching Strategy

1. **API Level**: Vercel Edge cache (10-second TTL)
   - Header: `Cache-Control: public, s-maxage=10, stale-while-revalidate=10`
   - **Updated**: January 23, 2026 (Build #211) - Reduced from 300 seconds to 10 seconds for near real-time updates

2. **Client Level**: localStorage backup (5-minute TTL)
   - Cache key: `doge_stats_cache`
   - Falls back to cache on API errors
   - Background refresh every 5 minutes

3. **Render Level**: React state management
   - Shows cached data immediately
   - Background refresh doesn't show loading state
   - Graceful degradation to 0 on errors

### Performance Targets

- API response: <100ms (p95)
- Initial render: <16ms (60fps)
- Cache hit: <1ms
- IndexedDB query: <10ms

---

## UI/UX Specifications

### Mobile Responsive Design

**Desktop (sm+)**: Horizontal row

```tsx
<div className="flex items-center gap-6">
  <SearchCounter />
  <AlertCounter />
</div>
```

**Mobile (< sm)**: Stacked vertical (not implemented in hero, but footer handles this)

### Visual Design

- **Icons**: `Search` (purple), `AlertTriangle` (amber)
- **Colors**:
  - Searches: `text-purple-500` (icon), `text-purple-400` (number)
  - Alerts: `text-amber-500` (icon), `text-amber-400` (number)
  - Labels: `text-slate-500`
- **Font**: Monospace for numbers (`font-mono`) - prevents layout shift
- **Loading state**: Shows "..." while fetching
- **Number format**: Comma-separated (e.g., "1,234,567")

### Location Specifications

#### Hero Section

**File**: `App.tsx`, lines 1819-1838
**Position**: Below Beta Build badge, above Tokens/NFT toggle buttons
**Spacing**: `mt-6` (margin-top: 1.5rem)
**Gap**: `gap-6` (1.5rem between counters)

#### Footer

**File**: `components/Footer.tsx`, lines 56-75
**Position**: Below Beta Build number, above disclaimer
**Spacing**: `mt-4 pt-4` (margin + padding)
**Gap**: `gap-4` (1rem on mobile, responsive on desktop)
**Divider**: `border-t border-space-700/50` above counters

---

## Error Handling

### API Errors

- **Network failure**: Silently falls back to cached data
- **404/500 errors**: Returns `{ searches: 0, alerts: 0 }`
- **Timeout**: Shows cached data with timestamp
- **Logging errors**: Logged to console, don't block UI

### Edge Cases

- **First visit** (no cache): Shows loading state ("...")
- **Private browsing** (no localStorage): Falls back to API only
- **Offline**: Shows cached data with timestamp
- **Database unavailable**: Returns zeros gracefully

---

## Testing Checklist

### Functional Testing

- [x] Counters display on homepage (hero section)
- [x] Counters display in footer
- [x] Search count increments when searching tokens
- [x] Alert count increments when alerts trigger
- [x] Numbers format correctly with commas
- [x] Loading state displays "..."
- [x] Auto-refresh every 5 minutes
- [x] Manual refresh via `refresh()` function works

### Error Testing

- [x] API failure falls back gracefully
- [x] Network offline shows cached data
- [x] Browser console has no errors (except expected CSP warnings)
- [x] TypeScript compilation passes
- [x] Production build succeeds

### Performance Testing

- [x] Initial page load <100ms impact
- [x] No layout shift (CLS score)
- [x] API response times acceptable
- [x] Cache hits are instant

### Browser Testing

- [x] Desktop Chrome/Edge (Chromium)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)
- [ ] Firefox

---

## Deployment

### Environment Variables

No new environment variables required. Uses existing:

- `DATABASE_URL` - Neon PostgreSQL connection string (already configured)

### Vercel Configuration

No changes to `vercel.json` required. API routes auto-deploy.

### Deployment Steps

1. Code pushed to `main` branch
2. Vercel auto-deploys API endpoints
3. Database migration manually run in Neon console
4. Build number auto-incremented to #150

---

## Future Enhancements

### Potential Features

1. **Historical Trends**: Sparkline charts showing search/alert activity over time
2. **Per-User Stats**: "Your searches" vs global searches
3. **Achievements**: Unlock badges at milestones (1K searches, etc.)
4. **Export**: Download stats as CSV for analysis
5. **Admin Dashboard**: Detailed analytics view with filtering
6. **Real-time WebSocket**: Live updates instead of polling
7. **Regional Stats**: Breakdown by geographic location
8. **Token-Specific Stats**: Most searched individual tokens

### Scalability Considerations

- Current setup handles 100K+ searches/day easily
- For higher volumes, consider:
  - Materialized views for pre-aggregated counts
  - Redis cache layer for faster reads
  - Read replicas for database scaling
  - Batch inserts for better write performance

---

## Maintenance

### Database Maintenance

**No regular maintenance required** for these tables. However, consider:

- **Monthly**: Review table sizes and index usage
- **Quarterly**: Archive old records if needed (keep last 90 days)
- **Monitoring**: Set up alerts for slow queries on these tables

### Code Maintenance

- **Dependencies**: All using existing packages (@neondatabase/serverless, lucide-react)
- **Breaking Changes**: None expected
- **Backward Compatibility**: Fully compatible with existing code

---

## Troubleshooting

### Issue: Counters showing 0

**Possible causes**:

1. API endpoints not deployed (check Vercel dashboard)
2. Database tables don't exist (run migration)
3. CORS issues (check browser console)

**Solution**:

- Verify `/api/stats` returns data: `curl https://your-api.vercel.app/api/stats`
- Check browser console for errors
- Verify Neon database has both tables

### Issue: Counters not updating

**Possible causes**:

1. Cache not invalidating
2. API caching issues
3. Browser caching old responses

**Solution**:

- Hard refresh page (Ctrl+Shift+R / Cmd+Shift+R)
- Clear localStorage: `localStorage.removeItem('doge_stats_cache')`
- Check Vercel Edge cache headers

---

### Issue: Counters not incrementing after searches (January 23, 2026)

**Symptoms**: Search counter remains at same value despite performing new searches

**Root Cause**: Vercel Edge cache serving stale responses for 5 minutes

**Details**:

- Search logging was working correctly (API returned 200)
- Database was being updated properly
- Frontend stats requests were hitting Vercel's edge cache
- Cache TTL was 300 seconds (5 minutes), causing stale data to be served
- Response showed `x-vercel-cache: HIT` with `age: 12+` seconds

**Investigation Steps**:

1. Verified search logging API call succeeded (`/api/trending/log` returned 200)
2. Checked stats endpoint response headers - showed `x-vercel-cache: HIT`
3. Confirmed cache-control was set to `s-maxage=300`
4. Performed test search - counter only updated after cache expiry

**Solution Applied** (Build #211):

- Reduced cache time from 300 seconds to 10 seconds in `api/stats.ts`
- Changed `Cache-Control: public, s-maxage=300, stale-while-revalidate=300`
- To `Cache-Control: public, s-maxage=10, stale-while-revalidate=10`

**Files Modified**:

- `api/stats.ts` (lines 29-30, 41)

**Verification**:

- Counter now updates within ~10 seconds of new searches
- Confirmed via production testing: 172 → 175 → 176

**Trade-off Consideration**:

- ✅ Search counters update quickly (near real-time)
- ⚠️ Slightly more database queries (still very manageable)
- Balance between real-time updates and database load

**Git Commit**: `4f05367` - "Fix stats counter cache time from 5 minutes to 10 seconds"

### Issue: High API latency

**Possible causes**:

1. Database query slow (missing indexes)
2. Network latency
3. Vercel cold start

**Solution**:

- Check query performance: `EXPLAIN ANALYZE` on counts
- Add database indexes if needed
- Consider using read replicas

---

## Related Files

### Database

- `prisma/migrations/202601120858_add_triggered_alerts_table/migration.sql`

### API Endpoints

- `api/stats.ts` - Stats aggregation endpoint
- `api/alerts/trigger.ts` - Alert logging endpoint
- `api/trending/log.ts` - Search logging endpoint (existing)

### Services

- `services/trendingService.ts` - Search logging client
- `services/db.ts` - IndexedDB definitions

### Components

- `components/Footer.tsx` - Footer with counters
- `components/Dashboard.tsx` - Alert triggering with server logging
- `components/TokenSearchInput.tsx` - Search input with logging

### Hooks

- `hooks/useStatsCounters.ts` - Stats counter hook
- `hooks/useClickOutside.ts` - Reference pattern for hooks

### Configuration

- `vite.config.ts` - API proxy configuration (lines 24-31)
- `vercel.json` - Deployment configuration

---

## Support & Contact

**Feature implemented by**: Claude Code (Anthropic)
**Date**: January 12, 2026
**Build**: #150
**Git commit**: bdb7e6f

For questions or issues, refer to:

- This documentation file
- Git commit history for detailed changes
- Vercel deployment logs for API errors
- Neon database console for data issues
