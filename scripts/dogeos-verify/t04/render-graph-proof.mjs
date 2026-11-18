/**
 * T-04 render proof: the bubbles are drawn from the LOG-DERIVED graph, not the holder API.
 *
 * Token : T09P 0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27 on Chikyū (deploy 9,562,825)
 * Run   : `npm run build && npx vite preview --port 5199`
 *         node scripts/dogeos-verify/t04/render-graph-proof.mjs http://localhost:5199
 *
 * Produces in docs/verification/:
 *   t04-01-graph-from-logs-t09p.png        desktop 1440x900, analysis view, log-sourced map
 *   t04-02-graph-from-logs-mobile-390x844.png  same at 390x844
 *   t04-03-fallback-holder-list.png        labelled fallback for a range with no Transfer logs
 *   t04-render-assertions.json             every check below, machine-readable
 *
 * Proof shape (each claim is an assertion, not narration):
 *   A. The app names its source: the "Graph source" card and the pill both read "Transfer logs".
 *   B. The number of logs in that card equals an INDEPENDENT eth_getLogs count this script
 *      makes against the chain (no app code involved).
 *   C. No request to blockscout's `/tokens/<addr>/holders` is made while the map renders.
 *   D. With that endpoint blocked at the network layer the map still renders — so the pixels
 *      cannot have come from the holder API.
 *   E. A token/range whose logs are empty renders the labelled fallback with the empty reason.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:5199";
const RPC = "https://rpc.testnet.dogeos.com/";
const TOKEN = "0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27"; // T09P, 4 holders / 7 Transfer logs
const TOKEN_ANCHOR = 9562825n;
const EMPTY_TOKEN = "0xe5e3a4fF1773d043a387b16Ceb3c91cC49bAFD54"; // LINK: no Transfer logs in range
const WALLET = "0x4dab72dc6Ac534852bE9fb3C56a128C74cb1A36b";
const OUT = "docs/verification";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail: detail ?? null });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- independent chain read (no app code): count Transfer logs in the window ----------
const rpc = async (method, params) => {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
};

const head = BigInt(await rpc("eth_blockNumber", []));
const toBlock = head;
// Chikyū rejects eth_getLogs ranges wider than 10k blocks, so walk it in ≤9,000-block chunks.
let chainLogs = 0;
let chunks = 0;
for (let cursor = toBlock; cursor >= TOKEN_ANCHOR; ) {
  const start = cursor - 9000n + 1n > TOKEN_ANCHOR ? cursor - 9000n + 1n : TOKEN_ANCHOR;
  const logs = await rpc("eth_getLogs", [
    { address: TOKEN, fromBlock: "0x" + start.toString(16), toBlock: "0x" + cursor.toString(16), topics: [TRANSFER_TOPIC] },
  ]);
  chainLogs += logs.length;
  chunks += 1;
  if (start === TOKEN_ANCHOR) break;
  cursor = start - 1n;
}
console.log(`chain: ${chainLogs} Transfer logs in ${chunks} chunk(s), blocks ${TOKEN_ANCHOR}-${toBlock}`);
check("independent eth_getLogs count is 7", chainLogs === 7, `logs=${chainLogs} chunks=${chunks}`);

// ---------- wallet injection (same shape the T-09 proof used) ----------
const injectWallet = ({ address }) => {
  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    chainId: "0x5fdaf3",
    selectedAddress: address,
    on: () => {},
    removeListener: () => {},
    request: async ({ method }) => {
      switch (method) {
        case "eth_chainId":
          return "0x5fdaf3";
        case "eth_accounts":
        case "eth_requestAccounts":
          return [address];
        case "eth_getBalance":
          return "0x5373fbf9a3a2a7d";
        case "eth_blockNumber":
          return "0x" + head.toString(16);
        case "eth_call":
          return "0x";
        case "eth_estimateGas":
          return "0x5208";
        case "eth_gasPrice":
          return "0xef426b";
        case "eth_getBlockByNumber":
          return { number: "0x" + head.toString(16), timestamp: "0x69000000", hash: `0x${"1".repeat(64)}` };
        default:
          return null;
      }
    },
  };
  window.ethereum = provider;
  window.dispatchEvent(new Event("ethereum#initialized"));
};

async function dismissTour(page) {
  for (let i = 0; i < 6; i++) {
    const skip = page.getByText("Skip Tour", { exact: true }).first();
    if (await skip.count()) {
      await skip.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      return true;
    }
    const close = page.locator("#modal-portal-root button[aria-label='Close']").first();
    if (await close.count()) {
      await close.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(300);
  }
  return false;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const analysisUrl = (token) => `${BASE}/?token=${token}&type=erc20&view=analysis`;

// =====================================================================================
// A–C. desktop: source card, independent log count, no holder-API request
// =====================================================================================
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: "block", // never let a precached bundle answer for the build under test
});
await ctx.addInitScript(injectWallet, { address: WALLET });
const page = await ctx.newPage();
const requested = [];
const errors = [];
page.on("request", (r) => requested.push(r.url()));
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

await page.goto(analysisUrl(TOKEN), { waitUntil: "domcontentloaded", timeout: 120000 });
await dismissTour(page);
await page
  .locator('[data-testid="graph-source-pill"]')
  .waitFor({ state: "visible", timeout: 180000 })
  .catch(() => {});
await page.waitForTimeout(2500);
await dismissTour(page);

const pill = await page.locator('[data-testid="source-pill"]').innerText().catch(() => "");
const sourcePill = await page.locator('[data-testid="graph-source-pill"]').innerText().catch(() => "");
const sourceDetail = await page.locator('[data-testid="graph-source-detail"]').innerText().catch(() => "");
const emptyReasonCount = await page.locator('[data-testid="graph-empty-reason"]').count();
const circles = await page.locator("circle").count();

check("app names its source as Transfer logs", /Transfer logs/.test(sourcePill), sourcePill);
check("source pill in the map controls says Transfer logs", /Transfer logs/.test(pill), pill.replace(/\n/g, " "));
const uiLogs = Number((sourceDetail.match(/(\d+)\s+Transfer log/) || [])[1]);
check("source line states the log count and block range", Boolean(uiLogs) && /blocks [\d,]+–[\d,]+/.test(sourceDetail), sourceDetail);
check("UI log count equals the independent eth_getLogs count", uiLogs === chainLogs, `ui=${uiLogs} chain=${chainLogs}`);
check("log graph renders no empty-state reason", emptyReasonCount === 0, `reasons=${emptyReasonCount}`);
check("bubbles drawn from the log graph", circles >= 4, `circles=${circles}`);
check(
  "no blockscout holder-list request while rendering",
  requested.filter((u) => /\/tokens\/[^/]+\/holders/i.test(u)).length === 0,
  `holderCalls=${requested.filter((u) => /\/tokens\/[^/]+\/holders/i.test(u)).length}`
);
await page.screenshot({ path: `${OUT}/t04-01-graph-from-logs-t09p.png` });
await ctx.close();

// =====================================================================================
// D. the strongest form: block the holder endpoint and the map must still appear
// =====================================================================================
const bctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  serviceWorkers: "block",
});
await bctx.addInitScript(injectWallet, { address: WALLET });
const blocked = [];
const bp = await bctx.newPage();
await bp.route("**/*", (route) => {
  const url = route.request().url();
  if (/\/tokens\/[^/]+\/holders/i.test(url)) {
    blocked.push(url);
    return route.abort();
  }
  return route.continue();
});
await bp.goto(analysisUrl(TOKEN), { waitUntil: "domcontentloaded", timeout: 120000 });
await dismissTour(bp);
await bp
  .locator('[data-testid="graph-source-pill"]')
  .waitFor({ state: "visible", timeout: 180000 })
  .catch(() => {});
