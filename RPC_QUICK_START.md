# RPC Implementation Quick Start Guide

## Overview

Quick reference for implementing Dogechain RPC transaction monitoring.

---

## Endpoints

### Primary (Load Balance These)

```typescript
const RPC_ENDPOINTS = [
  "https://rpc.dogechain.dog", // Primary
  "https://rpc-us.dogechain.dog", // US
  "https://rpc-sg.dogechain.dog", // Singapore
];
```

### WebSocket

```typescript
const WS_ENDPOINT = "wss://rpc.dogechain.dog";
```

---

## eth.js Examples

### Install Dependencies

```bash
npm install ethers@6
```

### Basic Provider Setup

```typescript
import { ethers } from "ethers";

// HTTP provider (for polling)
const provider = new ethers.JsonRpcProvider("https://rpc.dogechain.dog");

// WebSocket provider (for real-time)
const wsProvider = new ethers.WebSocketProvider("wss://rpc.dogechain.dog");
```

### Fetch Latest Block

```typescript
const blockNumber = await provider.getBlockNumber();
const block = await provider.getBlock(blockNumber, true); // true = full tx data

console.log(`Block ${blockNumber}:`, block.transactions);
```

### Fetch Token Transfers

```typescript
// ERC20 Transfer event signature
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const logs = await provider.getLogs({
  address: "0xYourTokenAddress",
  fromBlock: 1000000,
  toBlock: "latest",
  topics: [TRANSFER_TOPIC],
});

console.log(`Found ${logs.length} transfers`);
```

### Monitor New Blocks (WebSocket)

```typescript
wsProvider.on("block", async (blockNumber) => {
  const block = await wsProvider.getBlock(blockNumber, true);
  console.log(`New block ${blockNumber} with ${block.transactions.length} transactions`);
});
```

### Monitor Token Transfers (WebSocket)

```typescript
wsProvider.on(
  {
    address: "0xYourTokenAddress",
    topics: [TRANSFER_TOPIC],
  },
  (log) => {
    console.log("New transfer:", {
      from: ethers.utils.getAddress("0x" + log.topics[1].slice(26)),
      to: ethers.utils.getAddress("0x" + log.topics[2].slice(26)),
      value: ethers.BigNumber.from(log.data),
    });
  }
);
```

---

## Load Balancing

### Round-Robin Provider

```typescript
class LoadBalancedProvider {
  private providers: ethers.JsonRpcProvider[];
  private currentIndex = 0;

  constructor(endpoints: string[]) {
    this.providers = endpoints.map((url) => new ethers.JsonRpcProvider(url));
  }

  async getBlock(blockNumber: number) {
    const provider = this.providers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.providers.length;

    try {
      return await provider.getBlock(blockNumber, true);
    } catch (error) {
      // Try next provider
      return this.getBlock(blockNumber);
    }
  }
}
```

---

## Error Handling

### Retry with Exponential Backoff

```typescript
async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
const block = await fetchWithRetry(() => provider.getBlockNumber());
```

---

## Caching Strategy

### Simple Block Cache

```typescript
class BlockCache {
  private cache = new Map<number, any>();

  get(blockNumber: number) {
    return this.cache.get(blockNumber);
  }

  set(blockNumber: number, block: any) {
    // Keep last 1000 blocks
    if (this.cache.size > 1000) {
      const oldest = Math.min(...Array.from(this.cache.keys()));
      this.cache.delete(oldest);
    }
    this.cache.set(blockNumber, block);
  }
}
```

---

## Real-Time Scanner Example

```typescript
class TokenScanner {
  private provider: ethers.WebSocketProvider;
  private cache = new BlockCache();

  constructor(tokenAddress: string) {
    this.provider = new ethers.WebSocketProvider("wss://rpc.dogechain.dog");
    this.monitorToken(tokenAddress);
  }

  private monitorToken(tokenAddress: string) {
    const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    this.provider.on(
      {
        address: tokenAddress,
        topics: [TRANSFER_TOPIC],
      },
      (log) => {
        const transfer = this.parseTransfer(log);
        console.log("New transfer:", transfer);
        // Emit to UI, store in database, etc.
      }
    );
  }

  private parseTransfer(log: any) {
    return {
      from: ethers.utils.getAddress("0x" + log.topics[1].slice(26)),
      to: ethers.utils.getAddress("0x" + log.topics[2].slice(26)),
      value: ethers.utils.formatEther(log.data),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
    };
  }
}

// Usage
const scanner = new TokenScanner("0xYourTokenAddress");
```

