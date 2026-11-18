/**
 * useWalletChain — the wallet's real chain, straight from the EIP-1193 provider.
 *
 * The app only reads DogeOS Chikyū (chain 6281971 / 0x5fdaf3). wagmi's config holds that single
 * chain, so a wallet sitting on another network produces no usable chain data; instead of
 * rendering empty/stale numbers, the app shell swaps the content for `ChainGuard`.
 *
 * Source of truth for the wallet's chain is `eth_chainId` on the injected provider (the same
 * provider wagmi's injected connector drives), refreshed on every `chainChanged`, with wagmi's
 * `useAccount().chainId` as the fallback when no provider object is reachable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { CHAIN_ID, CHAIN_ID_HEX, isExpectedChain, walletAddChainParams } from "../lib/chain";

/** Minimal EIP-1193 surface the app needs. */
export interface InjectedProvider {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: InjectedProvider[];
}

interface ProviderError {
  code?: number;
  message?: string;
}

/** JSON-RPC error a wallet returns when it does not know the chain yet. */
const UNRECOGNIZED_CHAIN = 4902;
/** JSON-RPC error a user produces by rejecting the request in their wallet. */
const USER_REJECTED = 4001;

const asNumber = (chainIdHex: unknown): number | undefined => {
  if (typeof chainIdHex !== "string") return undefined;
  const parsed = Number.parseInt(chainIdHex, 16);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const errorMessage = (error: unknown): string => {
  const { code, message } = (error ?? {}) as ProviderError;
  if (code === USER_REJECTED) return "Request rejected in your wallet.";
  if (code === UNRECOGNIZED_CHAIN)
    return "Your wallet does not know this network yet — add it first.";
  return message && message.length > 0 ? message : "The wallet refused the request.";
};

export const getInjectedProvider = (): InjectedProvider | undefined => {
  if (typeof window === "undefined") return undefined;
  const ethereum = (window as unknown as { ethereum?: InjectedProvider }).ethereum;
  if (!ethereum) return undefined;
  const announced = ethereum.providers;
  if (Array.isArray(announced) && announced.length > 0) {
    return announced.find((provider) => provider.isMetaMask) ?? announced[0];
  }
  return ethereum;
};

export interface WalletChainState {
  /** Chain the wallet is on, or undefined when it cannot be read. */
  walletChainId?: number;
  walletChainIdHex?: string;
  /** True only when we KNOW the wallet is connected to a different chain. */
  isWrongChain: boolean;
  isSwitching: boolean;
  error?: string;
  /** False when no injected provider is reachable (nothing to switch). */
  canSwitch: boolean;
  switchToExpectedChain: () => Promise<void>;
  addExpectedChain: () => Promise<void>;
}

export const useWalletChain = (): WalletChainState => {
  const { isConnected, chainId: wagmiChainId, address, connector } = useAccount();
  const [providerChainId, setProviderChainId] = useState<number | undefined>(undefined);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readProviderChainId = useCallback(async (): Promise<number | undefined> => {
    const provider = getInjectedProvider();
    if (!provider) return undefined;
    try {
      const hex = await provider.request({ method: "eth_chainId" });
      return asNumber(hex);
    } catch {
      return undefined;
    }
  }, []);

  // Read on connect / reconnect, and follow the wallet's own chainChanged events.
  useEffect(() => {
    let cancelled = false;
    const provider = getInjectedProvider();

    const sync = () => {
      void readProviderChainId().then((value) => {
        if (!cancelled && value !== undefined) setProviderChainId(value);
      });
    };

    if (isConnected && provider) {
      sync();
      const onChainChanged = (chainIdHex: unknown) => {
        const next = asNumber(chainIdHex);
        if (!cancelled && next !== undefined) setProviderChainId(next);
      };
      provider.on?.("chainChanged", onChainChanged);
      return () => {
        cancelled = true;
        provider.removeListener?.("chainChanged", onChainChanged);
      };
    }

    if (isConnected) sync();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector, readProviderChainId]);

  // Provider read wins; wagmi's account chain is the fallback (e.g. non-injected connectors).
  const effectiveChainId = providerChainId ?? (isConnected ? wagmiChainId : undefined);

  useEffect(() => {
    if (isConnected && effectiveChainId !== undefined && isExpectedChain(effectiveChainId)) {
      setError(undefined);
    }
  }, [isConnected, effectiveChainId]);

  const addExpectedChain = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet is available in this browser.");
      return;
    }
    setIsSwitching(true);
    setError(undefined);
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [walletAddChainParams()],
      });
      // Most wallets switch to the chain they just added; ask explicitly for the rest.
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
      const next = await readProviderChainId();
      if (mounted.current && next !== undefined) setProviderChainId(next);
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setIsSwitching(false);
    }
  }, [readProviderChainId]);

  const switchToExpectedChain = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("No injected wallet is available in this browser.");
      return;
    }
    setIsSwitching(true);
    setError(undefined);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
      const next = await readProviderChainId();
      if (mounted.current && next !== undefined) setProviderChainId(next);
    } catch (e) {
      const { code, message } = (e ?? {}) as ProviderError;
      if (code === UNRECOGNIZED_CHAIN || /unrecognized chain/i.test(message ?? "")) {
        // Chain unknown to the wallet: add it (which also switches), then stop.
        if (mounted.current) setIsSwitching(false);
        await addExpectedChain();
        return;
      }
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) setIsSwitching(false);
    }
  }, [addExpectedChain, readProviderChainId]);

  return {
    walletChainId: effectiveChainId,
    walletChainIdHex:
      effectiveChainId !== undefined ? `0x${effectiveChainId.toString(16)}` : undefined,
    isWrongChain: isConnected && effectiveChainId !== undefined && effectiveChainId !== CHAIN_ID,
    isSwitching,
    error,
    canSwitch: true,
    switchToExpectedChain,
    addExpectedChain,
  };
};
