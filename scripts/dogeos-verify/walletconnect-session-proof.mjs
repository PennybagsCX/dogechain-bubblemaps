/**
 * WalletConnect SESSION proof for DogeOS Bubblemaps (Chikyū, chain 6281971).
 *
 * Proves, with a real WalletConnect v2 session (not a mock injected provider):
 *   1. the production build offers the WalletConnect connector;
 *   2. choosing it produces a `wc:` pairing URI against the live WC relay;
 *   3. a real WC client (this script's wallet peer, @walletconnect/sign-client) pairs and
 *      approves a session for exactly one chain — eip155:6281971;
 *   4. the app then reports the wallet as connected and the chain badge shows 6281971,
 *      with no chain guard, i.e. `eth_chainId` over the session returned 0x5fdaf3.
 *
 * The wallet peer answers session_request payloads itself (eth_chainId, eth_accounts,
 * personal_sign via a throwaway dev key). Every request/response is recorded.
 *
 * Usage: node scripts/dogeos-verify/walletconnect-session-proof.mjs [baseUrl]
 *   baseUrl defaults to http://localhost:5199 (vite preview of the production build).
 * Requires VITE_WALLETCONNECT_PROJECT_ID in .env.local (never committed) — the same id is
 * used by the wallet peer, which is exactly what a real mobile wallet does with its own id.
 * No install needed: @walletconnect/sign-client, viem and playwright are app dependencies.
 */
import { chromium } from "playwright";
import { SignClient } from "@walletconnect/sign-client";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || process.env.APP_URL || "http://localhost:5199";
const OUT_DIR = "docs/verification";
const EXPECTED_CHAIN_ID = 6281971;
const EXPECTED_CHAIN_HEX = "0x5fdaf3";
const CAIP_CHAIN = `eip155:${EXPECTED_CHAIN_ID}`;

// Throwaway dev key (public, well-known test vector). Holds no funds; only used so the peer can
// produce real personal_sign signatures instead of fake ones.
const DEV_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const account = privateKeyToAccount(DEV_PK);

const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const projectId = (env.match(/^VITE_WALLETCONNECT_PROJECT_ID=(.*)$/m)?.[1] || "").trim();
if (!/^[0-9a-f]{32}$/.test(projectId)) {
  console.error("no valid VITE_WALLETCONNECT_PROJECT_ID in .env.local");
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
};
const redact = (uri) => (typeof uri === "string" ? uri.slice(0, 24) + "…(" + uri.length + " chars)" : uri);

const transcript = {
  baseUrl: BASE,
  expectedChain: CAIP_CHAIN,
  walletPeer: { address: account.address, transport: "walletconnect v2 relay" },
  projectId: { len: projectId.length, prefix: projectId.slice(0, 4) + "…" },
  steps: [],
};

/**
 * Capture the wc: pairing URI.
 *
 * RainbowKit renders the QR as an inline SVG (no readable text), but it also offers the official
 * WalletConnect modal ("Need the official WalletConnect modal? OPEN"). That modal is a web
 * component (`<wui-qr-code>`) whose `uri` attribute IS the pairing URI the connector generated,
 * so we read it there — no DOM guessing, no clipboard patching.
 */
