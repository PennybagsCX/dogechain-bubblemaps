/**
 * URL construction utilities for embedded crypto charts
 * Supports Dexscreener and GeckoTerminal embedding
 */

export type ChartSource = "dexscreener" | "geckoterminal";

export interface ChartUrlOptions {
  tokenAddress: string;
  chainId?: string;
  source: ChartSource;
}

/**
 * Constructs the chart URL based on the source platform
 */
export function getChartUrl(options: ChartUrlOptions): string {
  const { tokenAddress, chainId = "dogechain", source } = options;

  switch (source) {
    case "dexscreener":
      return `https://dexscreener.com/${chainId}/${tokenAddress}`;

    case "geckoterminal":
      return `https://www.geckoterminal.com/${chainId}/pools/${tokenAddress}`;

    default:
      throw new Error(`Unknown chart source: ${source}`);
  }
}

/**
 * Get both chart URLs for a token
 */
export function getAllChartUrls(tokenAddress: string, chainId: string = "dogechain") {
  return {
    dexscreener: getChartUrl({ tokenAddress, chainId, source: "dexscreener" }),
    geckoterminal: getChartUrl({ tokenAddress, chainId, source: "geckoterminal" }),
  };
}

/**
 * Validate token address format (basic check)
 */
export function isValidTokenAddress(address: string): boolean {
  // Basic Ethereum address validation: 0x followed by 40 hex characters
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

/**
 * Get chain display name
 */
export function getChainDisplayName(chainId: string): string {
  const chainNames: Record<string, string> = {
    dogechain: "Dogechain",
    ethereum: "Ethereum",
    bsc: "BNB Chain",
    polygon: "Polygon",
    arbitrum: "Arbitrum",
    optimism: "Optimism",
    avalanche: "Avalanche",
    solana: "Solana",
  };

  return chainNames[chainId] || chainId;
}

/**
 * Parse chart URL to extract token address and chain
 */
export function parseChartUrl(
  url: string
): { tokenAddress: string; chainId: string; source: ChartSource } | null {
  try {
    const urlObj = new URL(url);

    // Dexscreener pattern: https://dexscreener.com/{chain}/{address}
    if (urlObj.hostname === "dexscreener.com") {
      const parts = urlObj.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return {
          chainId: parts[0]!,
          tokenAddress: parts[1]!,
          source: "dexscreener",
        };
      }
    }

    // GeckoTerminal pattern: https://www.geckoterminal.com/{chain}/pools/{address}
    if (urlObj.hostname === "www.geckoterminal.com" || urlObj.hostname === "geckoterminal.com") {
      const parts = urlObj.pathname.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[1] === "pools") {
        return {
          chainId: parts[0]!,
          tokenAddress: parts[2]!,
          source: "geckoterminal",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
