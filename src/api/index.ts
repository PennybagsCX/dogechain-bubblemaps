import express, { Express } from "express";
import helloRouter from "./hello";
import alertsRouter from "./routes/alerts";
import analyticsRouter from "./routes/analytics";
import chainMetricsRouter from "./routes/chainMetrics";
import explorerProxyRouter from "./routes/explorerProxy";
import statsRouter from "./routes/stats";
import { CHAIN, CHAIN_ID, RPC_URL } from "../../lib/chain";
import { cacheInfo } from "./lib/cache";
import { checkDatabase } from "./lib/db";
import { unavailablePayload } from "./lib/unavailable";

/**
 * Build the fork's API application.
 *
 * Every `/api/*` route below answers with either live Chikyū data or the explicit
 * `{ unavailable: true, reason: "no … source on DogeOS Chikyū testnet" }` payload.
 * Routes and their sources are catalogued in `docs/api-layer.md`.
 *
 * The app is deliberately importable without a live network or database: handlers
 * resolve those lazily, so unit tests can mount the app and assert on the shapes.
 */
export function createApiApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // CORS headers (if needed for development)
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  });

  // Routes
  app.use("/api", helloRouter);
  app.use("/api", statsRouter);
  app.use("/api", alertsRouter);
  app.use("/api", chainMetricsRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", explorerProxyRouter);

  /**
   * Health check: reports the chain identity, the fork database and the cache namespace.
   * Always HTTP 200 — the point is that a degraded dependency is *reported*
   * (`database: "unavailable"` + an explicit `unavailable` entry), not hidden behind 503.
   */
  app.get("/api/health", async (_req, res) => {
    const database = await checkDatabase();
    res.json({
      status: database.ok ? "healthy" : "degraded",
      chain: { id: CHAIN_ID, name: CHAIN.name, rpc: RPC_URL },
      database: database.ok ? "connected" : "unavailable",
      cache: cacheInfo(),
      ...(database.ok
        ? {}
        : {
            databaseError: database.error,
            unavailable: {
              database: unavailablePayload("alert-store", database.error ?? "database unreachable"),
            },
          }),
      timestamp: new Date().toISOString(),
    });
  });

  // Legacy (non-/api) health check kept for the existing smoke tests.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", chainId: CHAIN_ID, timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      message: "Not found",
      timestamp: new Date().toISOString(),
      status: "error",
    });
  });

  return app;
}

export default createApiApp;
