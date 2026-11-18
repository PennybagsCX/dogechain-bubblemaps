/**
 * Wallet-flow + chain-guard proof for DogeOS Bubblemaps (Chikyū, chain 6281971).
 *
 * Runs the PRODUCTION build in Chromium with an injected EIP-1193 wallet and proves:
 *   1. on chain 6281971 — the connected address and chain id 6281971 are visible;
 *   2. on chain 1 (Ethereum) — the chain guard replaces all app data;
 *   3. the guard's "Add network to wallet" adds Chikyū from lib/chain.ts values, switches,
 *      and the app data comes back;
 *   4. a rejected switch keeps the guard up and shows the wallet's error.
 *
 * Usage: node scripts/dogeos-verify/wallet-guard-proof.mjs [baseUrl]
 *   baseUrl defaults to http://localhost:5199 (vite preview of the production build).
 * Screenshots + assertions land in docs/verification/.
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || process.env.APP_URL || "http://localhost:5199";
const OUT_DIR = "docs/verification";
const EXPECTED_CHAIN_ID = 6281971;
const EXPECTED_CHAIN_HEX = "0x5fdaf3";
const FAKE_ADDRESS = "0x36397E1C1B136C3FA28C5E440Cc0e074Ababf0b9";

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Install a minimal EIP-1193 wallet before any app script runs. */
const injectWallet = (cfg) => {
  const listeners = {};
  let chainId = cfg.chainId;
  const known = new Set(cfg.knownChains);
  const emit = (event, payload) => (listeners[event] || []).forEach((fn) => fn(payload));
  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    chainId,
    selectedAddress: cfg.address,
    on: (event, fn) => {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    removeListener: (event, fn) => {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
    },
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_chainId":
          return chainId;
        case "net_version":
          return String(parseInt(chainId, 16));
        case "eth_accounts":
        case "eth_requestAccounts":
          return [cfg.address];
        case "eth_getBalance":
          return "0x1bc16d674ec80000";
        case "eth_blockNumber":
          return "0x91e0a3";
        case "eth_blockNumber".toUpperCase():
          return "0x91e0a3";
        case "eth_call":
          return "0x";
        case "eth_estimateGas":
          return "0x5208";
        case "eth_gasPrice":
          return "0x5f5e100";
        case "eth_getBlockByNumber":
          return { number: "0x91e0a3", timestamp: "0x69000000", hash: `0x${"1".repeat(64)}` };
        case "eth_getCode":
          return "0x";
        case "personal_sign":
        case "eth_sign":
          return `0x${"0".repeat(130)}`;
        case "wallet_switchEthereumChain": {
          if (cfg.rejectSwitch) {
            const error = new Error("User rejected the request.");
            error.code = 4001;
            throw error;
          }
          const target = params?.[0]?.chainId;
          if (!target) throw new Error("wallet_switchEthereumChain requires a chainId");
          if (cfg.throw4902 && !known.has(target)) {
            // Exactly what MetaMask returns for a chain it has never seen.
            const error = new Error("Unrecognized chain ID. Try adding the chain first.");
            error.code = 4902;
            throw error;
          }
          chainId = target;
          provider.chainId = target;
          emit("chainChanged", target);
          return null;
        }
        case "wallet_addEthereumChain": {
          const params0 = params?.[0] ?? {};
          cfg.addCalls.push(params0);
          if (cfg.rejectAdd) {
            const error = new Error("User rejected the request.");
            error.code = 4001;
            throw error;
          }
          known.add(params0.chainId);
          chainId = params0.chainId;
          provider.chainId = params0.chainId;
          emit("chainChanged", params0.chainId);
          return null;
        }
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          throw Object.assign(new Error(`unsupported method ${method}`), { code: -32601 });
      }
    },
  };
  window.ethereum = provider;
  window.__walletMock = { addCalls: cfg.addCalls, getChainId: () => provider.chainId };
};

const newWalletContext = async (browser, cfg) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  if (cfg) await context.addInitScript(injectWallet, cfg);
  // Suppress the first-visit onboarding modal + in-app guides: they are not part of this proof
  // and their overlay would intercept clicks meant for the guard.
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
    for (const [key, value] of Object.entries(flags)) localStorage.setItem(key, value);
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  return { context, page };
};

