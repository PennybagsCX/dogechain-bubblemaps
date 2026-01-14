/**
 * Known DEX Factory Contracts on Dogechain
 *
 * This file contains a registry of verified DEX factory contracts deployed on Dogechain.
 * These factories emit PairCreated events that can be monitored to discover liquidity pools.
 *
 * Sources:
 * - ChewySwap (formerly Dogeshrek): https://github.com/ChewySwap/dogeshrek-contracts
 * - QuickSwap: https://docs.quickswap.exchange
 */

export type DEXFactoryType = "UNISWAP_V2" | "PANCAKESWAP" | "SUSHISWAP" | "CUSTOM";

export interface DEXFactory {
  address: string;
  name: string; // e.g., "ChewySwap", "QuickSwap"
  type: DEXFactoryType;
  initCodeHash: string; // Keccak256 hash of bytecode for CREATE2 calculation
  deployBlock: number;
  status: "ACTIVE" | "RENOUNCED" | "UNKNOWN";
  description?: string;
}

/**
 * Known DEX Factory Contracts on Dogechain
 *
 * This list will be expanded as more DEXes are discovered and verified.
 * To add a new factory:
 * 1. Verify the factory address on Dogechain explorer
 * 2. Determine the DEX type (Uniswap V2 fork, etc.)
 * 3. Get the init code hash (from contract verification or known bytecode)
 * 4. Add to this array
 */
export const KNOWN_FACTORIES: DEXFactory[] = [
  {
    address: "0x7C10a3b7EcD42dd7D79C0b9d58dDB812f92B574A",
    name: "ChewySwap",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash (most forks use this)
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0, // TODO: Find actual deployment block
    status: "ACTIVE",
    description: "Formerly Dogeshrek - Uniswap V2 fork on Dogechain",
  },
  {
    address: "0xC3550497E591Ac6ed7a7E03ffC711CfB7412E57F",
    name: "QuickSwap",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0, // TODO: Find actual deployment block
    status: "ACTIVE",
    description: "QuickSwap V2 on Dogechain - 2nd largest DEX by volume (~45% market share)",
  },
  {
    address: "0xf4bc79d32a7defd87c8a9c100fd83206bbf19af5",
    name: "KibbleSwap",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0, // TODO: Find actual deployment block
    status: "ACTIVE",
    description: "First native DEX on Dogechain - discovered via pair contract queries",
  },
  {
    address: "0xd27d9d61590874bf9ee2a19b27e265399929c9c3",
    name: "DogeSwap",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0, // TODO: Find actual deployment block
    status: "ACTIVE",
    description:
      "DogeSwap V1 - LARGEST DEX on Dogechain (~54.6% market share) - discovered via OMNOM/WWDOGE pair",
  },
  {
    address: "0x72ca245B078966578aB45e89067cc1245E3186c0",
    name: "DogeSwap V2",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0,
    status: "ACTIVE",
    description: "DogeSwap V2 - Updated factory contract (user-provided address)",
  },
  {
    address: "0xAaA04462e35f3e40D798331657cA015169e005d7",
    name: "YodeSwap",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0,
    status: "ACTIVE",
    description: "YodeSwap AMM on Dogechain",
  },
  {
    address: "0xc7c86B4f940Ff1C13c736b697e3FbA5a6Bc979F9",
    name: "Wojak Finance",
    type: "UNISWAP_V2",
    // Standard Uniswap V2 init code hash
    initCodeHash: "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5",
    deployBlock: 0,
    status: "ACTIVE",
    description: "Wojak Finance DEX on Dogechain",
  },
  // Additional factories will be added here as they are discovered
  // Priority targets:
  // - ToolSwap - factory address TBD
  // - DegenDex - factory address TBD
];

/**
 * Standard Uniswap V2 PairCreated event signature
 *
 * event PairCreated(address indexed token0, address indexed token1, address pair, uint);
 */
export const PAIR_CREATED_EVENT_SIGNATURE =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

/**
 * Helper function to get factory by address
 */
export function getFactoryByAddress(address: string): DEXFactory | undefined {
  return KNOWN_FACTORIES.find((factory) => factory.address.toLowerCase() === address.toLowerCase());
}

/**
 * Helper function to check if address is a known factory
 */
export function isKnownFactory(address: string): boolean {
  return KNOWN_FACTORIES.some((factory) => factory.address.toLowerCase() === address.toLowerCase());
}

/**
 * Helper function to get all active factories
 */
export function getActiveFactories(): DEXFactory[] {
  return KNOWN_FACTORIES.filter((factory) => factory.status === "ACTIVE");
}

/**
 * Get all factories (static + dynamic)
 * This combines manual KNOWN_FACTORIES with dynamically discovered factories from IndexedDB
 */
export async function getAllFactories(): Promise<DEXFactory[]> {
  try {
    // Load dynamic factories from database
    const { loadDiscoveredFactories } = await import("./db");
    const dynamicFactories = await loadDiscoveredFactories();

    // Convert DbDiscoveredFactory to DEXFactory format
    const converted: DEXFactory[] = dynamicFactories.map((df) => ({
      address: df.address,
      name: df.name,
      type: df.type as DEXFactoryType,
      initCodeHash: df.initCodeHash,
      deployBlock: df.deployBlock,
      status: df.status as "ACTIVE" | "RENOUNCED" | "UNKNOWN",
      description: df.description,
    }));

    // Merge with static KNOWN_FACTORIES (static takes precedence for duplicates)
    const staticAddresses = new Set(KNOWN_FACTORIES.map((f) => f.address.toLowerCase()));
    const uniqueDynamic = converted.filter((f) => !staticAddresses.has(f.address.toLowerCase()));

    return [...KNOWN_FACTORIES, ...uniqueDynamic];
  } catch (error) {
    // Error handled silently

    return KNOWN_FACTORIES;
  }
}

/**
 * Get all active factories (static + dynamic)
 */
export async function getAllActiveFactories(): Promise<DEXFactory[]> {
  const all = await getAllFactories();
  return all.filter((factory) => factory.status === "ACTIVE");
}

/**
 * Add a factory to the runtime registry (does not persist to database)
 * This can be used to manually add discovered factories during runtime
 */
export function addRuntimeFactory(factory: DEXFactory): void {
  KNOWN_FACTORIES.push(factory);
}

/**
 * Check if an address is a known factory (static or dynamic)
 */
export async function isAnyKnownFactory(address: string): Promise<boolean> {
  const allFactories = await getAllFactories();
  return allFactories.some((factory) => factory.address.toLowerCase() === address.toLowerCase());
}

/**
 * Get factory by address (searches both static and dynamic)
 */
export async function getAnyFactoryByAddress(address: string): Promise<DEXFactory | undefined> {
  const allFactories = await getAllFactories();
  return allFactories.find((factory) => factory.address.toLowerCase() === address.toLowerCase());
}
