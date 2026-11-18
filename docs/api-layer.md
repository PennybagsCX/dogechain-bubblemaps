# API layer — DogeOS Chikyū fork (T-06)

The fork's backend lives in **`src/api/`** (Express). Every route answers with either
live Chikyū data or the explicit "we do not have this" payload — never a zero dressed
as a number.

```bash
npm run api:dev     # tsx src/api/server.ts → http://127.0.0.1:3001 (vite proxies /api here)
npm run api:proof   # full route transcript + gates → docs/verification/t06-api-layer.txt
```

`vite.config.ts` proxies `/api/*` to `VITE_DEV_API_TARGET || http://localhost:3001`;
`vercel.json` no longer rewrites `/api/*` to the upstream production backend.

## The unavailable contract

Any endpoint whose source does not exist on this testnet returns **HTTP 200** with:

```json
{
  "unavailable": true,
  "reason": "no <x> source on DogeOS Chikyū testnet",
  "chainId": 6281971,
  "chainName": "DogeOS Chikyū Testnet",
  "checkedAt": "2026-11-17T19:05:00.000Z"
}
```

Write endpoints with no store add `"success": false, "recorded": false`. Route-specific
empty arrays (`assets: []`, `tokens: []`, `candles: []`) are included only where an
existing client indexes into them; they are always accompanied by `unavailable: true`.

`src/api/lib/unavailable.ts` is the single builder, so the wording cannot drift.

## Routes

| Method     | Path                                                                                                                                                                          | Source                                                         | Contract                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET        | `/api/health`                                                                                                                                                                 | RPC + fork DB                                                  | `status: healthy\|degraded`, chain id, DB state, cache namespace — always 200                                                                                                        |
| GET        | `/api/stats`                                                                                                                                                                  | Chikyū RPC + blockscout v2 `/stats` + `triggered_alerts` count | live `blockNumber`, `explorer.{totalBlocks,totalTransactions,totalAddresses,transactionsToday,averageBlockTimeMs}`, `alerts` (real count), `searches: null` + `unavailable.searches` |
| GET        | `/api/alerts?wallet=0x…`                                                                                                                                                      | fork Postgres `user_alerts`                                    | `{ success, count, data: AlertApiRow[] }` (real rows or `[]`)                                                                                                                        |
| POST       | `/api/alerts`                                                                                                                                                                 | fork Postgres                                                  | upsert one alert → `{ success, saved, alertId }`                                                                                                                                     |
| POST       | `/api/alerts?action=sync`                                                                                                                                                     | fork Postgres                                                  | `{ success, uploaded, downloaded: 0, conflicts, syncTimestamp }`                                                                                                                     |
| POST       | `/api/alerts?action=trigger`                                                                                                                                                  | fork Postgres `triggered_alerts`                               | `{ success, logged, id, triggeredAt }`                                                                                                                                               |
| DELETE     | `/api/alerts?wallet=…&alertId=…`                                                                                                                                              | fork Postgres                                                  | `{ success, deleted }`                                                                                                                                                               |
| GET        | `/api/explorer-proxy?module=…`                                                                                                                                                | Chikyū blockscout v1 API                                       | live explorer body, 60s cache, module allow-list                                                                                                                                     |
| GET        | `/api/tvl`                                                                                                                                                                    | —                                                              | unavailable (`tvl: null` on blockscout)                                                                                                                                              |
| GET        | `/api/chain-metrics`                                                                                                                                                          | —                                                              | unavailable, `metrics: null` (no DEX indexer)                                                                                                                                        |
| GET        | `/api/market`                                                                                                                                                                 | —                                                              | unavailable (`coin_price: null`, `market_cap: "0"`)                                                                                                                                  |
| GET        | `/api/price?token=…`                                                                                                                                                          | —                                                              | unavailable                                                                                                                                                                          |
| GET        | `/api/candles?token=…`                                                                                                                                                        | —                                                              | unavailable, `candles: []`                                                                                                                                                           |
| GET        | `/api/trending`                                                                                                                                                               | —                                                              | unavailable, `assets: []`                                                                                                                                                            |
| GET        | `/api/trending-wallet`                                                                                                                                                        | —                                                              | unavailable, `assets: []`                                                                                                                                                            |
| GET        | `/api/learned-tokens`                                                                                                                                                         | —                                                              | unavailable, `tokens: []`                                                                                                                                                            |
| GET        | `/api/trending/popularity`                                                                                                                                                    | —                                                              | unavailable, `popularity: {}`                                                                                                                                                        |
| GET        | `/api/recommendations/peers`                                                                                                                                                  | —                                                              | unavailable, `recommendations: []`                                                                                                                                                   |
| POST       | `/api/trending/log`, `/api/interactions`, `/api/analytics/search`, `/api/analytics/click`, `/api/trending/popularity`, `/api/wallet-scan`, `/api/contributions/{submit,vote}` | —                                                              | unavailable + `recorded: false`                                                                                                                                                      |
| GET/DELETE | `/api/cache`                                                                                                                                                                  | process cache                                                  | `{ namespace, entries, keys }` / flush                                                                                                                                               |

