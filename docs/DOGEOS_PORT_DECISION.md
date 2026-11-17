# DogeOS Port Decision Record

Status: decided 2026-11-17 (Kai, developer lane). Written BEFORE any code change in this fork.
Fork: `/Volumes/DEV Projects/Dogechain-Bubblemaps-DogeOS`
Source (read-only, untouched): `/Volumes/DEV Projects/Dogechain Bubblemaps`

Target: **DogeOS Chikyū Testnet** — chain id `6281971`, RPC `https://rpc.testnet.dogeos.com/`,
native currency `DOGE` (18 decimals), human explorer `https://dogeos-testnet.l2scan.co`,
EVM indexer/API `https://blockscout.testnet.dogeos.com`.

## Live probes behind these decisions (2026-11-17, this run)

| Probe                                                                 | Result                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `eth_chainId` on `https://rpc.testnet.dogeos.com/`                    | `0x5fdaf3` = **6281971** (hex→decimal computed with a tool)                        |
| `eth_blockNumber`                                                     | advancing (mainnet head ≈ 9.55M)                                                   |
| `eth_getLogs` (address filter, small range)                           | logs returned, no special key needed                                               |
| blockscout `GET /api?module=token&action=getToken`                    | `{"status":"1","result":{name:"ChainLink Token",symbol:"LINK",decimals:"18",...}}` |
| blockscout `GET /api/v2/stats`                                        | live counters (total_blocks, total_transactions, total_addresses)                  |
| blockscout `GET /api/v2/tokens?limit=2`                               | works — sorted token list with `holders`, `total_supply`, `type`                   |
| blockscout `GET /api/v2/tokens/{addr}/counters`                       | `{"token_holders_count":"2","transfers_count":"2"}`                                |
| blockscout `GET /api/v2/tokens/{addr}/holders`                        | holder list with address + raw `value`                                             |
| blockscout `GET /api?module=account&action=tokentx&address=…`         | works (requires `address`; `contractaddress` alone is rejected)                    |
| blockscout `GET /api?module=stats&action=tokensupply`                 | works                                                                              |
| blockscout `GET /api?module=contract&action=getabi` / `getsourcecode` | works                                                                              |
| `https://dogeos-testnet.l2scan.co`                                    | HTTP 200                                                                           |

Conclusion: the fork's explorer-API surface is **shape-compatible** with DogeOS's blockscout. The port is a
retarget plus chain-constant consolidation — not a data-layer rewrite.

## 1. Data source: RPC log scanning + DogeOS blockscout API. No self-hosted indexer.

Two read paths, both live on Chikyū:

- **Primary (transfers, graph edges):** direct JSON-RPC `eth_getLogs` against
  `https://rpc.testnet.dogeos.com/`, exactly the path `services/dogechainRPC.ts` already implements
  (viem `createPublicClient` → `getLogs` for `Transfer(address,address,uint256)`, `getBlock` for
  timestamps, `readContract` for name/symbol/decimals/totalSupply). Nothing in this file is
  Dogechain-specific except endpoints and chain metadata, so it survives with the constants swapped.
- **Secondary (discovery, metadata, trending, holder counts):** DogeOS blockscout
  `https://blockscout.testnet.dogeos.com`, called through the _same_ etherscan-compat and v2
  shapes the fork already uses. This is what makes trending/search viable without running an indexer.

Why not an indexer: the product's question is "who holds/traded this token", which `eth_getLogs`
answers directly for a young testnet. Running Ponder/Subsquid would add a service, a database and an
ops surface for zero user-visible gain at this chain size. Revisit only when per-token log volume
makes a single scan exceed the RPC's block-range/response limits (Chikyū rejects ranges >10k blocks;
the existing chunked walker already copes).

### Call-by-call mapping for `services/dogechainRPC.ts` (and the explorer clients)

