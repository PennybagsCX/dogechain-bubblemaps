# API Reference

Complete reference for the Dogechain Bubblemaps Backend API.

## Overview

**Base URL:** `https://dogechain-bubblemaps-api.vercel.app`

**Authentication:** None required (public API)

**CORS:** Configured for `https://www.dogechain-bubblemaps.xyz`

**Rate Limiting:** Implemented on specific endpoints

**Content Type:** `application/json`

---

## Quick Start

```bash
# Health check
curl https://dogechain-bubblemaps-api.vercel.app/api/health

# Get trending tokens
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending?type=TOKEN&limit=10"

# Log a search
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/trending/log \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
    "assetType": "TOKEN",
    "symbol": "DOGE",
    "name": "DogeCoin"
  }'
```

---

## Endpoints

### Analytics Endpoints

#### POST /api/analytics/search

Track search query events for aggregate learning and analytics.

**Request Body:**

```typescript
{
  sessionId: string;      // 64-character hex session ID
  query: string;           // Search query (2-500 characters)
  results: string[];       // Array of token addresses (max 100)
  resultCount: number;     // Number of results
  timestamp: number;       // Unix timestamp in milliseconds
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "saved": true
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields or invalid data
- `500 Internal Server Error` - Database error

**Example:**

```bash
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/analytics/search \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "7fe237cbd2ca8c9e5e624f47e154dfda1234567890123456789012345678901",
    "query": "DOGE",
    "results": ["0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2"],
    "resultCount": 1,
    "timestamp": 1704556800000
  }'
```

**Use Cases:**

- Track what users are searching for
- Build search analytics and insights
- Improve search relevance over time

---

#### POST /api/analytics/click

Track click events on search results for popularity scoring.

**Request Body:**

```typescript
{
  sessionId: string; // 64-character hex session ID
  query: string; // Original search query
  clickedAddress: string; // Token address that was clicked
  resultRank: number; // Position in results (0-indexed)
  resultScore: number; // Relevance score
  timeToClickMs: number; // Time from search to click (ms)
  timestamp: number; // Unix timestamp in milliseconds
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "saved": true
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields or invalid data
- `500 Internal Server Error` - Database error

**Example:**

```bash
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/analytics/click \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "7fe237cbd2ca8c9e5e624f47e154dfda1234567890123456789012345678901",
    "query": "DOGE",
    "clickedAddress": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
    "resultRank": 0,
    "resultScore": 95.5,
    "timeToClickMs": 1500,
    "timestamp": 1704556801500
  }'
```

**Use Cases:**

- Measure search result relevance
- Calculate click-through rates
- Improve ranking algorithms

---

### Trending Endpoints

#### GET /api/trending

Get trending tokens and NFTs based on search frequency.

**Query Parameters:**

| Parameter | Type   | Default | Description                      |
| --------- | ------ | ------- | -------------------------------- |
| `type`    | string | "ALL"   | Filter: "TOKEN", "NFT", or "ALL" |
| `limit`   | number | 20      | Max results (1-100)              |

**Response (200 OK):**

```json
{
  "assets": [
    {
      "address": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
      "symbol": "DOGE",
      "name": "DogeCoin",
      "type": "TOKEN",
      "velocityScore": 95.5,
      "totalSearches": 1500,
      "recentSearches": 450,
      "previousSearches": 1050,
      "rank": 1
    }
  ],
  "cached": true,
  "stale": false,
  "timestamp": "2026-01-06T12:00:00.000Z"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid query parameters
- `500 Internal Server Error` - Database error

**Example:**

```bash
# Get top 10 trending tokens
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending?type=TOKEN&limit=10"

# Get all trending assets
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending?type=ALL&limit=20"
```

**Use Cases:**

- Display trending tokens on homepage
- Show popular searches
- Discover trending assets

**Caching:** 5 minutes with stale-while-revalidate

---

#### POST /api/trending/log

Log search queries for trending calculation (fire-and-forget).

**Request Body:**

```typescript
{
  address: string;          // Token contract address (0x...)
  assetType: "TOKEN" | "NFT";
  symbol?: string;          // Optional token symbol
  name?: string;            // Optional token name
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "logged": true
}
```

**Error Responses:**

- `400 Bad Request` - Invalid address format or missing fields
- `200 OK` - Always returns 200, logs failures silently (fire-and-forget)

**Example:**

```bash
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/trending/log \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
    "assetType": "TOKEN",
    "symbol": "DOGE",
    "name": "DogeCoin"
  }'
