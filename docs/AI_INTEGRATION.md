# AI Integration Guide

This guide explains how to securely integrate AI features into Dogechain Bubblemaps, addressing concerns about public repositories and API key security.

---

## Table of Contents

1. [Current Security Setup](#current-security-setup)
2. [Public Repository Safety](#public-repository-safety)
3. [Why AI Features Are Currently Disabled](#why-ai-features-are-currently-disabled)
4. [Secure AI Implementation Options](#secure-ai-implementation-options)
5. [Serverless Proxy Implementation](#serverless-proxy-implementation)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Current Security Setup ✅

Your Dogechain Bubblemaps project is **already secure** for public repository deployment:

### What's Protected

**`.env.local` (NOT in Git)**
```bash
# This file is in .gitignore - NEVER committed
SENTRY_DSN=https://abc123@sentry.io/456
GEMINI_API_KEY=AIzaSyCabc123xyz...
```

**`.env.example` (Committed to Git)**
```bash
# This template IS in Git - safe to share
SENTRY_DSN=your_sentry_dsn_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### Key Security Points

✅ **`.env.local` is in `.gitignore`** - Never committed to version control
✅ **Only `.env.example` is in Git** - Contains placeholder text only
✅ **No hardcoded secrets in source code** - All secrets use environment variables
✅ **Vercel environment variables** - Secrets stored securely on the server

---

## Public Repository Safety

### What GitHub Users Will See

When you make your repository public, users will see:

✅ **All source code** - TypeScript, React components, services, etc.
✅ **`.env.example`** - Template file with placeholders like `your_api_key_here`
✅ **Configuration files** - vite.config.ts, vercel.json, package.json, etc.

### What GitHub Users Will NOT See

❌ **Your actual `.env.local` file** - This file is ignored by Git
❌ **Your Vercel environment variables** - Stored server-side, not in code
❌ **Your API keys** - Never committed to version control

### Example: What Users See

**In your public repository:**
```bash
# .env.example (SAFE - users see this)
GEMINI_API_KEY=your_gemini_api_key_here
SENTRY_DSN=your_sentry_dsn_here
```

**On your machine (NOT in Git):**
```bash
# .env.local (PRIVATE - users don't see this)
GEMINI_API_KEY=AIzaSyCabc123xyz...
SENTRY_DSN=https://abc123@sentry.io/456
```

**In Vercel dashboard (NOT in Git):**
```
Environment Variables:
NODE_ENV = production
SENTRY_DSN = https://abc123@sentry.io/456
GEMINI_API_KEY = AIzaSyCabc123xyz...
```

---

## Why AI Features Are Currently Disabled

### Current Implementation

**File**: `services/geminiService.ts`

```typescript
const isAIEnabled = (): boolean => {
    // AI features require backend proxy - disabled for security
    return false;
};
```

### Why Disabled?

**Problem with Client-Side API Keys**

If you put API keys in environment variables and use them directly in React code:

```typescript
// ❌ INSECURE - Don't do this!
const apiKey = import.meta.env.GEMINI_API_KEY;
fetch('https://generativelanguage.googleapis.com/v1/models/...' + apiKey);
```

**During build process:**
1. Vite includes environment variables in the JavaScript bundle
2. Anyone can inspect your site's JavaScript in browser DevTools
3. API keys are visible in plain text in the bundled code
4. Anyone can steal your API key and use it themselves

**This is why AI features are disabled** - to prevent accidental API key exposure.

---

## Secure AI Implementation Options

### Option 1: Keep AI Disabled (Current State) ✅

**Pros:**
- Zero security risk
- App works perfectly without AI
- No API costs
- Simpler architecture

**Cons:**
- No AI-powered features
- Missed opportunities for intelligent analysis

**Best for:** MVP launch, portfolio showcase, proof of concept

---

### Option 2: Enable AI with Serverless Proxy (Recommended) 🔒

**Architecture:**

```
User's Browser → Your Vercel Serverless Function → Gemini API
                     ↓
                API Key Here (Hidden)
```

**Pros:**
- API key never exposed to browser
- Users can use AI features safely
- You can add rate limiting server-side
- Monitor and control usage

**Cons:**
- Requires implementation work (2-4 hours)
- Need Vercel Pro plan for unlimited functions (free tier has limits)

**Best for:** Production apps, public repositories, portfolio projects

---

## Serverless Proxy Implementation

### Why This Is Secure

```
❌ INSECURE (Client-Side):
Browser → Gemini API (API key visible in browser)

✅ SECURE (Server-Side):
Browser → Your API → Gemini API (API key hidden on server)
```

### Implementation Steps

#### Step 1: Create Vercel Serverless Function

**File**: `api/gemini.ts` (create this file)

```typescript
// api/gemini.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variables (server-side only!)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { prompt } = req.body;

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    const data = await response.json();

    // Return only the AI response (API key stays on server!)
    return res.status(200).json(data);

  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}
```

#### Step 2: Add API Key to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - Key: `GEMINI_API_KEY`
   - Value: Your actual API key from Google AI Studio
   - Environments: Production, Preview, Development

#### Step 3: Update Frontend to Call Your API

**File**: `services/geminiService.ts`

```typescript
// Update the service to call YOUR serverless function
export async function generateAnalysis(prompt: string): Promise<string> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate analysis');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error('Error generating analysis:', error);
    throw error;
  }
}
```

#### Step 4: Enable AI Feature Flag

**File**: `.env.local`

```bash
FEATURE_AI_ENABLED=true
```

#### Step 5: Test Locally

```bash
npm run dev
# Test the AI feature
# API key stays on your machine!
```

#### Step 6: Deploy to Vercel

```bash
git add .
git commit -m "feat: add secure AI integration with serverless proxy"
git push origin main
# Vercel will deploy automatically
# API key is loaded from Vercel environment variables
```

### Security Benefits

✅ **API key never in browser** - Stays server-side
✅ **Rate limiting** - Add throttling in serverless function
✅ **Monitoring** - Track usage in serverless function logs
✅ **Revocable** - Can rotate API key without updating code
✅ **Public repo safe** - Even if repo is public, API key is hidden

---

## Security Best Practices

### ✅ DO

1. **Keep `.env.local` in `.gitignore`**
   ```gitignore
   .env.local
   .env.*.local
   ```

2. **Use `.env.example` as template only**
   ```bash
   # .env.example
   API_KEY=your_api_key_here  # Placeholder, not real key
   ```

3. **Store API keys server-side**
   - Use Vercel environment variables
   - Use serverless functions for API calls
   - Never include API keys in client-side code

4. **Use environment-specific variables**
   ```bash
   # Production: Vercel environment variables
   # Development: .env.local (not in Git)
   ```

5. **Monitor API usage**
   - Check Vercel function logs
   - Set up Sentry error tracking
   - Review API key usage in Google AI Console

### ❌ DON'T

1. **Never commit `.env.local`**
   ```bash
   # Check what's being committed
   git status
   # If .env.local appears, add it to .gitignore!
   ```

2. **Never hardcode API keys**
   ```typescript
   // ❌ BAD
   const apiKey = 'AIzaSyCabc123...'; // Don't do this!

   // ✅ GOOD
   const apiKey = import.meta.env.GEMINI_API_KEY;
   ```

3. **Never use client-side API keys for production**
   - Development-only is OK (with warnings)
   - Production requires server-side proxy

4. **Never share API keys in GitHub Issues/Gists**
   - Use placeholder text like `your_api_key_here`
   - Document that users need their own keys

---

## Sentry DSN Safety

### Is Sentry DSN Safe to Expose?

**YES!** Sentry DSNs are designed to be public.

### Why Sentry DSN is Safe

**What it does:**
- Sends error reports to your Sentry dashboard
- Allows clients to report errors only
- Cannot read data from your Sentry account
- Cannot delete or modify your Sentry data

**What it CANNOT do:**
- ❌ Access your Sentry dashboard
- ❌ Read your project data
- ❌ Modify your settings
- ❌ View other users' error reports

**Analogy:** Think of it like an email address for errors - anyone can send emails TO it, but they can't read your inbox.

### Example: Public Sentry DSNs

Many major companies have public Sentry DSNs in their open-source code:
- Mozilla Firefox
- WordPress
- Next.js
- And thousands more

**It's completely safe and standard practice.**

---

## Environment Variable Management

### Development (Local)

**File**: `.env.local` (NOT in Git)

```bash
# Your local development secrets
SENTRY_DSN=https://abc123@sentry.io/456
GEMINI_API_KEY=AIzaSyCabc123...
```

### Production (Vercel)

**Location**: Vercel Dashboard → Settings → Environment Variables

```
NODE_ENV = production
SENTRY_DSN = https://abc123@sentry.io/456
GEMINI_API_KEY = AIzaSyCabc123...
```

**Benefits:**
- Encrypted at rest
- Never exposed in Git
- Easy to rotate
- Environment-specific values

---

## Troubleshooting

### Problem: API key exposed in browser DevTools

**Solution:**
You're using the API key client-side. Move to serverless function (see [Serverless Proxy Implementation](#serverless-proxy-implementation)).

### Problem: `.env.local` accidentally committed

**Solution:**
```bash
# Remove from Git history (use with caution!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# Add to .gitignore
echo ".env.local" >> .gitignore

# Commit the changes
git add .gitignore
git commit -m "chore: remove .env.local from version control"
```

### Problem: Serverless function not working on Vercel

**Solution:**
1. Check Vercel function logs
2. Verify environment variables are set
3. Ensure function is in `/api/` directory
4. Check function is exported as default

### Problem: API calls failing with 401/403 errors

**Solution:**
1. Verify API key is correct
2. Check API key has required permissions
3. Ensure API key is not expired
4. Check billing is active for API service

---

## Summary

### Your Current Setup is Secure ✅

- `.env.local` is in `.gitignore` (not in Git)
- Only `.env.example` is committed (placeholders only)
- Sentry DSN is safe to expose (designed for public use)
- AI features are disabled to prevent accidental exposure

### For Future AI Implementation

- Use serverless functions for API calls
- Keep API keys in Vercel environment variables
- Never expose API keys to client-side code
- Your public repository will remain secure

### Quick Reference

| What | Safe to Commit? | Why |
|------|----------------|-----|
| `.env.local` | ❌ NO | Contains actual secrets |
| `.env.example` | ✅ YES | Contains placeholders only |
| Sentry DSN | ✅ YES | Designed to be public |
| API keys in code | ❌ NO | Will be exposed in bundle |
| Serverless functions | ✅ YES | API keys server-side |

---

## Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Google AI Studio](https://makersuite.google.com/app/apikey)
- [Sentry Documentation](https://docs.sentry.io/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

---

**Last Updated**: 2026-01-04
**Project**: Dogechain Bubblemaps
**Version**: 1.0.0
