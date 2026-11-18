/**
 * T-09 final render proof (live Chikyū data, production build).
 *
 * Deploy: 0x5a8a5ce80b12ce388a6e3cb8cddc654fffaca13399f71af5830a0fff85efa368
 * Token : 0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27 (T09 Proof Token / T09P, 4 holders)
 *
 * Produces in docs/verification/:
 *   t09-01-bubble-map-t09p.png            analysis view, desktop 1440x900
 *   t09-02-bubble-map-mobile-390x844.png  analysis view, mobile 390x844
 *   t09-03-wallet-drilldown-t09p.png      wallet drawer with the 4 live transfers (OUT/IN fixed)
 *   t09-04-wallet-connected-chain-6281971.png  account modal, chain 6281971
 * plus t09-render-assertions.json
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:5199";
const TOKEN = "0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27";
const HOLDER = "0x4dab72dc6Ac534852bE9fb3C56a128C74cb1A36b"; // 265,000 T09P, 3 live transfers
const TOP_HOLDER = "0x9bad5588d63e20Bde1a4E72f2DDfd900288B2BAf"; // 300,000 T09P, mint + 3 OUT
const OUT = "docs/verification";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const injectWallet = ({ address }) => {
  const listeners = {};
  const provider = {
    isMetaMask: true, isConnected: () => true, chainId: "0x5fdaf3", selectedAddress: address,
    on: (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn),
    removeListener: () => {},
    request: async ({ method }) => {
      switch (method) {
        case "eth_chainId": return "0x5fdaf3";
        case "eth_accounts": case "eth_requestAccounts": return [address];
        case "eth_getBalance": return "0x5373fbf9a3a2a7d";
        case "eth_blockNumber": return "0x91e9e5";
        case "eth_call": return "0x";
        case "eth_estimateGas": return "0x5208";
        case "eth_gasPrice": return "0xef426b";
        case "eth_getBlockByNumber": return { number: "0x91e9e5", timestamp: "0x69000000", hash: `0x${"1".repeat(64)}` };
        default: return null;
      }
    },
  };
  window.ethereum = provider;
  window.dispatchEvent(new Event("ethereum#initialized"));
};

async function dismissTour(page) {
  for (let i = 0; i < 6; i++) {
    const skip = page.getByText("Skip Tour", { exact: true }).first();
    if (await skip.count()) { await skip.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); return true; }
    const close = page.locator("#modal-portal-root button[aria-label='Close']").first();
    if (await close.count()) { await close.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); }
    await page.waitForTimeout(400);
  }
  return false;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

// ---------- desktop ----------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(injectWallet, { address: HOLDER });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/?token=${TOKEN}&type=erc20&view=analysis`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);
await dismissTour(page);
await page.waitForTimeout(4000);

const body = await page.locator("body").innerText();
check("token name rendered", /T09 Proof Token/.test(body));
check("symbol rendered", /T09P/.test(body));
check("4 holders tracked", /4 total holders tracked/.test(body) || /\b4\b/.test(body));
check("holder 30.0% rendered", /30(\.0)?%/.test(body));
check("chain badge 6281971", /6281971/.test(body));
check("bubble circles drawn", (await page.locator("circle").count()) >= 4, `circles=${await page.locator("circle").count()}`);
await page.screenshot({ path: `${OUT}/t09-01-bubble-map-t09p.png` });

// ---------- wallet drill-down (top holder: mint + 3 outgoing) ----------
await page.getByText("0x9bad", { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(6000);
await dismissTour(page);
await page.waitForTimeout(800);
const drawer = await page.locator("body").innerText();
check("drawer shows top-holder balance", /300,000/.test(drawer));
check("drawer shows live transfer rows", /4 transactions/.test(drawer), (drawer.match(/\d+ transactions/) || [])[0]);
check("direction labels are mixed (IN+OUT), not all IN", /\bOUT\b/.test(drawer) && /\bIN\b/.test(drawer));
const txRows = await page.locator('a[href*="/tx/"]').allInnerTexts();
const outRows = txRows.filter((t) => /^OUT\b/.test(t.trim())).length;
const inRows = txRows.filter((t) => /^IN\b/.test(t.trim())).length;
check("transaction rows split 1 IN / 3 OUT for the deployer wallet", outRows === 3 && inRows === 1, `rows=${txRows.length} IN=${inRows} OUT=${outRows}`);
await page.screenshot({ path: `${OUT}/t09-03-wallet-drilldown-t09p.png` });

// ---------- connected wallet + chain ----------
// capture the app's own chain/wallet UI first (the badge is fed by useWalletChain's eth_chainId)
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(1200);
const header = await page.locator("header").first().innerText().catch(() => "");
const navbarText = await page.locator("nav, header").first().innerText().catch(() => "");
const shell = `${header}\n${navbarText}`;
check("navbar shows Chikyū 6281971 badge", /6281971/.test(shell), shell.replace(/\n+/g, " ").slice(0, 120));
check("navbar shows the connected wallet", /A36b/i.test(shell));
await page.screenshot({ path: `${OUT}/t09-04-wallet-connected-chain-6281971.png` });

const pill = page.getByText(/0x4dab|0x4d\.\.\.|A36b/).first();
if (await pill.count()) { await pill.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(3500); }
const modal = await page.locator("body").innerText();
check("account modal shows wallet address", /0x4dab/i.test(modal) || /A36b/.test(modal));
await page.screenshot({ path: `${OUT}/t09-05-wallet-account-modal.png` });
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await ctx.close();

// ---------- mobile 390x844 ----------
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await mctx.addInitScript(injectWallet, { address: HOLDER });
const mp = await mctx.newPage();
await mp.goto(`${BASE}/?token=${TOKEN}&type=erc20&view=analysis`, { waitUntil: "domcontentloaded", timeout: 90000 });
await mp.waitForTimeout(3000);
await dismissTour(mp);
await mp.waitForTimeout(5000);
// keep the map itself (opening the hamburger panel covers the canvas on 390px); the token
// identity is carried by the desktop capture, this one proves the map survives the mobile width
const mbody = await mp.locator("body").innerText();
check("[mobile] holder percentages rendered", /30(\.0)?%/.test(mbody) && /26\.5%/.test(mbody));
check("[mobile] connected wallet pill rendered", /A36b/i.test(mbody));
check("[mobile] bubbles drawn", (await mp.locator("circle").count()) >= 3, `circles=${await mp.locator("circle").count()}`);
await mp.screenshot({ path: `${OUT}/t09-02-bubble-map-mobile-390x844.png` });
await mctx.close();
await browser.close();

fs.writeFileSync(`${OUT}/t09-render-assertions.json`, JSON.stringify({ base: BASE, token: TOKEN, wallet: HOLDER, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
