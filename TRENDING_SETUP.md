# Server-Side Trending Setup Guide

This guide will help you set up the server-side trending aggregation system that displays trending tokens based on **all users' search queries** collectively.

## Prerequisites

- A Vercel account with the project deployed
- Vercel Postgres database access

---

## Step 1: Create Vercel Postgres Database

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Postgres** and choose a region (closest to your users)
6. Click **Create**

Once created, you'll see the connection strings. Copy the `POSTGRES_URL` value.

---

## Step 2: Set Environment Variables

Add the following environment variables to your Vercel project:

### Via Vercel Dashboard:

1. Go to **Project Settings** → **Environment Variables**
2. Add the following variables:

```bash
POSTGRES_URL=postgresql://user:password@host.vercel-storage.com/verceldb?sslmode=require
POSTGRES_PRISMA_URL=postgresql://user:password@host.vercel-storage.com/verceldb?pgbouncer=true&sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://user:password@host.vercel-storage.com/verceldb?sslmode=require
```

3. Apply to all environments: **Production**, **Preview**, and **Development**

### Via CLI (alternative):

```bash
vercel env add POSTGRES_URL
vercel env add POSTGRES_PRISMA_URL
vercel env add POSTGRES_URL_NON_POOLING
```

---

## Step 3: Create Database Schema

1. In Vercel, go to **Storage** → **Your Postgres Database**
2. Click **Query** to open the database console
3. Run the following SQL script:

```sql
-- ============================================
-- Server-Side Trending Database Schema
-- ============================================

-- Primary table for asset tracking
CREATE TABLE trending_searches (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  asset_type VARCHAR(10) NOT NULL,
  symbol VARCHAR(100),
  name VARCHAR(255),
  search_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT address_unique UNIQUE (address)
);

-- Time-series table for velocity calculation (hourly buckets)
CREATE TABLE trending_search_history (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  hour_bucket TIMESTAMP NOT NULL,
  search_count INTEGER DEFAULT 1,
  CONSTRAINT address_hour_unique UNIQUE (address, hour_bucket)
);

-- Performance indexes
CREATE INDEX idx_searches_address ON trending_searches(address);
CREATE INDEX idx_searches_asset_type ON trending_searches(asset_type);
CREATE INDEX idx_searches_updated_at ON trending_searches(updated_at DESC);
CREATE INDEX idx_searches_search_count ON trending_searches(search_count DESC);
CREATE INDEX idx_history_address ON trending_search_history(address);
CREATE INDEX idx_history_hour_bucket ON trending_search_history(hour_bucket DESC);
CREATE INDEX idx_history_address_hour ON trending_search_history(address, hour_bucket DESC);
```

---

## Step 4: Deploy and Test

1. **Deploy your changes**:

   ```bash
   git add .
   git commit -m "feat: add server-side trending aggregation"
   git push
   ```

2. **Test the API endpoints**:

   ### Test Log Endpoint:

   ```bash
   curl -X POST https://your-app.vercel.app/api/trending/log \
     -H "Content-Type: application/json" \
     -d '{
       "address": "0xb6fa775c541300e17f86cde703c56fe8ff7723b8",
       "assetType": "TOKEN",
       "symbol": "wDOGE",
       "name": "Wrapped Doge"
     }'
   ```

   Expected response:

   ```json
   { "success": true }
   ```

   ### Test Get Trending Endpoint:

   ```bash
   curl https://your-app.vercel.app/api/trending
   ```

   Expected response:

   ```json
   {
     "assets": [
       {
         "address": "0xb6fa775c541300e17f86cde703c56fe8ff7723b8",
         "symbol": "wDOGE",
         "name": "Wrapped Doge",
         "type": "TOKEN",
         "totalSearches": 5,
         "recentSearches": 3,
         "previousSearches": 1,
         "velocityScore": 4.2,
         "rank": 1
       }
     ],
     "cached": false,
     "timestamp": "2025-01-05T14:30:00.000Z"
   }
   ```

---

## Step 5: Verify Functionality

1. **Open your app** and search for a few tokens
2. **Wait 2-3 minutes** for the cache to refresh
3. **Check the trending section** on the homepage
4. The tokens you searched for should appear in trending

---

## How It Works

### Velocity Algorithm

The trending system uses a **velocity-based algorithm** that weights:

1. **Recent Activity (60%)**: Searches in the last 3 hours
2. **Acceleration (30%)**: Growth rate compared to the previous 3 hours
3. **All-Time (10%)**: Cumulative search count

Formula:

```
velocityScore = (recentSearches × 0.6) + (acceleration × 100 × 0.3) + (log10(totalSearches + 1) × 10 × 0.1)
```

This means:

- **Rising tokens** get a boost (high acceleration)
- **Established tokens** maintain visibility (all-time count)
- **Viral tokens** surface quickly (recent activity)

### Caching Strategy

- **Server cache**: 10 minutes (reduces database load)
- **Refresh interval**: 15 minutes (frontend fetch)
- **Fallback**: Local trending if server unavailable

### Privacy

- **Anonymous tracking**: No user IDs or IP addresses stored
- **Only valid tokens**: Logged after successful data fetch
- **Sanitized data**: Addresses normalized to lowercase

---

## Maintenance

### Weekly Tasks (Optional)

Run this SQL to clean up old history data (>90 days):

```sql
DELETE FROM trending_search_history
WHERE hour_bucket < NOW() - INTERVAL '90 days';

VACUUM ANALYZE trending_searches;
VACUUM ANALYZE trending_search_history;
```

### Monthly Tasks (Optional)

Remove dead assets (no searches in 30 days):

```sql
DELETE FROM trending_searches
WHERE updated_at < NOW() - INTERVAL '30 days';
```

---

## Troubleshooting

### Issue: "Failed to log search"

**Solutions**:

- Check environment variables are set in Vercel
- Verify database tables exist (run schema SQL)
- Check Vercel function logs for errors

### Issue: Trending not updating

**Solutions**:

- Wait 15 minutes for cache refresh
- Check if database is receiving writes (Query console: `SELECT COUNT(*) FROM trending_searches`)
- Verify API endpoint returns data

### Issue: High database costs

**Solutions**:

- Increase cache TTL in `/api/trending/index.ts` (change `CACHE_TTL`)
- Add rate limiting with Upstash Redis
- Clean old history data regularly

---

## Performance Targets

| Metric          | Target | Notes                                 |
| --------------- | ------ | ------------------------------------- |
| Log API latency | <100ms | Fire-and-forget, doesn't block search |
| Get API latency | <500ms | <100ms with cache hit                 |
| Cache hit rate  | >90%   | Reduces database costs                |

---

## Success Criteria

✅ Trending section shows global search patterns (all users)
✅ Velocity-based ranking surfaces rising tokens
✅ Server cache reduces database load
✅ Graceful fallback to local trending
✅ Anonymous tracking (no user data)
✅ API response times under 500ms

---

## Next Steps

1. **Monitor performance**: Check Vercel Analytics for API response times
2. **Tune algorithm**: Adjust velocity weights based on results
3. **Add rate limiting**: Implement IP-based rate limiting if abuse detected
4. **Create dashboard**: Build admin dashboard for trending analytics

---

## Questions?

For issues or questions:

1. Check Vercel function logs
2. Review database query performance
3. Verify environment variables are set correctly
