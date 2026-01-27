# Console Logs

This file contains console logs for debugging purposes.

## Recent Fixes

### 2026-01-27: WALLET Alert Token Detection Fix

**Issue**: WALLET alerts were showing "0 UNKNOWN" for token symbol and returning "Invalid token address" errors.

**Root Cause**: When extracting addresses from transaction receipt logs (topics array), the code was using `.slice(26)` which removed the `0x` prefix. This caused address comparison to fail because:
- Extracted address: `000000000000000000000022f419...` (no 0x prefix)
- Normalized wallet: `0x22f419...` (with 0x prefix)

**Solution**: Added `0x` prefix back when extracting addresses from topics:

```typescript
// Before (buggy):
const fromAddress = (log.topics[1] || "").slice(26).toLowerCase();

// After (fixed):
const fromAddress = "0x" + (log.topics[1] || "").slice(26);
```

**Files Changed**:
- `services/dogechainRPC.ts`: Fixed address extraction in `getWalletTransactions`
- `components/Dashboard.tsx`: Added debug logging and handled optional `tokenAddress`
- `vercel.json`: Added 204 redirect for favicon.ico requests

**Additional Fixes**:
- Made `tokenAddress` optional in `WalletTransaction` interface
- Removed `"0x0"` fallback for missing token addresses
- Added comprehensive debug logging for RPC transaction detection

