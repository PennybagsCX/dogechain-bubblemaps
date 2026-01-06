# Deployment Guide

Complete guide for setting up, deploying, and maintaining the Dogechain Bubblemaps project (frontend and backend API).

---

## Project Structure

The project consists of two separate repositories:

### Frontend Repository

**Location:** `/Volumes/DEV Projects/Dogechain Bubblemaps`
**URL:** https://www.dogechain-bubblemaps.xyz
**Framework:** Vite + React + TypeScript
**Deployment:** Vercel

### Backend API Repository

**Location:** `/Volumes/DEV Projects/dogechain-bubblemaps-api`
**URL:** https://dogechain-bubblemaps-api.vercel.app
**Framework:** Next.js 15 + TypeScript
**Database:** Neon PostgreSQL
**Deployment:** Vercel

### How They Connect

```
Frontend (www.dogechain-bubblemaps.xyz)
    ↓ API calls
Backend API (dogechain-bubblemaps-api.vercel.app)
    ↓ Queries
Neon PostgreSQL Database
```

---

## Environment Variables

### Frontend Environment Variables

| Variable                      | Purpose                   | Required | Example                                       |
| ----------------------------- | ------------------------- | -------- | --------------------------------------------- |
| `VITE_API_BASE_URL`           | Backend API base URL      | Yes      | `https://dogechain-bubblemaps-api.vercel.app` |
| `VITE_ANALYTICS_API_ENDPOINT` | Analytics API URL         | Yes      | `https://dogechain-bubblemaps-api.vercel.app` |
| `SENTRY_DSN`                  | Error tracking (optional) | No       | `https://...@sentry.io/...`                   |

### Backend Environment Variables

| Variable       | Purpose                    | Required | Example                                                                  |
| -------------- | -------------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL` | Neon PostgreSQL connection | Yes      | `postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require` |

---

## Local Development Setup

### Frontend Setup

**1. Navigate to frontend directory:**

```bash
cd "/Volumes/DEV Projects/Dogechain Bubblemaps"
```

**2. Install dependencies:**

```bash
npm install
```

**3. Create environment file:**

```bash
cp .env.example .env.local
```

**4. Edit `.env.local`:**

```bash
# Local development (uses relative paths for API calls)
VITE_API_BASE_URL=
VITE_ANALYTICS_API_ENDPOINT=

# Optional: Sentry for error tracking
# SENTRY_DSN=https://...
```

**5. Start development server:**

```bash
npm run dev
```

**6. Open in browser:**

```
http://localhost:5173
```

**Note:** Leave `VITE_API_BASE_URL` empty in local development to use relative paths (proxied to backend).

---

### Backend Setup

**1. Navigate to backend directory:**

```bash
cd "/Volumes/DEV Projects/dogechain-bubblemaps-api"
```

**2. Install dependencies:**

```bash
npm install
```

**3. Create environment file:**

```bash
cp .env.example .env.local
```

**4. Edit `.env.local`:**

```bash
# Neon PostgreSQL database connection
DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require
```

**5. Start development server:**

```bash
npm run dev
```

**6. Test backend:**

```bash
# Health check
curl http://localhost:3000/api/health

# Should return: {"status":"healthy","database":"connected"}
```

---

### Running Both Locally

**Terminal 1 - Frontend:**

```bash
cd "/Volumes/DEV Projects/Dogechain Bubblemaps"
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - Backend:**

```bash
cd "/Volumes/DEV Projects/dogechain-bubblemaps-api"
npm run dev
# Runs on http://localhost:3000
```

**Vite Proxy Configuration:**

The frontend's `vite.config.ts` proxies API calls to the local backend:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

This allows you to leave `VITE_API_BASE_URL` empty in development.

---

## Production Deployment

### Frontend Deployment to Vercel

**1. Connect GitHub Repository:**

- Go to https://vercel.com/new
- Import repository: `PennybagsCX/dogechain-bubblemaps`
- Vercel auto-detects Vite configuration

