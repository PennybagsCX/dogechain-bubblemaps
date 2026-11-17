# DogeOS Port Plan — DogeOS Bubblemaps (Chikyū testnet)

Companion to `docs/DOGEOS_PORT_DECISION.md`. Every task below becomes a Kanban card assigned
`developer`, parented to the umbrella card in dependency order. Each task names the artifact that
proves it.

Chain facts (single source of truth after T-01: `lib/chain.ts`): id `6281971`,
RPC `https://rpc.testnet.dogeos.com/`, explorer `https://dogeos-testnet.l2scan.co`,
API `https://blockscout.testnet.dogeos.com`, native `DOGE`/18.

## Phase 0 — Fork and baseline (done)

**T-00 Copy + baseline** — `rsync -a` to `Dogechain-Bubblemaps-DogeOS`, excluding `node_modules`,
`coverage`, `dev-dist`, `.DS_Store`.
_Proof (verified 2026-11-17 by the umbrella run t_ea0e676a, not a claim):_ source non-excluded set =
**925 files / 38,244,061 bytes**; fork at copy time matched path-for-path, with the only differences
being the four new port artifacts (`docs/DOGEOS_PORT_DECISION.md`, `docs/DOGEOS_PORT_PLAN.md`,
`lib/chain.ts`, `services/evmRPC.ts` replacing `services/dogechainRPC.ts`) and 9 `.DS_Store` files
deliberately not copied. `npm ci` completes in the fork (`node_modules` 1.1 GB); `dist/` build output
is generated in the fork, never copied. _(Completed in the umbrella run.)_

## Phase 1 — Chain identity

**T-01 `lib/chain.ts` single source of truth.**
Create the module (`CHAIN`, `CHAIN_ID`, `RPC_URL`, `EXPLORER_URL`, `EXPLORER_API`, `EXPLORER_API_V2`,
`NATIVE_SYMBOL`, `FAUCET_URL`, `explorerTxUrl()`, `explorerAddressUrl()`), make `wagmi.ts` and
`services/dogechainRPC.ts` thin wrappers over it, delete the duplicate chain literals.
_Acceptance:_ `grep -rn 'dogechain.dog' --include=*.ts --include=*.tsx` returns 0 hits outside
historical docs; `grep -rn '6281971'` finds exactly one module plus its imports; `tsc --noEmit` clean.
_Depends on:_ T-00.

**T-02 Explorer-API retarget.** Point every explorer client (`dataService.ts`, `factoryDiscovery.ts`,
`lpBatchScanner.ts`, `discoverFactories.ts`, `userContributions.ts`, `tokenSearchService.ts`) at the
chain module's API base; replace the Dogechain-only `getTokenHolders` call with v2
`/tokens/{addr}/holders`; drop price/market panels that have no testnet source.
_Acceptance:_ one live fetch per retargeted endpoint returns HTTP 200 + parseable body against
blockscout; grep for `explorer.dogechain.dog` = 0 in code.
_Depends on:_ T-01.

## Phase 2 — Scanner and graph

**T-03 Transfer scanning on Chikyū.** `services/dogechainRPC.ts` (renamed `services/evmRPC.ts` with a
compat re-export) scans `Transfer` logs in ≤9k-block chunks from head back to a deploy anchor, resolves
timestamps via `getBlock`, and returns the same `TransferEvent[]` shape the graph consumes.
_Acceptance:_ a scan of a real Chikyū token returns ≥1 transfer with a hash that resolves on
`https://dogeos-testnet.l2scan.co`; zero-transfer tokens return `[]` + an explicit empty-state flag.
_Depends on:_ T-01.

**T-04 Graph data contract.** Holder aggregation + edge weighting produces the JSON the D3 graph
consumes (`nodes: {address, balance, isContract}`, `links: {source, target, value, txCount}`),
identical field names to the current implementation so components do not change.
_Acceptance:_ fixture-free run against a live token emits valid graph JSON; counts reconcile against
blockscout's `transfers_count`.
_Depends on:_ T-03.

