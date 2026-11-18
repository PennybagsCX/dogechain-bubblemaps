/**
 * Unit tests for the graph-first data path the analysis view now uses.
 *
 * What is pinned here:
 *   1. `buildUiTokenGraph` scans anchor→head for a young token and the bounded lookback window
 *      for an old one (a whole-history walk of a 25k-holder token is not shippable in a browser).
 *   2. The payload it returns still satisfies the BubbleMap contract through `toBubbleMapData`
 *      (id / percentage / isWhale / connections), so no component signature had to change.
 *   3. A zero-log range stays an explicit empty state with a message — never fabricated nodes.
 *
 * `publicClient` is mocked because the only chain reads left after the log walk are `balanceOf`
 * and `eth_getCode` per node; every other value in these tests comes from the fake client.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../services/evmRPC", () => {
  const publicClient = {
    readContract: vi.fn(async () => 1000n * 10n ** 18n),
    getCode: vi.fn(async () => "0x"),
  };
  class EvmRPCClient {
    async getTokenMetadata() {
      return { name: "T09 Proof Token", symbol: "T09P", decimals: 18 };
    }
    async scanTokenTransfers() {
      throw new Error("the fake client passed to buildUiTokenGraph must be used");
    }
    async getLatestBlockNumber() {
      return 0n;
    }
    async findDeployBlock() {
      return 0n;
    }
  }
  return {
    publicClient,
    EvmRPCClient,
    EVM_LOG_CHUNK_SIZE: 9000n,
    TRANSFER_EVENT_SIGNATURE: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  };
});

import {
  buildUiTokenGraph,
  toBubbleMapData,
  UI_GRAPH_LOOKBACK_BLOCKS,
} from "../services/graphService";

const TOKEN = "0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27";
const ZERO = "0x0000000000000000000000000000000000000000";
const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

/** The subset of `TransferEvent` the graph builder reads. */
interface Leg {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  tokenAddress: string;
}

interface FakeOptions {
  head: bigint;
  anchor: bigint;
  transfers?: Leg[];
}

function fakeClient({ head, anchor, transfers = [] }: FakeOptions) {
  const seen: { fromBlock?: bigint; toBlock?: bigint } = {};
  const client = {
    seen,
    async getLatestBlockNumber() {
      return head;
    },
    async findDeployBlock() {
      return anchor;
    },
    async getTokenMetadata() {
      return { name: "T09 Proof Token", symbol: "T09P", decimals: 18 };
    },
    async scanTokenTransfers(_address: string, options: { fromBlock?: bigint; toBlock?: bigint }) {
      seen.fromBlock = options.fromBlock;
      seen.toBlock = options.toBlock;
      return {
        tokenAddress: TOKEN,
        transfers,
        empty: transfers.length === 0,
        fromBlock: options.fromBlock,
        toBlock: options.toBlock,
        anchorBlock: anchor,
        chunks: 1,
        ...(transfers.length === 0
          ? { emptyReason: `no Transfer logs in blocks ${options.fromBlock}-${options.toBlock}` }
          : {}),
      };
    },
  };
  return client as unknown as EvmRPCClient;
}

const leg = (from: string, to: string, value: bigint, hash = "0x" + "a".repeat(64)) => ({
  transactionHash: hash,
  blockNumber: 9562826n,
  from,
  to,
  value,
  timestamp: 1_760_000_000_000,
  tokenAddress: TOKEN,
});

describe("buildUiTokenGraph — scan window", () => {
  it("scans anchor→head when the token is younger than the lookback window", async () => {
    const head = 9_600_000n;
    const anchor = 9_562_825n;
    const client = fakeClient({ head, anchor });

    const graph = await buildUiTokenGraph(TOKEN, { client });

    expect(client.seen.fromBlock).toBe(anchor);
    expect(client.seen.toBlock).toBe(head);
    expect(graph.scanned.fromBlock).toBe(anchor.toString());
    expect(graph.scanned.anchorBlock).toBe(anchor.toString());
    expect(graph.empty).toBe(true);
  });

  it("falls back to the bounded lookback window for an old token", async () => {
    const head = 9_600_000n;
    const anchor = 1_000_000n; // far older than the 40,000-block window
    const client = fakeClient({ head, anchor });

    await buildUiTokenGraph(TOKEN, { client });

    expect(client.seen.toBlock).toBe(head);
    expect(client.seen.fromBlock).toBe(head - UI_GRAPH_LOOKBACK_BLOCKS);
  });

  it("honours an explicit lookbackBlocks override", async () => {
    const head = 9_600_000n;
    const client = fakeClient({ head, anchor: 1n });

    await buildUiTokenGraph(TOKEN, { client, lookbackBlocks: 9_000n });

    expect(client.seen.fromBlock).toBe(9_591_000n);
  });

  it("rejects a non-address instead of scanning", async () => {
    await expect(buildUiTokenGraph("not-an-address")).rejects.toThrow(/invalid token address/);
  });
});

describe("buildUiTokenGraph — payload", () => {
  it("keeps a zero-log range an explicit empty state with a message", async () => {
    const client = fakeClient({ head: 9_600_000n, anchor: 9_562_825n });

    const graph = await buildUiTokenGraph(TOKEN, { client });

    expect(graph.nodes).toEqual([]);
    expect(graph.links).toEqual([]);
    expect(graph.empty).toBe(true);
    expect(graph.message).toMatch(/EMPTY STATE/);
    expect(graph.message).toMatch(/no Transfer logs/);
    expect(graph.stats).toEqual({
      distinctAddresses: 0,
      contractNodes: 0,
      totalBalance: 0,
      largestTransfer: 0,
    });
  });

  it("builds nodes and links from real legs and adapts them to the BubbleMap props", async () => {
    const client = fakeClient({
      head: 9_600_000n,
      anchor: 9_562_825n,
      transfers: [
        leg(ZERO, A, 1_000_000n * 10n ** 18n), // mint to A
        leg(A, B, 250_000n * 10n ** 18n), // A → B
      ],
    });

    const graph = await buildUiTokenGraph(TOKEN, { client });

    expect(graph.empty).toBe(false);
    expect(graph.scanned.transfers).toBe(2);
    // ZERO, A and B all appear in a leg, so all three are nodes.
    expect(graph.nodes.map((n) => n.address.toLowerCase()).sort()).toEqual([ZERO, A, B].sort());
    expect(graph.links).toHaveLength(2);
    expect(graph.links[0]).toMatchObject({ source: expect.any(String), value: expect.any(Number) });
    // Window delta is the in − out over the scanned legs, in token units.
    expect(graph.nodes.find((n) => n.address === A)?.windowDelta).toBe(750_000);

    const { wallets, links } = toBubbleMapData(graph);
    expect(wallets).toHaveLength(graph.nodes.length);
    for (const wallet of wallets) {
      expect(wallet).toMatchObject({
        id: expect.any(String),
        address: expect.any(String),
        percentage: expect.any(Number),
        isWhale: expect.any(Boolean),
        isContract: expect.any(Boolean),
        connections: expect.any(Array),
      });
    }
    // Percentage is a share of the summed real balances, not of the transfer volume.
    const totalPct = wallets.reduce((sum, w) => sum + w.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 6);
    expect(links).toHaveLength(graph.links.length);
    expect(Object.keys(links[0]).sort()).toEqual(["source", "target", "value"]);
  });
});
