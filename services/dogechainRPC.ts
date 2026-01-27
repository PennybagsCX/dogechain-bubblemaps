import { createPublicClient, http } from "viem";
import type { Client } from "viem";

const RPC_ENDPOINTS = [
  "https://rpc.dogechain.dog",
  "https://rpc-us.dogechain.dog",
  "https://rpc-sg.dogechain.dog",
];

// Dogechain chain configuration
const dogechain = {
  id: 2000,
  name: "Dogechain",
  nativeCurrency: { name: "DOGE", symbol: "DOGE", decimals: 18 },
  rpcUrls: {
    public: { http: ["https://rpc.dogechain.dog"] },
    default: { http: ["https://rpc.dogechain.dog"] },
  },
  blockExplorers: {
    default: { name: "DogeScan", url: "https://dogechain.dog" },
  },
} as const;

/**
 * Token metadata interface
 */
export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Known token metadata fallback list
 * Sourced from dataService.ts BOOTSTRAP_TOKENS
 */
const KNOWN_TOKENS: Record<string, Omit<TokenMetadata, "address">> = {
  "0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d": {
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
  },
  "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101": {
    name: "Wrapped DOGE",
    symbol: "wDOGE",
    decimals: 18,
  },
  "0x7b4328c127b85369d9f82ca0503b000d09cf9180": {
    name: "Dogechain",
    symbol: "DC",
    decimals: 18,
  },
  "0xd38b22794b308a2e55808a13d1e6a80c4be94fd5": {
    name: "RealDogePunks",
    symbol: "DPunks",
    decimals: 0,
  },
};

/**
 * ERC20 ABI snippets for metadata retrieval
 */
const ERC20_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export interface TransferEvent {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  tokenAddress: string;
}

export interface WalletTransaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  blockNumber: bigint;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export interface WalletTransactionOptions {
  fromBlock?: bigint;
  toBlock?: bigint;
  maxResults?: number;
  includeNativeTransfers?: boolean;
}

export interface BlockRange {
  from: bigint;
  to: bigint;
  size: bigint;
}

interface BlockCacheEntry {
  block: any;
  timestamp: number;
}

interface FetchBlockRangeOptions {
  batchSize?: number;
  includeTransactions?: boolean;
}

export class DogechainRPCClient {
  private clients: Array<Client<any> & Record<string, any>>;
  private currentProvider: number = 0;
  private maxRetries: number = 3;
  private blockCache: Map<bigint, BlockCacheEntry> = new Map();
  private readonly CACHE_TTL: number = 30000; // 30 seconds in milliseconds

  // Token metadata cache - persists for the lifetime of the client
  private tokenMetadataCache: Map<string, TokenMetadata> = new Map();

  constructor() {
    this.clients = RPC_ENDPOINTS.map((url) =>
      createPublicClient({
        chain: dogechain,
        transport: http(url, {
          retryCount: 2,
          timeout: 10_000,
        }),
      })
    );

    // Initialize cache with known tokens
    this.initializeKnownTokens();
  }

  /**
   * Initialize token metadata cache with known tokens
   */
  private initializeKnownTokens(): void {
    for (const [address, metadata] of Object.entries(KNOWN_TOKENS)) {
      this.tokenMetadataCache.set(address.toLowerCase(), {
        address,
        ...metadata,
      });
    }
  }

  /**
   * Get current provider with automatic failover
   */
  private getClient() {
    return this.clients[this.currentProvider];
  }

  /**
   * Switch to next provider in round-robin fashion
   */
  private switchProvider(): void {
    this.currentProvider = (this.currentProvider + 1) % this.clients.length;
  }

  /**
   * Execute a provider operation with retry logic and provider switching
   */
  private async executeWithRetry<T>(operation: (client: any) => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const client = this.getClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `RPC attempt ${attempt + 1} failed (provider ${this.currentProvider}):`,
          lastError.message
        );

