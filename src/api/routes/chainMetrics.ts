/**
 * Endpoints whose data source does not exist on DogeOS Chikyū testnet.
 *
 * Checked live on 2026-11-17 against the Chikyū blockscout v2 `/stats` payload:
 * `coin_price: null`, `market_cap: "0"`, `tvl: null`, and there is no OHLCV/candles
 * endpoint at all. Upstream served these panels from a mainnet market feed; this fork
 * must not. Every route here answers HTTP 200 with the explicit
 * `{ unavailable: true, reason: "no <x> source on DogeOS Chikyū testnet" }` payload so a
 * client can render "unavailable" instead of a fake $0.00 / 0 TVL.
 */

import { Router, type Request } from "express";
import { unavailablePayload } from "../lib/unavailable";

function requestedParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim() !== "")
    return value[0].trim();
  return undefined;
}

/** Echo only what the caller asked for, so the reason can name the token/interval. */
function echo(req: Request, keys: string[]): Record<string, string> {
  const echoed: Record<string, string> = {};
  for (const key of keys) {
    const value = requestedParam(req, key);
    if (value) echoed[key] = value;
  }
  return echoed;
}

const router = Router();

/** Total value locked: no indexer publishes TVL for this testnet (blockscout reports null). */
router.get("/tvl", (req, res) => {
  res.json({
    ...unavailablePayload("TVL", "blockscout /api/v2/stats returns tvl: null"),
    ...echo(req, ["token", "pool"]),
  });
});

/** Chain-level metrics panel (TVL, 24h/7d DEX volume, active pools, daily users). */
router.get("/chain-metrics", (req, res) => {
  res.json({
    ...unavailablePayload(
      "TVL/DEX-volume/active-pool/daily-user",
      "no DEX indexer or analytics source is deployed for the Chikyū testnet"
    ),
    metrics: null,
    ...echo(req, ["window"]),
  });
});

/** Aggregate market data (market cap, FDV, circulating supply, price change). */
router.get("/market", (req, res) => {
  res.json({
    ...unavailablePayload(
      "market/price",
      'blockscout reports coin_price: null and market_cap: "0" — zeros are not served as data'
    ),
    ...echo(req, ["token"]),
  });
});

/** Spot price for one token. Same absent feed as /market. */
router.get("/price", (req, res) => {
  res.json({
    ...unavailablePayload("market/price", "no price oracle or DEX feed on the Chikyū testnet"),
    ...echo(req, ["token"]),
  });
});

/** OHLCV candles. No candle endpoint exists on the testnet explorer or RPC. */
router.get("/candles", (req, res) => {
  res.json({
    ...unavailablePayload(
      "candle/OHLCV",
      "neither blockscout nor the Chikyū RPC exposes traded prices"
    ),
    candles: [],
    ...echo(req, ["token", "pool", "interval", "timeframe"]),
  });
});

export default router;
