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

## Execution status (2026-11-17, umbrella card t_7016aa75)

| Task                           | Card       | State       | Evidence                                                                                                                                                                                                          |
| ------------------------------ | ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-00 copy + baseline           | —          | **done**    | 4,322 files / 87,949,688 bytes, identical md5-of-md5s manifest; `npm ci` 1,510 packages; build green                                                                                                              |
| T-01 chain constants           | t_8648e84b | **done**    | `lib/chain.ts`; `grep -rn Dogechain` in code = 0; `grep dogechain.dog` = 0; tsc clean                                                                                                                             |
| T-02 explorer retarget         | t_72de0b35 | **done**    | all six clients on `EXPLORER_API`/`EXPLORER_API_V2`; token search moved to `/api/v2/search`; live fetches OK                                                                                                      |
| T-03 transfer scanning         | t_bce7706f | **done**    | `services/evmRPC.ts` scanned 1,654 live mWDOGE logs in 40k blocks; hashes resolve on l2scan                                                                                                                       |
| T-04 graph data contract       | t_f0095e6c | **done**    | `docs/verification/mwdoge-graph.json` — 411 nodes / 643 links from live logs                                                                                                                                      |
| T-05 database isolation        | t_b5dddf8a | **open**    | no Neon database provisioned in this run; app runs on local Dexie only. Production tables never touched                                                                                                           |
| T-06 API layer                 | t_47717481 | **partial** | no `/api/*` handler was rewritten in this run; the production-backend rewrite was deleted and the dev proxy now points at `localhost:3001`. Handlers still need the Chikyū pass                                   |
| T-07 wallet flow + chain guard | t_2c2f9111 | **partial** | `wagmi.ts` is Chikyū-only, placeholder id gone, WalletConnect omitted without a real id; live connection proven on chain 6281971 (`docs/verification/03,04`). The explicit wrong-chain guard UI was **not** built |
| T-08 copy + link sweep         | t_287c3338 | **done**    | 0 Dogechain strings in code; explorer links → l2scan; `docs/DOGEOS_PORT_DOCS_NOTE.md` added; build green                                                                                                          |
| T-09 live verification         | t_551163ba | **partial** | bubble map + explorer tx + wallet chain + live metrics captured; **not** done: new-token deploy (fee arithmetic), wallet drawer, WalletConnect path                                                               |

### Deviations from the plan, and why

1. **Token search** was rewritten, not just repointed: modern blockscout no longer serves
   `/tokens?type=JSON&query=` (returns HTML), so the scraper became a v2 `/api/v2/search` client.
2. **Registries emptied** (`knownFactories`, `whaleWalletRegistry`, `KNOWN_LABELS`, `MOCK_TEST_ALERTS`,
   `INITIAL_TRENDING` addresses): carrying mainnet addresses would have labelled empty Chikyū accounts
   as bridges/exchanges/whales — fabricated data by construction.
3. **No new token deployed**: measured effective fee floor ≈ 3,860 gwei/gas makes a ~1M-gas ERC-20
   deploy ≈ 3.9 DOGE; funded testnet keys on disk hold 1.04 DOGE combined and the faucet is
   captcha-gated. The proof uses real existing Chikyū tokens (mWDOGE, SUCH) instead.
4. **RainbowKit `getDefaultConfig` removed**: it throws when the WalletConnect project id is empty, so
   the config is built with wagmi `createConfig` and the WC connector is conditional.
5. **Dangling `.context` symlink deleted** in the fork: vite's watcher crashed with `ELOOP` on it.
