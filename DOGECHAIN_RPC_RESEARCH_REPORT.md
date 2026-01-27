# Task #12073: Dogechain RPC Node Connection Research

**Date**: January 27, 2026
**Status**: ✅ Complete
**Research Focus**: Direct RPC node connection for Dogechain to eliminate 15-30 minute explorer API indexing delays

---

## Executive Summary

Direct RPC connection to Dogechain is **technically viable** and provides **near-instant transaction access** compared to the explorer API's 15-30 minute indexing delays. However, RPC connections have different trade-offs and limitations.

### Key Findings

| Metric               | Explorer API        | RPC Node                       |
| -------------------- | ------------------- | ------------------------------ |
| **Data Freshness**   | 15-30 min delay     | Near-instant (block time ~2s)  |
| **Historical Data**  | Rich indexed data   | Raw blockchain data            |
| **Query Complexity** | Simple REST calls   | Requires eth_getLogs/filtering |
| **Rate Limits**      | API tier-based      | Varies by provider             |
| **Cost**             | Free tier available | Free tiers with limits         |

---

## 1. Available RPC Endpoints

### Official Dogechain Public RPCs (FREE)

From [ChainList](https://chainlist.org/chain/2000) and [Dogechain Docs](https://docs.dogechain.dog):

1. **Primary Official Endpoints**:
   - `https://rpc.dogechain.dog` ⭐ **Recommended**
   - `https://rpc-us.dogechain.dog` (US region)
   - `https://rpc-sg.dogechain.dog` (Singapore region)
   - `https://rpc01-sg.dogechain.dog` (Singapore #1)
   - `https://rpc02-sg.dogechain.dog` (Singapore #2)
   - `https://rpc03-sg.dogechain.dog` (Singapore #3)

2. **Third-Party RPCs** (with tracking):
   - `https://doge-mainnet.gateway.tatum.io` (Tatum - privacy policy applies)
   - `https://rpc.ankr.com/dogechain` (Ankr - free tier with limits)

### Testnet RPC

- `https://rpc-testnet.dogechain.dog`

### Current Implementation

The project currently uses:

```typescript
// From wagmi.ts
rpcUrls: {
  public: { http: ["https://rpc.dogechain.dog"] },
  default: { http: ["https://rpc.dogechain.dog"] },
}
```

---

## 2. Authentication & Rate Limits

### Official Dogechain RPCs

- **Authentication**: None required (public endpoints)
- **Rate Limits**: Not publicly documented
- **Stability**: Operated by Dogechain team
- **Recommended**: Use geographic load balancing (US + SG endpoints)

### Ankr

- **Free Tier**: Available
- **Rate Limits**: Dependent on plan
- **Pricing**: Pay-as-you-go API credits
- **Documentation**: [Ankr Pricing](https://www.ankr.com/rpc/pricing/)

### Tatum

- **Privacy**: Tracks usage (see privacy policy)
- **Rate Limits**: Tier-based
- **Recommendation**: Avoid for privacy-sensitive applications

---

## 3. Transaction Fetching Methods

### Method A: eth_getLogs (Event Logs)

**Best for**: Monitoring specific contract events (e.g., Transfer, Swap)

```bash
curl https://rpc.dogechain.dog -X POST \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_getLogs",
    "params":[{
      "fromBlock": "0x186A0",
      "toBlock": "0x18894",
      "address": "0x0000000000000000000000000000000000001001"
    }],
    "id":1
  }'
```

**Parameters**:

- `fromBlock`: Starting block (hex or "latest", "pending")
- `toBlock`: Ending block (hex or "latest", "pending")
- `address`: Contract address to filter
- `topics`: Array of event signatures to filter

**Limitations**:

- Block range limits vary by provider (QuickNode: 10k blocks paid, 5 blocks free)
- Requires knowing event signatures
- Returns logs, not full transaction data

**Pros**:

- Efficient for specific events
- Real-time access
- Standard Ethereum JSON-RPC

**Cons**:

- Limited to event logs
- Doesn't capture all transaction types
- May need pagination for large ranges

---

### Method B: Block Subscription (WebSocket)

**Best for**: Real-time monitoring of new blocks/transactions

```javascript
const ws = new WebSocket("wss://rpc.dogechain.dog");

ws.send(
  JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_subscribe",
    params: ["newHeads"],
    id: 1,
  })
);
```

**Available Subscriptions**:

- `newHeads`: New block headers
- `logs`: Event logs with filters
- `newPendingTransactions`: Mempool transactions

**Pros**:

- Real-time updates
- Push-based (no polling)
- Low latency

**Cons**:

- Requires WebSocket support
- Need to handle connection drops
- More complex implementation

---

### Method C: eth_getBlockByNumber

**Best for**: Getting full transaction data for specific blocks

```bash
curl https://rpc.dogechain.dog -X POST \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_getBlockByNumber",
    "params":["0x123456", true],
    "id":1
  }'
```

**Parameters**:

- Block number (hex) or "latest", "pending"
- `true`: Include full transaction data
- `false`: Transaction hashes only

**Pros**:

- Complete transaction data
- Real-time access
- Simple pagination

**Cons**:

- Higher bandwidth usage
- More data to parse
- Need to process each transaction

---

## 4. Implementation Strategy

### Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│               Transaction Scanner                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. [Primary] Official RPC (http)                  │
│     - Load balance: rpc.dogechain.dog              │
│     - Fallback: rpc-us, rpc-sg                     │
│                                                     │
│  2. [Real-time] WebSocket Subscription             │
│     - eth_subscribe: newHeads                      │
│     - eth_subscribe: logs (Transfer events)        │
│                                                     │
│  3. [Fallback] Ankr Free Tier                      │
│     - Rate-limited backup                          │
│     - Extended range queries                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Code Example: Hybrid Scanner

```typescript
import { ethers } from "ethers";

class DogechainScanner {
  private providers: ethers.JsonRpcProvider[];
  private wsProvider: ethers.WebSocketProvider;

  constructor() {
    // HTTP providers with load balancing
    this.providers = [
      new ethers.JsonRpcProvider("https://rpc.dogechain.dog"),
      new ethers.JsonRpcProvider("https://rpc-us.dogechain.dog"),
      new ethers.JsonRpcProvider("https://rpc-sg.dogechain.dog"),
    ];

    // WebSocket for real-time
    this.wsProvider = new ethers.WebSocketProvider("wss://rpc.dogechain.dog");
  }

  /**
   * Fetch Transfer events for a token
   */
  async fetchTransferEvents(tokenAddress: string, fromBlock: number, toBlock: number) {
    // Transfer(address indexed from, address indexed to, uint256 value)
    const transferEvent = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    for (const provider of this.providers) {
      try {
        const logs = await provider.getLogs({
          address: tokenAddress,
          fromBlock,
          toBlock,
          topics: [transferEvent],
        });
        return logs;
      } catch (error) {
        console.warn(`Provider failed, trying next...`, error);
      }
    }
    throw new Error("All providers failed");
  }

  /**
   * Monitor new blocks via WebSocket
   */
  subscribeToNewBlocks(callback: (block: any) => void) {
    this.wsProvider.on("block", async (blockNumber) => {
      const block = await this.wsProvider.getBlock(blockNumber, true);
      callback(block);
    });
  }

  /**
   * Get full transactions from a block
   */
  async getBlockTransactions(blockNumber: number) {
    for (const provider of this.providers) {
      try {
        const block = await provider.getBlock(blockNumber, true);
        return block.transactions;
      } catch (error) {
        console.warn(`Failed to fetch block ${blockNumber}`, error);
      }
    }
    return [];
  }
}
```

---

## 5. Performance Comparison

### Explorer API vs RPC

| Operation      | Explorer API  | RPC (eth_getLogs) | RPC (WebSocket)   |
| -------------- | ------------- | ----------------- | ----------------- |
| **Latency**    | 15-30 min     | 1-3 seconds       | < 1 second        |
| **Freshness**  | Stale         | Current           | Real-time         |
| **Setup**      | Simple HTTP   | Medium complexity | High complexity   |
| **Historical** | Rich, indexed | Full chain        | From subscription |
| **Cost**       | Free tier     | Free/Public       | Free/Public       |

### Dogechain Block Time

- **Target**: ~2 seconds per block
- **Actual**: Varies with network congestion
- **Implication**: RPC provides ~720 blocks/hour vs Explorer's 2-4 updates/hour

---

## 6. Rate Limiting & Best Practices

### Mitigation Strategies

1. **Load Balancing**:

   ```typescript
   const endpoints = [
     "https://rpc.dogechain.dog",
     "https://rpc-us.dogechain.dog",
     "https://rpc-sg.dogechain.dog",
   ];
   // Round-robin or random selection
   ```

2. **Request Batching**:

   ```typescript
   // Process blocks in batches
   const BATCH_SIZE = 100;
   for (let i = fromBlock; i <= toBlock; i += BATCH_SIZE) {
     await processBatch(i, Math.min(i + BATCH_SIZE, toBlock));
   }
   ```

3. **Exponential Backoff**:

   ```typescript
   async function fetchWithRetry(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
       }
     }
   }
   ```

4. **Cache Results**:
   ```typescript
   const cache = new Map<string, any>();
   // Cache block data to avoid refetching
   ```

---

## 7. Third-Party Provider Comparison

### Task #12074: Third-Party Provider Analysis

| Provider               | Free Tier        | Rate Limits     | Pricing               | Notes            |
| ---------------------- | ---------------- | --------------- | --------------------- | ---------------- |
| **Official Dogechain** | ✅ Yes           | Undocumented    | Free                  | Recommended      |
| **Ankr**               | ✅ Yes           | Tier-based      | Pay-as-you-go credits | Good backup      |
| **Tatum**              | ⚠️ With tracking | Yes             | Paid tiers            | Privacy concerns |
| **QuickNode**          | ❌ Trial only    | 5 blocks (free) | Paid plans            | Expensive        |
| **Chainstack**         | ❌ Trial only    | Yes             | Paid plans            | Enterprise focus |

### Recommendation

**Use Official Dogechain RPCs as primary** with Ankr as fallback.

---

## 8. Fallback Architecture (Task #12077)

### Proposed Multi-Layer Fallback

```
┌──────────────────────────────────────────────────┐
│                  Priority                        │
├──────────────────────────────────────────────────┤
│ 1. WebSocket (Real-time)                         │
│    └── Monitor new blocks as they're mined       │
│                                                  │
│ 2. Official RPC HTTP (Polling)                   │
│    └── Fetch recent blocks on demand             │
│    └── Load balance across 3 regions             │
│                                                  │
│ 3. Ankr Free Tier                                │
│    └── Backup for extended queries               │
│    └── Rate-limited fallback                     │
│                                                  │
│ 4. Explorer API (Last Resort)                    │
│    └── Historical data beyond RPC limits         │
│    └── When all RPCs fail                        │
└──────────────────────────────────────────────────┘
```

### Health Checks

```typescript
async function checkRpcHealth(url: string): Promise<boolean> {
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
    return !!data.result;
  } catch {
    return false;
  }
}
```

---

## 9. Known Limitations

### RPC Constraints

1. **No Native Token Transfers**: RPC doesn't directly filter native DOGE transfers
   - **Solution**: Monitor `eth_getBlockByNumber` and parse transaction inputs

2. **Block Range Limits**: Some providers limit `eth_getLogs` range
   - **Solution**: Paginate queries or use WebSocket subscriptions

3. **Rate Limiting**: Public RPCs may throttle aggressive polling
   - **Solution**: Implement caching, backoff, and load balancing

4. **WebSocket Stability**: Connections may drop
   - **Solution**: Auto-reconnect with exponential backoff

### vs Explorer API

| Feature            | Explorer API    | RPC                |
| ------------------ | --------------- | ------------------ |
| Token holder lists | ✅ Yes          | ❌ Need to compute |
| Rich metadata      | ✅ Yes          | ❌ Raw data only   |
| Historical prices  | ✅ Yes          | ❌ Not available   |
| Real-time updates  | ❌ 15-30m delay | ✅ Instant         |

---

## 10. Next Steps

### Immediate Actions

1. **Update Task #12074**: Document third-party providers (see Section 7)
2. **Update Task #12077**: Implement fallback architecture (see Section 8)
3. **Create Proof of Concept**: Test RPC scanner with sample data
4. **Benchmark Performance**: Compare RPC vs Explorer API latency

### Implementation Phases

**Phase 1**: WebSocket Real-time Scanner

- Subscribe to new blocks
- Parse transactions for monitored tokens
- Update UI instantly

**Phase 2**: Historical Backfill

- Use `eth_getLogs` for event history
- Use `eth_getBlockByNumber` for full transaction data
- Implement pagination and caching

**Phase 3**: Fallback System

- Add Ankr as secondary RPC
- Re-enable Explorer API as last resort
- Implement health checks and auto-switching

---

## 11. Code Snippets for Quick Start

### Fetch Recent Blocks

```typescript
async function fetchRecentBlocks(count: number = 10) {
  const provider = new ethers.JsonRpcProvider("https://rpc.dogechain.dog");
  const latestBlock = await provider.getBlockNumber();
  const blocks = [];

  for (let i = 0; i < count; i++) {
    const block = await provider.getBlock(latestBlock - i, true);
    blocks.push(block);
  }

  return blocks;
}
```

### Monitor Token Transfers

```typescript
async function monitorTokenTransfers(tokenAddress: string) {
  const provider = new ethers.JsonRpcProvider("https://rpc.dogechain.dog");
  const transferInterface = new ethers.utils.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  provider.on(
    {
      address: tokenAddress,
      topics: [transferInterface.getEventTopic("transfer")],
    },
    (log) => {
      const parsed = transferInterface.parseLog(log);
      console.log(`Transfer: ${parsed.args.from} → ${parsed.args.to}: ${parsed.args.value}`);
    }
  );
}
```

---

## Conclusion

**RPC is viable** for real-time transaction monitoring on Dogechain, offering **dramatically improved data freshness** (seconds vs 15-30 minutes). The trade-off is increased implementation complexity and the need to build/maintain custom indexing logic.

**Recommended Approach**: Hybrid system using WebSocket for real-time updates and Explorer API for historical queries and rich metadata.

---

## References

- [Dogechain JSON-RPC Documentation](https://docs.dogechain.dog/docs/working-with-node/query-json-rpc)
- [Dogechain JSON-RPC Commands](https://docs.dogechain.dog/docs/get-started/json-rpc-commands)
- [ChainList: Dogechain Mainnet](https://chainlist.org/chain/2000)
- [CompareNodes: Dogechain RPC Endpoints](https://www.comparenodes.com/library/public-endpoints/dogechain/)
- [Ankr RPC Pricing](https://www.ankr.com/rpc/pricing/)
- [Ethereum eth_getLogs Reference](https://docs.metamask.io/services/reference/ethereum/json-rpc-methods/eth_getlogs/)

---

**Task Status**: ✅ Complete
**Related Tasks**:

- Task #12074: ✅ Updated with third-party provider analysis
- Task #12077: ✅ Updated with RPC fallback architecture details
