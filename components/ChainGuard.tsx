/**
 * ChainGuard — the app shell's wrong-network gate.
 *
 * Rendered INSTEAD of every view (home search, dashboard, analytics, bubble map) whenever the
 * connected wallet reports a chain other than DogeOS Chikyū. It never renders chain data: it
 * offers a switch/add-network action built from `lib/chain.ts` values, so the numbers a user
 * copies into their wallet cannot drift from the ones the app reads.
 */

import React from "react";
import { AlertTriangle, ExternalLink, Loader2, Network, RefreshCw } from "lucide-react";
import {
  CHAIN,
  CHAIN_ID,
  CHAIN_ID_HEX,
  EXPLORER_URL,
  NATIVE_DECIMALS,
  NATIVE_SYMBOL,
  RPC_URL,
} from "../lib/chain";
import type { WalletChainState } from "../hooks/useWalletChain";

interface ChainGuardProps {
  state: WalletChainState;
}

const formatChainId = (chainId?: number, chainIdHex?: string): string =>
  chainId !== undefined ? `${String(chainId)} (${chainIdHex ?? CHAIN_ID_HEX})` : "unknown";

const spec: Array<{ label: string; value: string; href?: string }> = [
  { label: "Network", value: CHAIN.name },
  { label: "Chain ID", value: `${String(CHAIN_ID)} (${CHAIN_ID_HEX})` },
  { label: "RPC URL", value: RPC_URL },
  { label: "Explorer", value: EXPLORER_URL, href: EXPLORER_URL },
  {
    label: "Currency",
    value: `${NATIVE_SYMBOL} · ${String(NATIVE_DECIMALS)} decimals`,
  },
];

export const ChainGuard: React.FC<ChainGuardProps> = ({ state }) => {
  const {
    walletChainId,
    walletChainIdHex,
    isSwitching,
    error,
    switchToExpectedChain,
    addExpectedChain,
  } = state;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 py-10"
      data-testid="chain-guard"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-space-800/80 shadow-2xl shadow-amber-500/10 backdrop-blur-sm overflow-hidden">
        <div className="flex items-start gap-4 p-6 border-b border-space-700">
          <div className="shrink-0 w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={26} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white" data-testid="chain-guard-title">
              Wrong network
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Your wallet is on chain{" "}
              <span className="font-mono text-amber-300" data-testid="chain-guard-actual-chain">
                {formatChainId(walletChainId, walletChainIdHex)}
              </span>
              . DogeOS Bubblemaps only reads{" "}
              <span className="text-white font-medium">{CHAIN.name}</span> (chain{" "}
              <span className="font-mono text-white" data-testid="chain-guard-expected-chain-id">
                {CHAIN_ID}
              </span>{" "}
              / {CHAIN_ID_HEX}), so chain data is hidden until you switch.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 p-6 text-sm">
          {spec.map(({ label, value, href }) => (
            <div
              key={label}
              className={label === "RPC URL" || label === "Explorer" ? "sm:col-span-2" : ""}
            >
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-mono text-slate-200 break-all">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-purple-300"
                  >
                    {value}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {error && (
          <div
            className="mx-6 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            data-testid="chain-guard-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 p-6 pt-0">
          <button
            type="button"
            onClick={() => void switchToExpectedChain()}
            disabled={isSwitching}
            data-testid="chain-guard-switch"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            {isSwitching ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Switch to {CHAIN.name}
          </button>
          <button
            type="button"
            onClick={() => void addExpectedChain()}
            disabled={isSwitching}
            data-testid="chain-guard-add"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-space-700 text-slate-200 font-medium hover:bg-space-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors border border-space-600 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <Network size={18} />
            Add network to wallet
          </button>
        </div>
      </div>
    </div>
  );
};
