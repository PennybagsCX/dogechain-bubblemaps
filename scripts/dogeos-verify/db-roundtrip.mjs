#!/usr/bin/env node
/**
 * T-05 database isolation proof — round-trip against the fork's OWN database.
 *
 * Why this script exists
 * ----------------------
 * `services/db.ts` is a browser-side Dexie (IndexedDB) layer. It never opens a
 * Postgres socket: its only server path is `fetch("/api/alerts…")`, which posts
 * the payload shape `{ walletAddress, localAlerts: DbAlert[] }` (see
 * `syncAlertsToServer` / `syncAlertsFromServer` in services/db.ts). The server
 * handlers that turn that payload into rows in `user_alerts` /
 * `triggered_alerts` / `diagnostic_logs` do not exist in this fork yet — that is
 * card T-06's job.
 *
 * So this script proves the storage layer end-to-end against the fork database
 * using the *same row shapes* the db.ts sync contract produces, and fails
 * loudly if the target is anything but a loopback database.
 *
 * Safety rails
 * ------------
 *  - refuses to run against a non-loopback host (so it can never touch prod)
 *  - never prints the connection string, only host:port/db
 *  - deletes everything it inserts
 *
 * Usage: node scripts/dogeos-verify/db-roundtrip.mjs
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// --- load .env.local without pulling in dotenv as a runtime dependency ------
for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#") || !s.includes("=")) continue;
  const i = s.indexOf("=");
  const key = s.slice(0, i).trim();
  if (!(key in process.env)) process.env[key] = s.slice(i + 1).trim();
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("FAIL: DATABASE_URL is not set");
  process.exit(2);
}
const url = new URL(raw);
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!LOOPBACK.has(url.hostname)) {
  console.error(`FAIL: refusing to run — target host ${url.hostname} is not loopback`);
  process.exit(3);
}
const target = `${url.hostname}:${url.port}/${url.pathname.replace(/^\//, "")}`;

const prisma = new PrismaClient({ datasources: { db: { url: raw } } });
const stamp = new Date().toISOString();
const alertId = `t05-proof-${randomUUID()}`;
const USER = "0x000000000000000000000000000000000000T05".replace("T", "a").slice(0, 42);
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  const who = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS usr,
    inet_server_addr()::text || ':' || inet_server_port() AS addr, version() AS v`;
  const ident = who[0];
  check(
    "connected to fork database (not prod)",
    ident.db === url.pathname.replace(/^\//, ""),
    `db=${ident.db} user=${ident.usr} server=${ident.addr}`
  );

  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const names = tables.map((t) => t.tablename);
  check(
    "all three migrated tables exist",
    ["diagnostic_logs", "triggered_alerts", "user_alerts"].every((t) => names.includes(t)),
    names.join(",")
  );

  // ---- 1. write: the user_alerts row a db.ts sync upload becomes -----------
  const created = await prisma.userAlert.create({
    data: {
      user_wallet_address: USER,
      alert_id: alertId,
      name: "T-05 isolation proof",
      wallet_address: "0x1111111111111111111111111111111111111111",
      token_address: null,
      token_symbol: "MDOGE",
      initial_value: "1234.5",
      type: "WALLET",
      created_at: BigInt(Date.now()),
      is_active: true,
    },
  });
  check("write user_alerts", created.id > 0, `id=${created.id}`);

  // ---- 2. read it back ----------------------------------------------------
  const read = await prisma.userAlert.findFirst({
    where: { user_wallet_address: USER, alert_id: alertId },
  });
  check(
    "read user_alerts round-trip",
    !!read && read.name === "T-05 isolation proof" && read.token_symbol === "MDOGE",
    `id=${read?.id} name="${read?.name}" initial_value=${read?.initial_value}`
  );
  check(
    "decimal + BigInt columns survive the round-trip",
    String(read?.initial_value) === "1234.5" && typeof read?.created_at === "bigint",
    `initial_value=${read?.initial_value} createdAtType=${typeof read?.created_at}`
  );

  // ---- 3. second table: triggered_alerts ----------------------------------
  const trig = await prisma.triggeredAlert.create({
    data: {
      alert_id: alertId,
      alert_name: "T-05 isolation proof",
      wallet_address: "0x1111111111111111111111111111111111111111",
      token_symbol: "MDOGE",
      transaction_count: 3,
    },
  });
  const trigRead = await prisma.triggeredAlert.findUnique({ where: { id: trig.id } });
  check("write+read triggered_alerts", trigRead?.transaction_count === 3, `id=${trig.id} count=${trigRead?.transaction_count}`);

  // ---- 4. third table: diagnostic_logs (JSONB payload) --------------------
  const diag = await prisma.diagnosticLog.create({
    data: {
      session_id: alertId,
      timestamp: BigInt(Date.now()),
      platform: "macos",
      console_logs: [{ level: "info", msg: "t05 proof" }],
      errors: [],
    },
  });
  const diagRead = await prisma.diagnosticLog.findFirst({ where: { session_id: alertId } });
  check(
    "write+read diagnostic_logs (JSONB)",
    Array.isArray(diagRead?.console_logs) && diagRead.console_logs.length === 1,
    `id=${diag.id} console_logs=${JSON.stringify(diagRead?.console_logs)}`
  );

  // ---- 5. update path (db.ts sync is upsert-shaped) ----------------------
  await prisma.userAlert.updateMany({
    where: { user_wallet_address: USER, alert_id: alertId },
    data: { is_active: false, name: "T-05 isolation proof (updated)" },
  });
  const updated = await prisma.userAlert.findFirst({ where: { alert_id: alertId } });
  check("update path", updated?.is_active === false && updated?.name.endsWith("(updated)"), `is_active=${updated?.is_active}`);

  // ---- cleanup ------------------------------------------------------------
  await prisma.triggeredAlert.deleteMany({ where: { alert_id: alertId } });
  await prisma.diagnosticLog.deleteMany({ where: { session_id: alertId } });
  await prisma.userAlert.deleteMany({ where: { alert_id: alertId } });
  const leftover = await prisma.userAlert.count({ where: { alert_id: alertId } });
  check("cleanup left no residue", leftover === 0, `rows=${leftover}`);
} catch (err) {
  check("round-trip", false, err instanceof Error ? err.message : String(err));
} finally {
  await prisma.$disconnect();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? "RESULT: PASS" : "RESULT: FAIL"} — ${results.length - failed.length}/${results.length} checks against ${target} at ${stamp}`
);
process.exit(failed.length === 0 ? 0 : 1);