        // Switch to next provider for retry
        this.switchProvider();
      }
    }

    throw new Error(
      `RPC operation failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }

  /**
   * Get the latest block information
   */
  async getLatestBlock(): Promise<{ number: bigint; timestamp: number }> {
    return this.executeWithRetry(async (client) => {
      const block = await client.getBlock({
        includeTransactions: false,
      });

      if (!block) {
        throw new Error("Unable to fetch latest block");
      }

      return {
        number: block.number,
        // CRITICAL FIX: Convert RPC timestamp (seconds) to milliseconds for JavaScript compatibility
        timestamp: Number(block.timestamp) * 1000,
      };
    });
  }

  /**
   * Get the latest block number
   */
  async getLatestBlockNumber(): Promise<bigint> {
    return this.executeWithRetry(async (client) => {
      const blockNumber = await client.getBlockNumber();
      return blockNumber;
    });
  }

  /**
   * Estimate the number of blocks for a given timeframe in minutes
   * Dogechain block time is approximately 2-3 seconds (using 2.5s for calculations)
   */
  estimateBlocksForTimeframe(minutes: number): number {
    const blockTimeInSeconds = 2.5;
    const seconds = minutes * 60;
    return Math.ceil(seconds / blockTimeInSeconds);
  }

  /**
   * Fetch a range of blocks efficiently in batches
   */
  async fetchBlockRange(
    start: bigint,
    end: bigint,
    options: FetchBlockRangeOptions = {}
  ): Promise<any[]> {
    const { batchSize = 10, includeTransactions = false } = options;

    // Validate block range
    if (start > end) {
      throw new Error(`Invalid block range: start (${start}) cannot be greater than end (${end})`);
    }

    const totalBlocks = Number(end - start) + 1;
    const blocks: any[] = [];

    // Clean expired cache entries before proceeding
    this.cleanExpiredCache();

    // Process blocks in batches
    for (let i = 0; i < totalBlocks; i += batchSize) {
      const batchStart = i;
      const batchEnd = Math.min(i + batchSize, totalBlocks);

      // Fetch batch in parallel
      const batchPromises: Promise<any>[] = [];

      for (let j = batchStart; j < batchEnd; j++) {
        const blockNumber = start + BigInt(j);

        // Check cache first
        const cachedEntry = this.blockCache.get(blockNumber);
        const now = Date.now();

        if (cachedEntry && now - cachedEntry.timestamp < this.CACHE_TTL) {
          // Use cached block
          batchPromises.push(Promise.resolve(cachedEntry.block));
        } else {
          // Fetch from RPC
          batchPromises.push(
            this.executeWithRetry(async (client) => {
              const block = await client.getBlock({
                blockNumber,
                includeTransactions,
              });

              if (!block) {
                throw new Error(`Unable to fetch block ${blockNumber}`);
              }

              // Cache the block
              this.blockCache.set(blockNumber, {
                block,
                timestamp: now,
              });

              return block;
            })
          );
        }
      }

      // Wait for all blocks in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      blocks.push(...batchResults);
    }

    return blocks;
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const entriesToDelete: bigint[] = [];

    for (const [blockNumber, entry] of this.blockCache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        entriesToDelete.push(blockNumber);
      }
    }

    for (const blockNumber of entriesToDelete) {
      this.blockCache.delete(blockNumber);
    }
  }

  /**
   * Clear the block cache (useful for testing or forced refresh)
   */
  clearBlockCache(): void {
    this.blockCache.clear();
  }

  /**
   * Get token metadata with caching
   * @param tokenAddress The token contract address
   * @returns Token metadata or defaults if not found
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Check cache first
    const cached = this.tokenMetadataCache.get(normalizedAddress);
    if (cached) {
      return cached;
    }

    // Check known tokens
    const knownToken = KNOWN_TOKENS[normalizedAddress];
    if (knownToken) {
      const metadata = {
        address: tokenAddress,
        ...knownToken,
      };
      this.tokenMetadataCache.set(normalizedAddress, metadata);
      return metadata;
    }

    // Fetch from RPC
    return this.executeWithRetry(async (client) => {
      try {
        // Fetch name, symbol, and decimals in parallel
        const [name, symbol, decimals] = await Promise.all([
          client
            .readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "name",
            })
            .catch(() => "Unknown Token"),
          client
            .readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "symbol",
            })
            .catch(() => "UNKNOWN"),
          client
            .readContract({
              address: tokenAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "decimals",
            })
            .catch(() => 18), // Default to 18 decimals
        ]);

        const metadata: TokenMetadata = {
          address: tokenAddress,
          name: name as string,
          symbol: symbol as string,
          decimals: decimals as number,
        };

        // Cache the result
        this.tokenMetadataCache.set(normalizedAddress, metadata);

        return metadata;
      } catch (error) {
        console.warn(`Failed to fetch metadata for ${tokenAddress}:`, error);

        // Return default metadata on error
        const defaultMetadata: TokenMetadata = {
          address: tokenAddress,
          name: "Unknown Token",
          symbol: "UNKNOWN",
          decimals: 18,
        };

        // Cache the default to avoid repeated failures
        this.tokenMetadataCache.set(normalizedAddress, defaultMetadata);

        return defaultMetadata;
      }
    });
  }

  /**
   * Get metadata for multiple tokens in batch
   * More efficient than calling getTokenMetadata multiple times
   * @param tokenAddresses Array of token contract addresses
   * @returns Map of token address to metadata
   */
  async getBatchTokenMetadata(tokenAddresses: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    const addressesToFetch: string[] = [];

    // First pass: check cache and known tokens
    for (const address of tokenAddresses) {
      const normalizedAddress = address.toLowerCase();

      // Check cache
      const cached = this.tokenMetadataCache.get(normalizedAddress);
      if (cached) {
        results.set(address, cached);
        continue;
      }

      // Check known tokens
      const knownToken = KNOWN_TOKENS[normalizedAddress];
      if (knownToken) {
        const metadata = {
          address,
          ...knownToken,
        };
        this.tokenMetadataCache.set(normalizedAddress, metadata);
        results.set(address, metadata);
        continue;
      }

      // Mark for fetching
      addressesToFetch.push(address);
    }

    // Batch fetch uncached tokens
    if (addressesToFetch.length > 0) {
      await this.executeWithRetry(async (client) => {
        // Fetch all uncached tokens in parallel
        const metadataPromises = addressesToFetch.map(async (address) => {
          try {
            const [name, symbol, decimals] = await Promise.all([
              client
                .readContract({
                  address: address as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: "name",
                })
                .catch(() => "Unknown Token"),
              client
                .readContract({
                  address: address as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: "symbol",
                })
                .catch(() => "UNKNOWN"),
              client
                .readContract({
                  address: address as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: "decimals",
                })
                .catch(() => 18),
            ]);

            const metadata: TokenMetadata = {
              address,
              name: name as string,
              symbol: symbol as string,
              decimals: decimals as number,
            };

            // Cache the result
            this.tokenMetadataCache.set(address.toLowerCase(), metadata);

            return { address, metadata };
          } catch (error) {
            console.warn(`Failed to fetch metadata for ${address}:`, error);

            // Return default metadata on error
            const defaultMetadata: TokenMetadata = {
              address,
              name: "Unknown Token",
              symbol: "UNKNOWN",
              decimals: 18,
            };

            // Cache the default to avoid repeated failures
            this.tokenMetadataCache.set(address.toLowerCase(), defaultMetadata);

            return { address, metadata: defaultMetadata };
          }
        });

        const fetchedResults = await Promise.all(metadataPromises);

        for (const { address, metadata } of fetchedResults) {
          results.set(address, metadata);
        }
      });
    }

    return results;
  }

  /**
   * Get cached token metadata without RPC call
   * @param tokenAddress The token contract address
   * @returns Cached metadata or undefined if not in cache
   */
  getCachedTokenMetadata(tokenAddress: string): TokenMetadata | undefined {
    return this.tokenMetadataCache.get(tokenAddress.toLowerCase());
  }

  /**
   * Clear token metadata cache (useful for testing or forced refresh)
   */
  clearTokenMetadataCache(): void {
    this.tokenMetadataCache.clear();
    this.initializeKnownTokens();
  }

  /**
   * Get token cache statistics
   */
  getTokenCacheStats(): { size: number; knownTokens: number } {
    return {
      size: this.tokenMetadataCache.size,
      knownTokens: Object.keys(KNOWN_TOKENS).length,
    };
  }

  /**
   * Get transfer events for a token contract within a block range
   */
  async getTransferEvents(
    tokenAddress: string,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<TransferEvent[]> {
    // Validate address format
    if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }

    if (fromBlock > toBlock) {
      throw new Error(
        `Invalid block range: fromBlock (${fromBlock}) cannot be greater than toBlock (${toBlock})`
      );
    }

    return this.executeWithRetry(async (client) => {
      // Transfer(address indexed from, address indexed to, uint256 value)
      const transferEventSignature =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      const logs = await client.getLogs({
        address: tokenAddress as `0x${string}`,
        fromBlock,
        toBlock,
      });

      // Filter logs for Transfer events only
      const transferLogs = logs.filter((log: any) => log.topics[0] === transferEventSignature);

      // Parse logs and fetch timestamps
      const results: TransferEvent[] = [];
      const blockCache = new Map<bigint, number>();

      for (const log of transferLogs) {
        // Use cached block timestamp if available
        let timestamp = blockCache.get(log.blockNumber);

        if (timestamp === undefined) {
          const block = await client.getBlock({
            blockNumber: log.blockNumber,
            includeTransactions: false,
          });

          if (!block) {
            console.warn(`Unable to fetch block ${log.blockNumber}, skipping log`);
            continue;
          }
          // CRITICAL FIX: Convert RPC timestamp (seconds) to milliseconds for JavaScript compatibility
          timestamp = Number(block.timestamp) * 1000;
          blockCache.set(log.blockNumber, timestamp);
        }

        // Parse indexed parameters from topics
        // topics[1] = from address (indexed, padded to 32 bytes)
        // topics[2] = to address (indexed, padded to 32 bytes)
        const from = `0x${log.topics[1]?.slice(26) || "0".repeat(40)}`;
        const to = `0x${log.topics[2]?.slice(26) || "0".repeat(40)}`;

        results.push({
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          from,
          to,
          value: BigInt(log.data || "0"),
          timestamp,
          tokenAddress: log.address,
        });
      }

      return results;
    });
  }

  /**
   * Get wallet transactions within a block range
   * Fetches full blocks and filters for transactions involving the wallet
   * This captures ALL transaction types: swaps, transfers, approvals, etc.
   */
  async getWalletTransactions(
    walletAddress: string,
    options: WalletTransactionOptions = {}
  ): Promise<WalletTransaction[]> {
    // Validate wallet address
    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    const { fromBlock, toBlock, maxResults = 1000 } = options;

    // Determine block range
    let actualFromBlock = fromBlock;
    let actualToBlock = toBlock;

    if (!actualFromBlock || !actualToBlock) {
      // If no block range specified, use last 1000 blocks (approximately 40 minutes)
      const latestBlock = await this.getLatestBlockNumber();
      actualToBlock = latestBlock;

      if (!actualFromBlock) {
        // Default to last 1000 blocks
        actualFromBlock = actualToBlock - BigInt(1000);
        if (actualFromBlock < 0n) actualFromBlock = 0n;
      }
    }

    // Validate block range
    if (actualFromBlock > actualToBlock) {
      throw new Error(
        `Invalid block range: fromBlock (${actualFromBlock}) cannot be greater than toBlock (${actualToBlock})`
      );
    }

    const rangeSize = actualToBlock - actualFromBlock;
    if (rangeSize > BigInt(10000)) {
      console.warn(
        `[getWalletTransactions] Large block range detected (${rangeSize} blocks). Consider using smaller ranges for better performance.`
      );
    }

    return this.executeWithRetry(async (client) => {
      const normalizedWallet = walletAddress.toLowerCase();
      const results: WalletTransaction[] = [];

      // Fetch blocks in range (batch by 50 blocks to balance speed and RPC limits)
      const batchSize = 50n;
      let currentBlock = actualFromBlock;
      let totalFetched = 0;

      while (currentBlock <= actualToBlock && totalFetched < maxResults) {
        const endBlock =
          currentBlock + batchSize - 1n > actualToBlock
            ? actualToBlock
            : currentBlock + batchSize - 1n;

        console.log(`[getWalletTransactions] Fetching blocks ${currentBlock} to ${endBlock}`);

        // Fetch block numbers
        const blockNumbers: bigint[] = [];
        for (let b = currentBlock; b <= endBlock; b++) {
          blockNumbers.push(b);
        }

        // Fetch all blocks in parallel with concurrency limit
        const concurrencyLimit = 10;
        const blocks: (any | null)[] = [];

        for (let i = 0; i < blockNumbers.length; i += concurrencyLimit) {
          const batch = blockNumbers.slice(i, i + concurrencyLimit);
          const batchResults = await Promise.all(
            batch.map((blockNumber) =>
              client.getBlock({ blockNumber, includeTransactions: true }).catch(() => null)
            )
          );
          blocks.push(...batchResults);
        }

        // Process each block
        for (const block of blocks) {
          if (!block) continue;

          // Skip blocks without transactions
          if (!block.transactions || block.transactions.length === 0) continue;

          // Filter transactions involving our wallet
          for (const tx of block.transactions) {
            if (totalFetched >= maxResults) break;

            // Check if wallet is involved in this transaction
            const walletInvolved =
              tx.from?.toLowerCase() === normalizedWallet ||
              tx.to?.toLowerCase() === normalizedWallet;

            if (!walletInvolved) continue;

            // For transaction to/from a contract, check logs for Transfer events
            // to determine the token address and value
            let tokenAddress: string | undefined;
            let value: bigint = 0n;

            if (tx.to && tx.to.toLowerCase() !== normalizedWallet) {
              // Transaction TO a contract - check logs for Transfer events
              try {
                const receipt = await client.getTransactionReceipt({
                  hash: tx.hash,
                });

                if (receipt && receipt.logs) {
                  // Find Transfer events involving our wallet
                  const transferEventSignature =
                    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

                  const transferLog = receipt.logs.find((log: any) => {
                    if (log.topics[0] !== transferEventSignature) return false;
                    const fromAddress = (log.topics[1] || "").slice(26).toLowerCase();
                    const toAddress = (log.topics[2] || "").slice(26).toLowerCase();
                    return fromAddress === normalizedWallet || toAddress === normalizedWallet;
                  });

                  if (transferLog) {
                    tokenAddress = transferLog.address;
                    value = BigInt(transferLog.data || "0");
                  }
                }
              } catch (error) {
                // If receipt fetch fails, continue without token details
                console.warn(`Failed to fetch receipt for ${tx.hash}:`, error);
              }
            }

            results.push({
              hash: tx.hash,
              from: tx.from || "0x0",
              to: tx.to || "0x0",
              value,
              // CRITICAL FIX: Convert RPC timestamp (seconds) to milliseconds for JavaScript compatibility
              timestamp: Number(block.timestamp) * 1000,
              blockNumber: block.number,
              tokenAddress: tokenAddress || "0x0",
            });

            totalFetched++;
          }
        }

        currentBlock = endBlock + 1n;
      }

      console.log(`[getWalletTransactions] Found ${results.length} transactions for wallet`);

      // Sort by timestamp (most recent first)
      results.sort((a, b) => b.timestamp - a.timestamp);

      return results;
    });
  }

  /**
   * Get wallet transactions for a specific token within a block range
   */
  async getWalletTokenTransactions(
    walletAddress: string,
    tokenAddress: string,
    options: Omit<WalletTransactionOptions, "includeNativeTransfers"> = {}
  ): Promise<WalletTransaction[]> {
    // Validate addresses
    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }

    const { fromBlock, toBlock, maxResults = 1000 } = options;

    // Determine block range
    let actualFromBlock = fromBlock;
    let actualToBlock = toBlock;

    if (!actualFromBlock || !actualToBlock) {
      // If no block range specified, use last 1000 blocks
      const latestBlock = await this.getLatestBlockNumber();
      actualToBlock = latestBlock;

      if (!actualFromBlock) {
        actualFromBlock = actualToBlock - BigInt(1000);
        if (actualFromBlock < 0n) actualFromBlock = 0n;
      }
    }

    // Validate block range
    if (actualFromBlock > actualToBlock) {
      throw new Error(
        `Invalid block range: fromBlock (${actualFromBlock}) cannot be greater than toBlock (${actualToBlock})`
      );
    }

    return this.executeWithRetry(async (client) => {
      // Transfer(address indexed from, address indexed to, uint256 value)
      const transferEventSignature =
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

      // Normalize wallet address for comparison
      const normalizedWallet = walletAddress.toLowerCase();

      // Get logs for specific token address
      const logs = await client.getLogs({
        address: tokenAddress as `0x${string}`,
        fromBlock: actualFromBlock,
        toBlock: actualToBlock,
      });

      // Filter for Transfer events involving our wallet
      const walletTransferLogs = logs.filter((log: any) => {
        // Must be Transfer event
        if (log.topics[0] !== transferEventSignature) return false;

        // Check if wallet is involved
        const fromAddress = (log.topics[1] || "").slice(26).toLowerCase();
        const toAddress = (log.topics[2] || "").slice(26).toLowerCase();

        return fromAddress === normalizedWallet || toAddress === normalizedWallet;
      });

      // Limit results if needed
      const limitedLogs = walletTransferLogs.slice(0, maxResults);

      // Parse logs and fetch timestamps
      const results: WalletTransaction[] = [];
      const blockCache = new Map<bigint, number>();

      for (const log of limitedLogs) {
        // Use cached block timestamp if available
        let timestamp = blockCache.get(log.blockNumber);

        if (timestamp === undefined) {
          try {
            const block = await client.getBlock({
              blockNumber: log.blockNumber,
              includeTransactions: false,
            });

            if (!block) {
              console.warn(`Unable to fetch block ${log.blockNumber}, skipping log`);
              continue;
            }
            // CRITICAL FIX: Convert RPC timestamp (seconds) to milliseconds for JavaScript compatibility
            timestamp = Number(block.timestamp) * 1000;
            blockCache.set(log.blockNumber, timestamp);
          } catch (error) {
            console.warn(`Error fetching block ${log.blockNumber}:`, error);
            continue;
          }
        }

        // Parse indexed parameters from topics
        const from = `0x${(log.topics[1] || "0".repeat(64)).slice(26)}`;
        const to = `0x${(log.topics[2] || "0".repeat(64)).slice(26)}`;

        results.push({
          hash: log.transactionHash,
          from,
          to,
          value: BigInt(log.data || "0"),
          timestamp,
          blockNumber: log.blockNumber,
          tokenAddress: log.address,
        });
      }

      // Sort by block number (descending)
      results.sort((a, b) => Number(b.blockNumber - a.blockNumber));

      return results;
    });
  }

  /**
   * Parse token transfer information from logs
   * Helper method to extract structured data from raw event logs
   */
  parseTokenTransfer(log: any): WalletTransaction | null {
    // Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    // Check if it's a Transfer event
    if (!log.topics || log.topics[0] !== transferEventSignature) {
      return null;
    }

    try {
      // Parse indexed parameters from topics
      const from = `0x${(log.topics[1] || "0".repeat(64)).slice(26)}`;
      const to = `0x${(log.topics[2] || "0".repeat(64)).slice(26)}`;

      return {
        hash: log.transactionHash,
        from,
        to,
        value: BigInt(log.data || "0"),
        timestamp: 0, // Caller should fetch timestamp separately
        blockNumber: log.blockNumber,
        tokenAddress: log.address,
      };
    } catch (error) {
      console.warn(`[parseTokenTransfer] Error parsing log:`, error);
      return null;
    }
  }

  /**
   * Calculate optimal block range for fetching transactions
   * Helps avoid RPC timeouts with large ranges
   */
  calculateOptimalBlockRange(fromBlock: bigint, toBlock: bigint): BlockRange[] {
    const MAX_RANGE_SIZE = BigInt(5000); // Maximum 5000 blocks per request
    const ranges: BlockRange[] = [];

    let currentFrom = fromBlock;

    while (currentFrom <= toBlock) {
      let rangeEnd = currentFrom + MAX_RANGE_SIZE - 1n;
      if (rangeEnd > toBlock) {
        rangeEnd = toBlock;
      }

      ranges.push({
        from: currentFrom,
        to: rangeEnd,
        size: rangeEnd - currentFrom + 1n,
      });

      currentFrom = rangeEnd + 1n;
    }

    return ranges;
  }

  /**
   * Get current provider index (useful for monitoring)
   */
  getCurrentProviderIndex(): number {
    return this.currentProvider;
  }

  /**
   * Get list of all RPC endpoints
   */
  getRPCEndpoints(): string[] {
    return [...RPC_ENDPOINTS];
  }
}
