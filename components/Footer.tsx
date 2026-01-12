import React from "react";
import { Github, Search, AlertTriangle } from "lucide-react";
import { Tooltip } from "./Tooltip";
import { useStatsCounters } from "../hooks/useStatsCounters";

/**
 * Format number with commas (e.g., 1,234,567)
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export const Footer: React.FC = () => {
  const { totalSearches, totalAlerts, isLoading } = useStatsCounters();
  return (
    <footer className="border-t border-space-700 bg-space-900 py-12 mt-auto">
      <div className="w-full px-4">
        <div className="flex flex-col items-center justify-center gap-6 text-center">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <span className="text-purple-600">Ð</span> Dogechain BubbleMaps
            </h3>
            <p className="text-slate-500 text-sm mt-2 max-w-full sm:max-w-md">
              An advanced on-chain intelligence platform providing live visualization of token
              distributions and whale activities on the Dogechain network.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/PennybagsCX/dogechain-bubblemaps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github size={20} />
            </a>
            <a
              href="https://t.me/PennybagsCX"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition-colors"
              aria-label="Telegram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.155.232.171.326.015.093.034.305.019.47z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-space-700 flex flex-col items-center justify-center text-xs text-slate-600 gap-4 text-center">
          <p>&copy; 2026 Dogechain BubbleMaps. All rights reserved.</p>
          <p>Beta Build #{__BETA_BUILD_NUMBER__}</p>

          {/* Stats Counters */}
          <div className="mt-4 pt-4 border-t border-space-700/50 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs">
            {/* Search Counter */}
            <Tooltip content="Since January 12, 2026">
              <div className="flex items-center gap-2 text-slate-400">
                <Search size={14} className="text-purple-500" />
                <span className="text-slate-500">Total Searches:</span>
                <span className="font-mono font-semibold text-purple-400">
                  {isLoading ? "..." : formatNumber(totalSearches)}
                </span>
              </div>
            </Tooltip>

            {/* Alert Counter */}
            <Tooltip content="Since January 12, 2026">
              <div className="flex items-center gap-2 text-slate-400">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-slate-500">Alerts Fired:</span>
                <span className="font-mono font-semibold text-amber-400">
                  {isLoading ? "..." : formatNumber(totalAlerts)}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-space-800/50 border border-space-800 text-[10px] text-slate-500 text-center">
          <strong>Disclaimer:</strong> This platform is for informational purposes only. Data is
          fetched in real-time from the Dogechain Explorer and may contain inaccuracies. Nothing on
          this site constitutes financial advice. Cryptocurrency investments carry high risk.
        </div>
      </div>
    </footer>
  );
};