| Call in the fork (Dogechain today)                                                                     | DogeOS replacement                                                                                                          | Status                                           |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `createPublicClient({chain: dogechain, transport: http(rpc.dogechain.dog)})` with 3 RPC failover hosts | one viem client over `lib/chain.ts` → `https://rpc.testnet.dogeos.com/` (single documented endpoint)                        | direct swap                                      |
| `getLogs({event: Transfer})`                                                                           | identical call, DogeOS RPC                                                                                                  | direct swap (probe: works)                       |
| `getBlock({blockNumber})` for log timestamps                                                           | identical                                                                                                                   | direct swap                                      |
| `readContract(name/symbol/decimals/totalSupply)`                                                       | identical                                                                                                                   | direct swap                                      |
| `explorer.dogechain.dog/api?module=account&action=tokentx` (compat v1)                                 | `blockscout.testnet.dogeos.com/api?module=account&action=tokentx` (+ `address` required)                                    | works, param change                              |
| `…&action=tokennfttx`                                                                                  | same host/action (empty result on quiet testnet)                                                                            | works, empty is valid                            |
| `…&action=tokenbalance` / `…&action=tokensupply`                                                       | same host/action                                                                                                            | works                                            |
| `explorer.dogechain.dog/api/v2/…` (blockscout v2: tokens, holders, counters, smart-contracts)          | `blockscout.testnet.dogeos.com/api/v2/…`                                                                                    | works                                            |
| `…&action=getTokenHolders` (custom Dogechain endpoint)                                                 | **no equivalent** → replaced by v2 `/tokens/{addr}/holders` (paged) for holder lists, or by deriving holders from `getLogs` | replaced                                         |
| `api.dogechain.dog` market/price aggregates                                                            | **no equivalent** → dropped; the testnet has no market data (`coin_price: null`)                                            | removed feature (testnet has no prices — see §3) |
| Dogechain explorer UI links `/tx/…`, `/address/…`                                                      | `https://dogeos-testnet.l2scan.co/tx/…`, `/address/…`                                                                       | direct swap                                      |

## 2. What exists to visualize on day one

Chikyū is not empty — it carries real ERC-20s with holders (probed: blockscout token list shows
tokens with 25k+ holders; LINK at `0xe5e3a4fF1773d043a387b16Ceb3c91cC49bAFD54` has holders and a
fixture of transfers). Day-one scannable assets:

1. The **gas token DOGE** — shown as the native balance layer; it has no ERC-20 contract, so it is
   _not_ a bubble-map token. The UI must say so rather than silently empty.
2. **Existing testnet ERC-20s** discovered via the token list/search (LINK, SUCH, mWDOGE, …).
3. A **purpose-deployed proof token** for end-to-end verification (see the plan, T-09), seeded with a
   small holder set from the operator's funded testnet keys so the graph has real, explorer-verifiable
   structure.

**Empty state is a first-class result.** For a token with no transfers on Chikyū the app must render an
explicit "no transfer activity on DogeOS Chikyū yet" panel with the explorer link, never an error and
never a fabricated node set. A blank map is correct.

## 3. Trending, alerts, analytics: DogeOS-only

Kept wired to DogeOS alone (operator default). Consequence: no market price / TVL / volume widgets,
because the testnet reports `coin_price: null` and no DEX liquidity — the UI hides those panels rather
than showing zeros dressed up as data.
Cost of keeping a cross-chain view: a second chain client, a mapping table between the two chains'
token identities, and doubled scan cost, for a comparison nobody can act on while one side is testnet.

## 4. Database: new Neon database (schema), never the production tables

The fork keeps `DATABASE_URL` out of git and points at a **new** Neon database/schema created for this
build. The production tables of the live app are never referenced by this fork: the connection string
in the fork's `.env.local` is replaced, and `.env.local` stays untracked. Prisma migrations are applied
to the new database only.

Fallback if no new Neon instance is available at build time: the app runs against local `pg` (the
Prisma schema is portable) and the API layer degrades to in-memory caching. Nothing in this fork may
open the live app's tables.

## 5. Dogechain mainnet support: removed in this fork, not kept behind a switch

The copy is DogeOS-only. This **deletes a feature**: this build cannot read Dogechain mainnet at all —
no chain switcher, no mainnet RPC, no mainnet explorer links. Rationale: a two-chain build doubles the
surface that must be verified, and every verification claim in this card is about Chikyū. The source
folder remains untouched, so the mainnet product is not lost — it is just not this build.

## Non-negotiables carried into execution

- Real chain data only: every holder, transfer and hash in a report is read back from Chikyū RPC or
  blockscout at report time; nothing is seeded as if it were chain state.
- `lib/chain.ts` is the single source of chain constants; `wagmi.ts` and `services/dogechainRPC.ts`
  become thin wrappers. Duplicate literals are deleted, not left in place.
- WalletConnect project id: the placeholder in `wagmi.ts` is not shipped. Either a real `VITE_WALLETCONNECT_PROJECT_ID`
  is supplied at build time, or the WalletConnect connector is disabled and injected wallets are used
  (wallet connection itself is still proven live — see the plan's acceptance criteria). This is an
  **operator item** if a WalletConnect id must be provisioned.
