/**
 * WalletConnect relay acceptance check for the configured project id.
 *
 * Answers one question with live evidence: does the WC relay accept the project id in
 * .env.local? An id WalletConnect Cloud does not know is refused by the relay ("Project not
 * found", close code 3000); a registered one opens the socket. Nothing identifying is printed
 * (length + first 4 chars only).
 *
 * Usage: node scripts/dogeos-verify/walletconnect-relay-id-check.mjs
 * No install needed: @walletconnect/sign-client is already a dependency of the app.
 */
import fs from "node:fs";
import { SignClient } from "@walletconnect/sign-client";

const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const projectId = (env.match(/^VITE_WALLETCONNECT_PROJECT_ID=(.*)$/m)?.[1] || "").trim();
const out = (o) => console.log(JSON.stringify(o));

if (!/^[0-9a-f]{32}$/.test(projectId)) {
  out({ ok: false, reason: "no-valid-id-in-env-local", idLen: projectId.length });
  process.exit(2);
}

const relayMessages = [];
const client = await SignClient.init({
  projectId,
  metadata: {
    name: "DogeOS relay id check",
    description: "Verifies the configured WalletConnect project id against the live relay",
    url: "http://localhost:5199",
    icons: [],
  },
  logger: "error",
});

client.core.relayer.on("relayer_error", (e) =>
  relayMessages.push(String(e?.message || e).slice(0, 240))
);
client.core.relayer.on("relayer_disconnect", (e) =>
  relayMessages.push("disconnect " + JSON.stringify(e).slice(0, 200))
);

const started = Date.now();
let error = null;
try {
  await client.core.relayer.connect();
} catch (e) {
  error = String(e?.message || e).slice(0, 300);
}
await new Promise((r) => setTimeout(r, 3000));

const connected = client.core.relayer.connected === true;
out({
  ok: connected,
  idLen: projectId.length,
  idPrefix: projectId.slice(0, 4) + "…",
  relayUrl: "wss://relay.walletconnect.org",
  connected,
  ms: Date.now() - started,
  error,
  relayMessages,
});

try {
  await client.core.relayer.transportClose?.();
} catch {}
process.exit(connected ? 0 : 1);
