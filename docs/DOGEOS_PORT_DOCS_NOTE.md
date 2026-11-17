# Docs note — which documents describe THIS build

This fork (DogeOS Bubblemaps) is a retarget of the Dogechain Bubblemaps product to **DogeOS Chikyū
testnet** (chain id 6281971).

## Authoritative for this build

| Document                        | Scope                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| `docs/DOGEOS_PORT_DECISION.md`  | data-source, chain-support, database and product decisions               |
| `docs/DOGEOS_PORT_PLAN.md`      | task breakdown, acceptance criteria, risks                               |
| `docs/DOGEOS_PORT_DOCS_NOTE.md` | this file — what the rest of the docs mean                               |
| `docs/verification/`            | live evidence: graphs, holder lists, screenshots, explorer confirmations |

## Historical (pre-port) documents

The top-level `*.md` files (`DOGECHAIN_RPC_RESEARCH_REPORT.md`, `RPC_QUICK_START.md`,
`DEX_REFERENCE.md`, `ARC_MOBILE_*.md`, `NEON_*`, `DEPLOYMENT*.md`, the build-fix notes, etc.) were
written for the original **Dogechain mainnet** product. They are kept as history and are **not**
description of this fork's chain, endpoints or deployments.

Rules for reading them:

1. Any Dogechain mainnet RPC/explorer URL in those files is historical; this build uses
   `lib/chain.ts` (DogeOS Chikyū) and nothing else.
2. Any DEX/factory/whale address list in those files (and in code comments) refers to mainnet
   accounts. The fork's registries (`services/knownFactories.ts`, `services/whaleWalletRegistry.ts`)
   are intentionally empty for that reason.
3. Deployment instructions in `docs/DEPLOYMENT*.md` describe the upstream host setup. This fork
   does not rewrite `/api/*` to the upstream backend; that rewrite was deleted from `vercel.json`.

Docs under `docs/archive/` are frozen HTML artifacts from the mainnet build.
