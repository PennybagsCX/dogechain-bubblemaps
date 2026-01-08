/**
 * Search Cache Service Worker
 *
 * Provides specialized caching strategies for search operations:
 * - Token search results from API
 * - Search patterns and queries
 * - Offline search capability for cached queries
 *
 * Strategies:
 * - Stale-While-Revalidate for API responses
 * - Cache-First for frequent searches
 * - Network-First for new searches
 */

const SEARCH_CACHE_NAME = "search-cache-v1";
const API_CACHE_NAME = "api-cache-v1";

// Cache search results with query as key
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache API search requests
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleSearchRequest(event.request));
  }
});

/**
 * Handle search API requests with caching strategies
 */
async function handleSearchRequest(request) {
  const url = new URL(request.url);
  const cacheKey = url.href;

  // Try cache first (Cache-First for recent searches)
  const cache = await caches.open(SEARCH_CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    // Return cached response immediately, then update in background
    fetchAndCache(request, cache, cacheKey);
    return cachedResponse;
  }

  // No cache hit, fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone and cache the response
      const responseToCache = networkResponse.clone();
      await cache.put(cacheKey, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    console.error("[Search SW] Network request failed:", error);

    // Try to return a cached response even if expired
    const cachedResponse = await cache.match(cacheKey, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback
    return new Response(JSON.stringify({ error: "Offline" }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }
}

/**
 * Fetch and cache in background (Stale-While-Revalidate)
 */
async function fetchAndCache(request, cache, cacheKey) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(cacheKey, responseToCache);
    }
  } catch (error) {
    console.warn("[Search SW] Background update failed:", error);
  }
}

/**
 * Clean up old caches on activate
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== SEARCH_CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

/**
 * Log installation
 */
self.addEventListener("install", () => {
  console.log("[Search SW] Service worker installed");
  self.skipWaiting();
});