```

**Use Cases:**

- Track search frequency for trending
- Fire-and-forget logging (doesn't block UI)
- Increment search counts on tokens

**Note:** This endpoint is designed for fire-and-forget operation. It returns success even if logging fails to prevent blocking the user interface.

---

#### GET /api/trending/popularity

Get popularity metrics for multiple tokens.

**Query Parameters:**

| Parameter     | Type   | Required | Description               |
| ------------- | ------ | -------- | ------------------------- |
| `addresses[]` | string | Yes      | Token addresses (max 100) |

**Response (200 OK):**

```json
{
  "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2": {
    "tokenAddress": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
    "searchCount": 150,
    "clickCount": 75,
    "ctr": 0.5,
    "lastSearched": 1704556800000,
    "lastClicked": 1704556815000
  }
}
```

**Error Responses:**

- `400 Bad Request` - No addresses provided or invalid address format
- `404 Not Found` - Endpoint not configured (returns null)
- `500 Internal Server Error` - Database error

**Example:**

```bash
curl "https://dogechain-bubblemaps-api.vercel.app/api/trending/popularity?addresses[]=0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2&addresses[]=0x1234567890123456789012345678901234567890"
```

**Use Cases:**

- Batch fetch popularity metrics
- Boost search results by popularity
- Display click-through rates

---

#### POST /api/trending/popularity

Update popularity metrics for a token (increment counters).

**Request Body:**

```typescript
{
  tokenAddress: string; // Token contract address
  appearedInResults: boolean; // Whether token appeared in search
  wasClicked: boolean; // Whether user clicked on token
  timestamp: number; // Unix timestamp in milliseconds
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "updated": true
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields or invalid address
- `404 Not Found` - Endpoint not configured (returns success)
- `500 Internal Server Error` - Database error

**Example:**

```bash
curl -X POST https://dogechain-bubblemaps-api.vercel.app/api/trending/popularity \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
    "appearedInResults": true,
    "wasClicked": true,
    "timestamp": 1704556800000
  }'
```

**Use Cases:**

- Increment search counters
- Increment click counters
- Track last interaction time

---

### Recommendations Endpoints

#### GET /api/recommendations/peers

Get collaborative filtering recommendations based on peer behavior.

**Query Parameters:**

| Parameter | Type   | Default | Description                      |
| --------- | ------ | ------- | -------------------------------- |
| `query`   | string | -       | Search query (required)          |
| `type`    | string | "TOKEN" | "TOKEN" or "NFT"                 |
| `limit`   | number | 5       | Number of recommendations (1-20) |

**Response (200 OK):**

```json
{
  "recommendations": [
    {
      "address": "0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2",
      "symbol": "DOGE",
      "name": "DogeCoin",
      "type": "TOKEN",
      "score": 0.85
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Missing query or invalid parameters
- `404 Not Found` - No recommendations found
- `500 Internal Server Error` - Database error

**Example:**

```bash
# Get peer recommendations for "DOGE"
curl "https://dogechain-bubblemaps-api.vercel.app/api/recommendations/peers?query=DOGE&type=TOKEN&limit=5"
```

**Use Cases:**

- Suggest related tokens
- Collaborative filtering
- Discover similar assets

---

### Proxy Endpoints

#### GET /api/dogechain-proxy

Proxy requests to Dogechain Explorer API to avoid CORS issues.

**Query Parameters:**

All query parameters are forwarded to `https://explorer.dogechain.dog/api`

**Response:** Returns the exact response from Dogechain Explorer API

**Error Responses:**

- `400 Bad Request` - Invalid request to upstream API
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Upstream API error

**Example:**

```bash
# Get token supply from Dogechain Explorer
curl "https://dogechain-bubblemaps-api.vercel.app/api/dogechain-proxy?module=stats&action=tokensupply&contractaddress=0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2"

# Get contract source code
curl "https://dogechain-bubblemaps-api.vercel.app/api/dogechain-proxy?module=contract&action=getsourcecode&address=0xbdaD927604c5cB78F15b3669a92Fa5A1427d33a2"
```

**Use Cases:**

- Avoid CORS issues with Dogechain Explorer API
- Avoid SSL certificate issues on mobile browsers
- Single source of truth for blockchain data

**Caching:** 1 minute cache
**CORS:** Configured for public access

---

### System Endpoints

#### GET /api/health

Health check endpoint for monitoring and uptime checks.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-06T12:00:00.000Z"
}
```

**Error Responses:**

- `503 Service Unavailable` - Database connection failed

**Example:**

```bash
curl https://dogechain-bubblemaps-api.vercel.app/api/health
```

**Use Cases:**

- Health monitoring
- Uptime checks
- Database connection verification

---

## Error Codes

### HTTP Status Codes

| Code                        | Meaning       | Description                              |
| --------------------------- | ------------- | ---------------------------------------- |
| `200 OK`                    | Success       | Request completed successfully           |
| `400 Bad Request`           | Invalid Input | Missing or invalid request parameters    |
| `404 Not Found`             | Not Found     | Endpoint or resource not found           |
| `500 Internal Server Error` | Server Error  | Database or server error                 |
| `503 Service Unavailable`   | Unavailable   | Service is down or database disconnected |

### Common Error Responses

**Missing Required Field (400):**

```json
{
  "error": "Missing required fields"
}
```

**Invalid Address Format (400):**

```json
{
  "error": "Invalid Ethereum address: 0xINVALID"
}
```

**Database Error (500):**

```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Rate limiting is implemented on specific endpoints to prevent abuse:

- **Analytics endpoints:** 60 requests/minute per IP
- **Trending endpoints:** 60 requests/minute per IP
- **Proxy endpoint:** 120 requests/minute per IP

