import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { Tooltip } from "./Tooltip";

interface EmbeddedChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  chainId?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  theme?: "light" | "dark";
  expanded?: boolean; // External control for expansion state
  showToggle?: boolean; // Show/hide internal toggle button
}

export const EmbeddedChart: React.FC<EmbeddedChartProps> = ({
  tokenAddress,
  tokenSymbol = "Unknown",
  chainId = "dogechain",
  className = "",
  onLoad,
  onError,
  theme = "dark",
  expanded = false,
  showToggle = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get chart URL for Dexscreener
  const getChartUrl = useCallback((): string => {
    const params = new URLSearchParams({
      embed: "1",
      theme: theme,
    });

    const url = `https://dexscreener.com/${chainId}/${tokenAddress}?${params.toString()}`;

    // Log URL for debugging
    console.log(`[EmbeddedChart] Dexscreener URL:`, url);

    return url;
  }, [chainId, tokenAddress, theme]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setIframeError(false);
    onLoad?.();

    // Log success
    console.log(`[EmbeddedChart] Dexscreener loaded successfully for ${tokenSymbol}`, {
      tokenAddress,
      source: "dexscreener",
      url: getChartUrl(),
    });
  }, [tokenSymbol, tokenAddress, onLoad, getChartUrl]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.warn(`[EmbeddedChart] Dexscreener failed to load for ${tokenSymbol}`, {
      tokenAddress,
    });

    setIframeError(true);
    setIsLoading(false);
    onError?.();
  }, [tokenSymbol, tokenAddress, onError]);

  // Toggle expansion
  const toggleExpansion = useCallback(() => {
    setIsExpanded((prev) => !prev);

    // Log expansion for analytics
    if (!isExpanded) {
      console.log(`[EmbeddedChart] Expanding chart for ${tokenSymbol}`, {
        tokenAddress,
        source: "dexscreener",
      });
    }
  }, [isExpanded, tokenSymbol, tokenAddress]);

  // Reload iframe
  const reloadIframe = useCallback(() => {
    setIsLoading(true);
    setIframeError(false);

    // Force reload by recreating iframe
    if (iframeRef.current) {
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = getChartUrl();
        }
      }, 100);
    }
  }, [getChartUrl]);

  // Open external link
  const openExternalLink = useCallback(() => {
    const url = getChartUrl();
    window.open(url, "_blank", "noopener,noreferrer");

    // Log external link click for analytics
    console.log("[EmbeddedChart] Opening external link to Dexscreener", {
      tokenSymbol,
      url,
    });
  }, [tokenSymbol, getChartUrl]);

  // Copy pair address
  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tokenAddress);

      // Show brief success indication
      const button = document.querySelector(
        `[data-copy-action="${tokenAddress}"]`
      ) as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("text-green-400");
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("text-green-400");
        }, 2000);
      }

      console.log(`[EmbeddedChart] Copied address for ${tokenSymbol}:`, tokenAddress);
    } catch (error) {
      console.error("[EmbeddedChart] Failed to copy address:", error);
    }
  }, [tokenAddress, tokenSymbol]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Sync internal expansion state with external prop
  useEffect(() => {
    if (showToggle === false) {
      // When controlled externally, use the expanded prop directly
      // Defer setState to avoid cascading renders
      setTimeout(() => setIsExpanded(expanded), 0);
    }
  }, [expanded, showToggle]);

  // Track if iframe is visible for lazy loading
  useEffect(() => {
    if (!isExpanded) return;

    // Small delay before loading iframe to allow animation to start
    const timer = setTimeout(() => {
      setIsLoading(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [isExpanded]);

  const chartUrl = getChartUrl();

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {/* Toggle Button - Only show if showToggle is true */}
      {showToggle && (
        <button
          onClick={toggleExpansion}
          className="flex items-center gap-2 text-sm text-doge-500 hover:text-doge-400 transition-colors px-2 py-1 rounded hover:bg-doge-500/10"
          aria-expanded={isExpanded}
          aria-label={`Toggle ${tokenSymbol} chart`}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {isExpanded ? `Hide ${tokenSymbol} Chart` : `View ${tokenSymbol} Chart`}
        </button>
      )}

      {/* Inline Chart Container */}
      {isExpanded && (
        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Dexscreener</span>
              {iframeError && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertCircle size={12} />
                  Failed to load
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Reload Button */}
              <Tooltip content="Reload chart">
                <button
                  onClick={reloadIframe}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-space-700 rounded transition-colors"
                  aria-label="Reload chart"
                >
                  <RefreshCw size={14} />
                </button>
              </Tooltip>

              {/* External Link Button */}
              <Tooltip content="View on Dexscreener">
                <button
                  onClick={openExternalLink}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-space-700 rounded transition-colors"
                  aria-label="Open on Dexscreener"
                >
                  <ExternalLink size={14} />
                </button>
              </Tooltip>

              {/* Copy Address Button */}
              <Tooltip content="Copy pair address">
                <button
                  onClick={copyAddress}
                  data-copy-action={tokenAddress}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-space-700 rounded transition-colors text-xs"
                  aria-label="Copy pair address"
                >
                  Copy
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="w-full h-[300px] sm:h-[400px] lg:h-[500px] border border-space-700 rounded-lg bg-space-800 flex items-center justify-center">
              <RefreshCw size={24} className="text-doge-500 animate-spin" />
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={isExpanded ? chartUrl : undefined}
            className={`w-full h-[300px] sm:h-[400px] lg:h-[500px] border border-space-700 rounded-lg bg-space-800 transition-all ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={`${tokenSymbol} chart on Dexscreener`}
            aria-label={`Embedded ${tokenSymbol} price chart from Dexscreener`}
          />
        </div>
      )}
    </div>
  );
};
