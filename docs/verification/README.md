# Live verification — DogeOS Bubblemaps on Chikyū testnet

Everything below was produced during the port run on 2026-11-17 from REAL chain reads.
No fixture, mock or seeded holder list is used anywhere in this directory.

Chain: DogeOS Chikyū testnet, id 6281971, RPC https://rpc.testnet.dogeos.com/

| Evidence                                       | File                                      | What proves it                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bubble map rendered from live holders          | `01-bubble-map-mwdoge.png`                | App analysis view for mWDOGE (`0xA69d8Ac86502e4E08c812c64675a4892dfe6870f`) showing 100 tracked holders and the D3 bubble map; holder percentages in the sidebar match the on-chain balances in `mwdoge-graph.json`                   |
| Real transfer confirmed on the explorer        | `02-explorer-tx-confirmation.png`         | tx `0x06f07c3c41dccb2d44128206de685de0abd56aa927c4b964944ba80547572adb` — Status Success, block 9,550,688, "Transferred 0.217773 mWDOGE" (same leg the scanner returned)                                                              |
| Wallet connected to chain 6281971              | `03-wallet-connected-chain-6281971.png`   | Production build (`vite preview`) with an EIP-1193 wallet reporting `eth_chainId = 0x5fdaf3`; account modal shows the connected address and its live DOGE balance                                                                     |
| App reading live chain metrics                 | `04-network-health-live.png`              | Network Health page: current block #9,559,876, block time 3.00s, gas price 0.02 gwei, 2.3 TPS — read through the app's own RPC client                                                                                                 |
| Machine-readable chain probe                   | `wallet-chain-probe.json`                 | `{walletChainId:"0x5fdaf3", walletChainIdDec:6281971, rpcHead:9559878, address:"0x3639…f0b9"}` captured in the same page session                                                                                                      |
| Connected wallet + chain badge on 6281971      | `05-wallet-connected-chain-6281971.png`   | Production build, injected EIP-1193 wallet reporting `eth_chainId = 0x5fdaf3`: navbar shows the truncated address and the `Chikyū 6281971` badge (T-07, `wallet-guard-proof.mjs` S1)                                                  |
| Wrong-chain guard replaces all app data        | `06-wrong-chain-guard.png`                | Wallet on chain 1 (Ethereum): the guard states the actual chain, names Chikyū 6281971 / 0x5fdaf3, shows RPC/explorer/currency, and offers switch + add-network. Hero, stats and the search input are absent (S2)                      |
| Guard clears on switch                         | `07-after-chain-switch.png`               | Same session after `Switch to DogeOS Chikyū Testnet`: guard gone, chain badge back on 6281971, wallet reports 0x5fdaf3 (S2)                                                                                                           |
| Rejected switch keeps the guard up             | `08-wrong-chain-switch-rejected.png`      | Wallet answers 4001: guard stays, error `Request rejected in your wallet.` is shown, no chain data rendered (S3)                                                                                                                      |
| Add-network sends the chain module's values    | `09-add-network-then-connected.png`       | `wallet_addEthereumChain` payload recorded from the page: chainId `0x5fdaf3`, rpcUrls `["https://rpc.testnet.dogeos.com/"]`, blockExplorerUrls `["https://dogeos-testnet.l2scan.co"]`, nativeCurrency DOGE/18; guard gone (S4)        |
| Unknown chain (4902) auto-adds                 | `10-chain-unknown-then-added.png`         | Wallet answers 4902 to a plain switch: the guard falls back to add-network and ends on 0x5fdaf3 with no error left (S5)                                                                                                               |
| Wrong-chain guard on mobile                    | `11-wrong-chain-guard-mobile-390x844.png` | Same guard at 390×844: card, URLs and both actions fit with no clipping                                                                                                                                                               |
| Wallet-flow/guard assertions                   | `wallet-guard-probe.json`                 | Machine-readable output of all 26 checks (6 scenarios, incl. no-wallet baseline) from `scripts/dogeos-verify/wallet-guard-proof.mjs`; 0 failed                                                                                        |
| Scanner transcript (holders, links, transfers) | `scan-transcript.txt`                     | Output of `scripts/dogeos-verify/run-scan.sh` running THIS APP'S `services/evmRPC.ts` against Chikyū                                                                                                                                  |
| Graph payload                                  | `mwdoge-graph.json`, `such-graph.json`    | nodes/links built from live `Transfer` logs: mWDOGE 411 nodes / 643 links from 1,654 logs in a 40,000-block window; SUCH 2 nodes / 2 links / 339 wallet transfers                                                                     |
| Bubble map rendered from Transfer logs (T-04)  | `t04-01-graph-from-logs-t09p.png`         | Analysis view for T09P with the "Graph source → Transfer logs" card: **7 Transfer log(s) → 5 address(es) · blocks 9,562,825–9,586,641 · 3 chunk(s)**, bubbles and edges from those logs. 15/15 checks in `t04-render-assertions.json` |
| Fallback is labelled, not silent (T-04)        | `t04-03-fallback-holder-list.png`         | LINK `0xe5e3…FD54`: log scan returns `EMPTY STATE` (5 chunks, no Transfer logs), so the card reads "Explorer holders (fallback)" and the empty reason is on screen                                                                    |

