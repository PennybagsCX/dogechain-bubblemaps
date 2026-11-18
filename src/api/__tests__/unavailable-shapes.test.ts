import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApiApp } from "../index";
import { CACHE_NAMESPACE, cacheKey, clearCache, readCache, writeCache } from "../lib/cache";

/**
 * Shape tests for the retargeted API layer.
 *
 * These assert the card's contract without touching the network or the database:
 * every "no source on this chain" route must answer 200 with
 * `{ unavailable: true, reason: "no <x> source on DogeOS Chikyū testnet…" }`,
 * and every cache key must carry the chain namespace.
 */

const app = createApiApp();

const UNAVAILABLE_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["/api/tvl", "TVL"],
  ["/api/chain-metrics", "TVL/DEX-volume/active-pool/daily-user"],
  ["/api/market", "market/price"],
  ["/api/price?token=0x0000000000000000000000000000000000000000", "market/price"],
  ["/api/candles?token=0x0000000000000000000000000000000000000000&interval=1h", "candle/OHLCV"],
  ["/api/trending?type=TOKEN&limit=5&cache=true", "search-analytics"],
  ["/api/trending-wallet?type=TOKEN&limit=5", "search-analytics"],
  ["/api/learned-tokens?type=TOKEN&limit=5", "learned-token index"],
  [
    "/api/trending/popularity?addresses[]=0x0000000000000000000000000000000000000000",
    "popularity-analytics",
  ],
  ["/api/recommendations/peers?query=DOGE&type=TOKEN", "peer-recommendation"],
];

const UNAVAILABLE_WRITE_ROUTES: readonly string[] = [
  "/api/interactions",
  "/api/analytics/search",
  "/api/analytics/click",
  "/api/trending/log",
  "/api/trending/popularity",
  "/api/wallet-scan",
  "/api/contributions/submit",
  "/api/contributions/vote",
];

describe("honest unavailable shapes", () => {
  it.each(UNAVAILABLE_ROUTES)(
    "%s returns 200 with an explicit unavailable payload",
    async (path, subject) => {
      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(response.body.unavailable).toBe(true);
      expect(response.body.chainId).toBe(6281971);
      expect(response.body.reason).toContain(`no ${subject} source on DogeOS Chikyū testnet`);
      expect(response.body.reason).toMatch(/^no .+ source on DogeOS Chikyū testnet/);
    }
  );

  it("never returns a fabricated zero for TVL/market/price/candles", async () => {
    for (const path of ["/api/tvl", "/api/market", "/api/price", "/api/candles"]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.body.unavailable).toBe(true);
      // No numeric data fields that a UI could render as real values.
      expect(response.body).not.toHaveProperty("priceUsd");
      expect(response.body).not.toHaveProperty("marketCap");
      expect(response.body).not.toHaveProperty("tvl");
    }
  });

  it.each(UNAVAILABLE_WRITE_ROUTES)(
    "%s reports recorded:false instead of pretending to store",
    async (path) => {
      const response = await request(app).post(path).send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.recorded).toBe(false);
      expect(response.body.unavailable).toBe(true);
      expect(response.body.reason).toMatch(/source on DogeOS Chikyū testnet/);
    }
  );
});

describe("alerts validation (no database required)", () => {
  it("rejects a missing wallet", async () => {
    const response = await request(app).get("/api/alerts");
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects a malformed wallet", async () => {
    const response = await request(app).get("/api/alerts?wallet=not-a-wallet");
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid wallet address");
  });

  it("rejects a trigger without payload", async () => {
    const response = await request(app).post("/api/alerts?action=trigger").send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("alertId is required");
  });

  it("rejects an unknown action", async () => {
    const response = await request(app).post("/api/alerts?action=nope").send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Unknown action");
  });

  it("rejects an invalid alert type", async () => {
    const response = await request(app).post("/api/alerts").send({
      walletAddress: "0x000000000000000000000000000000000000dEaD",
      alertId: "a1",
      name: "n",
      monitoredWallet: "0x1111111111111111111111111111111111111111",
      type: "NOT_A_TYPE",
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid alert type");
  });
});

describe("explorer proxy guardrails", () => {
  it("requires a module parameter", async () => {
    const response = await request(app).get("/api/explorer-proxy");
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("module query parameter is required");
  });

  it("rejects modules outside the allow-list", async () => {
    const response = await request(app).get("/api/explorer-proxy?module=admin");
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Unsupported module");
  });
});

describe("cache namespacing", () => {
  it("prefixes every key with the chain id", () => {
    expect(CACHE_NAMESPACE).toBe("chain-6281971");
    expect(cacheKey("stats")).toBe("chain-6281971:stats");
    expect(cacheKey("explorer-proxy", { query: "module=stats", ignored: undefined })).toBe(
      "chain-6281971:explorer-proxy?query=module=stats"
    );
  });

  it("only returns values stored under the same namespaced key", () => {
    clearCache();
    writeCache(cacheKey("stats"), { blockNumber: 1 }, 60_000);
    expect(readCache(cacheKey("stats"))?.value).toEqual({ blockNumber: 1 });
    // A pre-fork key (no chain prefix) can never resolve to a namespaced entry.
    expect(readCache("stats")).toBeNull();
    expect(readCache("dogeos:stats")).toBeNull();
    clearCache();
  });
});