/**
 * Wait until wagmi sees the injected wallet. wagmi reconnects to an injected provider that
 * already exposes accounts, so usually no click is needed; if the app still shows the connect
 * button, drive the RainbowKit modal.
 */
const connectInjected = async (page) => {
  const badge = page.locator('[data-testid="chain-badge"]');
  const guard = page.locator('[data-testid="chain-guard"]');
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if ((await badge.count()) > 0 || (await guard.count()) > 0) return;
    const connectButton = page.getByRole("button", { name: /connect wallet|^connect$|real wallet/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();
      await page.waitForTimeout(800);
      const option = page.getByText(/browser wallet|metamask|injected/i).first();
      if (await option.isVisible().catch(() => false)) await option.click();
    }
    await page.waitForTimeout(500);
  }
  throw new Error("wallet never connected (no chain badge and no guard)");
};

/**
 * Close any first-visit overlay (onboarding tour / in-app guides). They are unrelated to the
 * chain guard and would sit on top of the button we need to click.
 */
const dismissOverlays = async (page) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const text = (await page.locator("#modal-portal-root").innerText().catch(() => "")).trim();
    if (text.length === 0) return;
    const skip = page.getByRole("button", { name: /skip tour|close onboarding|^close$|got it/i }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(400);
  }
};

const main = async () => {
  // Playwright's bundled browser revision can lag the cache on this machine, so use the system
  // Chrome (also closer to what a real user runs). Override with PW_CHANNEL=chromium.
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome" });
  const probe = { baseUrl: BASE, expectedChainId: EXPECTED_CHAIN_ID, scenarios: [] };

  // ---------- Scenario 0: no wallet at all -> no guard, connect button offered ----------
  {
    const { context, page } = await newWalletContext(browser, null);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    const guardCount = await page.locator('[data-testid="chain-guard"]').count();
    const connectVisible = await page
      .getByRole("button", { name: /connect wallet|^connect$|real wallet/i })
      .first()
      .isVisible()
      .catch(() => false);
    check("S0 no guard while no wallet is connected", guardCount === 0, `guard count=${guardCount}`);
    check("S0 connect action still offered", connectVisible, `visible=${connectVisible}`);
    probe.scenarios.push({ scenario: "no-wallet", guardCount, connectVisible });
    await context.close();
  }

  // ---------- Scenario 1: wallet already on Chikyū ----------
  {
    const addCalls = [];
    const { context, page } = await newWalletContext(browser, {
      chainId: EXPECTED_CHAIN_HEX,
      address: FAKE_ADDRESS,
      knownChains: [EXPECTED_CHAIN_HEX],
      addCalls,
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await connectInjected(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1200);

    const guardCount = await page.locator('[data-testid="chain-guard"]').count();
    const badge = page.locator('[data-testid="chain-badge"]');
    const badgeText = (await badge.count()) ? (await badge.innerText()).replace(/\s+/g, " ") : "";
    const navText = (await page.locator("header, nav").first().innerText()).replace(/\s+/g, " ");
    const walletChain = await page.evaluate(() => window.__walletMock?.getChainId());
    const addressVisible = /0x[0-9a-fA-F]{2,}/.test(navText);

    check("S1 no guard when wallet is on 0x5fdaf3", guardCount === 0, `guard count=${guardCount}`);
    check(
      "S1 chain badge shows 6281971",
      badgeText.includes(String(EXPECTED_CHAIN_ID)),
      `badge="${badgeText}"`
    );
    check("S1 connected address visible", addressVisible, `nav="${navText.slice(0, 120)}"`);
    check("S1 wallet chain id is 0x5fdaf3", walletChain === EXPECTED_CHAIN_HEX, String(walletChain));

    await page.screenshot({ path: path.join(OUT_DIR, "05-wallet-connected-chain-6281971.png"), fullPage: false });
    probe.scenarios.push({ scenario: "connected-on-chikyu", guardCount, badgeText, walletChain, addressVisible });
    await context.close();
  }

  // ---------- Scenario 2: wallet on Ethereum, switch succeeds ----------
  {
    const addCalls = [];
    const { context, page } = await newWalletContext(browser, {
      chainId: "0x1",
      address: FAKE_ADDRESS,
      knownChains: ["0x1"],
      addCalls,
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await connectInjected(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    const guard = page.locator('[data-testid="chain-guard"]');
    const guardVisible = await guard.isVisible().catch(() => false);
    const guardText = guardVisible ? (await guard.innerText()).replace(/\s+/g, " ") : "";
    const actualChainText = guardVisible
      ? (await page.locator('[data-testid="chain-guard-actual-chain"]').innerText()).replace(/\s+/g, " ")
      : "";
    const expectedChainText = guardVisible
      ? (await page.locator('[data-testid="chain-guard-expected-chain-id"]').innerText()).trim()
      : "";
    // No app data may render behind the guard: the views themselves are not mounted.
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const searchInput = await page.locator("input").count();
    const heroVisible = /Reveal the/.test(bodyText);
    const statsVisible = /Total Searches|Alerts Fired/.test(bodyText);
    const navbarWrongNet = await page.locator('[data-testid="navbar-wrong-network"]').count();

    check("S2 guard replaces app data on chain 1", guardVisible, `visible=${guardVisible}`);
    check("S2 guard names the actual chain", /1 \(0x1\)/.test(actualChainText), actualChainText);
    check(
      "S2 guard names the expected chain id",
      expectedChainText === String(EXPECTED_CHAIN_ID),
      expectedChainText
    );
    check(
      "S2 no app data rendered (hero/stats/search input absent)",
      !heroVisible && !statsVisible && searchInput === 0,
      `hero=${heroVisible} stats=${statsVisible} inputs=${searchInput}`
    );
    check("S2 navbar shows wrong-network action", navbarWrongNet > 0, `count=${navbarWrongNet}`);

    await page.screenshot({ path: path.join(OUT_DIR, "06-wrong-chain-guard.png"), fullPage: false });

    // Switch from the guard (wallet knows the chain here, so plain switch works).
    await page.locator('[data-testid="chain-guard-switch"]').click();
    await page.waitForTimeout(2000);
    const guardAfter = await page.locator('[data-testid="chain-guard"]').count();
    const badgeAfter = (await page.locator('[data-testid="chain-badge"]').innerText().catch(() => "")).replace(/\s+/g, " ");
    const walletChain = await page.evaluate(() => window.__walletMock?.getChainId());

    check("S2 guard disappears after switch", guardAfter === 0, `guard count=${guardAfter}`);
    check("S2 app data renders after switch", badgeAfter.includes(String(EXPECTED_CHAIN_ID)), `badge="${badgeAfter}"`);
    check("S2 wallet switched to 0x5fdaf3", walletChain === EXPECTED_CHAIN_HEX, String(walletChain));

    await page.screenshot({ path: path.join(OUT_DIR, "07-after-chain-switch.png"), fullPage: false });
    probe.scenarios.push({
      scenario: "wrong-chain-then-switch",
      guardVisible,
      actualChainText,
      expectedChainText,
      heroVisible,
      statsVisible,
      searchInput,
      guardAfter,
      badgeAfter,
      walletChain,
      addCalls,
    });
    await context.close();
  }

  // ---------- Scenario 3: wallet on Ethereum, switch rejected ----------
  {
    const addCalls = [];
    const { context, page } = await newWalletContext(browser, {
      chainId: "0x1",
      address: FAKE_ADDRESS,
      knownChains: ["0x1"],
      addCalls,
      rejectSwitch: true,
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await connectInjected(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="chain-guard-switch"]').click();
    await page.waitForTimeout(1200);

    const guardVisible = await page.locator('[data-testid="chain-guard"]').isVisible().catch(() => false);
    const errorText = (await page.locator('[data-testid="chain-guard-error"]').innerText().catch(() => "")).replace(/\s+/g, " ");
    check("S3 rejected switch keeps the guard up", guardVisible, `visible=${guardVisible}`);
    check("S3 guard reports the rejection", /rejected/i.test(errorText), errorText);

    await page.screenshot({ path: path.join(OUT_DIR, "08-wrong-chain-switch-rejected.png"), fullPage: false });
    probe.scenarios.push({ scenario: "wrong-chain-rejected", guardVisible, errorText });
    await context.close();
  }

  // ---------- Scenario 4: wallet does not know the chain -> add network ----------
  {
    const addCalls = [];
    const { context, page } = await newWalletContext(browser, {
      chainId: "0x1",
      address: FAKE_ADDRESS,
      knownChains: ["0x1"],
      addCalls,
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await connectInjected(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="chain-guard-add"]').click();
    await page.waitForTimeout(2000);

    // The provider lives in the page, so read the recorded call from the page.
    const calls = await page.evaluate(() => window.__walletMock?.addCalls ?? []);
    const params = calls[0] ?? {};
    const walletChain = await page.evaluate(() => window.__walletMock?.getChainId());
    const guardAfter = await page.locator('[data-testid="chain-guard"]').count();

    check("S4 add-network sends chainId 0x5fdaf3", params.chainId === EXPECTED_CHAIN_HEX, JSON.stringify(params.chainId));
    check("S4 add-network sends the chain module RPC URL", (params.rpcUrls ?? []).includes("https://rpc.testnet.dogeos.com/"), JSON.stringify(params.rpcUrls));
    check("S4 add-network sends the explorer", (params.blockExplorerUrls ?? []).includes("https://dogeos-testnet.l2scan.co"), JSON.stringify(params.blockExplorerUrls));
    check("S4 add-network sends DOGE/18", params.nativeCurrency?.symbol === "DOGE" && params.nativeCurrency?.decimals === 18, JSON.stringify(params.nativeCurrency));
    check("S4 wallet ends on 0x5fdaf3", walletChain === EXPECTED_CHAIN_HEX, String(walletChain));
    check("S4 guard gone after add+switch", guardAfter === 0, `guard count=${guardAfter}`);

    await page.screenshot({ path: path.join(OUT_DIR, "09-add-network-then-connected.png"), fullPage: false });
    probe.scenarios.push({ scenario: "add-network", params, walletChain, guardAfter });
    await context.close();
  }

  // ---------- Scenario 5: wallet answers 4902 to a plain switch -> auto add ----------
  {
    const addCalls = [];
    const { context, page } = await newWalletContext(browser, {
      chainId: "0x1",
      address: FAKE_ADDRESS,
      knownChains: ["0x1"],
      addCalls,
      throw4902: true, // wallet does not know 0x5fdaf3 until it is added
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await connectInjected(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="chain-guard-switch"]').click();
    await page.waitForTimeout(2500);

    const calls = await page.evaluate(() => window.__walletMock?.addCalls ?? []);
    const walletChain = await page.evaluate(() => window.__walletMock?.getChainId());
    const guardAfter = await page.locator('[data-testid="chain-guard"]').count();
    const errorText = (await page.locator('[data-testid="chain-guard-error"]').innerText().catch(() => "")).trim();

    check("S5 4902 on switch falls back to wallet_addEthereumChain", calls.length > 0, `addCalls=${calls.length}`);
    check("S5 add used chain 0x5fdaf3", calls[0]?.chainId === EXPECTED_CHAIN_HEX, JSON.stringify(calls[0]?.chainId));
    check("S5 wallet ends on 0x5fdaf3", walletChain === EXPECTED_CHAIN_HEX, String(walletChain));
    check("S5 guard gone, no error left", guardAfter === 0 && errorText.length === 0, `guard=${guardAfter} error="${errorText}"`);

    await page.screenshot({ path: path.join(OUT_DIR, "10-chain-unknown-then-added.png"), fullPage: false });
    probe.scenarios.push({ scenario: "4902-auto-add", calls, walletChain, guardAfter, errorText });
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  probe.assertions = results;
  probe.failed = failed.length;
  fs.writeFileSync(path.join(OUT_DIR, "wallet-guard-probe.json"), JSON.stringify(probe, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.name).join("; ")}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("PROOF RUN THREW:", error);
  process.exit(2);
});