## Wallet flow and chain guard (T-07)

`wagmi.ts` builds exactly one chain — DogeOS Chikyū, derived from `lib/chain.ts`. With
`VITE_WALLETCONNECT_PROJECT_ID` unset the connector list is `injected, injected, coinbaseWalletSDK,
safe` and `walletConnectEnabled === false` (measured with `scripts/dogeos-verify/wagmi-connectors-probe.mjs`);
setting the variable adds the WalletConnect connectors. No placeholder project id is left in **code**:
`lib/chain.ts`, `wagmi.ts` and every component resolve the id from the env only, and grep over the
shipped source returns zero hits for the old `8d2cf68c…` literal. It still appears in _historical_
capture files that are not compiled or served — `console.md`, `docs/archive/console.md`,
`CONSOLE_FIXES_PLAN.md`, `CONSOLE_FIXES_SUMMARY.md`, `RAINBOWKIT_*.md` — where it was redacted
in place (`8d2cf68c…<placeholder-id-redacted>`) rather than deleted, because those files record what
the upstream build did.

The shell gate is `hooks/useWalletChain.ts` + `components/ChainGuard.tsx`: the wallet's real chain is
read from `eth_chainId` on the injected provider and followed through `chainChanged`; while it is not
`0x5fdaf3` the app renders the guard instead of any view, so no chain data can be shown for the wrong
network. Switch/add actions send `wallet_switchEthereumChain` and `wallet_addEthereumChain` with
parameters generated by `walletAddChainParams()` in `lib/chain.ts` (never hand-written).

Reproduce: `npm run build && npx vite preview --port 5199` then
`node scripts/dogeos-verify/wallet-guard-proof.mjs http://localhost:5199` (needs Playwright; it uses
system Chrome via `channel: "chrome"`). It drives five injected-wallet scenarios plus a no-wallet baseline and rewrites
`05`–`10` plus `wallet-guard-probe.json`.

## Holder-set choice

> **Superseded by T-09** (see "T-09 — end-to-end on a token we deployed" below). This section records
> what was believed during T-02..T-04: that a deploy was unaffordable. It was **wrong** — the estimate
> came from multiplying the RPC receipt by a guessed fee multiple. Measured live with `balance`
> deltas, a 1,498-byte ERC-20 deploy cost **0.1935 DOGE**, and T-09 did deploy one.