**Rate Limit Response (429 Too Many Requests):**

```json
{
  "error": "Rate limit exceeded",
  "limit": 60,
  "remaining": 0,
  "resetAt": "2026-01-06T12:01:00.000Z"
}
```

**Best Practices:**

- Implement exponential backoff on rate limit errors
- Cache responses when appropriate
- Use batch endpoints when available

---

## Troubleshooting

### CSP Violations

**Symptom:** Browser console shows "Refused to connect to https://dogechain-bubblemaps-api.vercel.app"

**Cause:** Content Security Policy blocking API requests

**Solution:**

1. Ensure `vercel.json` has correct CSP headers
2. Add backend URL to `connect-src` directive
3. Remove conflicting CSP meta tags from HTML

**Reference:** See `vercel.json` configuration

---

### CORS Errors

**Symptom:** Browser shows "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS not configured correctly

**Solution:**

1. Verify `next.config.js` in backend has CORS headers
2. Ensure frontend URL is in allowed origins
3. Check that `Access-Control-Allow-Methods` includes required methods

**Reference:** See backend `next.config.js` configuration

---

### Empty Search Results

**Symptom:** API calls return 400 Bad Request for searches with no results

**Cause:** Services attempting to log/search with empty data arrays

**Solution:**

- Search analytics skip logging when `results.length === 0`
- Popularity scoring skips API calls when `addresses.length === 0`
- This is expected behavior to avoid unnecessary API calls

**Expected Console Log:**

```
[Analytics] Skipped tracking search with no results: "0x..."
```

---

### Environment Variable Issues

**Symptom:** API calls going to wrong URL (e.g., `www.dogechain-bubblemaps.xyz/api/...`)

**Cause:** `VITE_API_BASE_URL` or `VITE_ANALYTICS_API_ENDPOINT` not set correctly

**Solution:**

1. Check environment variables in Vercel dashboard
2. Verify GitHub Actions workflow has correct env vars
3. Ensure variables are prefixed with `VITE_` for frontend
4. Redeploy after changing variables

**Required Variables:**

```bash
VITE_API_BASE_URL=https://dogechain-bubblemaps-api.vercel.app
VITE_ANALYTICS_API_ENDPOINT=https://dogechain-bubblemaps-api.vercel.app
```

---

### Trailing Slash 404s

**Symptom:** `GET https://dogechain-bubblemaps-api.vercel.app/? 404`

**Cause:** Analytics services constructing URLs incorrectly (using base URL as full URL)

**Solution:**
Services should append endpoint paths to base URL:

```typescript
// ❌ Wrong
const apiEndpoint = import.meta.env.VITE_ANALYTICS_API_ENDPOINT;
// Results in: fetch("https://dogechain-bubblemaps-api.vercel.app")

// ✅ Correct
const apiBase = import.meta.env.VITE_ANALYTICS_API_ENDPOINT;
const apiEndpoint = apiBase ? `${apiBase}/api/analytics/search` : "/api/analytics/search";
// Results in: fetch("https://dogechain-bubblemaps-api.vercel.app/api/analytics/search")
```

**Reference:** See `services/searchAnalytics.ts` and `services/popularityScoring.ts`

---

## SDK and Integration Examples

### JavaScript/TypeScript

```typescript
const API_BASE = "https://dogechain-bubblemaps-api.vercel.app";

// Get trending tokens
async function getTrendingTokens(limit = 10) {
  const response = await fetch(`${API_BASE}/api/trending?type=TOKEN&limit=${limit}`);
  return response.json();
}

// Log a search
async function logSearch(address, assetType, symbol, name) {
  await fetch(`${API_BASE}/api/trending/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, assetType, symbol, name }),
  });
}

// Health check
async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`);
  return response.json();
}
```

### Python

```python
import requests

API_BASE = 'https://dogechain-bubblemaps-api.vercel.app'

def get_trending_tokens(limit=10):
    response = requests.get(
        f'{API_BASE}/api/trending',
        params={'type': 'TOKEN', 'limit': limit}
    )
    return response.json()

def log_search(address, asset_type, symbol=None, name=None):
    requests.post(
        f'{API_BASE}/api/trending/log',
        json={
            'address': address,
            'assetType': asset_type,
            'symbol': symbol,
            'name': name
        }
    )

def check_health():
    response = requests.get(f'{API_BASE}/api/health')
    return response.json()
```

---

## Changelog

### January 2026 - API Fixes

- ✅ Fixed URL construction in analytics services
- ✅ Added proper base URL handling
- ✅ Implemented skip logic for empty results
- ✅ Resolved 404 and 400 errors

### Previous Releases

- Initial implementation of all 8 API endpoints
- Database schema with 4 tables
- CORS configuration for frontend access
- Health monitoring endpoint

---

## Support

For issues or questions:

- Check troubleshooting section above
- Review deployment guide: `docs/DEPLOYMENT_GUIDE.md`
- Check frontend console for detailed error messages
- Verify environment variables are set correctly

---

**Last Updated:** 2026-01-06

**API Version:** 1.0.0

**Base URL:** `https://dogechain-bubblemaps-api.vercel.app`
