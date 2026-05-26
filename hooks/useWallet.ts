/**
 * useWallet - Unified wallet hook
 *
 * In dev mode: returns simulated wallet if no real wallet is connected
 * In prod mode: passthrough to wagmi's useAccount
 *
 * This lets all components use a single hook that works both with and without MetaMask.
 */

import { useAccount as useWagmiAccount } from "wagmi";
import { useDevWallet } from "../contexts/DevWalletContext";

interface WalletState {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  isDevWallet: boolean;
}

export function useWallet(): WalletState {
  const wagmiAccount = useWagmiAccount();
  const devWallet = useDevWallet();

  // If real wallet is connected, use it
  if (wagmiAccount.isConnected && wagmiAccount.address) {
    return {
      address: wagmiAccount.address,
      isConnected: true,
      isDevWallet: false,
    };
  }

  // In dev mode, fall back to simulated wallet
  if (devWallet.isDevMode && devWallet.isActive && devWallet.address) {
    return {
      address: devWallet.address as `0x${string}`,
      isConnected: true,
      isDevWallet: true,
    };
  }

  return {
    address: undefined,
    isConnected: false,
    isDevWallet: false,
  };
}