No new token was deployed during T-02..T-08. Measured on 2026-11-17: Chikyū's effective fee floor was ~3,860 gwei per
gas while `eth_gasPrice` reported 0.0157 gwei, so a ~1M-gas ERC-20 deploy plus three seed transfers
is ≈ 1.0–1.2 DOGE. The only funded testnet keys on this machine held 0.17 DOGE (deployer) and
0.87 DOGE (banker), and the faucet is reCAPTCHA-gated (no headless claim possible). Deploying would
have risked the operator's remaining testnet fuel for no additional evidence, so the proof uses
**mWDOGE** (25,207 holders / 242,007 transfers) and **SUCH** (8 holders / 1,331 transfers) — real
contracts with real activity.

## T-09 — end-to-end on a token we deployed

The final gate deploys its own ERC-20 so every step (deploy → seed → scan → graph → map → wallet →
explorer) runs on data created in this run, with no borrowed holders.

| Step                           | Evidence                                                                                  | Result                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy                         | `t09-explorer-01-deploy.png`, `t09-transcript.txt`                                        | `T09ProofToken` (T09P, 18 dp, 1,000,000 supply) at **`0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27`**, tx `0x5a8a5ce8…efa368`, block 9,562,825, status Success. Broadcast with ethers v6 `ContractFactory` — `forge --broadcast` silently dry-runs on this chain.   |
| Seed 3+ holders                | `t09-explorer-02..07*.png`                                                                | 6 real transfers from the operator's funded keys: deployer→author 250,000, deployer→forwarder 250,000, deployer→tipper 200,000, author→tipper 60,000, tipper→forwarder 40,000, forwarder→author 25,000. Final holders 300,000 / 265,000 / 220,000 / 215,000 T09P. |
| App scanner                    | `t09-scan-transcript.txt`                                                                 | THIS APP's `services/evmRPC.ts`: anchor walk found deploy block 9,562,825, one ≤9k-block chunk, **7 Transfer logs**, 4 non-zero holders.                                                                                                                          |
| Graph payload                  | `t09p-graph.json`                                                                         | 5 nodes / 7 links (5th node = `0x0` mint origin, not a holder).                                                                                                                                                                                                   |
| Bubble map from that live data | `t09-01-bubble-map-t09p.png` (1440×900), `t09-02-bubble-map-mobile-390x844.png` (390×844) | Analysis view for T09P: 4 holders tracked, bubbles at 30.0 / 26.5 / 22.0 / 21.5 %, edges from the seeded transfers, `Chikyū 6281971` badge.                                                                                                                       |
| Click into a wallet            | `t09-03-wallet-drilldown-t09p.png`                                                        | Top holder `0x9bad…2BAf`: 300,000 T09P, 30.00 % share, 4 rows = 1 IN (mint 1,000,000) + 3 OUT (250,000 / 250,000 / 200,000).                                                                                                                                      |
| Chain in the wallet UI         | `t09-04-wallet-connected-chain-6281971.png`, `t09-05-wallet-account-modal.png`            | Injected EIP-1193 wallet reporting `eth_chainId = 0x5fdaf3`; navbar shows the `Chikyū 6281971` badge + connected address, account modal shows the address and its live DOGE balance.                                                                              |
| Every hash on the explorer     | `t09-explorer-01..09*.png`, `t09-explorer-assertions.json`                                | All 9 hashes open on `https://dogeos-testnet.l2scan.co`, each page shows that hash, `Success`, and a fee equal to the measured balance delta.                                                                                                                     |

Reconciliation against the chain's own indexer (`GET /api/v2/tokens/{addr}/counters`): `transfers_count`
7 = 7 scanned, `token_holders_count` 4 = 4 non-zero holders, `total_supply` 1e24 = on-chain
`totalSupply`, `type`/`symbol` `ERC-20`/`T09P` = the compiled contract. **Exact on all four.**

### Fee reality check (measured, not estimated)

Chikyū's RPC receipt is the part that lies. For the deploy:

| Source                                                           | Cost                         |
| ---------------------------------------------------------------- | ---------------------------- |
| `receipt.gasUsed × receipt.effectiveGasPrice` (391,886 × 1 gwei) | **0.000391886 DOGE**         |
| balance delta (`eth_getBalance` at block−1 vs block)             | **0.19353024612628087 DOGE** |
| explorer "Transaction fee" on the tx page                        | **0.19353024612628087 DOGE** |

