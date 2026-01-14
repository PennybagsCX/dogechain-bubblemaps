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

// Known whale wallets on Dogechain
export const WHALE_WALLETS: WhaleWalletEntry[] = [
  {
    address: "0x66aB144DEE239bb9FE2fB6FA28672611A2C0D854", // Dogechain Bridge
    name: "Dogechain Bridge",
    volume: "high",
    priority: 1,
    discoveredAt: 0,
    lastVerified: 0,
    transactionCount: 0,
  },
  {
    address: "0xf93cE2EeF8a97e6D9c0d39bb9cEbA8bbDbAa4570", // Dogechain Token
    name: "Dogechain Token Contract",
    volume: "high",
    priority: 2,
    discoveredAt: 0,
    lastVerified: 0,
    transactionCount: 0,
  },
  {
    address: "0xd7eF39F971F5199EB3661F1C6947EA27d6D173c5", // Multisig
    name: "Multi-sig Wallet",
    volume: "medium",
    priority: 3,
    discoveredAt: 0,
    lastVerified: 0,
    transactionCount: 0,
  },
];

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