`AlertApiRow` = `{ alert_id, name, wallet_address, token_address, token_name,
token_symbol, initial_value, type, created_at, is_active }` — exactly what
`services/db.ts` sends/consumes.

## Why the analytics routes are unavailable

The fork schema (`prisma/migrations/`) has exactly three tables: `diagnostic_logs`,
`triggered_alerts`, `user_alerts`. Upstream's search analytics, popularity scoring,
learned-token index and contribution pipeline lived in tables that do not exist here,
and the interaction counters were what fed "total searches". Rather than seed fake
counts, those endpoints report `unavailable` and `/api/stats` returns `searches: null`
(rendered as "—" in `App.tsx` / `components/Footer.tsx`).

Adding real analytics later is a schema change: add a migration, then replace the
unavailable handler with a real one. Do not edit an applied migration.

## Cache namespacing (no Dogechain-era rows)

| Cache                                                      | Namespace                                | Behaviour on chain change                                                           |
| ---------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| API process cache (`src/api/lib/cache.ts`)                 | `chain-6281971:*`                        | different chain id ⇒ different key; old entries unreachable and TTL-expired         |
| localStorage stats (`hooks/useStatsCounters.ts`)           | `dogeos_stats_cache:6281971`             | legacy `doge_stats_cache` deleted on first read                                     |
| localStorage token metadata (`services/dataService.ts`)    | `dogeos_token_metadata_cache:6281971:v4` | legacy `…_v3`/`…_v2` keys deleted on first read                                     |
| Search cache (`services/searchCache.ts`)                   | key prefix `6281971:`                    | in-memory only; cannot survive a chain switch                                       |
| IndexedDB cache tables (`services/chainCacheNamespace.ts`) | marker `dogeos_cache_namespace:6281971`  | one-time clear of chain-derived tables on first load; user alerts/history untouched |
| Service worker API cache (`vite.config.ts`)                | `api-cache-dogeos-chikyu-6281971-v1`     | new cache name ⇒ old bodies unreachable, `cleanupOutdatedCaches` deletes them       |

`/api/stats` accepts `?t=<ts>` or `?fresh=1` to bypass the read side of the cache, which
is what the client's manual refresh already sends.

## Deviations worth knowing

1. **`app/api/*` holds no code.** The upstream repo shipped empty `app/api/…` folders with
   only agent-memory files; this is a Vite SPA, not a Next.js app, so route handlers
   there would never execute. All handlers live in `src/api/` (see `app/api/README.md`).
   The acceptance grep over `app` + `src/api` is therefore also a guard against
   reintroducing chain literals.
2. **The proxy route was renamed** from the upstream chain-named path to
   `/api/explorer-proxy` and now forwards to `EXPLORER_API` from `lib/chain.ts`.
3. **`/api/health` is 200 even when the DB is down** (`status: "degraded"`, plus an
   explicit `unavailable.database`). A 503 would make the route indistinguishable from a
   chain outage; the body carries the distinction.
4. **Sync never invents downloads.** `POST /api/alerts?action=sync` stores what it is
   given and returns `downloaded: 0`; there is no server-side alert population to merge.

## Verification

`scripts/dogeos-verify/api-layer-proof.sh` starts the API on a throwaway port, curls all
28 checks (including a create→read→trigger→stats→sync→delete alert round-trip against
the fork database), asserts each JSON contract with
`scripts/dogeos-verify/assert_json.py`, runs the `dogechain` grep, `tsc --noEmit` and
`npm run build`, cleans up its synthetic rows and writes the transcript to
`docs/verification/t06-api-layer.txt`.
