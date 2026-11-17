/**
 * Known DEX Factory Contracts
 *
 * Registry of verified DEX factory contracts deployed on this chain.
 *
 * **IMPORTANT:** The deployBlock field is set to 0 for newly added factories.
 * This is intentional - the actual deployBlock is discovered by running the
 * factory discovery utility from browser console (see utils/discoverFactories.ts).
 *
 * **To update deployBlock values:**
 * 1. Open app in browser
 * 2. Open DevTools console
 * 3. Run: `await discoverFactoriesWithCheckpoint()`
 * 4. Copy the generated code and update deployBlock values
 *
 * **NOTE:** This is a ONE-TIME manual process per factory, not automatic.
 * The deployBlock field is used by developer tools, not production code.
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
 * Known DEX Factory Contracts
 *
 * This list is expanded as more DEXes are discovered and verified.
 * To add a new factory:
 * 1. Verify the factory address on the DogeOS explorer
 * 2. Determine the DEX type (Uniswap V2 fork, etc.)
 * 3. Get the init code hash (from contract verification or known bytecode)
 * 4. Add to this array
 */
export const KNOWN_FACTORIES: DEXFactory[] = [
  // DogeOS Chikyū testnet has no verified DEX deployments yet, so this registry starts empty.
  // The upstream mainnet factories (ChewySwap/QuickSwap/DogeSwap/YodeSwap/Wojak)
  // do not exist at these addresses on Chikyū — keeping them would have made the LP scanner
  // report "0 pairs" for factories that are not there. Add entries as they are discovered:
  // run `discoverFactoriesWithCheckpoint()` (utils/discoverFactories.ts) in the browser console
  // and paste the generated entries here.
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
  } catch {
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
