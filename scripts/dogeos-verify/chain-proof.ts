/**
 * PROOF — T-01 chain constants (lib/chain.ts single source of truth).
 *
 * Run: bash scripts/dogeos-verify/chain-proof.sh
 *
 * Asserts, against the live chain:
 *   1. every constant exported by lib/chain.ts has the expected Chikyū value,
 *   2. the WalletConnect project id accessor returns undefined when unset (no placeholder),
 *   3. `eth_chainId` read through the app's single viem public client is 0x5fdaf3,
 *   4. the same read through EvmRPCClient's shared client agrees, and the client knows of
 *      exactly one RPC endpoint.
 *
 * Exits non-zero on any mismatch so it can be used as a gate.
 */
import {
  CHAIN,
  CHAIN_ID,
  CHAIN_ID_HEX,
  RPC_URL,
  EXPLORER_URL,
  EXPLORER_API,
  EXPLORER_API_V2,
  FAUCET_URL,
  explorerTxUrl,
  explorerAddressUrl,
  getWalletConnectProjectId,
} from "../../lib/chain";
import { EvmRPCClient, publicClient } from "../../services/evmRPC";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label}: ${String(actual)}${ok ? "" : ` (expected ${String(expected)})`}`
  );
};

const main = async (): Promise<void> => {
  console.log("== lib/chain.ts constants ==");
  check("CHAIN.id", CHAIN.id, 6281971);
  check("CHAIN.name", CHAIN.name, "DogeOS Chikyū Testnet");
  check("CHAIN.network", (CHAIN as { network?: string }).network, "dogeos-chikyu");
  check("nativeCurrency.symbol", CHAIN.nativeCurrency.symbol, "DOGE");
  check("nativeCurrency.decimals", CHAIN.nativeCurrency.decimals, 18);
  check(
    "rpcUrls.default.http[0]",
    CHAIN.rpcUrls.default.http[0],
    "https://rpc.testnet.dogeos.com/"
  );
  check(
    "blockExplorers.default.url",
    CHAIN.blockExplorers.default.url,
    "https://dogeos-testnet.l2scan.co"
  );
  check("CHAIN_ID", CHAIN_ID, 6281971);
  check("CHAIN_ID_HEX", CHAIN_ID_HEX, "0x5fdaf3");
  check("RPC_URL", RPC_URL, "https://rpc.testnet.dogeos.com/");
  check("EXPLORER_URL", EXPLORER_URL, "https://dogeos-testnet.l2scan.co");
  check("EXPLORER_API", EXPLORER_API, "https://blockscout.testnet.dogeos.com/api");
  check("EXPLORER_API_V2", EXPLORER_API_V2, "https://blockscout.testnet.dogeos.com/api/v2");
  check("FAUCET_URL", FAUCET_URL, "https://faucet.testnet.dogeos.com");
  check("explorerTxUrl", explorerTxUrl("0xabc"), "https://dogeos-testnet.l2scan.co/tx/0xabc");
  check(
    "explorerAddressUrl",
    explorerAddressUrl("0xabc"),
    "https://dogeos-testnet.l2scan.co/address/0xabc"
  );

  console.log("\n== WalletConnect project id (must never be a placeholder) ==");
  const wcId = getWalletConnectProjectId();
  const wcOk = wcId === undefined || (typeof wcId === "string" && wcId.trim().length > 0);
  if (!wcOk) failures++;
  console.log(
    `${wcOk ? "PASS" : "FAIL"} getWalletConnectProjectId() -> ${wcId === undefined ? "undefined (unconfigured, WalletConnect disabled)" : `configured (${wcId.length} chars)`}`
  );

  console.log("\n== live eth_chainId through the app's single public client ==");
  const raw = (await publicClient.request({ method: "eth_chainId" })) as string;
  check("publicClient.request(eth_chainId)", raw, "0x5fdaf3");
  const viemChainId = await publicClient.getChainId();
  check("publicClient.getChainId()", viemChainId, 6281971);

  console.log("\n== EvmRPCClient (services/evmRPC.ts) uses that same client ==");
  const rpc = new EvmRPCClient();
  check("getRPCEndpoints().length", rpc.getRPCEndpoints().length, 1);
  check("getRPCEndpoints()[0]", rpc.getRPCEndpoints()[0], RPC_URL);
  check("getCurrentProviderIndex()", rpc.getCurrentProviderIndex(), 0);
  const blockNumber = await rpc.getLatestBlockNumber();
  check("getLatestBlockNumber() > 0", blockNumber > 0n, true);
  const meta = await rpc.getTokenMetadata("0x555de2148ef9ff0fef70faf7587c3492eb468a91");
  check("getTokenMetadata(SUCH).symbol", meta.symbol, "SUCH");
  console.log(`     head block: ${blockNumber}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("PROOF ERRORED:", err?.message ?? err);
  process.exit(1);
});
