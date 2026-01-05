# Dogechain DEX Reference

## Supported DEX Factories

This document lists all DEX (Decentralized Exchange) factories currently supported by the Dogechain Bubblemaps platform, along with their contract addresses and detection capabilities.

---

## Registered DEX Factories (7 Total)

### 1. ChewySwap (formerly Dogeshrek)

**Factory Address:** `0x7C10a3b7EcD42dd7D79C0b9d58dDB812f92B574A`

**Router V2 Address:** `0x45AFCf57F7e3F3B9cA70335E5E85e4F77DcC5087`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active

**Description:** Originally launched as Dogeshrek, later rebranded to ChewySwap. One of the major DEXes on Dogechain.

**Documentation:**
- GitHub: https://github.com/ChewySwap/dogeshrek-contracts
- Docs: https://docs.chewyswap.com

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

---

### 2. QuickSwap

**Factory Address:** `0xC3550497E591Ac6ed7a7E03ffC711CfB7412E57F`

**Router Address:** `0xAF96E63f965374dB6514e8cF595fB0a3f4d7763c`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active

**Description:** QuickSwap V2 on Dogechain - 2nd largest DEX by volume (~45% market share)

**Documentation:**
- Docs: https://docs.quickswap.exchange
- Contracts: https://docs.quickswap.exchange/overview/contracts-and-addresses

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

---

### 3. KibbleSwap

**Factory Address:** `0xf4bc79d32a7defd87c8a9c100fd83206bbf19af5`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active

**Description:** First native DEX on Dogechain - discovered via pair contract queries

**Website:** https://swap.kibby.dog (also known as Kibbyswap)

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

---

### 4. DogeSwap V1

**Factory Address:** `0xd27d9d61590874bf9ee2a19b27e265399929c9c3`

**Router Address:** TBD

**Type:** Uniswap V2 Fork

**Status:** ✅ Active

**Description:** LARGEST DEX on Dogechain (~54.6% market share) - discovered via OMNOM/WWDOGE pair

**Website:** https://omnomswap.dog

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

**Note:** Original factory address. May be deprecated in favor of V2.

---

### 5. DogeSwap V2 ⭐ NEW

**Factory Address:** `0x72ca245B078966578aB45e89067cc1245E3186c0`

**Router Address:** `0xa4EE06Ce40cb7e8c04E127c1F7D3dFB7F7039C81`

**Token Address:** `0xdd6e8bd626dac3ea6af8454ab69c793b9ea7a052`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active (newly added)

**Description:** Updated DogeSwap factory contract (user-provided address)

**Documentation:** https://omnomswap.dog

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

**Note:** This is the newer V2 factory. The platform supports both V1 and V2 addresses.

---

### 6. YodeSwap ⭐ NEW

**Factory Address:** `0xAaA04462e35f3e40D798331657cA015169e005d7`

**Router Address:** `0x72d85Ab47fBfc5E7E04a8bcfCa1601D8f8cE1a50`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active (newly added)

**Description:** YodeSwap AMM on Dogechain

**Website:** https://app.yodeswap.dog

**Documentation:**
- GitHub: https://github.com/yodedex/yodeswap-default-tokenlist

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

---

### 7. Wojak Finance ⭐ NEW

**Factory Address:** `0xc7c86B4f940Ff1C13c736b697e3FbA5a6Bc979F9`

**Router Address:** `0x9695906B4502D5397E6D21ff222e2C1a9e5654a9`

**Type:** Uniswap V2 Fork

**Status:** ✅ Active (newly added)

**Description:** Wojak Finance DEX on Dogechain

**Website:** https://wojak.fi

**Documentation:** https://docs.wojak.fi/contracts

**Market Data:**
- Price: ~$0.0011 USD
- TVL: $11,914
- 24h Volume: ~$60-70 USD

**Init Code Hash:** `0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5`

---

## Pending Integration (Research Needed)

### ToolSwap
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Mentioned in community discussions

### DegenDex
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Mentioned in community discussions

### Fraxswap
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Listed on GeckoTerminal

### Bourbon Defi
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Listed on GeckoTerminal

### PupSwap
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Listed on GeckoTerminal

### Radioshack
- Factory Address: TBD
- Status: 🔍 Research needed
- Notes: Listed on GeckoTerminal

---

## LP Pool Detection

### How It Works

The platform automatically detects LP (Liquidity Provider) pools by:

1. **Factory Recognition:** Identifies trades from known DEX factories
2. **Pair Discovery:** Queries PairCreated events from factory contracts
3. **Token Identification:** Extracts token0 and token1 addresses from pairs
4. **Visual Indication:** Displays LP pools as **pink-colored bubbles** on bubblemaps

