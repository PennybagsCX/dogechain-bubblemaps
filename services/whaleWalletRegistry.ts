/**
 * Whale Wallet Registry
 *
 * Manages registry of high-volume wallets for token discovery.
 * Scans whale wallets to find tokens they interact with.
 */

// Known whale wallets on Dogechain
export const WHALE_WALLETS = [
  {
    address: "0x66aB144DEE239bb9FE2fB6FA28672611A2C0D854", // Dogechain Bridge
    name: "Dogechain Bridge",
    volume: "high",
    priority: 1,
  },
  {
    address: "0xf93cE2EeF8a97e6D9c0d39bb9cEbA8bbDbAa4570", // Dogechain Token
    name: "Dogechain Token Contract",
    volume: "high",
    priority: 2,
  },
  {
    address: "0xd7eF39F971F5199EB3661F1C6947EA27d6D173c5", // Multisig
    name: "Multi-sig Wallet",
    volume: "medium",
    priority: 3,
  },
];

// Registry for community-suggested wallets
interface WhaleWalletEntry {
  address: string;
  name: string;
  volume: "high" | "medium" | "low";
  priority: number;
  discoveredAt: number;
  lastVerified: number;
  transactionCount: number;
}

const whaleWalletRegistry = new Map<string, WhaleWalletEntry>();

/**
 * Initialize whale wallet registry
 */
export function initializeWhaleRegistry(): void {
  for (const whale of WHALE_WALLETS) {
    whaleWalletRegistry.set(whale.address.toLowerCase(), {
      ...whale,
      discoveredAt: Date.now(),
      lastVerified: Date.now(),
      transactionCount: 0,
    });
  }

  console.log(`[Whale Registry] Initialized with ${WHALE_WALLETS.length} whale wallets`);
}

/**
 * Get all whale wallet addresses
 */
export function getWhaleWallets(): WhaleWalletEntry[] {
  return Array.from(whaleWalletRegistry.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Add community-suggested whale wallet
 *
 * @param address - Wallet address
 * @param name - Wallet name/description
 * @param volume - Estimated volume level
 * @returns Success status
 */
export async function suggestWhaleWallet(
  address: string,
  name: string,
  volume: "high" | "medium" | "low"
): Promise<boolean> {
  try {
    // Validate address
    const addressRegex = /^0x[a-f0-9]{40}$/i;
    if (!addressRegex.test(address)) {
      throw new Error("Invalid Ethereum address");
    }

    // Check if already exists
    if (whaleWalletRegistry.has(address.toLowerCase())) {
      console.warn("[Whale Registry] Wallet already registered:", address);
      return false;
    }

    // Verify wallet has high transaction volume
    const verified = await verifyWalletVolume(address);
    if (!verified) {
      throw new Error("Wallet does not meet volume threshold");
    }

    // Add to registry
    whaleWalletRegistry.set(address.toLowerCase(), {
      address: address.toLowerCase(),
      name,
      volume,
      priority: whaleWalletRegistry.size + 1,
      discoveredAt: Date.now(),
      lastVerified: Date.now(),
      transactionCount: 0,
    });

    console.log("[Whale Registry] Added new whale wallet:", address);
    return true;
  } catch (error) {
    console.error("[Whale Registry] Failed to add wallet:", error);
    return false;
  }
}

/**
 * Verify wallet has sufficient transaction volume
 */
async function verifyWalletVolume(address: string): Promise<boolean> {
  try {
    // Check transaction count via Blockscout API
    const response = await fetch(
      `https://explorer.dogechain.dog/api?module=account&action=txlist&address=${address}`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const txCount = data.result?.length || 0;

    // Require at least 100 transactions to be considered a "whale"
    return txCount >= 100;
  } catch (error) {
    console.warn("[Whale Registry] Volume verification failed:", error);
    return false;
  }
}

/**
 * Get whale wallet priority for scanning
 */
export function getWhaleScanOrder(): string[] {
  return getWhaleWallets()
    .sort((a, b) => {
      // Prioritize high volume wallets
      const volumeOrder = { high: 3, medium: 2, low: 1 };
      const volumeDiff = volumeOrder[b.volume] - volumeOrder[a.volume];

      if (volumeDiff !== 0) return volumeDiff;

      // Then by priority (lower = higher priority)
      return a.priority - b.priority;
    })
    .map((w) => w.address);
}

// Auto-initialize
if (typeof window !== "undefined") {
  initializeWhaleRegistry();
}