**2. Configure Environment Variables:**

In Vercel Project Settings > Environment Variables:

| Name                          | Value                                         | Environment                      |
| ----------------------------- | --------------------------------------------- | -------------------------------- |
| `VITE_API_BASE_URL`           | `https://dogechain-bubblemaps-api.vercel.app` | Production, Preview, Development |
| `VITE_ANALYTICS_API_ENDPOINT` | `https://dogechain-bubblemaps-api.vercel.app` | Production, Preview, Development |
| `SENTRY_DSN`                  | (optional) Your Sentry DSN                    | Production only                  |

**3. Deploy:**

```bash
# Push to main branch
git push origin main

# GitHub Actions automatically deploys to Vercel
```

**4. Verify Deployment:**

```bash
# Open production site
open https://www.dogechain-bubblemaps.xyz

# Check browser console for errors
# Should see: [Analytics] Initialized with session
```

---

### Backend Deployment to Vercel

**1. Connect GitHub Repository:**

- Go to https://vercel.com/new
- Import repository: `PennybagsCX/dogechain-bubblemaps-api`
- Vercel auto-detects Next.js configuration

**2. Configure Environment Variables:**

In Vercel Project Settings > Environment Variables:

| Name           | Value                                  | Environment                      |
| -------------- | -------------------------------------- | -------------------------------- |
| `DATABASE_URL` | Your Neon PostgreSQL connection string | Production, Preview, Development |

**3. Deploy:**

```bash
# Push to main branch
cd "/Volumes/DEV Projects/dogechain-bubblemaps-api"
git push origin main

# Vercel auto-deploys on push
```

**4. Verify Deployment:**

```bash
# Health check
curl https://dogechain-bubblemaps-api.vercel.app/api/health

# Should return: {"status":"healthy","database":"connected"}

# Test trending endpoint
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=5"
```

---

## GitHub Actions Workflow

### Frontend Workflow

**File:** `.github/workflows/deploy.yml`

**Trigger:**

- Push to `main` branch
- Manual workflow dispatch

**Steps:**

1. Checkout code
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Deploy to Vercel (production)

**Environment Variables:**
Passed in workflow `env` section:

```yaml
env:
  VITE_API_BASE_URL: https://dogechain-bubblemaps-api.vercel.app
  VITE_ANALYTICS_API_ENDPOINT: https://dogechain-bubblemaps-api.vercel.app
```

**Required GitHub Secrets:**

- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

**Access:** Repository Settings > Secrets and variables > Actions

---

## Deployment Verification

### Frontend Verification Checklist

- [ ] Site loads at https://www.dogechain-bubblemaps.xyz
- [ ] No 404 errors in browser console
- [ ] API requests succeed (200 OK) in Network tab
- [ ] Search functionality works
- [ ] Token lookups work
- [ ] No CSP violations in console
- [ ] No CORS errors in console

### Backend Verification Checklist

- [ ] Health check returns 200 OK
- [ ] All 8 API endpoints respond correctly
- [ ] Database connection working
- [ ] CORS headers present
- [ ] Trending endpoint returns data
- [ ] Analytics endpoints accept data

### Test Commands

```bash
# Frontend health
curl -I https://www.dogechain-bubblemaps.xyz

# Backend health
curl https://dogechain-bubblemaps-api.vercel.app/api/health

# Trending endpoint
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending?type=TOKEN&limit=5"

# Log endpoint test
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/trending/log \
  -H "Content-Type: application/json" \
  -d '{"address":"0x1234567890123456789012345678901234567890","assetType":"TOKEN","symbol":"TEST","name":"Test Token"}'

# Proxy endpoint test
curl "https://dogechain-bubblemaps-api.vercel.app/api/dogechain-proxy?module=stats&action=tokensupply&contractaddress=0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2"
```

---

## Common Deployment Issues

