# Simple Neon Setup Guide

You already have Neon Serverless Postgres! This guide shows you how to add the learning search tables to it.

## What You Already Have ✅

- Neon Serverless Postgres database
- Existing tables: `trending_searches` and `trending_search_history`
- Database connection: `DATABASE_URL`

## What We're Adding

4 new tables to the **same** Neon database:

1. `learned_tokens` - Stores tokens from wallet scans
2. `token_interactions` - Tracks searches and clicks
3. `wallet_scan_contributions` - Links wallets to tokens
4. `trending_tokens` - Materialized view for fast queries

---

## Step 1: Get Your Neon Connection

1. Go to https://console.neon.tech
2. Find your project (should already exist)
3. Click **"SQL Editor"** in the left sidebar
4. You're now ready to run SQL commands!

---

## Step 2: Run the Setup Script

1. Keep the Neon SQL Editor open
2. Copy everything from the file: `setup-learning-db.sql`
3. Paste it into the Neon SQL Editor
4. Click the **"Run"** button (or press Ctrl+Enter)

That's it! Your tables are now created.

---

## Step 3: Add DATABASE_URL to Your Project

### Option A: Local Development (Your Computer)

1. Open your `.env.local` file (in the project folder)
2. Add this line:

```bash
DATABASE_URL=your_neon_connection_string_here
```

3. To get the connection string:
   - Go back to Neon console
   - Click your project
   - Copy the "Connection string" (looks like: `postgresql://user:pass@ep-xxx.aws.neon.tech/dbname`)

### Option B: Vercel (Where Your App Is Hosted)

1. Go to https://vercel.com/dashboard
2. Select your project: "dogechain-bubblemaps"
3. Go to **Settings** → **Environment Variables**
4. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Neon connection string (from above)
   - **Environments**: Select all (Production, Preview, Development)

---

## Step 4: Test It Locally

1. Start your app:

```bash
npm run dev
```

2. Open the app in your browser
3. Perform a wallet scan
4. Check the browser console (F12) - you should see:

```
[Learned Tokens] Submitted X assets from wallet scan
```

---

## Step 5: Verify in Neon

Go back to Neon SQL Editor and run:

```sql
-- Check if tokens are being saved
SELECT COUNT(*) as total_tokens FROM learned_tokens;

-- See recent tokens
SELECT address, symbol, name, popularity_score, scan_frequency
FROM learned_tokens
ORDER BY discovery_timestamp DESC
LIMIT 10;
```

You should see tokens from your wallet scan!

---

## What If Something Goes Wrong?

### "DATABASE_URL not configured"

- Make sure you added DATABASE_URL to `.env.local` (Step 3)
- Restart your app: `npm run dev`

### "Table does not exist"

- Run the setup script again (Step 2)
- Check for error messages in Neon SQL Editor

### "No tokens appearing"

- Check browser console for errors (F12)
- Make sure wallet scan completed successfully
- Verify DATABASE_URL is correct

---

## After Setup Works

1. **Deploy to Vercel**:

```bash
git add .
git commit -m "Add learning search with Neon"
git push
```

2. **Check Production**:
   - Visit your deployed site
   - Do a wallet scan
   - Check Neon database for new tokens

---

## Summary

✅ Step 1: Open Neon SQL Editor
✅ Step 2: Run `setup-learning-db.sql` script
✅ Step 3: Add DATABASE_URL to `.env.local` and Vercel
✅ Step 4: Test locally with `npm run dev`
✅ Step 5: Verify data in Neon

That's all! Your learning search system will now work with your existing Neon database.

---

## What Happens Next?

**When users scan wallets:**

- Tokens are automatically saved to your Neon database
- Popularity scores increase
- Tokens become "popular" and show at top of search

**When users search:**

- Popular tokens appear first (with green "Popular" badge)
- Search gets better over time
- Community-curated tokens are prioritized

**Your database:**

- All data goes to your existing Neon database
- No new account or service needed
- Uses your current Neon free tier

---

## Need Help?

Check these files:

- `setup-learning-db.sql` - The SQL script to run
- `.env.example` - Shows all environment variables
- `NEON-INTEGRATION-SUMMARY.md` - Technical details (if you're curious)

Or contact Neon support: https://neon.tech/support
