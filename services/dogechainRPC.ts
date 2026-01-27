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

export interface TransferEvent {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  value: bigint;
  timestamp: number;
  tokenAddress: string;
}

export class DogechainRPCClient {
  private clients: Array<Client<any> & Record<string, any>>;
  private currentProvider: number = 0;
  private maxRetries: number = 3;

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
        timestamp: Number(block.timestamp),
      };
    });
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
          timestamp = Number(block.timestamp);
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