## Phase 3 — Persistence and API

**T-05 Database isolation.** New Neon database (or local Postgres) for the fork; Prisma migrations
applied there; every connection string in the fork points at it; production tables never referenced.
_Acceptance:_ `prisma migrate status` clean on the new database; the fork's `.env.local` `DATABASE_URL`
host ≠ production host (host only, value redacted); `git check-ignore .env.local` passes.
_Depends on:_ T-00 (independent of chain work, can run in parallel).

**T-06 API layer retarget.** `app/api/*` + `src/api/*` handlers read Chikyū; candles/market endpoints
that have no testnet source return an explicit `unavailable` payload instead of fabricated data.
_Acceptance:_ each route answers 200 with real chain data or the explicit unavailable shape; no
handler mentions Dogechain.
_Depends on:_ T-02, T-05.

## Phase 4 — UI, wallet, rebrand

**T-07 Wallet flow + chain guard.** `wagmi.ts` exposes Chikyū only; the app refuses to render chain
data if `eth_chainId` ≠ `0x5fdaf3` and offers "switch/add network" with the chain module's values;
WalletConnect ships only with a real project id, otherwise the connector is disabled.
_Acceptance:_ live browser run shows the connected address on chain 6281971 (screenshot); a forced
wrong-chain session shows the guard instead of data.
_Depends on:_ T-01.

**T-08 Copy and link sweep.** Every `/tx/` `/address/` `/token/` link and every "Dogechain network"
string in UI + docs replaced; `docs/DOGEOS_PORT_DECISION.md` linked from the README; historical
`*.md` files either updated or marked as history in a single `docs/DOGEOS_PORT_DOCS_NOTE.md`.
_Acceptance:_ `grep -rn 'Dogechain' App.tsx components services lib utils app src` returns 0 hits;
every rendered explorer link resolves to l2scan.co.
_Depends on:_ T-01, T-02.

## Phase 5 — End-to-end proof

**T-09 Live verification.** Deploy a small ERC-20 to Chikyū with the operator's testnet deployer key,
seed 3+ holders with real transfers, then: run the scanner (holder list), render the bubble map with
real addresses (screenshot), click a wallet (transfers from live logs), confirm every hash on l2scan
(screenshot), show the app connected to chain 6281971 (screenshot).
_Acceptance:_ the four screenshots exist in `docs/verification/`, each hash resolves on the explorer,
and every claim is traceable to a live read performed during the run.
_Depends on:_ T-03, T-04, T-06, T-07, T-08.

## Risk list

| Risk                                                              | Mitigation                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blockscout testnet lags or 5xx under scan load                    | RPC `eth_getLogs` is the primary path; blockscout is discovery-only, and failures degrade to "search unavailable" instead of empty data                                  |
| RPC rejects wide log ranges (>10k blocks)                         | chunked walker with per-chunk retry + resume; anchor at the token's deploy block                                                                                         |
| Testnet DOGE unavailable for the proof token deploy               | reuse the funded deployer key at `~/.chikyu-deployer/deployer.json`; measure fees from balance deltas (Chikyū's effective fee floor is far above the reported gas price) |
| WalletConnect project id missing                                  | disable the connector, prove connection with an injected EIP-1193 wallet; report the id as an operator item                                                              |
| Neon risk of touching production tables                           | new database, isolated `DATABASE_URL`, `.env.local` git-ignored, host-only assertion in T-05                                                                             |
| `npm ci` blocked install scripts (esbuild/go-gyp) break the build | run the approved install scripts explicitly before the build gate                                                                                                        |
| Long log scans on a busy token stall the UI                       | bound scan depth (deploy anchor → head, capped chunks) and stream progress via the existing `TransferProgressCallback`                                                   |
| Rebrand misses a copy string                                      | grep-based acceptance criterion per task, plus a final repo-wide census in T-08                                                                                          |
