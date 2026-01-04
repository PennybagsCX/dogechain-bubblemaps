# Security Guide

Production security reference for Dogechain Bubblemaps platform.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Environment Variable Management](#environment-variable-management)
3. [Content Security Policy (CSP)](#content-security-policy-csp)
4. [Rate Limiting](#rate-limiting)
5. [Input Validation](#input-validation)
6. [Public vs Private Secrets](#public-vs-private-secrets)
7. [Production Security Checklist](#production-security-checklist)
8. [Monitoring and Error Tracking](#monitoring-and-error-tracking)

---

## Security Overview

### Security Architecture

Dogechain Bubblemaps implements defense-in-depth security:

```
User Input
    ↓
Zod Validation
    ↓
Rate Limiting
    ↓
API Encryption (HTTPS)
    ↓
Server-Side Processing
    ↓
Output Sanitization
    ↓
User Display
```

### Security Measures Implemented

✅ **Content Security Policy** - Prevents XSS attacks
✅ **Input Validation** - Zod schemas on all inputs
✅ **Rate Limiting** - 60 requests/minute max
✅ **HTTPS Only** - All API calls encrypted
✅ **Security Headers** - HSTS, X-Frame-Options, etc.
✅ **No Hardcoded Secrets** - All via environment variables
✅ **Error Tracking** - Sentry for production monitoring

---

## Environment Variable Management

### Principles

1. **Never commit secrets to Git**
2. **Use `.env.example` as template only**
3. **Store secrets in hosting platform environment variables**
4. **Different values for development/production**

### Files

**`.env.local` (NOT in Git)**
```bash
# Actual secrets - NEVER commit
SENTRY_DSN=https://abc123@sentry.io/456
GEMINI_API_KEY=AIzaSyCabc123...
```

**`.env.example` (IN Git)**
```bash
# Template - safe to commit
SENTRY_DSN=your_sentry_dsn_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### Vercel Environment Variables

**Setup:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add variables for each environment

**Required Variables:**

| Variable | Production | Description |
|----------|-----------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `SENTRY_DSN` | Your DSN | Error tracking |
| `GEMINI_API_KEY` | (Optional) | AI features |

**Accessing in Code:**
```typescript
const dsn = import.meta.env.SENTRY_DSN;
```

---

## Content Security Policy (CSP)

### What is CSP?

Content Security Policy prevents XSS attacks by controlling which resources can be loaded.

### Current CSP Configuration

**File**: `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://aistudiocdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://explorer.dogechain.dog https://dogechain.dog; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
        }
      ]
    }
  ]
}
```

### CSP Directives Explained

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Only load from same origin |
| `script-src` | `'self' https://aistudiocdn.com` | JavaScript sources |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | CSS sources |
| `font-src` | `'self' https://fonts.gstatic.com` | Font sources |
| `img-src` | `'self' data: https:` | Image sources |
| `connect-src` | `'self' https://explorer.dogechain.dog` | API calls |
| `frame-ancestors` | `'none'` | Prevent clickjacking |
| `base-uri` | `'self'` | Restrict `<base>` tags |
| `form-action` | `'self'` | Restrict form submissions |

### Updating CSP for Custom Domains

If you deploy to a custom domain, update `connect-src`:

```json
"connect-src 'self' https://explorer.dogechain.dog https://your-custom-domain.com;"
```

### Testing CSP

**Browser DevTools:**
1. Open Console
2. Look for CSP violations
3. Fix any blocked resources

**Online Tool:**
https://securityheaders.com/

---

## Rate Limiting

### Implementation

**File**: `utils/rateLimit.ts`

**Algorithm**: Sliding window with token bucket

**Configuration:**
```bash
API_RATE_LIMIT_PER_MINUTE=60
API_MAX_RETRIES=3
API_TIMEOUT=8000
```

### How It Works

```
Request → Check Bucket → If tokens available → Process → Deduct token
                    ↓
                 If empty → Return 429 (Too Many Requests)
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Dogechain API | 60/min | Rolling |
| Wallet Scanner | 30/min | Rolling |
| Token Analysis | 20/min | Rolling |

### Customization

**File**: `.env.local`

```bash
# Increase for high-usage scenarios
API_RATE_LIMIT_PER_MINUTE=120

# Decrease for conservative usage
API_RATE_LIMIT_PER_MINUTE=30
```

---

## Input Validation

### Zod Schemas

All user inputs are validated using Zod schemas.

**File**: `utils/validation.ts`

### Example Schemas

**Wallet Address Validation:**
```typescript
const walletAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
  .transform(val => val.toLowerCase());
```

**Token Contract Validation:**
```typescript
const tokenContractSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.enum(['dogechain', 'ethereum', 'bsc']),
});
```

### Validation Flow

```
User Input
    ↓
Zod Schema Parse
    ↓
Invalid? → Return Error
    ↓
Valid → Transform/Sanitize
    ↓
Use in Application
```

### Adding Validation

**1. Define Schema:**
```typescript
import { z } from 'zod';

