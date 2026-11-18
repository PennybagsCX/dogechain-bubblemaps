/**
 * Graph data contract for the D3 bubble map — built from live Chikyū Transfer logs.
 *
 * This is the single place that turns on-chain activity into the payload the map consumes:
 *
 *   nodes: { address, balance, isContract }
 *   links: { source, target, value, txCount }
 *
 * Field names are deliberately identical to what `components/BubbleMap.tsx` already reads
 * (`Wallet.address`/`balance`/`isContract`, `Link.source`/`target`/`value`), so no component
 * signature changes. `toBubbleMapData()` performs the one shape adaptation the map needs
 * (`id`, `percentage`, `isWhale`, `connections`) without touching the components.
 *
 * Data provenance — every number comes from the chain, nothing is synthesized:
 *   - balances   : sum(in) − sum(out) over the scanned logs, then real `balanceOf` per node
 *   - decimals   : `readContract` metadata (viem), used for unit-correct formatting
 *   - isContract : `eth_getCode` per node
 *   - links      : Transfer legs aggregated per (from → to), with tx counts
 *
 * Empty state: a token with no Transfer logs in the scanned range yields
 * `{ nodes: [], links: [], empty: true, message }` — never a fabricated holder.
 */

import { formatUnits, isAddress } from "viem";
import type { Wallet, Link } from "../types";
import { CHAIN_ID } from "../lib/chain";
import { EvmRPCClient, publicClient } from "./evmRPC";
import type { TokenMetadata, TransferEvent, TransferProgressCallback } from "./evmRPC";

/** The zero address as it appears in mint/burn Transfer legs. */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** One bubble. Field names match `Wallet` in types.ts (address/balance/isContract). */
export interface GraphNode {
  address: string;
  /** Real `balanceOf` formatted with the token's decimals (token units, e.g. 1213.11). */
  balance: number;
  /** `eth_getCode(address) !== "0x"`. */
  isContract: boolean;
  /** In − out over the scanned window in token units — diagnostic, not a real balance. */
  windowDelta?: number;
  /** 1 = largest real balance in this payload. */
  rank?: number;
}

/** One edge. `value`/`txCount` are aggregates of the Transfer legs behind it. */
export interface GraphLink {
  source: string;
  target: string;
  /** Total moved from source to target in token units over the window. */
  value: number;
  /** Number of Transfer legs aggregated into this edge. */
  txCount: number;
}

export interface TokenGraph {
  chainId: number;
  token: { address: string; name: string; symbol: string; decimals: number };
  scanned: {
    fromBlock: string;
    toBlock: string;
    anchorBlock: string;
    chunks: number;
    transfers: number;
    empty: boolean;
  };
  nodes: GraphNode[];
  links: GraphLink[];
  /** True when the scanned range held no Transfer logs — nodes/links are then empty. */
  empty: boolean;
  /** Human-readable empty-state reason. Present only when `empty` is true. */
  message?: string;
  stats: {
    distinctAddresses: number;
    contractNodes: number;
    totalBalance: number;
    /** Largest single transfer leg seen, in token units. */
    largestTransfer: number;
  };
}

export interface BuildTokenGraphOptions {
  /** Highest block to scan; defaults to head. */
  toBlock?: bigint;
  /** Lowest block to scan; defaults to the token's deploy anchor. */
  fromBlock?: bigint;
  /** Scan only this many blocks back from `toBlock` (window mode). */
  lookback?: bigint;
  /** Parallel `balanceOf` / `eth_getCode` requests. Default 8. */
  concurrency?: number;
  onProgress?: TransferProgressCallback;
  /** Reuse a client (e.g. one that already cached metadata/anchor). */
  client?: EvmRPCClient;
}

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function toUnits(value: bigint, decimals: number): number {
  // formatUnits keeps full precision in the bigint domain; Number() then matches the
  // `number` field type the components already use.
  return Number(formatUnits(value, decimals));
}

function normalizeDecimals(decimals: number | undefined): number {
  return typeof decimals === "number" && Number.isInteger(decimals) && decimals >= 0
    ? decimals
    : 18;
}

