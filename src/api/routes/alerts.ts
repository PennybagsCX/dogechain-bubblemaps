/**
 * /api/alerts — the fork's alert sync API, backed by the fork-local PostgreSQL database.
 *
 * Row shapes are the ones `services/db.ts` already sends and expects, so the client does
 * not change:
 *   GET    /api/alerts?wallet=0x…                       → { success, data: AlertApiRow[], count }
 *   POST   /api/alerts                                   → create/update one alert
 *   POST   /api/alerts?action=sync                       → push local alerts, report what was stored
 *   POST   /api/alerts?action=trigger                    → append to triggered_alerts
 *   DELETE /api/alerts?wallet=0x…&alertId=…              → remove one alert
 *
 * Honesty rules applied here:
 *   - An empty table returns `data: []` (a real zero), not fabricated rows.
 *   - A database that is not configured/reachable returns 503 with the explicit
 *     `{ unavailable: true, reason }` shape — never an empty list pretending to be data.
 *   - `downloaded` in the sync result is always 0: this endpoint stores, it does not
 *     invent server-side alerts to merge back.
 */

import { Router, type Request, type Response } from "express";
import { CHAIN_ID } from "../../../lib/chain";
import { redact } from "../lib/chainData";
import { getPrisma, isDatabaseConfigured } from "../lib/db";
import { unavailablePayload } from "../lib/unavailable";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ALERT_TYPES = ["WALLET", "TOKEN", "WHALE"] as const;
type AlertType = (typeof ALERT_TYPES)[number];

/** One row exactly as `services/db.ts` consumes it. */
export interface AlertApiRow {
  alert_id: string;
  name: string;
  wallet_address: string;
  token_address: string | null;
  token_name: string | null;
  token_symbol: string | null;
  initial_value: number | null;
  type: string | null;
  created_at: number;
  is_active: boolean;
}

interface UserAlertRecord {
  alert_id: string;
  name: string;
  wallet_address: string;
  token_address: string | null;
  token_name: string | null;
  token_symbol: string | null;
  initial_value: unknown;
  type: string | null;
  created_at: bigint;
  is_active: boolean | null;
}

function toApiRow(row: UserAlertRecord): AlertApiRow {
  return {
    alert_id: row.alert_id,
    name: row.name,
    wallet_address: row.wallet_address,
    token_address: row.token_address,
    token_name: row.token_name,
    token_symbol: row.token_symbol,
    initial_value:
      row.initial_value === null || row.initial_value === undefined
        ? null
        : Number(row.initial_value),
    type: row.type,
    created_at: Number(row.created_at),
    is_active: Boolean(row.is_active),
  };
}

function queryString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string" && first.trim() !== "") return first.trim();
  }
  return undefined;
}

function bodyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value);
}

function badRequest(res: Response, error: string): void {
  res.status(400).json({ success: false, error });
}

function dbUnavailable(res: Response, detail: string): void {
  res.status(503).json({
    success: false,
    ...unavailablePayload("alert-store", detail),
  });
}

function serverError(res: Response, error: unknown): void {
  const message = redact(error instanceof Error ? error.message : String(error));
  res.status(500).json({ success: false, error: message });
}

interface AlertInput {
  walletAddress: string;
  alertId: string;
  name: string;
  monitoredWallet: string;
  tokenAddress: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  initialValue: number | null;
  type: AlertType;
  createdAt: number;
}

/** Validate one alert payload (shared by POST /alerts and POST /alerts?action=sync). */
function parseAlertInput(raw: Record<string, unknown>): { input?: AlertInput; error?: string } {
  const walletAddress = readString(raw, "walletAddress");
  if (!walletAddress) return { error: "walletAddress is required" };
  if (!ADDRESS_RE.test(walletAddress)) return { error: `Invalid walletAddress: ${walletAddress}` };

  const alertId = readString(raw, "alertId");
  if (!alertId) return { error: "alertId is required" };
  if (alertId.length > 255) return { error: "alertId must be 255 characters or fewer" };

  const name = readString(raw, "name");
  if (!name) return { error: "name is required" };

  // `monitoredWallet` is what the client posts; `walletAddress` inside the alert object is
  // the monitored wallet on older payloads, so accept either and require a valid address.
  const monitoredWallet = readString(raw, "monitoredWallet") ?? readString(raw, "walletAddress");
  if (!monitoredWallet) return { error: "monitoredWallet is required" };
  if (!ADDRESS_RE.test(monitoredWallet))
    return { error: `Invalid monitored wallet: ${monitoredWallet}` };

  const rawType = readString(raw, "type");
  const type = rawType ?? "WALLET";
  if (!isAlertType(type)) {
    return { error: `Invalid alert type: ${type} (expected one of ${ALERT_TYPES.join(", ")})` };
  }

  const tokenAddress = readString(raw, "tokenAddress");
  if (tokenAddress && !ADDRESS_RE.test(tokenAddress)) {
    return { error: `Invalid tokenAddress: ${tokenAddress}` };
  }

  return {
    input: {
      walletAddress,
      alertId,
      name,
      monitoredWallet,
      tokenAddress: tokenAddress ?? null,
      tokenName: readString(raw, "tokenName") ?? null,
      tokenSymbol: readString(raw, "tokenSymbol") ?? null,
      initialValue: readNumber(raw, "initialValue") ?? null,
      type,
      createdAt: readNumber(raw, "createdAt") ?? Date.now(),
    },
  };
}