That is **494×** what the receipt implies, i.e. an effective ~493.8 gwei/gas against an `eth_gasPrice`
of 0.0157 gwei. The same gap holds for the other 8 txs (455×–825×, i.e. 454–824 gwei/gas). The price is
not derivable from gas alone — only a post-hoc balance delta, or the explorer's fee row (which matches
the balance delta on all 9 txs), is trustworthy. The node's own submission check
(`gasLimit × ~4.5e11 wei`) is the closest pre-flight predictor: it asked for 0.1879 DOGE for this deploy
and the real debit was 0.1935.

### Found and fixed while verifying

`components/WalletSidebar.tsx` compared `tx.from === wallet?.address` — blockscout's v1 `tokentx`
returns lowercase addresses while `wallet.address` is checksummed, so **every transfer in the wallet
drawer rendered as `IN`** (the deployer's 3 outgoing transfers included). Fixed to a case-insensitive
compare; `t09-03` now shows 3 OUT + 1 IN, and `render-proof.mjs` asserts that split.

Cross-checking the explorer's fee row against our own balance-delta measurement also caught a bug in
_this card's_ first pass: for the one native DOGE transfer the debit still contained the 0.08 DOGE of
value, making it look like a 4x fee spike. `seed.mjs`/`recompute-fees.mjs` now subtract `tx.value`, and
the corrected figure matches the explorer exactly.

### Not verified (kept out of "verified")

- **WalletConnect** has no `project id` yet, so no WC _session_ exists and there is nothing to
  screenshot (operator item). What IS proven — `t09-walletconnect-state.txt`, produced by
  `scripts/dogeos-verify/walletconnect-state-probe.mjs`: with `VITE_WALLETCONNECT_PROJECT_ID` unset the
  production build does not offer the connector at all (Browser Wallet / Rabby / Coinbase only); with
  any syntactically valid id it offers the full list (… + MetaMask, Rainbow, WalletConnect, Trust,
  Ledger) and the app opens a real socket to `wss://relay.walletconnect.org`, which the relay closes
  with code **3000 "Project not found"** for an unregistered id — i.e. the connector path is wired to
  the live relay and only a Cloud-registered id is missing.
  **Unblock:** paste the id into `.env.local` (`VITE_WALLETCONNECT_PROJECT_ID=<id>`, gitignored — the
  empty slot with instructions is already there), `npm run build`, then pair once and capture the
  session (`docs/verification/t09-12-walletconnect-chain-6281971.png`).
- The explorer's **token page UI shows `Holders 0`** for T09P while its own `/api/v2` reports 4 — an
  indexer/UI disagreement inside blockscout, not something this app can fix. Holder counts used in the
  proof come from `/api/v2` and from the app's own scanner, both of which agree.
- The explorer renders the mint as `999,999.999999 T09P` (float64 rounding in its UI); on-chain
  `totalSupply` is exactly 1,000,000e18.
- The bubble map now draws the log-derived graph (see "T-04 — the log-derived graph in the
  dashboard" below). It is **not** every holder: the default window is the deploy block when the
  token is younger than 40,000 blocks, otherwise the last 40,000 blocks — so a token older than
  ~33 h shows the addresses active in that window, and the card states the range on screen. The
  mint origin `0x000…000` appears as a node (it is one end of the mint leg) at 0.0 %.
- The wallet drawer's tx list comes from blockscout's `tokentx` API; the log-derived list is in
  `t09-scan-transcript.txt`. Both are live, they are different sources.

Reproduce the WalletConnect connector state (`t09-walletconnect-state.txt`):
`npm run build && npx vite preview --port 5201` then
`node scripts/dogeos-verify/walletconnect-state-probe.mjs http://localhost:5201/ <label>` — repeat
the build with `VITE_WALLETCONNECT_PROJECT_ID=<any id>` for the enabled-connector case.

Reproduce: `node scripts/dogeos-verify/t09/render-proof.mjs` and
`node scripts/dogeos-verify/t09/explorer-proof.mjs` against `npx vite preview --port 5199`
(production build). The deploy/seed scripts (`deploy.mjs`, `seed.mjs`, `verify-deploy.mjs`) need
`ethers@6` and the operator key files; they never print key material.

## Not verified / limitations (kept out of "verified")

1. **No NEW contract deployed by this run** — see the fee arithmetic above.
2. **Wallet-side transfer panel not screenshotted.** The per-wallet transfer proof is the scanner's
   own output (`scan-transcript.txt`: 339 SUCH transfers for `0x3639…f0b9`, each with a hash) plus the
   explorer confirmation, not a screenshot of the app's Wallet Activity drawer. The drawer needs the
   5–8 minute full wallet scan to populate, which was not run in this window.
3. **WalletConnect path not exercised** — no real WalletConnect Cloud project id was supplied; the
   connector is disabled by design and the connection proof uses an injected EIP-1193 wallet. The
   connector/relay reachability evidence is in `t09-walletconnect-state.txt`; the unblock step is in
   the WalletConnect bullet above.
4. **Database layer not exercised end to end** — the fork's Prisma/Neon target was not provisioned in
   this run; the app runs on its local IndexedDB (Dexie) cache. No production Neon tables were touched.
5. **mWDOGE holder coverage**: the map shows the top 100 holders served by blockscout, while the
   token has 25,207 — the UI labels this ("Showing top 100 holders from blockchain").

## Graph data contract (T-04)

`services/graphService.ts` is the single place that turns live Chikyū Transfer logs into the payload
the D3 map consumes. Field names are the ones the components already read, so no component signature
changed:

```
nodes: { address, balance, isContract }        // + windowDelta, rank (diagnostics)
links: { source, target, value, txCount }
```

`toBubbleMapData(graph)` returns the exact `Wallet[]` / `Link[]` props `components/BubbleMap.tsx`
takes (`id`, `percentage`, `isWhale`, `connections` added, nothing renamed). Balances are real
`balanceOf` reads **pinned to the scan's `toBlock`** — without pinning, an interest-bearing token
drifts: mWDOGE moved ~0.01 mWDOGE between the log walk and the balance read. `isContract` is
`eth_getCode` at that same block. A range with zero Transfer logs returns
`{ nodes: [], links: [], empty: true, message }` — no fabricated holders.

Live runs (`scripts/dogeos-verify/graph-probe.sh`, transcript in `t04-graph-transcript.txt`):

| Artifact                | Token / range                                                            | Result                                                        |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `mwdoge-graph-t04.json` | mWDOGE `0xA69d…870f`, 40,000-block window (5 chunks)                     | 2,542 transfers → **576 nodes / 922 links**, 1 contract node  |
| `mbone-full-graph.json` | MBONE `0x4A82…3B44`, **whole history** anchor→head (64 chunks)           | 6 transfers → 7 nodes / 6 links; counters **EXACT MATCH** 6/6 |
| `link-empty-graph.json` | LINK `0xe5e3…FD54`, 90,000-block range with no Transfer logs (11 chunks) | **0 nodes / 0 links**, `empty: true`, explicit message        |

Reconciliation against `GET /api/v2/tokens/{addr}/counters`:

- MBONE — `transfers_count` 6 = 6 scanned; `token_holders_count` 6 = 6 distinct non-zero addresses
  (the payload carries a 7th node, `0x000…000`, because the mint leg starts there; blockscout does
  not count it as a holder).
- mWDOGE — `transfers_count` 242,099 and `token_holders_count` 25,232 are chain-wide; the payload is
  a 40,000-block window, so 2,542 transfers / 575 non-zero addresses is a subset by construction, not
  missing data. The window is the number the payload advertises in `scanned.fromBlock/toBlock`.
- Cross-check outside the app: `eth_call balanceOf` at each payload's `toBlock` reproduces 5/5 sampled
  node balances exactly, `eth_getCode` at that block confirms every `isContract: true`, no link has a
  dangling endpoint, and summing link values per node reproduces `windowDelta` to ≤8e-14 relative.

**Empty state is proven on a real zero-log range, not on a chain-wide zero-transfer token.** No such
token exists on Chikyū: a census of the explorer's token lists (`/api/v2/tokens?type=ERC-20|ERC-721|ERC-1155`)
found 600 ERC-20, 50 sampled ERC-721 and 27 ERC-1155 contracts with a minimum of 6 Transfer logs each,
and deploying a fresh zero-transfer
ERC-20 is not affordable here (~3.9 DOGE at the measured fee floor vs 0.65 DOGE across all four local
testnet keys — see "Holder-set choice"). The service's empty branch is therefore exercised live on LINK
over a range that genuinely has no logs.

Reproduce: `TOKEN=<erc20> [BLOCKS=<n>] [OUT=docs/verification/x.json] bash scripts/dogeos-verify/graph-probe.sh`.

## T-04 — the log-derived graph in the dashboard

The analysis view is now graph-first. `App.handleSearch` calls `loadAnalysisData()`, which calls
`buildUiTokenGraph()` (`services/graphService.ts`) — the same contract the harness proved, reached
from the product instead of a script:

1. **Logs are the product path.** The walk resolves the token's deploy anchor (`eth_getCode` binary
   search), then scans anchor → head in **≤9,000-block chunks** (`EVM_LOG_CHUNK_SIZE`; Chikyū rejects
   ranges wider than 10,000 blocks outright). Window rule: if the anchor is within
   `UI_GRAPH_LOOKBACK_BLOCKS` (40,000 blocks ≈ 33 h) of head the walk is the token's whole history,
   otherwise the last 40,000 blocks — the payload advertises whichever it used in
   `scanned.fromBlock/toBlock`, and the UI prints that range.
2. **The blockscout holder list is a labelled fallback.** It is fetched _only_ when the log walk
   returns zero logs. The card then reads "Explorer holders (fallback)" and carries the scan's own
   `EMPTY STATE` message; when both sources are empty the map is replaced by an explicit
   "No graph data for this token" panel. Nothing is fabricated to fill either case.
3. **The source is on screen, not implied.** The map's control pill and the "Graph source" card both
   name the source, and the card states the log count, the address count, the block range and the
   chunk count that produced the bubbles.
4. **Both payloads are live.** Balances are `balanceOf` pinned to the scan's `toBlock`, `isContract`
   is `eth_getCode` at the same block, and links are the aggregated `Transfer` legs.

Proof: `node scripts/dogeos-verify/t04/render-graph-proof.mjs http://localhost:5199` against
`npm run build && npx vite preview --port 5199` (Playwright, system Chrome). It asserts, not narrates:

| Check                                                                            | Result                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Source card + pill read "Transfer logs"                                          | PASS                                                 |
| Independent `eth_getLogs` count (no app code) equals the count printed in the UI | PASS — 7 = 7                                         |
| No request to `/tokens/<addr>/holders` while the map renders                     | PASS — 0 calls                                       |
| With that endpoint blocked at the network layer the map still renders            | PASS — bubbles present, source still "Transfer logs" |
| LINK (no Transfer logs in range) shows the labelled fallback + empty reason      | PASS                                                 |
| Desktop 1440×900 and mobile 390×844 captures                                     | `t04-01`, `t04-02`                                   |

One line for the record: **the rendered graph in `t04-01-graph-from-logs-t09p.png` was supplied by
on-chain Transfer logs — 7 `eth_getLogs` results in 3 × ≤9,000-block chunks — and the blockscout
holder API was never called.**

Unit coverage for the window rule and the payload→`BubbleMap` adaptation: `tests/graph-service.test.ts`
(young token scans anchor→head, old token scans the bounded window, zero-log range stays an explicit
empty state, `toBubbleMapData` keeps the component props).
