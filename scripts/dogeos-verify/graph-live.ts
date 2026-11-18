/**
 * Live proof for T-04 (graph data contract): run `services/graphService.buildTokenGraph`
 * against DogeOS Chikyū and emit the bubble-map JSON the D3 components consume.
 *
 * No fixtures, no mocks: every address, balance and edge comes from eth_getLogs /
 * balanceOf / eth_getCode on the live chain. The script also reconciles the payload
 * against blockscout's `/api/v2/tokens/{addr}/counters`.
 *
 *   bash scripts/dogeos-verify/graph-probe.sh                  # default token, full range
 *   TOKEN=0x… BLOCKS=40000 bash scripts/dogeos-verify/graph-probe.sh   # windowed scan
 *   TOKEN=0x… OUT=docs/verification/foo-graph.json bash scripts/dogeos-verify/graph-probe.sh
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { explorerAddressUrl, EXPLORER_API_V2 } from "../../lib/chain";
import { buildTokenGraph, toBubbleMapData } from "../../services/graphService";
import type { TokenGraph } from "../../services/graphService";

// mWDOGE on Chikyū: the busiest ERC-20 (242k transfers chain-wide), so a windowed scan
// always has real data. LINK is the small token used for exact whole-history reconciliation.
const DEFAULT_TOKEN = "0xA69d8Ac86502e4E08c812c64675a4892dfe6870f";

const TOKEN = process.env.TOKEN ?? DEFAULT_TOKEN;
const BLOCKS = process.env.BLOCKS ? BigInt(process.env.BLOCKS) : undefined;
const FROM = process.env.FROM ? BigInt(process.env.FROM) : undefined;
const TO = process.env.TO ? BigInt(process.env.TO) : undefined;
const OUT = process.env.OUT;

interface Counters {
  transfers_count?: string;
  token_holders_count?: string;
}

async function fetchCounters(address: string): Promise<Counters | null> {
  try {
    const res = await fetch(`${EXPLORER_API_V2}/tokens/${address}/counters`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      console.log(`  counters: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as Counters;
  } catch (error) {
    console.log(`  counters: unreachable (${(error as Error).message})`);
    return null;
  }
}

const graph: TokenGraph = await buildTokenGraph(TOKEN, {
  lookback: BLOCKS,
  fromBlock: FROM,
  toBlock: TO,
  onProgress: (p) => {
    if (p.phase === "fetching_logs") console.log(`  ${p.message}`);
  },
});

const symbol = graph.token.symbol.toLowerCase() || "graph";
const outFile = OUT
  ? resolve(process.cwd(), OUT)
  : resolve(process.cwd(), `docs/verification/${symbol}-graph.json`);
mkdirSync(resolve(outFile, ".."), { recursive: true });
writeFileSync(outFile, JSON.stringify(graph, null, 2));

console.log("=== GRAPH PAYLOAD ===");
console.log(
  `  token      : ${graph.token.name} (${graph.token.symbol}), ${graph.token.decimals} decimals, ${graph.token.address}`
);
console.log(
  `  window     : blocks ${graph.scanned.fromBlock}-${graph.scanned.toBlock} (anchor ${graph.scanned.anchorBlock}, ${graph.scanned.chunks} chunk(s))`
);
console.log(`  transfers  : ${graph.scanned.transfers}`);
console.log(
  `  nodes      : ${graph.nodes.length} (distinct addresses ${graph.stats.distinctAddresses}, contracts ${graph.stats.contractNodes})`
);
console.log(`  links      : ${graph.links.length}`);
console.log(`  empty      : ${graph.empty}`);

if (graph.empty) {
  console.log(`\n${graph.message}`);
}

// ---- contract shape: the exact field names the D3 components read -------------------
const nodeShapeOk = graph.nodes.every(
  (n) =>
    typeof n.address === "string" &&
    typeof n.balance === "number" &&
    Number.isFinite(n.balance) &&
    typeof n.isContract === "boolean"
);
const linkShapeOk = graph.links.every(
  (l) =>
    typeof l.source === "string" &&
    typeof l.target === "string" &&
    typeof l.value === "number" &&
    Number.isFinite(l.value) &&
    Number.isInteger(l.txCount) &&
    l.txCount > 0
);
const nodeKeys = new Set(graph.nodes.map((n) => n.address.toLowerCase()));
const dangling = graph.links.filter(
  (l) => !nodeKeys.has(l.source.toLowerCase()) || !nodeKeys.has(l.target.toLowerCase())
);
console.log(
  `\nshape      : nodes ${nodeShapeOk ? "OK" : "BROKEN"} (address/balance/isContract), links ${linkShapeOk ? "OK" : "BROKEN"} (source/target/value/txCount)`
);
console.log(
  `d3 safety  : ${dangling.length} dangling link endpoint(s)${dangling.length ? " -> forceLink would throw" : " (every link resolves to a node)"}`
);

// ---- the map's own props, unchanged components --------------------------------------
const bubble = toBubbleMapData(graph);
console.log(
  `bubble map : ${bubble.wallets.length} Wallet / ${bubble.links.length} Link props, no component change`
);

// ---- reconciliation against the explorer's chain-wide counters ----------------------
const counters = await fetchCounters(TOKEN);
if (counters) {
  const transfersCount = counters.transfers_count ? Number(counters.transfers_count) : null;
  const holdersCount = counters.token_holders_count ? Number(counters.token_holders_count) : null;
  const nonZeroNodes = graph.nodes.filter(
    (n) => n.address.toLowerCase() !== "0x0000000000000000000000000000000000000000"
  ).length;
  const wholeHistory = FROM === undefined && BLOCKS === undefined;
  console.log("\n=== RECONCILIATION (blockscout /api/v2/tokens/{addr}/counters) ===");
  console.log(
    `  transfers_count        : ${transfersCount ?? "n/a"} chain-wide vs ${graph.scanned.transfers} in this payload (blocks ${graph.scanned.fromBlock}-${graph.scanned.toBlock})`
  );
  console.log(
    `  token_holders_count    : ${holdersCount ?? "n/a"} current holders vs ${nonZeroNodes} distinct non-zero holder addresses in the payload`
  );
  if (!wholeHistory) {
    console.log(
      `  note                   : windowed scan (${BLOCKS ? `${BLOCKS} blocks` : "explicit range"}), so its transfer count is a subset of the chain-wide counter — the delta is the window, not missing data.`
    );
  } else if (transfersCount !== null) {
    console.log(
      `  transfers verdict      : ${transfersCount === graph.scanned.transfers ? "EXACT MATCH" : `MISMATCH (${graph.scanned.transfers} vs ${transfersCount})`}`
    );
  }
}

console.log("\n=== TOP NODES (real balanceOf) ===");
for (const node of graph.nodes.slice(0, 12)) {
  console.log(
    `  #${node.rank} ${node.address}  ${node.balance.toFixed(6)} ${graph.token.symbol}` +
      `  contract=${node.isContract}  ${explorerAddressUrl(node.address)}`
  );
}

console.log("\n=== TOP LINKS (aggregated Transfer legs) ===");
for (const link of graph.links.slice(0, 10)) {
  console.log(
    `  ${link.source} -> ${link.target}  ${link.value.toFixed(6)} ${graph.token.symbol} over ${link.txCount} tx`
  );
}

if (!graph.empty && (graph.nodes.length < 2 || graph.links.length < 1)) {
  console.error("\nFAIL: non-empty payload with fewer than 2 nodes / 1 link");
  process.exit(1);
}
console.log(`\nGRAPH OK -> ${outFile}`);
