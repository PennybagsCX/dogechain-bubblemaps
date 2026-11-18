/**
 * T-09 explorer confirmation — every hash from the deploy + seed run is opened on the public
 * explorer (https://dogeos-testnet.l2scan.co) and screenshotted. Each page must (a) carry that
 * hash, (b) say Success, and (c) display a transaction fee equal to the DOGE the sender really
 * lost (balance delta) — the RPC receipt's gasUsed*effectiveGasPrice is ~455-4600x smaller.
 *
 * Produces docs/verification/t09-explorer-*.png and t09-explorer-assertions.json.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const EXPLORER = "https://dogeos-testnet.l2scan.co";
const OUT = "docs/verification";
const TOKEN = "0x12525A2Ab363005D2Ad7D931B06B804bEbDeBc27";
const HOLDER = "0x4dab72dc6Ac534852bE9fb3C56a128C74cb1A36b";

// [name, hash, label, real DOGE fee measured from balance deltas]
const TXS = [
  ["01-deploy", "0x5a8a5ce80b12ce388a6e3cb8cddc654fffaca13399f71af5830a0fff85efa368", "contract creation", "0.19353024612628087"],
  ["02-mint-deployer", "0x67ebfb3ea0dec99da9764015996357dba3cccd5078b48b05785a2034ed53b00c", "deployer->author 250000", "0.023492392421721144"],
  ["03-deployer-forwarder", "0x336cd35f0ad4882a2ff1fd1ba02308c9649f7e148c97d5ee539ced70ef41f924", "deployer->forwarder 250000", "0.023492392421721144"],
  ["04-deployer-tipper", "0x59c40b884a10ecdc6c615bc2292570b27f36d76fe380bd5ec9a04928c56c4e22", "deployer->tipper 200000", "0.023492380421721144"],
  ["05-author-tipper", "0xb28a6e0b144ea53eb9c255dd932a4b34630d74af1926131f561c4e5cba80da17", "author->tipper 60000", "0.023475292421721144"],
  ["06-tipper-forwarder", "0x8b04e76b4ccdbbacef407be3ab11226875fe48432cb09404d77abdd42d1ef7dc", "tipper->forwarder 40000", "0.023475280421721144"],
  ["07-forwarder-author", "0x87eb7ae765b11785e87cb40c69ed8083fac1ff79c10f6282e7fab4d46406948c", "forwarder->author 25000", "0.024429846453102871"],
  ["08-doge-funding", "0x90bf0426aacb58283924d0a2e59f2ee73f7222b16ad129fbc0671be73d5df8da", "forwarder->deployer 0.08 DOGE", "0.017312731026104367"],
  ["09-fee-probe", "0x3108f58d6e17133a79f50ea7eb997b6b28acf6941816e21dab548b8b7da69749", "deployer->tipper 0.001 DOGE", "0.018142495562886194"],
];

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function open(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000); // blockscout streams details in after load
  return page.locator("body").innerText();
}

const NF = /page not found|transaction not found|we couldn't find|sorry, we can't find/i;
for (const [name, hash, label, realFee] of TXS) {
  const text = await open(`${EXPLORER}/tx/${hash}`);
  const hashOk = text.toLowerCase().includes(hash.toLowerCase().slice(2, 20));
  const success = /success/i.test(text);
  const notFound = NF.test(text);
  // the explorer prints the REAL fee; compare its leading digits with the measured balance delta
  const m = text.match(/Transaction fee\s*\n?\s*([\d.]+)\s*DOGE/i) || text.match(/([\d.]+)\s*DOGE\s*\n?\s*\(?\$?0?\.0?1?\)?/);
  const shown = m ? m[1] : null;
  const feeOk = shown ? Math.abs(Number(shown) - Number(realFee)) / Number(realFee) < 1e-6 : false;
  check(`explorer ${name} (${label})`, hashOk && !notFound && success && feeOk,
    `hash=${hashOk} success=${success} notFound=${notFound} feeShown=${shown} feeMatchesBalanceDelta=${feeOk}`);
  await page.screenshot({ path: `${OUT}/t09-explorer-${name}.png` });
}

const tokenText = await open(`${EXPLORER}/token/${TOKEN}`);
check("explorer token page shows T09 Proof Token / T09P / ERC-20", /T09 Proof Token/.test(tokenText) && /T09P/.test(tokenText) && /ERC-20/.test(tokenText));
check("explorer token page shows 1,000,000 max supply", /1,000,000/.test(tokenText));
check("explorer token page lists 7 total transfers", /7 total/i.test(tokenText), (tokenText.match(/\d+ total/gi) || [])[0]);
// observed quirk kept out of "verified": this page renders Holders 0 while /api/v2 reports 4
const holderCard = (tokenText.match(/Holders\s*\n?\s*(\d+)/i) || [])[1] ?? "n/a";
results.push({ name: "explorer token page holder counter", ok: null, detail: `UI shows ${holderCard} holders while /api/v2/tokens/{addr} reports 4 — UI counter not reconciled` });
await page.screenshot({ path: `${OUT}/t09-explorer-10-token.png` });

const holderText = await open(`${EXPLORER}/address/${HOLDER}`);
check("explorer holder page resolves", holderText.toLowerCase().includes(HOLDER.toLowerCase().slice(2, 12)) && !NF.test(holderText));
await page.screenshot({ path: `${OUT}/t09-explorer-11-holder.png` });

fs.writeFileSync(`${OUT}/t09-explorer-assertions.json`, JSON.stringify({ explorer: EXPLORER, token: TOKEN, results }, null, 2));
const failed = results.filter((r) => r.ok === false);
console.log(`\n${results.filter((r) => r.ok === true).length}/${results.filter((r) => r.ok !== null).length} explorer checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