### Detection Status

- ✅ **7 DEX Factories Registered** - All actively monitored
- ✅ **IndexedDB Storage** - LP pairs cached locally for performance
- ✅ **Auto-Initialization** - LP detection runs on app startup
- ✅ **Dynamic Updates** - New factories can be added at runtime

### Known LP Pairs

As of the latest initialization, the platform has detected **195 LP pairs** across all registered DEXes.

**Example Pairs:**
- OMNOM/WWDOGE (DogeSwap)
- Various token pairs on ChewySwap, QuickSwap, KibbleSwap

### Adding New LP Pairs

LP pairs are automatically discovered when:
1. You search for a token
2. The platform queries the factory for PairCreated events
3. New pairs are saved to IndexedDB

**Manual Addition:**
Use `manual-factory-entry.html` to add new factories and scan for all their LP pairs.

---

## Technical Details

### Uniswap V2 PairCreated Event

**Event Signature:**
```
0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9
```

**Event Structure:**
```solidity
event PairCreated(
    address indexed token0,
    address indexed token1,
    address pair,
    uint
);
```

### CREATE2 Address Calculation

LP pair addresses are deterministically calculated using CREATE2:
```
pair_address = keccak256(0xff ++ factory_address ++ keccak256(abi.encodePacked(token0, token1)) ++ init_code_hash)
```

All registered DEXes use the standard Uniswap V2 init code hash.

---

## Database Schema

### Version History

- **v1-v5:** Core database features (alerts, caching, discovered contracts)
- **v6:** LP pairs table added
- **v7:** Scan checkpoints table added
- **v8:** Discovered factories registry added

### Tables

**lpPairs:**
- `pairAddress` (unique) - LP pair contract address
- `factoryAddress` - Factory that created the pair
- `token0Address` - First token in pair
- `token1Address` - Second token in pair
- `dexName` - DEX name (e.g., "ChewySwap")
- `discoveredAt` - Timestamp of discovery
- `lastVerifiedAt` - Last verification timestamp
- `isValid` - Pair validity status

**discoveredFactories:**
- `address` (unique) - Factory contract address
- `name` - DEX name
- `type` - DEX type (usually UNISWAP_V2)
- `initCodeHash` - Bytecode hash for CREATE2
- `deployBlock` - Deployment block number
- `status` - ACTIVE, RENOUNCED, or UNKNOWN
- `description` - Optional notes

---

## API Limitations

### Dogechain Explorer API

**Base URL:** `https://explorer.dogechain.dog/api`

**Limitations:**
- Does not support topic-only queries (cannot scan entire blockchain for PairCreated events)
- Requires specific factory address for event queries
- Rate limited to ~60 requests/minute
- May return "No logs found" even for valid addresses

**Workaround:**
Use `manual-factory-entry.html` for factory-specific LP pair discovery.

---

## Update Log

### January 5, 2025
- ✅ Added YodeSwap factory (0xAaA04462e35f3e40D798331657cA015169e005d7)
- ✅ Added Wojak Finance factory (0xc7c86B4f940Ff1C13c736b697e3FbA5a6Bc979F9)
- ✅ Added DogeSwap V2 factory (0x72ca245B078966578aB45e89067cc1245E3186c0)
- ✅ Fixed IndexedDB schema initialization (v7 and v8)
- ✅ Renamed original DogeSwap to "DogeSwap V1"
- ✅ Total DEX coverage: 7 factories

### Previous Updates
- Initial implementation with 4 DEXes (ChewySwap, QuickSwap, KibbleSwap, DogeSwap)
- Added LP pair detection and caching
- Implemented auto-initialization on app startup

---

## Resources

### Block Explorers
- **Dogechain Explorer:** https://explorer.dogechain.dog

### DEX Analytics
- **GeckoTerminal:** https://www.geckoterminal.com/dogechain/pools

### Developer Tools
- **manual-factory-entry.html** - Add factories manually
- **comprehensive-scanner.html** - Full blockchain scan (when API supports it)

---

## Summary

**Total DEX Factories:** 7
**Total LP Pairs Detected:** 195+
**Coverage:** Major Dogechain DEXes
**Detection Method:** Uniswap V2 PairCreated events
**Storage:** IndexedDB (client-side)
**Auto-Initialization:** ✅ Yes

---

## Contact & Support

For issues or questions about DEX integration:
1. Check console logs for error messages
2. Verify factory addresses on Dogechain explorer
3. Ensure LP detection has initialized (check console)
4. Use manual-factory-entry.html for testing new factories

**Last Updated:** January 5, 2025