const mySchema = z.object({
  field1: z.string().min(1).max(100),
  field2: z.number().positive(),
});
```

**2. Validate Input:**
```typescript
try {
  const validated = mySchema.parse(userInput);
  // Use validated data
} catch (error) {
  // Handle validation error
  console.error('Invalid input:', error.errors);
}
```

**3. Display Errors:**
```typescript
if (error instanceof z.ZodError) {
  const errorMessages = error.errors.map(e => e.message);
  setErrors(errorMessages);
}
```

---

## Public vs Private Secrets

### What's Safe to Expose

✅ **Public (Safe in Git/Client-Side)**

| Secret | Why Safe |
|--------|----------|
| Sentry DSN | Designed for public use, error reporting only |
| Public API URLs | Endpoints are public anyway |
| Feature flags | Boolean values, no secrets |
| Configuration values | Non-sensitive settings |

❌ **Private (Keep Secret)**

| Secret | Why Private |
|--------|-------------|
| API keys | Can be used to make API calls on your behalf |
| Database URLs | Direct access to your data |
| Private keys | Cryptographic secrets |
| Session secrets | Can compromise user sessions |
| Webhook URLs | Can be used to send fake events |

### Examples

**✅ Safe (Public):**
```typescript
const DSN = 'https://abc123@sentry.io/456'; // Safe
const API_URL = 'https://explorer.dogechain.dog'; // Public endpoint
const FEATURE_ENABLED = true; // Configuration
```

**❌ Unsafe (Private):**
```typescript
const API_KEY = 'AIzaSyCabc123...'; // Secret! Use serverless function
const DB_URL = 'postgres://user:pass@host...'; // Secret!
const PRIVATE_KEY = '0xabc123...'; // Secret!
```

---

## Production Security Checklist

### Pre-Deployment

- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets hardcoded in source code
- [ ] All inputs validated with Zod
- [ ] Rate limiting configured
- [ ] CSP headers set correctly
- [ ] Security headers enabled
- [ ] HTTPS enforced
- [ ] Error tracking configured

### Post-Deployment

- [ ] Test all forms for XSS
- [ ] Verify CSP in browser DevTools
- [ ] Check security headers with curl
- [ ] Monitor Sentry for errors
- [ ] Review Vercel function logs
- [ ] Test rate limiting
- [ ] Verify API authentication

### Ongoing Monitoring

- [ ] Review Sentry error reports daily
- [ ] Check API usage metrics
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated
- [ ] Review audit logs

---

## Security Headers

### Current Configuration

**File**: `vercel.json`

All security headers are pre-configured:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(self)"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### Header Explanations

| Header | Purpose | Value |
|--------|---------|-------|
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` |
| `X-XSS-Protection` | XSS filter | `1; mode=block` |
| `Referrer-Policy` | Control referrer info | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Control browser features | Minimal permissions |
| `Strict-Transport-Security` | Force HTTPS | `max-age=31536000` |

### Testing Security Headers

**Command Line:**
```bash
curl -I https://your-app.vercel.app
```

**Expected Output:**
```
HTTP/2 200
content-type: text/html; charset=utf-8
x-content-type-options: nosniff
x-frame-options: DENY
x-xss-protection: 1; mode=block
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains
```

---

## Monitoring and Error Tracking

### Sentry Configuration

**File**: `utils/sentry.config.ts`

Sentry captures:
- JavaScript errors
- Unhandled promise rejections
- Performance data
- User feedback

### Setting Up Sentry

1. **Create Account**: https://sentry.io/signup/
2. **Create Project**: React platform
3. **Get DSN**: From project settings
4. **Add to Vercel**: Environment variable `SENTRY_DSN`
5. **Verify**: Check Sentry dashboard for errors

### Error Types Tracked

| Error Type | Severity | Action |
|------------|----------|--------|
| JavaScript errors | High | Fix immediately |
| API failures | Medium | Monitor and fix |
| Performance issues | Low | Optimize if needed |
| User feedback | Medium | Review and address |

### Monitoring Dashboards

**Sentry Dashboard:**
- Error rate
- Performance metrics
- User impact
- Release health

**Vercel Analytics:**
- Page views
- Bandwidth usage
- Edge function calls
- Build duration

---

## Security Best Practices

### Development

1. **Never disable security features**
   ```typescript
   // ❌ BAD
   process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

   // ✅ GOOD
   // Always use HTTPS
   ```

2. **Validate all inputs**
   ```typescript
   // ❌ BAD
   const address = req.body.address;

   // ✅ GOOD
   const address = walletAddressSchema.parse(req.body.address);
   ```

3. **Sanitize outputs**
   ```typescript
   // ✅ GOOD
   const sanitized = DOMPurify.sanitize(userInput);
   ```

### Production

1. **Keep dependencies updated**
   ```bash
   npm audit
   npm update
   ```

2. **Use HTTPS only**
   ```typescript
   // ✅ GOOD
   fetch('https://api.example.com/data');

   // ❌ BAD
   fetch('http://api.example.com/data');
   ```

3. **Enable security headers**
   - Already configured in `vercel.json`
   - Don't remove or weaken

### Deployment

1. **Environment-specific secrets**
   - Development: `.env.local`
   - Production: Vercel environment variables

2. **Rotate credentials regularly**
   - Change API keys every 90 days
   - Update Sentry DSN if compromised

3. **Review access logs**
   - Check who has access
   - Revoke unnecessary permissions

---

## Troubleshooting Security Issues

### Problem: CSP Violations in Console

**Symptoms:**
- Errors in browser console about CSP
- Resources not loading

**Solutions:**
1. Check what's being blocked
2. Update CSP to allow resource
3. Use nonce or hash for inline scripts

### Problem: Rate Limiting Too Aggressive

**Symptoms:**
- Legitimate requests blocked
- 429 errors

**Solutions:**
1. Increase rate limit in `.env.local`
2. Implement user-based rate limiting
3. Add rate limit status indicator

### Problem: XSS Vulnerabilities

**Symptoms:**
- Suspicious scripts executing
- Data corruption

**Solutions:**
1. Enable React's built-in XSS protection (automatic)
2. Validate all inputs with Zod
3. Sanitize user-generated content
4. Never use `dangerouslySetInnerHTML`

---

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Security Headers](https://securityheaders.com/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Zod Validation](https://zod.dev/)

---

**Last Updated**: 2026-01-04
**Project**: Dogechain Bubblemaps
**Version**: 1.0.0
