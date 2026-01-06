# Neon PostgreSQL Setup Guide

This guide walks you through setting up Neon PostgreSQL for the search analytics and learning system.

## Prerequisites

- Neon PostgreSQL account (free tier available at https://neon.tech)
- Vercel account for deployment
- Existing Neon database connected to Vercel

## Step 1: Set Up Neon Database

### 1.1 Run Migration Script

1. Go to your Neon console: https://console.neon.tech
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Copy the entire contents of `/server/database/neon-migration.sql`
5. Paste into the SQL Editor
6. Click "Run" to execute the migration

The script will create:

- `search_events` table (stores all search queries)
- `click_events` table (stores click events on results)
- `token_popularity` table (aggregate popularity metrics)
- `user_contributions` table (community submissions)
- `analytics_summary` table (aggregated statistics)
- `whale_wallets` table (high-volume wallet registry)
- `discovered_factories` table (DEX factory registry)
- `token_search_index` materialized view (fast token lookups)
- Indexes for performance
- Functions for aggregation and cleanup

### 1.2 Verify Tables Were Created

Run this query in the SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'search_events',
    'click_events',
    'token_popularity',
    'user_contributions',
    'analytics_summary',
    'whale_wallets',
    'discovered_factories'
  )
ORDER BY table_name;
```

Expected output: 7 tables

## Step 2: Configure Environment Variables

### 2.1 Get Neon Connection String

1. In Neon console, go to your project
2. Click "Connection Details" in the left sidebar
3. Copy the "Connection string" (looks like `postgresql://...`)

### 2.2 Add to Vercel

**Option A: Via Vercel Dashboard**

1. Go to your Vercel project
2. Settings → Environment Variables
3. Add `DATABASE_URL` with your Neon connection string
4. Select all environments (Production, Preview, Development)

**Option B: Via Vercel CLI**

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Link to your project
vercel link

# Add environment variable
vercel env add DATABASE_URL

# Paste your Neon connection string when prompted
# Select "All" when asked for environments

# Deploy to apply changes
vercel --prod
```

## Step 3: Deploy API Endpoints

The API endpoints are already created and integrated with Neon. Simply deploy:

```bash
# Deploy to production
vercel --prod

