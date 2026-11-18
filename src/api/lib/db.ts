/**
 * Server-side database access for the API layer.
 *
 * Driver choice matters here: the fork's database is a local PostgreSQL cluster
 * (`DATABASE_URL` in `.env.local`, loopback only). `@neondatabase/serverless` speaks
 * Neon's HTTP protocol and cannot open a socket to it, so this module uses Prisma
 * Client, which talks the PostgreSQL wire protocol and works against either target.
 *
 * The client is created lazily: importing this module (and `createApiApp()` used by the
 * unit tests) must not require a live database. A missing `DATABASE_URL`, or a database
 * that is down, is reported as `unavailable` by the routes — never as empty data.
 */

import { PrismaClient } from "@prisma/client";
import { redact } from "./chainData";

let client: PrismaClient | null = null;
let clientError: string | null = null;

/** True when the process has a DSN at all (the value itself is never exposed). */
export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.trim().length > 0);
}

/** Lazy singleton. Throws when no DSN is configured. */
export function getPrisma(): PrismaClient {
  if (client) return client;
  if (clientError) throw new Error(clientError);
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not set for the API server");
  }
  try {
    client = new PrismaClient({ log: [] });
    return client;
  } catch (error) {
    clientError = redact(error instanceof Error ? error.message : String(error));
    throw new Error(clientError);
  }
}

export interface DatabaseHealth {
  ok: boolean;
  error?: string;
}

/** `SELECT 1` against the fork database. Error text is redacted before it leaves here. */
export async function checkDatabase(): Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: "DATABASE_URL is not set for the API server" };
  }
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: redact(error instanceof Error ? error.message : String(error)) };
  }
}

/** Test hook: drop the singleton so a new DSN/process state can be picked up. */
export async function closeDatabase(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = null;
}
