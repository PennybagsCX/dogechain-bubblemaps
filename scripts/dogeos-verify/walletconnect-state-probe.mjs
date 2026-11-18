/**
 * WalletConnect connector STATE probe — works with and without a project id.
 *
 * It answers two questions with live evidence and never touches the network except through the
 * app itself:
 *   1. Does the production build offer the WalletConnect connector? (RainbowKit modal contents)
 *   2. When WalletConnect is chosen, does the app actually reach the WC relay, and what does the
 *      relay say? (relay websocket + console) A project id that WalletConnect Cloud does not know
 *      is rejected with close code 3000 "Project not found"; a valid one opens a session.
 *
 * Usage: node scripts/dogeos-verify/walletconnect-state-probe.mjs <url> [label]
 * Requires a production build served at <url> (vite preview) and Playwright with system Chrome.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5199";
const LABEL = process.argv[3] || "unlabelled";

const out = (o) => console.log(JSON.stringify({ label: LABEL, ...o }));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
await context.addInitScript(() => {
  // first-visit overlays would intercept the clicks this probe needs
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
});
const page = await context.newPage();

const net = [];
page.on("websocket", (ws) => {
  if (/relay\.walletconnect/.test(ws.url())) net.push({ relay: ws.url().split("?")[0] });
});
page.on("console", (m) => {
  const t = m.text();
  if (/relayer|socket error|project not found|3000/i.test(t)) net.push({ console: t.slice(0, 200) });
});
page.on("response", (r) => {
  const u = r.url();
  if (/web3modal\.org|pulse\.walletconnect/.test(u)) net.push({ http: r.status(), url: u.split("?")[0] });
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const connectBtn = page.getByRole("button", { name: /connect wallet/i }).first();
await connectBtn.click();
await page.waitForTimeout(1500);

const dialog = page.locator('[role="dialog"]').first();
const dialogText = await dialog.innerText().catch(() => "");
const offered = (await dialog.getByRole("button").allInnerTexts().catch(() => [])).filter(Boolean);
const walletConnectOffered = /^WalletConnect$/m.test(offered.join("\n"));
out({ step: "connect-modal", walletConnectOffered, offered });

if (walletConnectOffered) {
  await page.getByRole("button", { name: /^WalletConnect$/i }).first().click();
  await page.waitForTimeout(9000);
  out({
    step: "walletconnect-clicked",
    relayReached: net.filter((e) => e.relay).length,
    relayProjectNotFound: net.some((e) => /Project not found|3000/i.test(JSON.stringify(e))),
    detail: net.slice(0, 8),
  });
}

await page.screenshot({ path: `/tmp/walletconnect-state-${LABEL}.png` });
await browser.close();
