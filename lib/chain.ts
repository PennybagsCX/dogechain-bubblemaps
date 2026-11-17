/**
 * DogeOS Chikyū chain identity — THE single source of truth.
 *
 * Every chain id, RPC URL, explorer URL and API host in this app comes from here.
 * `wagmi.ts` and `services/evmRPC.ts` are thin wrappers over this module; do not
 * reintroduce literal hosts anywhere else.
 *
 * Verified live 2026-11-17: eth_chainId on the RPC returns 0x5fdaf3 (6281971).
 */

export const CHAIN = {
  id: 6281971,
  name: "DogeOS Chikyū Testnet",
  network: "dogeos-chikyu",
  nativeCurrency: {
    name: "DOGE",
    symbol: "DOGE",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.dogeos.com/"] },
    public: { http: ["https://rpc.testnet.dogeos.com/"] },
  },
  blockExplorers: {
    default: {
      name: "DogeOS Testnet Explorer",
      url: "https://dogeos-testnet.l2scan.co",
    },
  },
  testnet: true,
} as const;

export const CHAIN_ID = CHAIN.id;
/** Chain id as the 0x-prefixed hex the wallet/RPC layer expects. */
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;
export const CHAIN_NAME = CHAIN.name;
export const NATIVE_SYMBOL = CHAIN.nativeCurrency.symbol;
export const NATIVE_DECIMALS = CHAIN.nativeCurrency.decimals;

/**
 * Primary JSON-RPC endpoint. Chikyū documents exactly one public endpoint, so there is
 * no endpoint array and no failover: every RPC call goes through this URL.
 */
export const RPC_URL = CHAIN.rpcUrls.default.http[0];

/** Human-facing explorer (links users click). */
export const EXPLORER_URL = CHAIN.blockExplorers.default.url;
export const EXPLORER_NAME = CHAIN.blockExplorers.default.name;

/**
 * Machine-facing indexer/API host. Chikyū exposes a blockscout instance that speaks
 * both the etherscan-compatible v1 API and the blockscout v2 API, and it sends
 * `access-control-allow-origin: *`, so the browser can call it directly.
 */
export const EXPLORER_API_HOST = "https://blockscout.testnet.dogeos.com";
export const EXPLORER_API = `${EXPLORER_API_HOST}/api`;
export const EXPLORER_API_V2 = `${EXPLORER_API_HOST}/api/v2`;

/** Testnet DOGE faucet (reCAPTCHA-gated: a human must claim). */
export const FAUCET_URL = "https://faucet.testnet.dogeos.com";

export const explorerTxUrl = (hash: string): string => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddressUrl = (address: string): string => `${EXPLORER_URL}/address/${address}`;
export const explorerTokenUrl = (address: string): string => `${EXPLORER_URL}/token/${address}`;
export const explorerBlockUrl = (block: number | bigint): string =>
  `${EXPLORER_URL}/block/${block}`;

/**
 * WalletConnect Cloud project id.
 *
 * The upstream app silently fell back to a hardcoded placeholder id, which produces a
 * broken, rate-limited WalletConnect session in production. Never ship a placeholder:
 * when this is undefined the WalletConnect connector is disabled and only injected
 * wallets are offered. A real id must be supplied via VITE_WALLETCONNECT_PROJECT_ID.
 */
export const getWalletConnectProjectId = (): string | undefined => {
  const raw =
    typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
          ?.VITE_WALLETCONNECT_PROJECT_ID
      : undefined;
  const value = (raw || "").trim();
  return value.length > 0 ? value : undefined;
};

/** Resolved once at module load; `undefined` means "not configured", never a placeholder. */
export const WALLETCONNECT_PROJECT_ID: string | undefined = getWalletConnectProjectId();

export const isWalletConnectConfigured = (): boolean => getWalletConnectProjectId() !== undefined;

/** True when the wallet reports the chain this build is built for. */
export const isExpectedChain = (chainIdHex?: string | number | null): boolean => {
  if (chainIdHex === undefined || chainIdHex === null) return false;
  const value = typeof chainIdHex === "number" ? chainIdHex : Number.parseInt(chainIdHex, 16);
  return value === CHAIN_ID;
};
