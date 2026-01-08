# Learning Search System - Setup Guide

This guide will help you set up the Vercel Postgres database for the learning search system.

## Prerequisites

- Vercel account (free tier works)
- This project deployed on Vercel
- Node.js installed locally

## Step 1: Create Vercel Postgres Database

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: "dogechain-bubblemaps"
3. Go to the "Storage" tab
4. Click "Create Database"
5. Select "Postgres" (free tier: 256MB storage, 60 connections)
6. Click "Continue"
7. Select your region (closest to your users)
8. Click "Create"

## Step 2: Get Database Connection Details

After creating the database, Vercel will show you connection details. You need to add these as environment variables.

1. In the database overview, click ".env.local" tab
2. Copy all the environment variables shown

## Step 3: Add Environment Variables Locally

Add the following to your `.env.local` file:

```bash
# Vercel Postgres Connection
POSTGRES_URL=your_postgres_url_here
POSTGRES_PRISMA_URL=your_postgres_prisma_url_here
POSTGRES_USER=your_postgres_user_here
POSTGRES_HOST=your_postgres_host_here
POSTGRES_PASSWORD=your_postgres_password_here
POSTGRES_DATABASE=your_postgres_database_here

# API Base URL (already exists)
VITE_API_BASE_URL=https://dogechain-bubblemaps-api.vercel.app
```

## Step 4: Add Environment Variables to Vercel

1. Go to your project settings in Vercel
2. Go to "Environment Variables"
3. Add all the POSTGRES\_\* variables from step 2
4. Make sure to add them to all environments (Production, Preview, Development)

## Step 5: Execute Database Schema

### Option A: Using Vercel Dashboard (Recommended)

1. Go to your Postgres database in Vercel
2. Click "Browse" to open the database editor
3. Click "Query" tab
4. Copy the contents of `setup-learning-db.sql`
5. Paste into the query editor
6. Click "Execute"

### Option B: Using psql CLI

If you have `psql` installed locally:

```bash
# Connect to your Vercel Postgres database
psql $POSTGRES_URL

# Then run:
\i setup-learning-db.sql
```

### Option C: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Execute the SQL file
cat setup-learning-db.sql | vercel env pull POSTGRES_URL && psql $POSTGRES_URL -f setup-learning-db.sql
```

## Step 6: Verify Database Setup

After executing the schema, verify the tables were created:

```sql
-- List all tables
\dt

-- You should see:
-- learned_tokens
-- token_interactions
-- wallet_scan_contributions
-- trending_tokens (materialized view)

-- Check learned_tokens table structure
\d learned_tokens

-- Verify indexes
\di

-- You should see indexes on:
-- idx_learned_tokens_address
-- idx_learned_tokens_type
-- idx_learned_tokens_popularity
-- idx_learned_tokens_symbol
-- idx_learned_tokens_name
```

## Step 7: Test API Endpoints Locally

1. Start your development server:

```bash
npm run dev
```

2. Test the endpoints:

```bash
# Test GET learned tokens (should return empty array initially)
curl "http://localhost:5173/api/learned-tokens?type=TOKEN&limit=10"

# Test POST learned tokens
curl -X POST "http://localhost:5173/api/learned-tokens" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "name": "Test Token",
    "symbol": "TEST",
    "decimals": 18,
    "type": "TOKEN"
  }'

# Test GET trending tokens
curl "http://localhost:5173/api/trending?type=TOKEN&limit=10"
```

## Step 8: Deploy to Production

1. Commit all changes:

```bash
git add .
git commit -m "Add learning search system with Vercel Postgres"
git push
```

2. Deploy to Vercel:

```bash
vercel --prod
```

Or push to your main branch if you have automatic deployments enabled.

## Step 9: Test in Production

1. Visit your deployed app
2. Perform a wallet scan
3. Check the browser console for success messages:

   ```
   [Learned Tokens] Submitted X assets from wallet scan
   ```

4. Search for tokens - you should see:
   - "Popular" badge on learned tokens (green with trending icon)
   - Learned tokens appear at top of search results

## Step 10: Monitor Database Growth

Check your database usage regularly:

1. Go to Vercel Dashboard → Storage → Your Postgres database
2. Monitor:
   - Storage used (should be <256MB on free tier)
   - Connection count (should be <60)
   - Row count in tables

You can run this query to check table sizes:

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### "Connection refused" errors

- Check that environment variables are set correctly
- Verify POSTGRES_URL is correct
- Ensure database is created in Vercel

### "Table does not exist" errors

- Run the setup-learning-db.sql schema
- Check for typos in table names

### API returns 404

- Ensure API routes are in `/api/` directory
- Check Vercel deployment logs
- Verify vercel.json configuration

### No tokens appearing in search

- Check browser console for errors
- Verify API_BASE_URL is correct
- Ensure wallet scan completed successfully
- Check Vercel Postgres database for data

### Rate limiting errors

- The system includes automatic rate limiting
- If you see many errors, reduce scan frequency
- Consider batching submissions (already implemented)

## Performance Tuning

### Refresh Materialized View

The `trending_tokens` materialized view should be refreshed every 5 minutes. You can set up a cron job:

```bash
# Using Vercel Cron Jobs (Pro plan)
# Add to vercel.json:
{
  "crons": [{
    "path": "/api/refresh-trending",
    "schedule": "*/5 * * * *"
  }]
}
```

Or manually refresh:

```sql
SELECT refresh_trending_tokens();
```

### Database Indexes

If queries are slow, check that indexes are being used:

```sql
EXPLAIN ANALYZE
SELECT * FROM learned_tokens
WHERE type = 'TOKEN'
ORDER BY popularity_score DESC
LIMIT 20;
```

Look for "Index Scan" in the output (good) rather than "Seq Scan" (slow).

## Database Maintenance

### Purge Old Data

To keep database size under control, you can purge old data:

```sql
-- Delete interactions older than 30 days
DELETE FROM token_interactions
WHERE created_at < NOW() - INTERVAL '30 days';

-- Delete tokens not seen in 90 days
DELETE FROM learned_tokens
WHERE last_seen_at < NOW() - INTERVAL '90 days';
```

### Backup Data

Vercel Postgres includes automatic backups. You can also export manually:

```bash
# Using pg_dump
pg_dump $POSTGRES_URL > backup.sql

# Restore from backup
psql $POSTGRES_URL < backup.sql
```

## Success Metrics

After deployment, monitor these metrics:

- **Token Discovery Rate**: Number of new tokens added per day
- **Search Improvement**: Click-through rate increase on learned tokens
- **Database Growth**: Should be <10MB per month
- **API Response Time**: p50 <100ms, p95 <500ms
- **User Engagement**: Number of wallet scans submitted

## Next Steps

1. Monitor the first week of data collection
2. Analyze which tokens are most popular
3. Consider adding token verification flags
4. Implement spam filtering if needed
5. Add admin dashboard for analytics visualization

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Vercel deployment logs
3. Verify database tables exist and have data
4. Test API endpoints individually
5. Review this setup guide

For more help, refer to:

- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Postgres SDK](https://github.com/vercel/vercel-postgres)
- [Project Implementation Plan](/Users/dts/.claude/plans/mutable-weaving-thimble.md)
