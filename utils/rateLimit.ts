/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Rate limiting utilities for API calls
 * Prevents API abuse and implements proper throttling
 */

interface RateLimitConfig {
  maxRequests: number; // Maximum number of requests
  windowMs: number; // Time window in milliseconds
}

export interface RequestQueue {
  timestamp: number;
  promise: Promise<unknown>;
}

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request can be made based on rate limits
   */
  private canMakeRequest(): boolean {
    const now = Date.now();

    // Remove timestamps outside the current window
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.config.windowMs);

    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(): void {
    this.requests.push(Date.now());
  }

  /**
   * Wait until a request can be made
   */
  private async waitForSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + this.config.windowMs - Date.now() + 1;

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    this.recordRequest();
    return fn();
  }

  /**
   * Get current usage statistics
   */
  getStats(): { used: number; remaining: number; resetTime: number } {
    const now = Date.now();
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.config.windowMs);

    const oldestRequest = this.requests.length > 0 ? Math.min(...this.requests) : now;
    const resetTime = oldestRequest + this.config.windowMs;

    return {
      used: this.requests.length,
      remaining: Math.max(0, this.config.maxRequests - this.requests.length),
      resetTime,
    };
  }

  /**
   * Reset rate limiter (for testing)
   */
  reset(): void {
    this.requests = [];
  }
}

/**
 * Token bucket rate limiter for more advanced throttling
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private config: {
    maxTokens: number;
    refillRate: number; // Tokens per second
    refillInterval: number; // Milliseconds
  };

  constructor(maxTokens: number, refillRate: number) {
    this.config = {
      maxTokens,
      refillRate,
      refillInterval: 1000 / refillRate, // ms per token
    };
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.config.refillInterval);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Try to consume a token
   */
  async tryConsume(): Promise<boolean> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    // Calculate wait time for next token
    const waitTime = this.config.refillInterval;
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    return this.tryConsume();
  }

  /**
   * Execute a function with token bucket rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.tryConsume();
    return fn();
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Default rate limiters for different API endpoints
 */

// Dogechain Explorer API - 60 requests per minute
export const dogechainApiLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
});

// More aggressive rate limiting for token holder fetching
export const tokenHoldersLimiter = new TokenBucket(10, 2); // 10 tokens, 2 per second

// General API rate limiter
export const generalApiLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
});

/**
 * Fetch with rate limiting and retry logic
 */
export const fetchWithRateLimit = async (
  url: string,
  options?: RequestInit,
  limiter?: RateLimiter | TokenBucket
): Promise<Response> => {
  const executeFetch = async (): Promise<Response> => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options?.headers,
      },
    });

    // Handle rate limiting from server (429 Too Many Requests)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Retry once after waiting
      return fetch(url, options);
    }

    return response;
  };

  // Use provided limiter or default
  if (limiter) {
    return limiter.execute(executeFetch) as Promise<Response>;
  }

  return executeFetch();
};

/**
 * Retry logic with exponential backoff
 */
export const fetchWithRetry = async (
  fn: () => Promise<Response>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();

      // Don't retry on client errors (4xx) except 429
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Success or server error - return response
      if (response.ok || response.status < 500) {
        return response;
      }

      // Server error - retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      // Network error - retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);

        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
};

/**
 * Adaptive Request Scheduler
 * Dynamically adjusts delays based on rate limit responses
 */
export class AdaptiveRequestScheduler {
  private queue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private minDelay = 2000; // 2 seconds base delay
  private rateLimitDetected = false;
  private consecutive429s = 0;

  async schedule<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          // Reset 429 counter on success
          this.consecutive429s = 0;
          resolve(result);
        } catch (error: any) {
          // Track 429 errors
          if (error.status === 429) {
            this.rateLimitDetected = true;
            this.consecutive429s++;
          }
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Adaptive delay based on rate limit history
      let delay = this.minDelay;

      if (this.rateLimitDetected) {
        // Triple delay for each consecutive 429
        delay = this.minDelay * Math.pow(3, Math.min(this.consecutive429s, 3));
      }

      const waitTime = Math.max(delay - timeSinceLastRequest, 500);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const request = this.queue.shift();
      if (!request) break;

      try {
        await request();
        this.lastRequestTime = Date.now();
      } catch (error: any) {
        if (error.status === 429) {
          // Wait 60 seconds and retry

          await new Promise((resolve) => setTimeout(resolve, 60000));

          // Re-queue the failed request
          this.queue.unshift(request);
        }
      }
    }

    this.isProcessing = false;
  }

  reset() {
    this.queue = [];
    this.rateLimitDetected = false;
    this.consecutive429s = 0;
  }
}

/**
 * Priority levels for request queue
 */
export enum RequestPriority {
  HIGH = 0, // User actions
  MEDIUM = 1, // Active scan
  LOW = 2, // Background tasks
}

/**
 * Priority Request Queue
 * Processes requests based on priority levels
 */
export class PriorityRequestQueue {
  private queues: Map<RequestPriority, Array<() => Promise<any>>> = new Map();
  private isProcessing = false;

  constructor() {
    // Initialize queues
    this.queues.set(RequestPriority.HIGH, []);
    this.queues.set(RequestPriority.MEDIUM, []);
    this.queues.set(RequestPriority.LOW, []);
  }

  enqueue<T>(fn: () => Promise<T>, priority: RequestPriority): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrapped = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      const queue = this.queues.get(priority);
      if (queue) {
        queue.push(wrapped);
      }

      this.process();
    });
  }

  private async process() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    // Process queues in priority order
    for (const priority of [RequestPriority.HIGH, RequestPriority.MEDIUM, RequestPriority.LOW]) {
      const queue = this.queues.get(priority);
      while (queue && queue.length > 0) {
        const request = queue.shift();
        if (!request) continue;

        try {
          await request();
        } catch (error) {
          // Error handled silently
        }
      }
    }

    this.isProcessing = false;
  }

  clear() {
    this.queues.forEach((queue) => (queue.length = 0));
  }
}