# Or push to git branch (if auto-deploy is enabled)
git push origin main
```

This will deploy:

- `/api/analytics/search` - Search event collection
- `/api/analytics/click` - Click event collection
- `/api/trending/popularity` - Popularity metrics
- `/api/recommendations/peers` - Peer recommendations

## Step 4: Set Up Cron Jobs

Cron jobs automatically aggregate data and clean up old records.

### 4.1 Create Cron Job Files

Create `/api/crons/aggregate-popularity.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Call the aggregate_popularity_metrics() function
    // This will update token_popularity table from events

    return NextResponse.json({ success: true, message: "Popularity aggregated" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### 4.2 Configure Cron Schedule

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/crons/aggregate-popularity",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/crons/generate-summary",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/crons/cleanup-events",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

**Schedule Explanation:**

- `0 * * * *` - Every hour (popularity aggregation)
- `0 0 * * *` - Daily at midnight (analytics summary)
- `0 2 * * 0` - Weekly on Sunday at 2 AM (cleanup)

### 4.3 Deploy Cron Configuration

```bash
git add vercel.json
git commit -m "Add cron jobs for analytics aggregation"
git push origin main
```

## Step 5: Test the Integration

### 5.1 Test Search Analytics

```bash
curl -X POST https://your-project.vercel.app/api/analytics/search \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "a1b2c3d4e5f6...64chars",
    "query": "doge",
    "results": ["0x123...", "0x456..."],
    "resultCount": 2,
    "timestamp": 1704067200000
  }'
```

Expected response:

```json
{
  "success": true,
  "saved": true,
  "message": "Search event recorded"
}
```

### 5.2 Test Click Analytics

```bash
curl -X POST https://your-project.vercel.app/api/analytics/click \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "a1b2c3d4e5f6...64chars",
    "query": "doge",
    "clickedAddress": "0x123...",
    "resultRank": 0,
    "resultScore": 95.5,
    "timeToClickMs": 1500,
    "timestamp": 1704067201000
  }'
```

Expected response:

```json
{
  "success": true,
  "saved": true,
  "message": "Click event recorded"
}
```

### 5.3 Test Popularity Endpoint

```bash
curl "https://your-project.vercel.app/api/trending/popularity?addresses[]=0x123...&addresses[]=0x456..."
```

Expected response:

```json
{
  "0x123...": {
    "tokenAddress": "0x123...",
    "searchCount": 150,
    "clickCount": 45,
    "ctr": 0.3,
    "lastSearched": 1704067200000,
    "lastClicked": 1704067201000
  }
}
```

### 5.4 Test Peer Recommendations

```bash
curl "https://your-project.vercel.app/api/recommendations/peers?query=doge&type=TOKEN&limit=5"
```

Expected response:

```json
{
  "recommendations": [
    {
      "address": "0x789...",
      "name": "DogeCoin",
      "symbol": "DOGE",
      "score": 0.85,
      "reason": "Popular with users who searched similar queries"
    }
  ],
  "query": "doge",
  "type": "TOKEN",
  "count": 1
}
```

### 5.5 Verify Data in Neon

Go to Neon SQL Editor and run:

```sql
-- Check search events
SELECT COUNT(*) as total_searches FROM search_events;

-- Check click events
SELECT COUNT(*) as total_clicks FROM click_events;

-- Check popularity metrics
SELECT * FROM token_popularity ORDER BY search_count DESC LIMIT 10;

-- Check recent activity
SELECT
  se.query,
  COUNT(*) as search_count,
  COUNT(ce.clicked_address) as click_count
FROM search_events se
LEFT JOIN click_events ce ON se.session_id = ce.session_id
GROUP BY se.query
ORDER BY search_count DESC
LIMIT 20;
```

## Step 6: Monitor and Maintain

### 6.1 Monitor Database Growth

Run weekly in Neon SQL Editor:

```sql
-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('search_events', 'click_events')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Event counts
SELECT
  'search_events' as table_name,
  COUNT(*) as row_count,
  MIN(timestamp) as oldest_event,
  MAX(timestamp) as newest_event
FROM search_events
UNION ALL
SELECT
  'click_events' as table_name,
  COUNT(*) as row_count,
  MIN(timestamp) as oldest_event,
  MAX(timestamp) as newest_event
FROM click_events;
```

### 6.2 Manual Cleanup (if needed)

```sql
-- Delete events older than 90 days
SELECT cleanup_old_events(90);

-- Verify cleanup worked
SELECT COUNT(*) FROM search_events WHERE timestamp < NOW() - INTERVAL '90 days';
SELECT COUNT(*) FROM click_events WHERE timestamp < NOW() - INTERVAL '90 days';
```

### 6.3 Refresh Materialized View

```sql
-- Refresh token search index (run after adding new tokens)
SELECT refresh_token_search_index();
```

### 6.4 Manual Aggregation (if cron fails)

```sql
-- Manually trigger popularity aggregation
SELECT aggregate_popularity_metrics();

-- Manually generate analytics summary for today
SELECT generate_analytics_summary(CURRENT_DATE);
```

## Troubleshooting

### Issue: API returns "DATABASE_URL not configured"

**Solution:** Check that `DATABASE_URL` is set in Vercel environment variables.

```bash
vercel env ls
```

Should show `DATABASE_URL` in all environments.

### Issue: "relation does not exist" errors

**Solution:** Run the migration script again in Neon SQL Editor.

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

### Issue: Cron jobs not running

**Solution:** Check Vercel cron logs.

```bash
vercel logs
```

Or check `vercel.json` has proper cron configuration.

### Issue: Popularity scores always 0

**Solution:** Need more data. Popularity requires:

1. Search events with results
2. Click events on those results
3. Aggregation job to run (hourly)

Run manual aggregation:

```sql
SELECT aggregate_popularity_metrics();
```

### Issue: Peer recommendations return empty

**Solution:** pg_trgm extension needs to be enabled.

```sql
-- Check extension
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- If not installed, create extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Cost Estimation

### Neon Free Tier:

- 0.5 GB storage
- 300 hours of compute time/month
- ~3 billion row reads/month

### Estimated Usage:

- 10,000 searches/day = 300K searches/month
- 3,000 clicks/day = 90K clicks/month
- Storage growth: ~50MB/month

### When to Upgrade:

- > 1,000 searches/day → Consider paid tier
- > 500MB storage → Upgrade to paid tier ($19/month)
- High traffic (10K+ searches/day) → Scale compute

## Performance Optimization

### Indexes Already Created

All tables have indexes on:

- `session_id` (for fast user analytics)
- `timestamp` (for time-based queries)
- `token_address` / `clicked_address` (for token lookups)

### Connection Pooling

Neon uses HTTP-based serverless driver, no pooling needed.

### Query Optimization

If queries are slow, check `EXPLAIN ANALYZE` output:

```sql
EXPLAIN ANALYZE
SELECT * FROM search_events
WHERE query LIKE '%doge%'
ORDER BY timestamp DESC
LIMIT 100;
```

## Security Best Practices

### 1. Use Read-Only User for Analytics Queries

Create a read-only user:

```sql
CREATE USER analytics_read_only WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE your_database TO analytics_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_read_only;
```

### 2. Enable Row-Level Security (Optional)

```sql
ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

-- Create policy (example)
CREATE POLICY user_can_view_own_events ON search_events
  FOR SELECT
  USING (session_id = current_setting('app.session_id'));
```

### 3. Regular Backups

Neon automatically backs up data. Check retention settings:

- Point-in-time recovery: 30 days (free tier)
- Backup retention: 7 days (free tier)

## Next Steps

1. ✅ Run migration script in Neon
2. ✅ Set DATABASE_URL in Vercel
3. ✅ Deploy API endpoints
4. ✅ Set up cron jobs
5. ✅ Test endpoints
6. ✅ Monitor database growth
7. ✅ Scale up as needed

## Support

- Neon Docs: https://neon.tech/docs
- Neon Support: support@neon.tech
- Vercel Docs: https://vercel.com/docs

## Appendix: Complete API Reference

### POST /api/analytics/search

**Request Body:**

```json
{
  "sessionId": "64-char-hex-string",
  "query": "search query",
  "results": ["0x...", "0x..."],
  "resultCount": 2,
  "timestamp": 1704067200000
}
```

**Response:**

```json
{
  "success": true,
  "saved": true,
  "message": "Search event recorded"
}
```

### POST /api/analytics/click

**Request Body:**

```json
{
  "sessionId": "64-char-hex-string",
  "query": "search query",
  "clickedAddress": "0x...",
  "resultRank": 0,
  "resultScore": 95.5,
  "timeToClickMs": 1500,
  "timestamp": 1704067201000
}
```

**Response:**

```json
{
  "success": true,
  "saved": true,
  "message": "Click event recorded"
}
```

### GET /api/trending/popularity

**Query Parameters:**

- `addresses[]` - Array of token addresses (max 100)

**Response:**

```json
{
  "0x123...": {
    "tokenAddress": "0x123...",
    "searchCount": 150,
    "clickCount": 45,
    "ctr": 0.3,
    "lastSearched": 1704067200000,
    "lastClicked": 1704067201000
  }
}
```

### POST /api/trending/popularity

**Request Body:**

```json
{
  "tokenAddress": "0x...",
  "appearedInResults": true,
  "wasClicked": false,
  "timestamp": 1704067200000
}
```

**Response:**

```json
{
  "success": true,
  "updated": true,
  "message": "Popularity metrics updated"
}
```

### GET /api/recommendations/peers

**Query Parameters:**

- `query` - Search query (min 2 chars)
- `type` - "TOKEN" or "NFT" (default: "TOKEN")
- `limit` - Number of recommendations (1-20, default: 5)

**Response:**

```json
{
  "recommendations": [
    {
      "address": "0x...",
      "name": "Token Name",
      "symbol": "SYMBOL",
      "score": 0.85,
      "reason": "Popular with users who searched similar queries"
    }
  ],
  "query": "search query",
  "type": "TOKEN",
  "count": 1
}
```

---

**Setup Complete!** Your Neon PostgreSQL database is now integrated and ready to collect search analytics and provide intelligent recommendations.
