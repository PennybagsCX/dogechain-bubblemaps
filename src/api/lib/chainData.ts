/**
 * Server-side reads of live DogeOS Chikyū data.
 *
 * Two sources only, both from `lib/chain.ts` (never a literal host at a call site):
 *   - JSON-RPC  : https://rpc.testnet.dogeos.com/   (block height, chain id)
 *   - Blockscout: https://blockscout.testnet.dogeos.com/api(/v2)  (chain counters, explorer proxy)
 *
 * Nothing here invents a number. Fields the testnet genuinely does not have
 * (`coin_price`, `market_cap`, `tvl`) are reported by the routes as `unavailable`,
 * never forwarded as the zeros blockscout itself returns.
 */

import {
  CHAIN,
  CHAIN_ID,
  EXPLORER_API,
  EXPLORER_API_V2,
  EXPLORER_URL,
  RPC_URL,
} from "../../../lib/chain";

const RPC_TIMEOUT_MS = 12_000;
const EXPLORER_TIMEOUT_MS = 15_000;

/** Error raised when a live source is unreachable or answers with garbage. */
export class UpstreamError extends Error {
  readonly source: string;
  readonly status?: number;

  constructor(source: string, message: string, status?: number) {
    super(message);
    this.name = "UpstreamError";
    this.source = source;
    this.status = status;
  }
}

/** Strip any connection string / credential from a message before it reaches a response. */
export function redact(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>")
    .replace(/password=[^\s&"']+/gi, "password=<redacted>");
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new UpstreamError(
        url,
        `HTTP ${response.status} from ${new URL(url).host}`,
        response.status
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UpstreamError(url, `non-JSON body from ${new URL(url).host}`);
    }
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    if (reason.toLowerCase().includes("aborted")) {
      throw new UpstreamError(url, `timed out after ${timeoutMs}ms`);
    }
    throw new UpstreamError(url, reason);
  } finally {
    clearTimeout(timer);
  }
}

interface JsonRpcEnvelope {
  result?: unknown;
  error?: { code?: number; message?: string };
}

/** Minimal JSON-RPC 2.0 call against the Chikyū endpoint. */
export async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const payload = (await fetchJson(
    RPC_URL,
    { method: "POST", headers: { "content-type": "application/json" }, body },
    RPC_TIMEOUT_MS
  )) as JsonRpcEnvelope;

  if (payload.error) {
    throw new UpstreamError(
      RPC_URL,
      `RPC error ${payload.error.code ?? "?"}: ${payload.error.message ?? "unknown"}`
    );
  }
  if (payload.result === undefined) {
    throw new UpstreamError(RPC_URL, `RPC ${method} returned no result`);
  }
  return payload.result as T;
}

/** Live head, as a number. */
export async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall<string>("eth_blockNumber");
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed))
    throw new UpstreamError(RPC_URL, `unparseable eth_blockNumber: ${hex}`);
  return parsed;
}

/** Live chain id, as a number — used to prove the RPC is still Chikyū. */
export async function getRpcChainId(): Promise<number> {
  const hex = await rpcCall<string>("eth_chainId");
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed)) throw new UpstreamError(RPC_URL, `unparseable eth_chainId: ${hex}`);
  return parsed;
}

export interface ExplorerStats {
  totalBlocks: number | null;
  totalTransactions: number | null;
  totalAddresses: number | null;
  transactionsToday: number | null;
  averageBlockTimeMs: number | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Blockscout v2 stats, filtered down to counters that describe the chain itself.
 *
 * Deliberately NOT forwarded: `coin_price` (null), `market_cap` ("0"), `tvl` (null) —
 * they are the exact "zeros dressed as data" the card forbids, so price/market/TVL
 * routes answer `unavailable` instead.
 */
export async function getExplorerStats(): Promise<ExplorerStats> {
  const raw = (await fetchJson(
    `${EXPLORER_API_V2}/stats`,
    { method: "GET", headers: { accept: "application/json" } },
    EXPLORER_TIMEOUT_MS
  )) as Record<string, unknown>;

  return {
    totalBlocks: toNumber(raw.total_blocks),
    totalTransactions: toNumber(raw.total_transactions),
    totalAddresses: toNumber(raw.total_addresses),
    transactionsToday: toNumber(raw.transactions_today),
    averageBlockTimeMs: toNumber(raw.average_block_time),
  };
}

export interface ExplorerProxyResult {
  status: number;
  body: unknown;
}

/**
 * Forward an explorer-API query string to the Chikyū blockscout host.
 *
 * The host is fixed by `lib/chain.ts`; only the query string is caller-controlled, so
 * this cannot be turned into a generic fetcher. Failures surface as `UpstreamError`.
 */
export async function explorerProxy(query: string): Promise<ExplorerProxyResult> {
  const target = `${EXPLORER_API}?${query}`;
  const body = await fetchJson(
    target,
    { method: "GET", headers: { accept: "application/json" } },
    EXPLORER_TIMEOUT_MS
  );
  return { status: 200, body };
}

/** Static chain identity, echoed in every route so a client can prove what it talks to. */
export const chainIdentity = {
  id: CHAIN_ID,
  name: CHAIN.name,
  network: CHAIN.network,
  nativeCurrency: CHAIN.nativeCurrency.symbol,
  rpc: RPC_URL,
  explorer: EXPLORER_URL,
  explorerApi: EXPLORER_API,
} as const;