### Issue: Environment Variables Not Working

**Symptoms:**

- API calls going to wrong URL
- `undefined` or empty strings in API URLs
- Frontend calling `www.dogechain-bubblemaps.xyz/api/...` instead of backend

**Solution:**

1. **Check Vercel Environment Variables:**
   - Go to Vercel Project > Settings > Environment Variables
   - Verify variables are set for ALL environments (Production, Preview, Development)
   - Variables must be prefixed with `VITE_` for frontend

2. **Redeploy After Changes:**

   ```bash
   # Commit changes
   git add .
   git commit -m "Update environment variables"
   git push origin main

   # Or trigger redeploy in Vercel dashboard
   ```

3. **Verify GitHub Actions:**
   - Check `.github/workflows/deploy.yml` has env vars
   - Variables must match Vercel dashboard

4. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache manually

**Reference:** Environment variables table above

---

### Issue: Build Failures

**Symptoms:**

- Deployment fails during build step
- TypeScript errors
- Module not found errors

**Solution:**

1. **Test Local Build:**

   ```bash
   cd "/Volumes/DEV Projects/Dogechain Bubblemaps"
   npm run build
   ```

2. **Fix TypeScript Errors:**

   ```bash
   npm run type-check
   # Fix any reported errors
   ```

3. **Check Dependencies:**

   ```bash
   npm audit
   npm audit fix
   ```

4. **Review Build Logs:**
   - Check Vercel deployment logs
   - Look for specific error messages
   - Fix reported issues

---

### Issue: CORS Errors

**Symptoms:**

- Browser console shows "No 'Access-Control-Allow-Origin' header"
- API calls blocked by CORS policy
- Preflight OPTIONS requests failing

**Solution:**

1. **Check Backend CORS Configuration:**
   - File: `/Volumes/DEV Projects/dogechain-bubblemaps-api/next.config.js`
   - Should have:
     ```javascript
     {
       source: "/api/:path*",
       headers: [
         { key: "Access-Control-Allow-Origin", value: "https://www.dogechain-bubblemaps.xyz" },
         { key: "Access-Control-Allow-Methods", value: "GET, DELETE, PATCH, POST, PUT, OPTIONS" }
       ]
     }
     ```

   ```

   ```

2. **Verify Frontend URL:**
   - Must match exactly: `https://www.dogechain-bubblemaps.xyz`
   - No trailing slash

3. **Redeploy Backend:**
   ```bash
   cd "/Volumes/DEV Projects/dogechain-bubblemaps-api"
   git push origin main
   ```

**Reference:** See `next.config.js` in backend repository

---

### Issue: Database Connection Failures

**Symptoms:**

- Health check returns database error
- API endpoints return 500 errors
- "Database connection failed" in logs

**Solution:**

1. **Check DATABASE_URL:**
   - Verify in Vercel dashboard
   - Must be valid Neon PostgreSQL connection string
   - Must include `?sslmode=require`

2. **Test Database Connection:**

   ```bash
   # Use Neon's SQL editor to test connection
   # Or use psql:
   psql $DATABASE_URL
   ```

3. **Check Database Tables:**

   ```sql
   -- Verify tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';
   ```

4. **Review Vercel Function Logs:**
   - Check for specific database error messages
   - Look for connection pool issues
   - Verify Neon database is active

---

### Issue: CSP Violations

**Symptoms:**

- Browser console shows "Refused to connect to..."
- API calls blocked by Content Security Policy

**Solution:**

1. **Check vercel.json:**
   - File: `/Volumes/DEV Projects/Dogechain Bubblemaps/vercel.json`
   - `connect-src` must include:
     - `https://dogechain-bubblemaps-api.vercel.app`
     - `https://dogechain.dog`
     - `https://explorer.dogechain.dog`

2. **Remove Conflicting Meta Tags:**
   - File: `index.html`
   - Should NOT have CSP meta tag
   - Only use HTTP headers from vercel.json

