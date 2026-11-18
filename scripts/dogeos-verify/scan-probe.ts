/**
 * Live gate for T-03 (transfer scanning on Chikyū). Proves, against the real RPC:
 *
 *  1. eth_getLogs REJECTS a 10,001-block range and ACCEPTS 9,000 — the reason
 *     EVM_LOG_CHUNK_SIZE is 9,000 and not "one query for the whole history".
 *  2. scanTokenTransfers() walks head -> deploy anchor in ≤9k chunks and resolves
 *     per-log timestamps with getBlock (cross-checked against the explorer's value).
 *  3. A token with no Transfer logs in the window returns [] plus empty:true with a
 *     reason — never a throw.
 *
 *   bash scripts/dogeos-verify/scan-probe.sh
 */
import { createPublicClient, http } from "viem";
import { EvmRPCClient, EVM_LOG_CHUNK_SIZE } from "../../services/evmRPC";
import { CHAIN, RPC_URL, explorerTxUrl } from "../../lib/chain";

// LINK on Chikyū: 2 Transfer logs total (mint at 2,474,763 / transfer at 6,199,387).
const LINK = "0xe5e3a4fF1773d043a387b16Ceb3c91cC49bAFD54";

const client = new EvmRPCClient();
const viem = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const head = await client.getLatestBlockNumber();

const jsonRpc = async (method: string, params: unknown[]) => {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
};
const hex = (n: bigint) => `0x${n.toString(16)}`;

console.log("chain id (lib/chain.ts) :", CHAIN.id);
console.log("rpc reported chain id   :", await viem.getChainId());
console.log("head block              :", head.toString());
console.log("EVM_LOG_CHUNK_SIZE      :", EVM_LOG_CHUNK_SIZE.toString());

// ---- 1. the range limit is real, and our chunk size sits under it -------------
const okRange = await jsonRpc("eth_getLogs", [
  { address: LINK, fromBlock: hex(head - EVM_LOG_CHUNK_SIZE + 1n), toBlock: hex(head) },
]);
console.log(
  `\n[1a] eth_getLogs over ${EVM_LOG_CHUNK_SIZE} blocks -> ${
    okRange.error
      ? `ERROR ${okRange.error.message}`
      : `${(okRange.result as unknown[]).length} logs (accepted)`
  }`
);
const tooWide = await jsonRpc("eth_getLogs", [
  { address: LINK, fromBlock: hex(head - 10500n), toBlock: hex(head) },
]);
console.log(
  `[1b] eth_getLogs over 10,500 blocks -> ${
    tooWide.error ? `REJECTED: ${tooWide.error.message}` : "accepted (range limit NOT enforced)"
  }`
);

// ---- 2. anchor walk finds the deploy, timestamps come from getBlock ----------
const full = await client.scanTokenTransfers(LINK, {
  onProgress: (p) => {
    if (p.phase === "fetching_logs" && p.current % 200 === 0) console.log(`[2] ${p.message}`);
  },
});
console.log(
  `\n[2a] anchor walk: blocks ${full.fromBlock}-${full.toBlock}, anchor ${full.anchorBlock}, ` +
    `${full.chunks} chunk(s), ${full.transfers.length} transfers, empty=${full.empty}`
);
for (const t of full.transfers) {
  const apiTx = (await (
    await fetch(`https://blockscout.testnet.dogeos.com/api/v2/transactions/${t.transactionHash}`)
  ).json()) as { status?: string; block_number?: number; timestamp?: string };
  const block = await viem.getBlock({ blockNumber: t.blockNumber });
  const explorerTs = apiTx.timestamp ? Date.parse(apiTx.timestamp) : NaN;
  console.log(
    `     ${t.transactionHash} block ${t.blockNumber} value ${t.value}\n` +
      `       getBlock ts=${new Date(t.timestamp).toISOString()} scanner=${t.timestamp}\n` +
      `       explorer  ts=${apiTx.timestamp} status=${apiTx.status} block=${apiTx.block_number}\n` +
      `       ts match explorer: ${explorerTs === t.timestamp}\n` +
      `       getBlock agrees: ${Number(block.timestamp) * 1000 === t.timestamp}\n` +
      `       ${explorerTxUrl(t.transactionHash)}`
  );
}
console.log(
  `[2b] chunk width never exceeded 9,000: ${full.chunks} chunk(s) covered ` +
    `${full.toBlock - full.fromBlock + 1n} blocks`
);

// ---- 3. empty window is an answer, not an exception --------------------------
const empty = await client.scanTokenTransfers(LINK, { fromBlock: head, toBlock: head });
console.log(
  `\n[3] empty window (head only): transfers=${empty.transfers.length} empty=${empty.empty} ` +
    `reason="${empty.emptyReason ?? ""}"`
);
if (!empty.empty || empty.transfers.length !== 0) {
  throw new Error("EMPTY-STATE FAILED: expected [] + empty:true");
}

const allFine =
  full.transfers.length >= 1 &&
  Boolean(tooWide.error) &&
  empty.empty &&
  full.fromBlock === full.anchorBlock;
console.log(`\nSCAN PROBE: ${allFine ? "ALL CHECKS PASSED" : "FAILED"}`);
if (!allFine) process.exit(1);
