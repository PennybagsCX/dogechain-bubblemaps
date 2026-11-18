# `app/api/` — no handlers here (by design)

This directory (and `app/api/distribution/`, `app/api/network-health/`,
`app/api/trending/log/`) contains **no route code** — only agent-memory `CLAUDE.md` files
inherited from the upstream repository. The upstream project ran those handlers in a
separate Next.js deployment; this fork is a Vite single-page app, so a `route.ts` placed
here would never be built, bundled or executed.

The fork's API layer is the Express application in **`src/api/`**:

```
src/api/
  index.ts                 createApiApp() — middleware, route mounting, /api/health
  server.ts                standalone server (npm run api:dev)
  lib/cache.ts             chain-namespaced TTL cache
  lib/chainData.ts         Chikyū RPC + blockscout reads
  lib/db.ts                Prisma client for the fork-local Postgres
  lib/unavailable.ts       the { unavailable: true, reason } builder
  routes/stats.ts          /api/stats, /api/cache
  routes/alerts.ts         /api/alerts (CRUD + sync + trigger)
  routes/chainMetrics.ts   /api/tvl, /api/market, /api/price, /api/candles, /api/chain-metrics
  routes/analytics.ts      trending / learning / analytics endpoints (unavailable)
  routes/explorerProxy.ts  /api/explorer-proxy → blockscout
```

See `docs/api-layer.md` for the route table, the unavailable contract, the cache
namespacing rules and how to run the proof script. Do not add Next.js-style handlers
here; add a router under `src/api/routes/` and mount it in `src/api/index.ts`.
