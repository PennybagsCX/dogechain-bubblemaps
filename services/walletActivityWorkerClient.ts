/**
 * Wallet Activity Worker Client
 *
 * Provides a Promise-based API for communicating with the Web Worker.
 * Handles worker initialization, message routing, and error handling.
 */

import type {
  Transaction,
  WalletActivity,
  ActivityTimelinePoint,
  FlowPattern,
  TimeRange,
} from "../types";

// =====================================================
// Worker Message Types
// =====================================================

type WorkerMessageType = "BUILD_TIMELINE" | "CALCULATE_FLOWS";

interface WorkerMessage {
  type: WorkerMessageType;
  requestId: string;
  data: {
    transactions: Transaction[];
    timeRange?: TimeRange;
    activities?: Array<{
      walletAddress: string;
      label?: string;
      behaviorType: string;
    }>;
    holderAddresses?: string[];
  };
}

interface WorkerResponse {
  type: WorkerMessageType;
  requestId: string;
  result?: ActivityTimelinePoint[] | FlowPattern[];
  error?: string;
}

// =====================================================
// Worker Client Class
// =====================================================

class WalletActivityWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  private requestIdCounter = 0;

  /**
   * Initialize worker lazily (only when first needed)
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL("../services/walletActivityWorker.ts", import.meta.url), {
          type: "module",
        });

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { requestId, result, error } = event.data;
          const pending = this.pendingRequests.get(requestId);

          if (pending) {
            this.pendingRequests.delete(requestId);
            if (error) {
              pending.reject(new Error(error));
            } else {
              pending.resolve(result);
            }
          }
        };

        this.worker.onerror = (error) => {
          console.error("[WalletActivityWorker] Worker error:", error);
          // Reject all pending requests
          for (const [requestId, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error(`Worker error: ${error.message}`));
            this.pendingRequests.delete(requestId);
          }
        };
      } catch (error) {
        console.error("[WalletActivityWorker] Failed to initialize worker:", error);
        throw new Error("Failed to initialize worker");
      }
    }
    return this.worker;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${this.requestIdCounter++}`;
  }

  /**
   * Send message to worker and wait for response
   */
  private async sendMessage<T>(type: WorkerMessageType, data: WorkerMessage["data"]): Promise<T> {
    const worker = this.ensureWorker();
    const requestId = this.generateRequestId();

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Worker timeout for ${type}`));
      }, 30000); // 30 second timeout

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // Send message to worker
      const message: WorkerMessage = { type, requestId, data };
      worker.postMessage(message);
    });
  }

  /**
   * Build activity timeline using worker
   */
  async buildActivityTimeline(
    transactions: Transaction[],
    timeRange: TimeRange,
    holderAddresses: Set<string>
  ): Promise<ActivityTimelinePoint[]> {
    try {
      return await this.sendMessage<ActivityTimelinePoint[]>("BUILD_TIMELINE", {
        transactions,
        timeRange,
        holderAddresses: Array.from(holderAddresses),
      });
    } catch (error) {
      console.error("[WalletActivityWorker] Timeline build failed:", error);
      throw error;
    }
  }

  /**
   * Calculate flow patterns using worker
   */
  async calculateFlowPatterns(
    activities: WalletActivity[],
    transactions: Transaction[]
  ): Promise<FlowPattern[]> {
    try {
      // Transform activities to worker-compatible format
      const workerActivities = activities.map((a) => ({
        walletAddress: a.walletAddress,
        label: a.label,
        behaviorType: a.behaviorType,
      }));

      return await this.sendMessage<FlowPattern[]>("CALCULATE_FLOWS", {
        transactions,
        activities: workerActivities,
      });
    } catch (error) {
      console.error("[WalletActivityWorker] Flow calculation failed:", error);
      throw error;
    }
  }

  /**
   * Terminate worker and clean up resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// =====================================================
// Singleton Instance
// =====================================================

let workerClientInstance: WalletActivityWorkerClient | null = null;

/**
 * Get or create the worker client singleton
 */
export function getWalletActivityWorkerClient(): WalletActivityWorkerClient {
  if (!workerClientInstance) {
    workerClientInstance = new WalletActivityWorkerClient();
  }
  return workerClientInstance;
}

/**
 * Terminate the worker client singleton
 */
export function terminateWalletActivityWorkerClient(): void {
  if (workerClientInstance) {
    workerClientInstance.terminate();
    workerClientInstance = null;
  }
}

// Export class for testing
export { WalletActivityWorkerClient };
