import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
  ledgerWallet,
} from "@rainbow-me/rainbowkit/wallets";

// Dogechain chain configuration
export const dogechain = {
  id: 2000,
  name: "Dogechain",
  network: "dogechain",
  nativeCurrency: {
    decimals: 18,
    name: "Dogechain",
    symbol: "DOGE",
  },
  rpcUrls: {
    public: { http: ["https://rpc.dogechain.dog"] },
    default: { http: ["https://rpc.dogechain.dog"] },
  },
  blockExplorers: {
    default: { name: "Dogechain Explorer", url: "https://explorer.dogechain.dog" },
  },
  testnet: false,
} as const;

export const config = getDefaultConfig({
  appName: "Dogechain BubbleMaps",
  // WalletConnect project ID - uses anonymous project if not provided
  projectId:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) ||
    "8d2cf68c8ec5b9c3b3a1e3b0d7e9f5a2c0d1e2f3a4b5c6d",
  chains: [dogechain],
  ssr: true, // Enable for better compatibility
  wallets: [
    {
      groupName: "Popular",
      wallets: [rabbyWallet, metaMaskWallet, rainbowWallet, coinbaseWallet],
    },
    {
      groupName: "Other",
      wallets: [walletConnectWallet, trustWallet, ledgerWallet],
    },
  ],
});
