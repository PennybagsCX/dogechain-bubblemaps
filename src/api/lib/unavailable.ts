/**
 * The explicit "we do not have this data" payload.
 *
 * The card's rule: an endpoint with no source on DogeOS Chikyū testnet returns
 * `{ unavailable: true, reason: "no <x> source on DogeOS Chikyū testnet" }` — never
 * zeros (or the blockscout `market_cap: "0"` / `tvl: null`) dressed up as data.
 *
 * Every route that cannot serve a real value uses this builder so the shape, the
 * wording and the chain identity stay identical across the API.
 */

import { CHAIN_ID, CHAIN_NAME } from "../../../lib/chain";

/** Human-facing testnet label used verbatim in every reason string. */
export const TESTNET_LABEL = "DogeOS Chikyū testnet";

export interface UnavailablePayload {
  unavailable: true;
  reason: string;
  chainId: number;
  chainName: string;
  checkedAt: string;
}

/**
 * @param subject - what is missing, e.g. "candle/OHLCV", "market/price", "TVL".
 * @param detail  - optional short parenthetical with the concrete finding.
 */
export function unavailablePayload(subject: string, detail?: string): UnavailablePayload {
  return {
    unavailable: true,
    reason: `no ${subject} source on ${TESTNET_LABEL}${detail ? ` (${detail})` : ""}`,
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * A write endpoint with no store behind it. Still HTTP 200 (the client's fire-and-forget
 * logging must not hard-fail), but explicit that nothing was recorded.
 */
export interface UnavailableWritePayload extends UnavailablePayload {
  success: false;
  recorded: false;
}

export function unavailableWrite(subject: string, detail?: string): UnavailableWritePayload {
  return { success: false, recorded: false, ...unavailablePayload(subject, detail) };
}
