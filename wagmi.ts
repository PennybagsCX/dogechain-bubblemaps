import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  rabbyWallet,
  coinbaseWallet,
  safeWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  ledgerWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

// Chain identity lives in ONE place. This file is a thin wrapper over it.
import { CHAIN, RPC_URL, getWalletConnectProjectId } from "./lib/chain";

/** The product name wallets show in their connect prompts. */
export const APP_NAME = "DogeOS Bubblemaps";

/** viem/wagmi chain descriptor for DogeOS Chikyū, derived from the single source of truth. */
export const dogeosChain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: {
    default: { http: [...CHAIN.rpcUrls.default.http] },
  },
  blockExplorers: {
    default: {
      name: CHAIN.blockExplorers.default.name,
      url: CHAIN.blockExplorers.default.url,
    },
  },
  testnet: true,
});

/** Kept so existing imports of `dogechain` / `dogeos` keep compiling. */
export const dogechain = CHAIN;
export const dogeos = CHAIN;

/**
 * WalletConnect connectivity.
 *
 * A real WalletConnect Cloud project id, or `undefined` — never a placeholder. RainbowKit's
 * `metaMaskWallet`, `rainbowWallet`, `trustWallet` and `ledgerWallet` call
 * `getWalletConnectConnector()` eagerly and THROW ("No projectId found...") when the id is
 * empty. Building that list without an id white-screens the app for any desktop visitor who
 * does not have one of those extensions installed, so those wallets are only listed when a
 * real id exists. Without one, injected / Coinbase / Safe wallets still connect.
 */
const walletConnectProjectId = getWalletConnectProjectId();
export const walletConnectEnabled = walletConnectProjectId !== undefined;

/** Never construct a WalletConnect connector — safe with no project id. */
const alwaysAvailableWallets = [injectedWallet, rabbyWallet, coinbaseWallet, safeWallet];

/** Only usable when a real WalletConnect project id is configured. */
const walletConnectDependentWallets = [
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  trustWallet,
  ledgerWallet,
];

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: walletConnectEnabled
        ? [...alwaysAvailableWallets, ...walletConnectDependentWallets]
        : alwaysAvailableWallets,
    },
  ],
  {
    appName: APP_NAME,
    // Only reachable with an id configured; in the other branch no WalletConnect connector
    // is built, so this value is never read by RainbowKit.
    projectId: walletConnectProjectId ?? "",
  }
);

export const config = createConfig({
  chains: [dogeosChain],
  connectors,
  transports: {
    [dogeosChain.id]: http(RPC_URL),
  },
  ssr: true,
});
