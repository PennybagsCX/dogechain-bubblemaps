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
  // WalletConnect project ID (set in Vercel environment variables)
  // If not set, uses empty string to skip remote config fetch
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
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