await bp.waitForTimeout(2500);
const bPill = await bp.locator("[data-testid='graph-source-pill']").innerText().catch(() => "");
const bCircles = await bp.locator("circle").count();
check("with the holder API blocked the map still renders", bCircles >= 4, `circles=${bCircles}`);
check("with the holder API blocked the source is still Transfer logs", /Transfer logs/.test(bPill), bPill);
await bp.screenshot({ path: `${OUT}/t04-04-holder-api-blocked.png` });
await bctx.close();

// =====================================================================================
// E. labelled fallback when the log scan finds nothing (LINK: no Transfer logs in range)
// =====================================================================================
const fctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: "block",
});
await fctx.addInitScript(injectWallet, { address: WALLET });
const fp = await fctx.newPage();
await fp.goto(analysisUrl(EMPTY_TOKEN), { waitUntil: "domcontentloaded", timeout: 120000 });
await dismissTour(fp);
await fp
  .locator('[data-testid="graph-source-pill"]')
  .waitFor({ state: "visible", timeout: 180000 })
  .catch(() => {});
await fp.waitForTimeout(2500);
await dismissTour(fp);
const fPill = await fp.locator("[data-testid='graph-source-pill']").innerText().catch(() => "");
const fReason = await fp.locator("[data-testid='graph-empty-reason']").innerText().catch(() => "");
const fBody = await fp.locator("body").innerText();
check(
  "empty log scan is labelled as a fallback (or as no data)",
  /fallback/i.test(fPill) || /No data/.test(fPill),
  fPill
);
check("fallback states why the log scan was empty", /no Transfer logs/i.test(fReason || fBody), (fReason || "").slice(0, 160));
await fp.screenshot({ path: `${OUT}/t04-03-fallback-holder-list.png` });
await fctx.close();

// =====================================================================================
// mobile 390x844 — the provenance line has to survive the narrow width
// =====================================================================================
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block",
});
await mctx.addInitScript(injectWallet, { address: WALLET });
const mp = await mctx.newPage();
await mp.goto(analysisUrl(TOKEN), { waitUntil: "domcontentloaded", timeout: 120000 });
await dismissTour(mp);
await mp
  .locator('[data-testid="graph-source-pill"]')
  .waitFor({ state: "visible", timeout: 180000 })
  .catch(() => {});
await mp.waitForTimeout(2500);
const mPill = await mp.locator("[data-testid='source-pill']").innerText().catch(() => "");
const mCircles = await mp.locator("circle").count();
check("[mobile] source pill says Transfer logs", /Transfer logs/.test(mPill), mPill.replace(/\n/g, " "));
check("[mobile] bubbles drawn", mCircles >= 3, `circles=${mCircles}`);
await mp.screenshot({ path: `${OUT}/t04-02-graph-from-logs-mobile-390x844.png` });
await mctx.close();

check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();

fs.writeFileSync(
  `${OUT}/t04-render-assertions.json`,
  JSON.stringify(
    {
      base: BASE,
      token: TOKEN,
      chainLogs,
      chainChunks: chunks,
      headBlock: head.toString(),
      blockedHolderRequests: blocked,
      holderRequestsSeen: requested.filter((u) => /\/tokens\/[^/]+\/holders/i.test(u)),
      results,
    },
    null,
    2
  )
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
