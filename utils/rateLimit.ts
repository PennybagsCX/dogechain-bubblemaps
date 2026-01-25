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
 * Handles 429 errors with exponential backoff and jitter
 */
export const fetchWithRateLimit = async (
  url: string,
  options?: RequestInit,
  limiter?: RateLimiter | TokenBucket
): Promise<Response> => {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1 second base delay
  const MAX_DELAY = 30000; // 30 second max delay

  const executeFetch = async (): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            Accept: "application/json",
            ...options?.headers,
          },
        });

        // Success - return response
        if (response.status !== 429) {
          return response;
        }

        // Handle rate limiting from server (429 Too Many Requests)
        const retryAfter = response.headers.get("Retry-After");
        let waitTime: number;

        if (retryAfter) {
          // Use server-provided Retry-After header
          waitTime = parseInt(retryAfter) * 1000;
        } else {
          // Use exponential backoff with jitter
          const exponentialDelay = BASE_DELAY * Math.pow(2, attempt);
          // Add jitter (±25% of delay) to avoid thundering herd
          const jitter = Math.random() * 0.5 - 0.25; // ±25%
          waitTime = exponentialDelay * (1 + jitter);
        }

        // Cap the delay
        waitTime = Math.min(waitTime, MAX_DELAY);

        // Log the retry attempt with context
        const urlShort = url.length > 100 ? url.substring(0, 100) + "..." : url;
        console.warn(
          `[RateLimit] ⚠️ 429 Too Many Requests - Attempt ${attempt + 1}/${MAX_RETRIES + 1} for ${urlShort}. Retrying in ${Math.round(waitTime / 1000)}s...`
        );

        // If this was the last attempt, throw an error
        if (attempt === MAX_RETRIES) {
          const error = new Error(
            `Rate limit exceeded after ${MAX_RETRIES} retries. Please try again later.`
          );
          (error as any).status = 429;
          (error as any).url = url;
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Continue to next attempt
        lastError = new Error(`Rate limit (429) on attempt ${attempt + 1}`);
        (lastError as any).status = 429;
        (lastError as any).url = url;
      } catch (err) {
        // Network error or other fetch error
        if (attempt === MAX_RETRIES) {
          throw err;
        }

        // Log network error and retry
        const urlShort = url.length > 100 ? url.substring(0, 100) + "..." : url;
        console.error(
          `[RateLimit] ❌ Network error on attempt ${attempt + 1}/${MAX_RETRIES + 1} for ${urlShort}:`,
          err
        );

        // Exponential backoff for network errors too
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error("Unknown error in fetchWithRateLimit");
  };

  // Use provided limiter or default
  if (limiter) {
    return limiter.execute(executeFetch) as Promise<Response>;
  }

  return executeFetch();
};

/**
 * Retry logic with exponential backoff
 * Handles 429 errors gracefully with proper retry strategy
 */
export const fetchWithRetry = async (
  fn: () => Promise<Response>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> => {
  const MAX_DELAY = 30000; // 30 second max delay

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

      // Server error (5xx) or 429 - retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), MAX_DELAY);
        // Add jitter (±25%) to avoid thundering herd
        const jitter = 1 + (Math.random() * 0.5 - 0.25);
        const waitTime = delay * jitter;

        if (response.status === 429) {
          console.warn(
            `[Retry] ⚠️ 429 Rate limit - Retrying in ${Math.round(waitTime / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
          );
        } else {
          console.error(
            `[Retry] ❌ Server error ${response.status} - Retrying in ${Math.round(waitTime / 1000)}s`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    } catch (err: any) {
      // Network error - check if it's a 429 error wrapped in an exception
      const is429Error =
        err?.status === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("rate limit");

      // Network error - retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), MAX_DELAY);
        // Add jitter for 429 errors to help distribute retries
        const jitter = is429Error ? 1 + (Math.random() * 0.5 - 0.25) : 1;
        const waitTime = delay * jitter;

        if (is429Error) {
          console.warn(
            `[Retry] ⚠️ Rate limit error caught - Retrying in ${Math.round(waitTime / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        // Last attempt failed - throw the error
        if (is429Error) {
          // Provide a more user-friendly error for rate limits
          const rateLimitError = new Error(
            "API rate limit exceeded. Please wait a moment and try again."
          );
          (rateLimitError as any).originalError = err;
          (rateLimitError as any).isRateLimit = true;
          throw rateLimitError;
        }
        throw err;
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
        } catch (err) {
          reject(err);
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
        } catch {
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