async function upsertAlert(input: AlertInput): Promise<void> {
  const prisma = getPrisma();
  const shared = {
    name: input.name,
    wallet_address: input.monitoredWallet,
    token_address: input.tokenAddress,
    token_name: input.tokenName,
    token_symbol: input.tokenSymbol,
    initial_value: input.initialValue,
    type: input.type,
    updated_at: new Date(),
    is_active: true,
  };
  await prisma.userAlert.upsert({
    where: {
      user_wallet_address_alert_id: {
        user_wallet_address: input.walletAddress,
        alert_id: input.alertId,
      },
    },
    create: {
      user_wallet_address: input.walletAddress,
      alert_id: input.alertId,
      created_at: BigInt(Math.trunc(input.createdAt)),
      ...shared,
    },
    update: shared,
  });
}

const router = Router();

router.get("/alerts", async (req: Request, res: Response) => {
  const wallet = queryString(req.query.wallet);
  if (!wallet) return badRequest(res, "wallet query parameter is required");
  if (!ADDRESS_RE.test(wallet)) return badRequest(res, `Invalid wallet address: ${wallet}`);
  if (!isDatabaseConfigured()) {
    return dbUnavailable(res, "DATABASE_URL is not set for this API server");
  }

  try {
    const rows = await getPrisma().userAlert.findMany({
      where: { user_wallet_address: wallet, is_active: true },
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, count: rows.length, data: rows.map(toApiRow), chainId: CHAIN_ID });
  } catch (error) {
    serverError(res, error);
  }
});

async function handleTrigger(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const alertId = readString(body, "alertId");
  const alertName = readString(body, "alertName");
  const walletAddress = readString(body, "walletAddress");
  if (!alertId) return badRequest(res, "alertId is required");
  if (!alertName) return badRequest(res, "alertName is required");
  if (!walletAddress || !ADDRESS_RE.test(walletAddress)) {
    return badRequest(res, `Invalid walletAddress: ${walletAddress ?? "(missing)"}`);
  }
  const tokenAddress = readString(body, "tokenAddress");
  if (tokenAddress && !ADDRESS_RE.test(tokenAddress)) {
    return badRequest(res, `Invalid tokenAddress: ${tokenAddress}`);
  }
  if (!isDatabaseConfigured()) {
    return dbUnavailable(res, "DATABASE_URL is not set for this API server");
  }

  try {
    const row = await getPrisma().triggeredAlert.create({
      data: {
        alert_id: alertId.slice(0, 255),
        alert_name: alertName.slice(0, 255),
        wallet_address: walletAddress,
        token_address: tokenAddress ?? null,
        token_symbol: readString(body, "tokenSymbol")?.slice(0, 50) ?? null,
        transaction_count: Math.max(1, Math.trunc(readNumber(body, "transactionCount") ?? 1)),
        session_id: readString(body, "sessionId")?.slice(0, 64) ?? null,
      },
      select: { id: true, triggered_at: true },
    });
    res.json({
      success: true,
      logged: true,
      id: row.id,
      triggeredAt: row.triggered_at,
      chainId: CHAIN_ID,
    });
  } catch (error) {
    serverError(res, error);
  }
}

async function handleSync(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const walletAddress = readString(body, "walletAddress");
  if (!walletAddress || !ADDRESS_RE.test(walletAddress)) {
    return badRequest(res, `Invalid walletAddress: ${walletAddress ?? "(missing)"}`);
  }
  const localAlerts = body.localAlerts;
  if (!Array.isArray(localAlerts)) {
    return badRequest(res, "localAlerts must be an array");
  }
  if (!isDatabaseConfigured()) {
    return dbUnavailable(res, "DATABASE_URL is not set for this API server");
  }

  let uploaded = 0;
  let skipped = 0;
  for (const raw of localAlerts) {
    // Every local alert is stamped with the authenticated wallet; never trust a nested one.
    const candidate = {
      ...bodyObject(raw),
      walletAddress,
      monitoredWallet: bodyObject(raw).walletAddress,
    };
    const { input } = parseAlertInput(candidate);
    if (!input) {
      skipped += 1;
      continue;
    }
    try {
      await upsertAlert(input);
      uploaded += 1;
    } catch {
      skipped += 1;
    }
  }

  res.json({
    success: true,
    uploaded,
    // This endpoint only stores. It does not fabricate server-side rows to merge back.
    downloaded: 0,
    conflicts: skipped,
    syncTimestamp: Date.now(),
    chainId: CHAIN_ID,
  });
}

async function handleSave(req: Request, res: Response): Promise<void> {
  const { input, error } = parseAlertInput(bodyObject(req.body));
  if (!input) return badRequest(res, error ?? "invalid alert payload");
  if (!isDatabaseConfigured()) {
    return dbUnavailable(res, "DATABASE_URL is not set for this API server");
  }

  try {
    await upsertAlert(input);
    res.json({ success: true, saved: true, alertId: input.alertId, chainId: CHAIN_ID });
  } catch (err) {
    serverError(res, err);
  }
}

router.post("/alerts", async (req: Request, res: Response) => {
  const action = queryString(req.query.action);
  if (action === "trigger") return handleTrigger(req, res);
  if (action === "sync") return handleSync(req, res);
  if (action) return badRequest(res, `Unknown action: ${action}`);
  return handleSave(req, res);
});

router.delete("/alerts", async (req: Request, res: Response) => {
  const wallet = queryString(req.query.wallet);
  const alertId = queryString(req.query.alertId);
  if (!wallet) return badRequest(res, "wallet query parameter is required");
  if (!ADDRESS_RE.test(wallet)) return badRequest(res, `Invalid wallet address: ${wallet}`);
  if (!alertId) return badRequest(res, "alertId query parameter is required");
  if (!isDatabaseConfigured()) {
    return dbUnavailable(res, "DATABASE_URL is not set for this API server");
  }

  try {
    const result = await getPrisma().userAlert.deleteMany({
      where: { user_wallet_address: wallet, alert_id: alertId },
    });
    res.json({ success: true, deleted: result.count, chainId: CHAIN_ID });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