---

## Health Checks

### Provider Health Check

```typescript
async function checkProviderHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result !== undefined;
  } catch {
    return false;
  }
}

// Check all providers
const healthStatus = await Promise.all(
  RPC_ENDPOINTS.map(async (url) => ({
    url,
    healthy: await checkProviderHealth(url),
  }))
);

console.table(healthStatus);
```

---

## Common Pitfalls

### 1. Forgetting to Parse Hex Addresses

```typescript
// ❌ Wrong
const from = log.topics[1];

// ✅ Correct
const from = ethers.utils.getAddress("0x" + log.topics[1].slice(26));
```

### 2. Not Handling BigInt

```typescript
// ❌ Wrong
const value = log.data;

// ✅ Correct
const value = ethers.BigNumber.from(log.data);
const formatted = ethers.utils.formatEther(value);
```

### 3. Ignoring Rate Limits

```typescript
// ❌ Wrong - Will get rate limited
for (let i = 0; i < 10000; i++) {
  await provider.getBlock(i);
}

// ✅ Correct - With delays
for (let i = 0; i < 10000; i++) {
  await provider.getBlock(i);
  await new Promise((r) => setTimeout(r, 100)); // 100ms delay
}
```

---

## Performance Tips

1. **Use WebSocket for real-time**: Much lower latency than polling
2. **Cache block data**: Don't refetch same blocks
3. **Load balance endpoints**: Distribute load across regions
4. **Implement backoff**: Handle rate limits gracefully
5. **Parse events efficiently**: Use ethers.js built-in parsers

---

## Testing

### Test RPC Connection

```typescript
async function testConnection() {
  const provider = new ethers.JsonRpcProvider("https://rpc.dogechain.dog");

  try {
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Connected! Latest block:", blockNumber);
    return true;
  } catch (error) {
    console.error("❌ Connection failed:", error);
    return false;
  }
}

testConnection();
```

### Test Transfer Event Parsing

```typescript
async function testTransferParsing() {
  const provider = new ethers.JsonRpcProvider("https://rpc.dogechain.dog");
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  const logs = await provider.getLogs({
    fromBlock: "latest",
    toBlock: "latest",
    topics: [TRANSFER_TOPIC],
  });

  console.log(`Found ${logs.length} transfers in latest block`);
  logs.forEach((log) => {
    console.log({
      from: ethers.utils.getAddress("0x" + log.topics[1].slice(26)),
      to: ethers.utils.getAddress("0x" + log.topics[2].slice(26)),
      value: ethers.utils.formatEther(log.data),
    });
  });
}

testTransferParsing();
```

---

## Monitoring & Debugging

### Log RPC Calls

```typescript
class LoggingProvider extends ethers.JsonRpcProvider {
  async send(method: string, params: any[]) {
    console.log(`[RPC] ${method}`, params);
    const result = await super.send(method, params);
    console.log(`[RPC] ${method} →`, result);
    return result;
  }
}

const provider = new LoggingProvider("https://rpc.dogechain.dog");
```

### Track Performance

```typescript
class PerformanceTracker {
  private metrics = new Map<string, number[]>();

  track(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  report() {
    for (const [op, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`${op}: ${avg.toFixed(2)}ms avg (${durations.length} calls)`);
    }
  }
}

// Usage
const tracker = new PerformanceTracker();
const start = Date.now();
await provider.getBlockNumber();
tracker.track("getBlockNumber", Date.now() - start);
tracker.report();
```

---

## Summary

- **Use `https://rpc.dogechain.dog` as primary**
- **Implement load balancing across regions**
- **Use WebSocket for real-time monitoring**
- **Cache results to avoid rate limits**
- **Handle errors with exponential backoff**
- **Test connections before production**

---

**Full Documentation**: See `DOGECHAIN_RPC_RESEARCH_REPORT.md` for complete analysis.
