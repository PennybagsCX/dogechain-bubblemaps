/**
 * Standalone API server for the fork.
 *
 *   npm run api:dev     # tsx src/api/server.ts (dev proxy in vite.config targets :3001)
 *
 * Loads `.env.local` (git-ignored) for `DATABASE_URL`, then serves the routes built by
 * `createApiApp()`. It binds loopback by default: this process holds a database
 * credential and reads testnet data, it is not meant to be exposed.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { CHAIN_ID } from "../../lib/chain";
import { createApiApp } from "./index";
import { isDatabaseConfigured } from "./lib/db";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

// `.env.local` first (fork-local values), then `.env` as a fallback for CI.
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const host = process.env.API_HOST ?? "127.0.0.1";

const app = createApiApp();

const server = app.listen(port, host, () => {
  const database = isDatabaseConfigured() ? "configured" : "NOT configured";
  // Never print the DSN itself — only whether one is present.
  console.log(
    `[api] DogeOS Chikyū fork API listening on http://${host}:${port} (chain ${CHAIN_ID}, database ${database})`
  );
});

function shutdown(signal: string): void {
  console.log(`[api] ${signal} received, closing server`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
