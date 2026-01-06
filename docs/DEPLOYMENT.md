# Deployment Guide

Complete deployment guide for Dogechain Bubblemaps platform.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Vercel Deployment](#vercel-deployment)
3. [Environment Variables](#environment-variables)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Domain Configuration](#domain-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Quick Start

### Prerequisites

- GitHub account
- Vercel account (sign up at https://vercel.com)
- Node.js 20+ installed locally

### 5-Minute Deploy

1. **Push to GitHub**

   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Select your repository
   - Click "Deploy"

3. **Done!**
   - Your app is live at `https://dogechain-bubblemaps.vercel.app`

---

## Vercel Deployment

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up"
3. Sign up with GitHub (recommended)
4. Verify email

### Step 2: Import Repository

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select `dogechain-bubblemaps`
4. Vercel auto-detects Vite ✅

### Step 3: Configure Project

**Framework Preset**: Vite (auto-detected)

**Build Settings** (auto-detected):

```
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

**Click "Deploy"**

### Step 4: Get Deployment URL

Vercel will provide:

```
https://dogechain-bubblemaps.vercel.app
or
https://dogechain-bubblemaps-[your-username].vercel.app
```

---

## Environment Variables

### Required Variables

**Vercel Dashboard** → Project → Settings → Environment Variables

| Variable     | Value        | Environments        |
| ------------ | ------------ | ------------------- |
| `NODE_ENV`   | `production` | Production, Preview |
| `SENTRY_DSN` | Your DSN     | All                 |

### Adding Variables

1. Go to Project Settings
2. Click "Environment Variables"
3. Click "Add New"
4. Enter key and value
5. Select environments
6. Click "Save"

### Re-deploy After Adding Variables

After adding environment variables:

1. Go to "Deployments" tab
2. Click "Redeploy"
3. Or push a new commit

---

## GitHub Actions CI/CD

### Configuration Files

**`.github/workflows/ci.yml`** - Continuous Integration

- Linting
- Type checking
- Testing
- Security audit

**`.github/workflows/deploy.yml`** - Automated Deployment

- Triggers on push to `main`
- Builds and deploys to Vercel

### Setting Up GitHub Secrets

**Required Secrets:**

1. **VERCEL_TOKEN**
   - Go to https://vercel.com/account/tokens
   - Create token with "Full Account" scope
   - Copy token

2. **VERCEL_ORG_ID**
   - Vercel Project → Settings → General
   - Copy "Organization ID"

3. **VERCEL_PROJECT_ID**
   - Vercel Project → Settings → General
   - Copy "Project ID"

**Add to GitHub:**

1. Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret

### Deployment Workflow

**Automatic Deployment:**

```bash
git add .
git commit -m "feat: new feature"
git push origin main
# GitHub Actions automatically deploys to Vercel
```

**Manual Deployment:**

```bash
# Trigger via GitHub Actions UI
# Repository → Actions → Deploy to Production → Run workflow
```

---

## Domain Configuration

### Using Default Vercel URL

Your app is accessible at:

```
https://dogechain-bubblemaps.vercel.app
```

**No additional configuration needed!**

### Adding Custom Domain

**Prerequisites:**

- Purchased domain
- Access to DNS settings

**Steps:**

1. **Add Domain in Vercel**
   - Vercel Dashboard → Project → Settings → Domains
   - Click "Add Domain"
   - Enter your domain (e.g., `bubblemaps.dog`)
   - Click "Add"

2. **Configure DNS**
   - Vercel provides DNS records
   - Go to your domain registrar
   - Add records:

   **A Record** (if using root domain):

   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```

   **CNAME Record** (if using subdomain):

   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **Wait for DNS Propagation**
   - Takes 5-60 minutes
   - Vercel will show status

4. **SSL Certificate**
   - Vercel automatically provisions SSL
   - HTTPS enabled automatically

### Updating CSP for Custom Domain

**File**: `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "connect-src 'self' https://explorer.dogechain.dog https://your-custom-domain.com;"
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

### Build Failures

**Problem**: Build fails in Vercel

**Solutions**:

1. Check build logs in Vercel Dashboard
2. Ensure `package.json` scripts are correct
3. Verify all dependencies are in `package.json`
4. Check TypeScript errors: `npm run type-check`

### Environment Variables Not Working

**Problem**: `process.env.VARIABLE` is undefined

**Solutions**:

1. Ensure variable name matches (case-sensitive)
2. Re-deploy after adding variables
3. Check variable is added to correct environment
4. Use `import.meta.env.VARIABLE` (Vite syntax)

### Deployment Shows Blank Page

**Problem**: Page loads but is blank

**Solutions**:

1. Check browser console for errors
2. Verify `dist/` directory is created
3. Check `index.html` is in `dist/`
4. Ensure routing is correct (Vite history API)

### API Calls Failing

**Problem**: API requests fail with CORS errors

**Solutions**:

1. Check CSP allows API domain
2. Verify API URL is correct
3. Check API is accessible from browser
4. Ensure CORS is enabled on API

### GitHub Actions Failing

**Problem**: Workflow fails in GitHub Actions

**Solutions**:

1. Check secrets are configured correctly
2. Verify Vercel token is valid
3. Check workflow logs in Actions tab
4. Ensure workflow YAML is valid

---

## Pre-Deployment Checklist

### Code Quality

- [ ] `npm run type-check` passes (0 errors)
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] `npm run test:run` passes (if tests exist)

### Configuration

- [ ] Environment variables added to Vercel
- [ ] `.env.local` is in `.gitignore`
- [ ] No hardcoded secrets in source code
- [ ] Security headers configured in `vercel.json`

### Testing

- [ ] Test all features in development
- [ ] Verify API calls work
- [ ] Check responsive design
- [ ] Test with different browsers
- [ ] Verify error handling

### Documentation

- [ ] README.md is up to date
- [ ] `.env.example` is complete
- [ ] CHANGELOG.md is updated
- [ ] LICENSE file is present

---

## Post-Deployment Checklist

### Immediate (Day 1)

- [ ] Access production URL
- [ ] Test all core features
- [ ] Check browser console (0 errors)
- [ ] Verify security headers
- [ ] Test Sentry error tracking
- [ ] Check Vercel logs
- [ ] Monitor API usage

### Week 1

- [ ] Review Sentry error reports daily
- [ ] Check Vercel Analytics
- [ ] Monitor performance metrics
- [ ] Test all user flows
- [ ] Gather user feedback

### Ongoing

- [ ] Review error reports weekly
- [ ] Update dependencies monthly
- [ ] Check security advisories
- [ ] Monitor API rate limits
- [ ] Review logs periodically

---

## Monitoring

### Vercel Dashboard

**URL**: https://vercel.com/dashboard

**Metrics to Track**:

- Page views
- Bandwidth usage
- Build duration
- Edge function usage
- Error rate

### Sentry Dashboard

**URL**: https://sentry.io

**Metrics to Track**:

- Error rate
- Performance
- User impact
- Release health
- Breadcrumbs

### Manual Testing

**Daily Checks**:

- Site loads correctly
- Core features work
- No console errors
- API calls succeed

**Weekly Checks**:

- Security headers present
- SSL certificate valid
- Performance metrics
- Mobile responsiveness

---

## Rollback Procedure

### If Deployment Fails

**Option 1: Vercel Dashboard**

1. Go to "Deployments" tab
2. Find previous successful deployment
3. Click "Promote to Production"

**Option 2: Git Revert**

```bash
git revert HEAD
git push origin main
# GitHub Actions will deploy previous version
```

**Option 3: Redeploy Previous**

```bash
git checkout <previous-commit-hash>
git push origin main --force
```

---

## Performance Optimization

### Vercel-Specific

**Edge Functions**:

- Move static API calls to Edge Functions
- Reduce cold starts

**Image Optimization**:

- Use Vercel Image Optimization
- Serve next-gen formats (WebP, AVIF)

**Analytics**:

- Enable Vercel Analytics
- Monitor Core Web Vitals

### Application-Level

**Code Splitting** (Already configured):

- Vendor chunks separated
- Lazy loading enabled
- Tree shaking active

**Bundle Size**:

- Main bundle: ~369 KB
- Total initial: ~420 KB
- Target: < 500 KB ✅

---

## Scaling Considerations

### Vercel Free Tier Limits

**Hobby Plan** (Free):

- 100GB bandwidth/month
- 100GB-hours of execution
- 6 deployments per day
- Automatic SSL

**When to Upgrade**:

- Bandwidth exceeds 100GB/month
- Need more deployments
- Require edge functions
- Need team collaboration

### Optimization Tips

1. **Reduce Bundle Size**
   - Lazy load components
   - Remove unused dependencies
   - Use dynamic imports

2. **Optimize Images**
   - Compress images
   - Use WebP format
   - Implement lazy loading

3. **API Optimization**
   - Implement caching
   - Use rate limiting
   - Batch requests

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/build.html)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Sentry Documentation](https://docs.sentry.io/)
- [Project Security Guide](docs/SECURITY_GUIDE.md)
- [AI Integration Guide](docs/AI_INTEGRATION.md)

---

## Support

### Vercel Support

- **Documentation**: https://vercel.com/docs
- **Status Page**: https://www.vercel-status.com/
- **Support**: support@vercel.com

### GitHub Issues

- **Vercel GitHub**: https://github.com/vercel/vercel/issues
- **Vite GitHub**: https://github.com/vitejs/vite/issues

### Community

- **Vercel Discord**: https://vercel.com/discord
- **Vite Discord**: https://chat.vitejs.dev/
- **Stack Overflow**: Tag questions with `vercel` or `vite`

---

**Last Updated**: 2026-01-04
**Project**: Dogechain Bubblemaps
**Version**: 1.0.0