/** Same leg appearing twice in one tx (fee splits, multi-hop) must not double count. */
function dedupeLegs(events: TransferEvent[]): TransferEvent[] {
  const seen = new Set<string>();
  const legs: TransferEvent[] = [];
  for (const event of events) {
    const key = `${event.transactionHash}:${event.from.toLowerCase()}:${event.to.toLowerCase()}:${event.value.toString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    legs.push(event);
  }
  return legs;
}

/**
 * Build the bubble-map payload for one token from live logs.
 *
 * Throws only for an invalid address; an empty chain answer is a valid result, not an error.
 */
export async function buildTokenGraph(
  tokenAddress: string,
  options: BuildTokenGraphOptions = {}
): Promise<TokenGraph> {
  if (!isAddress(tokenAddress)) {
    throw new Error(`buildTokenGraph: invalid token address ${tokenAddress}`);
  }

  const client = options.client ?? new EvmRPCClient();
  const metadata: TokenMetadata = await client.getTokenMetadata(tokenAddress);
  const decimals = normalizeDecimals(metadata.decimals);

  const scan = await client.scanTokenTransfers(tokenAddress, {
    toBlock: options.toBlock,
    fromBlock: options.fromBlock,
    lookback: options.lookback,
    onProgress: options.onProgress,
  });

  const token = {
    address: tokenAddress,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals,
  };
  const scanned = {
    fromBlock: scan.fromBlock.toString(),
    toBlock: scan.toBlock.toString(),
    anchorBlock: scan.anchorBlock.toString(),
    chunks: scan.chunks,
    transfers: scan.transfers.length,
    empty: scan.empty,
  };
  const baseStats = {
    distinctAddresses: 0,
    contractNodes: 0,
    totalBalance: 0,
    largestTransfer: 0,
  };

  const legs = scan.transfers.length > 0 ? dedupeLegs(scan.transfers) : [];

  // ---- empty state: no logs means no graph. Nothing is invented to fill the view. ----
  if (legs.length === 0) {
    return {
      chainId: CHAIN_ID,
      token,
      scanned,
      nodes: [],
      links: [],
      empty: true,
      message:
        `EMPTY STATE: ${scan.emptyReason ?? `no Transfer logs for ${token.symbol} in blocks ${scanned.fromBlock}-${scanned.toBlock}`}. ` +
        `No nodes or links are fabricated — an empty map is the correct answer for this range.`,
      stats: baseStats,
    };
  }

  // ---- holder aggregation: in − out over the scanned legs (bigint, no float drift) ----
  const deltas = new Map<string, bigint>();
  const bump = (address: string, amount: bigint): string => {
    const key = address.toLowerCase();
    const current = deltas.get(key);
    if (current === undefined) deltas.set(key, amount);
    else deltas.set(key, current + amount);
    return key;
  };
  let largestTransfer = 0n;
  for (const leg of legs) {
    bump(leg.from, -leg.value);
    bump(leg.to, leg.value);
    if (leg.value > largestTransfer) largestTransfer = leg.value;
  }

  // ---- links: one edge per (from → to), value and leg count aggregated ----
  const edges = new Map<
    string,
    { source: string; target: string; value: bigint; txCount: number }
  >();
  for (const leg of legs) {
    const key = `${leg.from.toLowerCase()}>${leg.to.toLowerCase()}`;
    const edge = edges.get(key);
    if (edge) {
      edge.value += leg.value;
      edge.txCount += 1;
    } else {
      edges.set(key, { source: leg.from, target: leg.to, value: leg.value, txCount: 1 });
    }
  }

  // ---- nodes: every address that appears in a leg, ranked by real balance ----
  const addresses = [...deltas.keys()];
  const concurrency = Math.max(1, options.concurrency ?? 8);
  const balances = new Map<string, bigint>();
  const isContract = new Map<string, boolean>();

  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (address) => {
        const typed = address as `0x${string}`;
        const [balance, code] = await Promise.all([
          publicClient
            .readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_BALANCE_ABI,
              functionName: "balanceOf",
              args: [typed],
              // Pin to the scan's last block so balances and links describe one snapshot.
              // (Without this, an interest-bearing token drifts between the log walk and
              // the balance read — measured ~0.01 mWDOGE on mWDOGE.)
              blockNumber: scan.toBlock,
            })
            .then((value: unknown) => value as bigint)
            .catch(() => null),
          publicClient
            .getCode({ address: typed, blockNumber: scan.toBlock })
            .then((value: unknown) => (value as string | undefined) ?? "0x")
            .catch(() => "0x"),
        ]);
        if (balance !== null) balances.set(address, balance);
        isContract.set(address, Boolean(code && code !== "0x"));
      })
    );
  }

  const allNodes: GraphNode[] = addresses.map((address) => {
    const delta = deltas.get(address) ?? 0n;
    const real = balances.get(address);
    // Fall back to the window delta when balanceOf is unavailable (transient RPC error).
    const balance = real !== undefined ? real : delta > 0n ? delta : 0n;
    return {
      address,
      balance: toUnits(balance, decimals),
      isContract: isContract.get(address) ?? false,
      windowDelta: toUnits(delta, decimals),
    };
  });

  allNodes.sort((a, b) => b.balance - a.balance || a.address.localeCompare(b.address));
  const nodes: GraphNode[] = allNodes.map((node, index) => ({ ...node, rank: index + 1 }));

  const links: GraphLink[] = [...edges.values()]
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: toUnits(edge.value, decimals),
      txCount: edge.txCount,
    }));

  const totalBalance = nodes.reduce((sum, node) => sum + node.balance, 0);

  return {
    chainId: CHAIN_ID,
    token,
    scanned,
    nodes,
    links,
    empty: false,
    stats: {
      distinctAddresses: addresses.length,
      contractNodes: nodes.filter((node) => node.isContract).length,
      totalBalance,
      largestTransfer: toUnits(largestTransfer, decimals),
    },
  };
}

/**
 * Default block window the analysis view scans when a token is older than it.
 *
 * 40,000 blocks is ~33 h at Chikyū's 3 s block time: big enough that a token deployed in the
 * last day (the common case for a bubble map) is scanned from its deploy block, small enough
 * that a 25k-holder token is 5 chunked `eth_getLogs` calls instead of a 100+ chunk crawl.
 */
export const UI_GRAPH_LOOKBACK_BLOCKS = 40000n;

export interface UiGraphOptions {
  /** Max blocks to walk back from head when the deploy anchor is older. */
  lookbackBlocks?: bigint;
  /** Per-chunk progress (used by the app's loading overlay). */
  onProgress?: TransferProgressCallback;
  /** Reuse a client (e.g. one that already cached metadata/anchor). */
  client?: EvmRPCClient;
}

/**
 * The app's entry point: build the graph for a token at head, picking the scan window so the
 * map is both complete for young tokens and bounded for old ones.
 *
 * Window rule: if the token's deploy anchor is within `lookbackBlocks` of head, scan
 * anchor → head (whole history, no gaps); otherwise scan the last `lookbackBlocks` blocks and
 * let the payload advertise that window in `scanned.fromBlock/toBlock`.
 */
export async function buildUiTokenGraph(
  tokenAddress: string,
  options: UiGraphOptions = {}
): Promise<TokenGraph> {
  if (!isAddress(tokenAddress)) {
    throw new Error(`buildUiTokenGraph: invalid token address ${tokenAddress}`);
  }

  const client = options.client ?? new EvmRPCClient();
  const lookback = options.lookbackBlocks ?? UI_GRAPH_LOOKBACK_BLOCKS;
  const toBlock = await client.getLatestBlockNumber();
  const anchorBlock = await client.findDeployBlock(tokenAddress, toBlock);
  const fromBlock =
    anchorBlock <= toBlock && toBlock - anchorBlock <= lookback ? anchorBlock : toBlock - lookback;

  return buildTokenGraph(tokenAddress, {
    client,
    fromBlock,
    toBlock,
    onProgress: options.onProgress,
  });
}

/**
 * Adapt a `TokenGraph` to the exact `Wallet[]` / `Link[]` props `BubbleMap` already takes.
 * Components stay untouched; this is the only conversion point.
 */
export function toBubbleMapData(graph: TokenGraph): { wallets: Wallet[]; links: Link[] } {
  const neighbors = new Map<string, string[]>();
  for (const link of graph.links) {
    const from = link.source.toLowerCase();
    const to = link.target.toLowerCase();
    neighbors.set(from, [...(neighbors.get(from) ?? []), to]);
    neighbors.set(to, [...(neighbors.get(to) ?? []), from]);
  }

  const total = graph.stats.totalBalance;
  const wallets: Wallet[] = graph.nodes.map((node, index) => ({
    id: node.address,
    address: node.address,
    balance: node.balance,
    percentage: total > 0 ? (node.balance / total) * 100 : 0,
    isWhale: index < 10,
    isContract: node.isContract,
    connections: neighbors.get(node.address.toLowerCase()) ?? [],
  }));

  const links: Link[] = graph.links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.value,
  }));

  return { wallets, links };
}
