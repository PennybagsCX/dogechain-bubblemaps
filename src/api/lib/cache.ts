/**
 * Chain-namespaced TTL cache for the API layer.
 *
 * The upstream backend cached responses (stats, trending, proxy) in a process-wide map
 * with keys that had no chain identity, so a fork pointed at a different chain could
 * serve rows produced by the pre-fork backend. Every key here is prefixed with
 * `chain-<chainId>:` (`CACHE_NAMESPACE`), which makes a pre-fork key unreachable
 * by construction: a different chain id produces a different key, so the old rows can
 * never be read back, and they expire on their own TTL.
 *
 * This cache is in-process only (no Redis, no shared store), which is the honest
 * scope of this fork: one dev/API process serving one chain.
 */

import { CHAIN_ID } from "../../../lib/chain";

interface CacheEntry {
  value: unknown;
  storedAt: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Prefix every key is built from. A chain switch changes the whole namespace. */
export const CACHE_NAMESPACE = `chain-${CHAIN_ID}`;

/**
 * Build a namespaced cache key.
 *
 * @param name - Logical name of the cached value, e.g. "stats".
 * @param params - Optional query-ish parameters; empty/undefined values are dropped and
 *                 the rest are sorted so parameter order never splits one key in two.
 */
export function cacheKey(name: string, params?: Record<string, string | undefined>): string {
  const suffix = params
    ? Object.entries(params)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : "";
  return suffix ? `${CACHE_NAMESPACE}:${name}?${suffix}` : `${CACHE_NAMESPACE}:${name}`;
}

export interface CacheLookup<T> {
  value: T;
  key: string;
  ageMs: number;
  expiresInMs: number;
}

/** Read a live entry (expired entries are dropped on read). */
export function readCache<T>(key: string): CacheLookup<T> | null {
  const entry = store.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return {
    value: entry.value as T,
    key,
    ageMs: now - entry.storedAt,
    expiresInMs: entry.expiresAt - now,
  };
}

/** Store a value under a namespaced key. TTL is clamped to a sane minimum. */
export function writeCache(key: string, value: unknown, ttlMs: number): void {
  const ttl = Math.max(1_000, Math.floor(ttlMs));
  const now = Date.now();
  store.set(key, { value, storedAt: now, expiresAt: now + ttl });
}

/** Drop every cached value (used by tests and by the `/api/cache` admin route). */
export function clearCache(): number {
  const removed = store.size;
  store.clear();
  return removed;
}

/** Introspection for `/api/health` and the proof script. */
export function cacheInfo(): { namespace: string; entries: number; keys: string[] } {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  return { namespace: CACHE_NAMESPACE, entries: store.size, keys: [...store.keys()] };
}
