# Live verification — DogeOS Bubblemaps on Chikyū testnet

Everything below was produced during the port run on 2026-11-17 from REAL chain reads.
No fixture, mock or seeded holder list is used anywhere in this directory.

Chain: DogeOS Chikyū testnet, id 6281971, RPC https://rpc.testnet.dogeos.com/

| Evidence                                       | File                                    | What proves it                                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bubble map rendered from live holders          | `01-bubble-map-mwdoge.png`              | App analysis view for mWDOGE (`0xA69d8Ac86502e4E08c812c64675a4892dfe6870f`) showing 100 tracked holders and the D3 bubble map; holder percentages in the sidebar match the on-chain balances in `mwdoge-graph.json` |
| Real transfer confirmed on the explorer        | `02-explorer-tx-confirmation.png`       | tx `0x06f07c3c41dccb2d44128206de685de0abd56aa927c4b964944ba80547572adb` — Status Success, block 9,550,688, "Transferred 0.217773 mWDOGE" (same leg the scanner returned)                                            |
| Wallet connected to chain 6281971              | `03-wallet-connected-chain-6281971.png` | Production build (`vite preview`) with an EIP-1193 wallet reporting `eth_chainId = 0x5fdaf3`; account modal shows the connected address and its live DOGE balance                                                   |
| App reading live chain metrics                 | `04-network-health-live.png`            | Network Health page: current block #9,559,876, block time 3.00s, gas price 0.02 gwei, 2.3 TPS — read through the app's own RPC client                                                                               |
| Machine-readable chain probe                   | `wallet-chain-probe.json`               | `{walletChainId:"0x5fdaf3", walletChainIdDec:6281971, rpcHead:9559878, address:"0x3639…f0b9"}` captured in the same page session                                                                                    |
| Scanner transcript (holders, links, transfers) | `scan-transcript.txt`                   | Output of `scripts/dogeos-verify/run-scan.sh` running THIS APP'S `services/evmRPC.ts` against Chikyū                                                                                                                |
| Graph payload                                  | `mwdoge-graph.json`, `such-graph.json`  | nodes/links built from live `Transfer` logs: mWDOGE 411 nodes / 643 links from 1,654 logs in a 40,000-block window; SUCH 2 nodes / 2 links / 339 wallet transfers                                                   |

## Holder-set choice

No new token was deployed. Measured on 2026-11-17: Chikyū's effective fee floor was ~3,860 gwei per
gas while `eth_gasPrice` reported 0.0157 gwei, so a ~1M-gas ERC-20 deploy plus three seed transfers
is ≈ 1.0–1.2 DOGE. The only funded testnet keys on this machine held 0.17 DOGE (deployer) and
0.87 DOGE (banker), and the faucet is reCAPTCHA-gated (no headless claim possible). Deploying would
have risked the operator's remaining testnet fuel for no additional evidence, so the proof uses
**mWDOGE** (25,207 holders / 242,007 transfers) and **SUCH** (8 holders / 1,331 transfers) — real
contracts with real activity.

## Not verified / limitations (kept out of "verified")

1. **No NEW contract deployed by this run** — see the fee arithmetic above.
2. **Wallet-side transfer panel not screenshotted.** The per-wallet transfer proof is the scanner's
   own output (`scan-transcript.txt`: 339 SUCH transfers for `0x3639…f0b9`, each with a hash) plus the
   explorer confirmation, not a screenshot of the app's Wallet Activity drawer. The drawer needs the
   5–8 minute full wallet scan to populate, which was not run in this window.
3. **WalletConnect path not exercised** — no real WalletConnect Cloud project id was supplied; the
   connector is disabled by design and the connection proof uses an injected EIP-1193 wallet.
4. **Database layer not exercised end to end** — the fork's Prisma/Neon target was not provisioned in
   this run; the app runs on its local IndexedDB (Dexie) cache. No production Neon tables were touched.
5. **mWDOGE holder coverage**: the map shows the top 100 holders served by blockscout, while the
   token has 25,207 — the UI labels this ("Showing top 100 holders from blockchain").