const captureUri = async (page) => {
  const readUri = () =>
    page.evaluate(() => {
      const hits = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          for (const a of el.attributes || []) if (/^wc:/.test(a.value)) hits.push(a.value);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return hits[0] || null;
    });

  for (let i = 0; i < 40; i += 1) {
    const found = await readUri();
    if (found) return found;
    const open = page.getByRole("button", { name: /^OPEN$/i }).first();
    if (await open.isVisible().catch(() => false)) await open.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  return null;
};

const main = async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    const flags = {
      dogechain_onboarding_seen: "true",
      dogechain_onboarding_version: "1.0.0",
      dogechain_bubble_guide_seen: "true",
      dogechain_bubble_guide_version: "2.0.0",
      dogechain_token_panel_guide_seen: "true",
      dogechain_token_panel_guide_version: "2.0.0",
      dogechain_wallet_details_guide_seen: "true",
      dogechain_wallet_details_guide_version: "2.0.0",
    };
    for (const [k, v] of Object.entries(flags)) localStorage.setItem(k, v);
    sessionStorage.setItem("dogechain_onboarding_session_shown", "true");
    // RainbowKit's "Copy to clipboard" gives us the exact pairing URI.
    try {
      const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      navigator.clipboard.writeText = async (t) => {
        if (typeof t === "string" && t.startsWith("wc:")) window.__wcCaptured = t;
        return orig ? orig(t) : undefined;
      };
    } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

  // ---------- 1. app offers WalletConnect ----------
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // ---------- control: nothing connected yet (the readout must be absent) ----------
  const preBadge = await page.locator('[data-testid="chain-badge"]').count();
  check("S0 no chain readout before any wallet is connected", preBadge === 0, `badge count=${preBadge}`);

  await page.getByRole("button", { name: /connect wallet/i }).first().click();
  await page.waitForTimeout(1500);
  const offered = (await page.locator('[role="dialog"]').first().getByRole("button").allInnerTexts().catch(() => [])).filter(Boolean);
  const wcOffered = /^WalletConnect$/m.test(offered.join("\n"));
  check("S1 production build offers WalletConnect", wcOffered, offered);
  transcript.steps.push({ step: "connect-modal", offered });

  // ---------- 2. wc: pairing URI from the live relay ----------
  await page.getByRole("button", { name: /^WalletConnect$/i }).first().click();
  const uri = await captureUri(page);
  check("S2 pairing URI generated against the WC relay", Boolean(uri), redact(uri));
  if (!uri) {
    await page.screenshot({ path: path.join(OUT_DIR, "t09-12-walletconnect-no-uri.png") });
    await browser.close();
    throw new Error("no wc: URI captured — cannot continue");
  }
  const qrShot = path.join(OUT_DIR, "t09-11-walletconnect-pairing-qr.png");
  await page.screenshot({ path: qrShot });
  transcript.steps.push({
    step: "pairing-uri",
    uri: redact(uri),
    relay: "wss://relay.walletconnect.org",
    screenshot: qrShot,
  });

  // ---------- 3. real wallet peer pairs + approves eip155:6281971 ----------
  const requests = [];
  const wallet = await SignClient.init({
    projectId,
    metadata: {
      name: "DogeOS Chikyū WC proof wallet",
      description: "Local WalletConnect wallet peer used to prove the connector end to end",
      url: BASE,
      icons: [],
    },
    logger: "error",
  });

  let approvedNamespaces = null;
  let sessionTopic = null;

  wallet.on("session_proposal", async (proposal) => {
    const req = proposal.params.requiredNamespaces || {};
    const opt = proposal.params.optionalNamespaces || {};
    const namespaces = {};
    for (const [key, ns] of Object.entries(req)) {
      namespaces[key] = {
        accounts: (ns.chains || []).map((c) => `${c}:${account.address}`),
        methods: ns.methods || [],
        events: ns.events || [],
      };
    }
    for (const [key, ns] of Object.entries(opt)) {
      if (namespaces[key]) continue;
      namespaces[key] = {
        accounts: (ns.chains || []).slice(0, 1).map((c) => `${c}:${account.address}`),
        methods: ns.methods || [],
        events: ns.events || [],
      };
    }
    const { acknowledged, topic } = await wallet.approve({ id: proposal.id, namespaces });
    await acknowledged();
    approvedNamespaces = namespaces;
    sessionTopic = topic;
  });

  wallet.on("session_request", async (event) => {
    const { topic, params, id } = event;
    const { method, params: reqParams } = params.request || {};
    let result;
    try {
      switch (method) {
        case "eth_chainId":
          result = EXPECTED_CHAIN_HEX;
          break;
        case "eth_accounts":
        case "eth_requestAccounts":
          result = [account.address];
          break;
        case "personal_sign":
          result = await account.signMessage({ message: { raw: reqParams?.[0] } });
          break;
        case "eth_sign":
          result = await account.signMessage({ message: { raw: reqParams?.[1] } });
          break;
        case "wallet_switchEthereumChain":
          if ((reqParams?.[0]?.chainId ?? "").toLowerCase() !== EXPECTED_CHAIN_HEX) {
            result = null;
          } else result = null;
          break;
        case "wallet_addEthereumChain":
          result = null;
          break;
        case "eth_blockNumber":
          result = "0x1";
          break;
        case "eth_getBalance":
          result = "0x0";
          break;
        default:
          result = null;
      }
      requests.push({ method, params: reqParams, result: typeof result === "string" ? result.slice(0, 80) : result });
      await wallet.respond({ topic, response: { id, jsonrpc: "2.0", result } });
    } catch (e) {
      requests.push({ method, error: String(e?.message || e).slice(0, 200) });
      await wallet.respond({
        topic,
        response: { id, jsonrpc: "2.0", error: { code: -32603, message: String(e?.message || e) } },
      });
    }
  });

  await wallet.pair({ uri });
  const settled = await (async () => {
    for (let i = 0; i < 120 && !sessionTopic; i += 1) await new Promise((r) => setTimeout(r, 250));
    return sessionTopic;
  })();
  check("S3 WC session settled over the relay", Boolean(settled), settled ? settled.slice(0, 12) + "…" : null);
  const chainInSession = approvedNamespaces?.eip155?.accounts ?? [];
  check(
    "S3 session namespace is exactly eip155:6281971",
    chainInSession.length === 1 && chainInSession[0] === `${CAIP_CHAIN}:${account.address}`,
    chainInSession
  );
  transcript.steps.push({
    step: "session-approved",
    topic: settled ? settled.slice(0, 12) + "…" : null,
    namespaces: approvedNamespaces,
  });

  // ---------- 4. app shows the connected wallet on chain 6281971 ----------
  // close the official WalletConnect modal so the screenshot is the app, not the QR
  for (let i = 0; i < 6; i += 1) {
    const close = page.getByRole("button", { name: /^(close|back)$/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if (!(await page.getByRole("dialog").first().isVisible().catch(() => false))) break;
  }

  const badge = page.locator('[data-testid="chain-badge"]');
  let badgeText = "";
  for (let i = 0; i < 60; i += 1) {
    if ((await badge.count()) > 0) {
      badgeText = (await badge.innerText()).replace(/\s+/g, " ");
      if (badgeText.includes(String(EXPECTED_CHAIN_ID))) break;
    }
    await page.waitForTimeout(500);
  }
  const guardCount = await page.locator('[data-testid="chain-guard"]').count();
  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const shortAddr = account.address.slice(2, 6).toLowerCase();
  const addressVisible = new RegExp(shortAddr, "i").test(bodyText);
  const chainIdRequest = requests.find((r) => r.method === "eth_chainId");
  const walletChainHex = (await badge.getAttribute("data-wallet-chain-id").catch(() => null)) ?? "";
  const injectedPresent = await page.evaluate(() => typeof window.ethereum !== "undefined");

  check("S4 app renders the chain badge with 6281971", badgeText.includes(String(EXPECTED_CHAIN_ID)), badgeText);
  check("S4 no wrong-chain guard (session chain == app chain)", guardCount === 0, `guard=${guardCount}`);
  check("S4 connected wallet address visible", addressVisible, shortAddr);
  check(
    "S4 no injected provider in this browser (chain can only come from the WC connector)",
    injectedPresent === false,
    `window.ethereum=${injectedPresent}`
  );
  check(
    "S4 eth_chainId read through the WC connector provider == 0x5fdaf3",
    walletChainHex.toLowerCase() === EXPECTED_CHAIN_HEX,
    walletChainHex || "(attribute empty)"
  );

  const heroShot = path.join(OUT_DIR, "t09-12-walletconnect-session-chain-6281971.png");
  await page.screenshot({ path: heroShot });

  // account modal (network name + address as the app surfaces them)
  let modalShot = null;
  try {
    const accountButton = page
      .locator("nav button")
      .filter({ hasText: new RegExp(`0x${shortAddr.slice(0, 2)}`, "i") })
      .last();
    await accountButton.click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    modalShot = path.join(OUT_DIR, "t09-13-walletconnect-account-modal.png");
    await page.screenshot({ path: modalShot });
  } catch (e) {
    console.log(`  [modal] ${e.message.slice(0, 120)}`);
  }

  transcript.steps.push({
    step: "connected-ui",
    badgeText,
    guardCount,
    addressVisible,
    requests,
    screenshots: [heroShot, modalShot].filter(Boolean),
  });
  transcript.assertions = results;
  transcript.failed = results.filter((r) => !r.ok).length;

  await browser.close();
  try {
    await wallet.core.relayer.transportClose?.();
  } catch {}

  fs.writeFileSync(path.join(OUT_DIR, "walletconnect-session-proof.json"), JSON.stringify(transcript, null, 2));
  const lines = [
    "# WalletConnect session proof — DogeOS Bubblemaps on Chikyū (6281971)",
    `# run: ${new Date().toISOString()}`,
    `# app: ${BASE}  (vite preview of the production build)`,
    `# wallet peer: local WalletConnect v2 client (@walletconnect/sign-client), address ${account.address}`,
    `# project id: ${projectId.length} chars, prefix ${projectId.slice(0, 4)}… (from gitignored .env.local)`,
    "",
    ...results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${JSON.stringify(r.detail)}`),
    "",
    "session namespaces:",
    ...Object.entries(approvedNamespaces || {}).map(([k, v]) => `  ${k}: chains=${JSON.stringify(v.accounts)}`),
    "",
    "session_request payloads handled by the wallet peer:",
    ...requests.map((r) => `  ${r.method} -> ${JSON.stringify(r.result)}`),
    "",
    `${results.length - transcript.failed}/${results.length} checks passed`,
  ];
  fs.writeFileSync(path.join(OUT_DIR, "t09-walletconnect-session.txt"), lines.join("\n") + "\n");
  console.log(`\n${results.length - transcript.failed}/${results.length} checks passed`);

  // keep the pairing URI's symKey out of every artifact
  process.exit(transcript.failed === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("PROOF RUN THREW:", error?.message || error);
  process.exit(2);
});
