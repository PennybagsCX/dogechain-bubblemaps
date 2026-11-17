/**
 * Whale Wallet Registry
 *
 * Manages registry of high-volume wallets for token discovery.
 * Scans whale wallets to find tokens they interact with.
 */

// Registry for community-suggested wallets
export interface WhaleWalletEntry {
  address: string;
  name: string;
  volume: "high" | "medium" | "low";
  priority: number;
  discoveredAt: number;
  lastVerified: number;
  transactionCount: number;
}

// Known whale wallets on DogeOS Chikyū.
// Empty by design: the upstream mainnet whales (bridge, multisig, DC token) are
// different accounts on this chain, and labelling arbitrary Chikyū addresses as "whales"
// would be invented data. Populate from observed activity once the testnet has volume.
export const WHALE_WALLETS: WhaleWalletEntry[] = [];

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
}

/**
 * Get all whale wallet addresses
 */
export function getWhaleWalletAddresses(): string[] {
  return Array.from(whaleWalletRegistry.keys());
}

/**
 * Get whale wallet entry
 */
export function getWhaleWallet(address: string): WhaleWalletEntry | undefined {
  return whaleWalletRegistry.get(address.toLowerCase());
}

/**
 * Add community-suggested wallet
 */
export function addWhaleWallet(
  entry: Omit<WhaleWalletEntry, "discoveredAt" | "lastVerified" | "transactionCount">
): void {
  whaleWalletRegistry.set(entry.address.toLowerCase(), {
    ...entry,
    discoveredAt: Date.now(),
    lastVerified: Date.now(),
    transactionCount: 0,
  });
}

/**
 * Update whale wallet stats
 */
export function updateWhaleWallet(address: string, transactionCount: number): void {
  const entry = whaleWalletRegistry.get(address.toLowerCase());
  if (entry) {
    entry.lastVerified = Date.now();
    entry.transactionCount += transactionCount;
  }
}
