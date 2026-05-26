/**
 * Dev Wallet Banner
 *
 * Shows a dismissible banner when running in dev mode with the simulated wallet.
 * Only renders in development — never in production.
 */

import React, { useState } from "react";
import { Wallet, X, AlertTriangle } from "lucide-react";

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

export const DevWalletBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (!isDev || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-purple-900/95 via-indigo-900/95 to-purple-900/95 border-b border-purple-500/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/20">
            <Wallet className="w-4 h-4 text-purple-300" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-200">Simulated Wallet Active</span>
            <span className="text-xs text-purple-400 hidden sm:inline">0x742d...BD38</span>
          </div>
          <div className="hidden md:flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
            <AlertTriangle size={12} />
            <span>Dev mode only</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md hover:bg-purple-500/20 transition-colors text-purple-400 hover:text-white"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