3. **Verify Headers:**
   ```bash
   curl -I https://www.dogechain-bubblemaps.xyz
   # Look for Content-Security-Policy header
   ```

**Reference:** See "CSP Configuration" section in Security Guide

---

## Maintenance

### Regular Tasks

**Daily:**

- Monitor error rates in Sentry (if configured)
- Check API response times
- Review Vercel function logs

**Weekly:**

- Review database growth
- Check trending data quality
- Monitor API usage metrics

**Monthly:**

- Run `npm audit` and update dependencies
- Review and rotate API keys (if applicable)
- Check database performance
- Review cost and usage

### Database Maintenance

**Check Table Sizes:**

```sql
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name)) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name) DESC;
```

**Clear Old Analytics Data (Optional):**

```sql
-- Delete search events older than 90 days
DELETE FROM search_events
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Delete click events older than 90 days
DELETE FROM click_events
WHERE timestamp < NOW() - INTERVAL '90 days';
```

**Reindex (If Performance Degrades):**

```sql
REINDEX TABLE search_events;
REINDEX TABLE click_events;
REINDEX TABLE trending_searches;
REINDEX TABLE token_popularity;
```

---

## Rollback Procedures

### Frontend Rollback

**Option 1: Vercel Dashboard**

1. Go to Vercel project > Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

**Option 2: Git Revert**

```bash
# Revert last commit
git revert HEAD

# Push to trigger rollback deployment
git push origin main
```

### Backend Rollback

Same process as frontend rollback using Vercel dashboard or git revert.

---

## Performance Optimization

### Frontend

**Bundle Size:**

- Current: ~420KB (gzipped)
- Target: Keep under 500KB
- Monitor: Vite build output

**Lazy Loading:**

- Components already use code splitting
- Images use lazy loading
- Analyze bundle with `npm run build -- --report`

### Backend

**Response Time Targets:**

- Health check: < 100ms
- Trending endpoint: < 500ms
- Analytics endpoints: < 200ms
- Proxy endpoint: < 1000ms (depends on upstream)

**Optimization Tips:**

- Database queries use indexes
- Trending endpoint cached (5 minutes)
- Proxy endpoint cached (1 minute)
- Use Vercel's Edge Network for global distribution

---

## Security Considerations

### Environment Variables

- Never commit `.env.local` files
- Use different values for dev/staging/production
- Rotate sensitive values regularly
- Use Vercel's encrypted environment variables

### API Security

- Rate limiting implemented on all endpoints
- CORS configured for specific origin
- Input validation on all endpoints
- No sensitive data in error messages

### Database Security

- Use SSL connections (`sslmode=require`)
- Neon provides managed security
- Regular backups (handled by Neon)
- principle of least privilege for database user

---

## Monitoring and Analytics

### Vercel Analytics

**Frontend:**

- Page views
- Web Vitals (LCP, FID, CLS)
- Deployment history

**Backend:**

- Function execution time
- Error rates
- Request counts

### Sentry (Optional)

If configured:

- JavaScript errors
- Performance issues
- User feedback
- Release tracking

### Custom Monitoring

**Health Check Endpoint:**

```bash
# Setup external monitoring
curl https://dogechain-bubblemaps-api.vercel.app/api/health
```

Recommended tools:

- UptimeRobot (free)
- Pingdom
- StatusCake

---

## Support and Resources

### Documentation

- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Security Guide](SECURITY_GUIDE.md)** - Security best practices
- **[README](../README.md)** - Project overview

### External Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vite Documentation](https://vitejs.dev/docs)

### Getting Help

1. Check troubleshooting section above
2. Review error logs in Vercel dashboard
3. Check browser console for frontend errors
4. Review API documentation for correct usage

---

**Last Updated:** 2026-01-06

**Frontend URL:** https://www.dogechain-bubblemaps.xyz

**Backend URL:** https://dogechain-bubblemaps-api.vercel.app
