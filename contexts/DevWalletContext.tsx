/**
 * Dev Wallet Context
 *
 * Provides a simulated wallet connection in dev mode.
 * Intercepts wagmi's useAccount to return a mock connected state.
 * Only active in development — no-op in production.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

const DEV_WALLET_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f2BD38" as const;

interface DevWalletState {
  isDevMode: boolean;
  isActive: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
}

const DevWalletContext = createContext<DevWalletState>({
  isDevMode: false,
  isActive: false,
  address: null,
  connect: () => {},
  disconnect: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components -- context hook co-located with provider; splitting adds import churn for a dev-HMR-only concern
export const useDevWallet = () => useContext(DevWalletContext);

export const DevWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(() => {
    if (!isDev) return false;
    // Auto-connect in dev mode unless explicitly disconnected
    const stored = sessionStorage.getItem("dev-wallet-connected");
    return stored !== "false";
  });

  const address = isActive ? DEV_WALLET_ADDRESS : null;

  const connect = useCallback(() => {
    setIsActive(true);
    sessionStorage.setItem("dev-wallet-connected", "true");
  }, []);

  const disconnect = useCallback(() => {
    setIsActive(false);
    sessionStorage.setItem("dev-wallet-connected", "false");
  }, []);

  return (
    <DevWalletContext.Provider
      value={{
        isDevMode: isDev,
        isActive: isDev && isActive,
        address,
        connect,
        disconnect,
      }}
    >
      {children}
    </DevWalletContext.Provider>
  );
};
