# T-09 — deploy + seed scripts for the Chikyū end-to-end proof

These are the scripts that produced `docs/verification/t09-*`. The token is live on Chikyū:

- contract `0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27` (T09ProofToken / T09P, 18 decimals, 1,000,000 supply)
- deploy tx `0x5a8a5ce80b12ce388a6e3cb8cddc654fffaca13399f71af5830a0fff85efa368` (block 9,562,825)
- evidence + numbers: `../docs/verification/t09-transcript.txt`, `t09-scan-transcript.txt`,
  `t09-render-assertions.json`, `t09-explorer-assertions.json`, `t09-explorer-*.png`

## Why not forge

`forge script --broadcast` silently dry-runs against this chain (it reports a simulated hash and no
tx lands). Broadcasting goes through **ethers v6 `ContractFactory`** instead.

## Prereqs

- `ethers@6` resolvable from the directory you run these in (`npm i ethers@6` in a scratch dir and run
  there, or add it to the repo). The repo itself does not depend on ethers.
- The operator's key files in `~/.chikyu-deployer/{deployer,author,forwarder,tipper}.json`.
  **These scripts never print key material** — they only ever print addresses, hashes and balances.
- `build/T09ProofToken.{abi,bin}` — rebuild with
  `solc --optimize --optimize-runs 1 --abi --bin --overwrite -o build T09ProofToken.sol`.
  `--optimize-runs 1` matters: metadata is `constant` (no string SSTOREs) and the deploy is 391,886 gas.

## Order

```bash
node deploy.mjs          # ethers ContractFactory deploy; prints preflight + result JSON
node verify-deploy.mjs   # re-reads the deploy from the chain, measures the REAL fee from balance deltas
node seed.mjs            # 1 DOGE top-up + 3 seed transfers + 3 holder-to-holder transfers
node recompute-fees.mjs  # recompute every fee as (balance delta - tx.value)
```

## Chikyū fee trap (read before trusting any number)

The RPC receipt's `gasUsed * effectiveGasPrice` understates the real cost by ~455–825x, and
`eth_gasPrice` (~0.0157 gwei) is roughly 30,000x below what is actually charged. Measure cost as
`eth_getBalance(block-1) - eth_getBalance(block)`, and for native transfers subtract `tx.value`.
The deploy really cost **0.1935 DOGE** against a receipt that claims 0.000392 DOGE. The node's
pre-flight check (`gasLimit * ~4.5e11 wei`, surfaced as "insufficient funds for gas \* price + value")
is the only usable pre-broadcast predictor — it wanted 0.1879 DOGE for this deploy.

## Rendering / explorer proofs

`render-proof.mjs` and `explorer-proof.mjs` drive the production build with Playwright:

```bash
npm run build && npx vite preview --port 5199
node scripts/dogeos-verify/t09/render-proof.mjs   http://localhost:5199   # 17/17 checks
node scripts/dogeos-verify/t09/explorer-proof.mjs                          # 13/13 checks
```
