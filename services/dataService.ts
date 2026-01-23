/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
// Diagnostic logging added for LP pair detection
import {
  Token,
  Wallet,
  Transaction,
  Link,
  AssetType,
  ScanProgressUpdate,
  ScanMetadata,
} from "../types";
import { validateTokenAddress, validateWalletAddress } from "../utils/validation";
import {
  fetchWithRateLimit,
  fetchWithRetry,
  dogechainApiLimiter,
  AdaptiveRequestScheduler,
} from "../utils/rateLimit";
import {
  loadScanCache,
  saveScanCache,
  loadDiscoveredContracts,
  saveDiscoveredContracts,
  DbDiscoveredContracts,
} from "./db";
import { submitWalletScanResults } from "./learnedTokensService";

// Proxy to Dogechain Explorer to avoid CORS issues
// Using relative URL since the proxy endpoint is in the same app
const EXPLORER_API_V1 = "/api/dogechain-proxy";
const EXPLORER_API_V2 = "/api/dogechain-proxy";
const METADATA_CACHE_KEY = "doge_token_metadata_cache_v2";
// Note: DISABLE_WALLET_ENDPOINTS removed - using fetchWalletAssetsHybrid instead

// --- Local Storage Cache Helpers ---
const getCachedMetadata = (address: string) => {
  try {
    const cacheRaw = localStorage.getItem(METADATA_CACHE_KEY);
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw);
    return cache[address.toLowerCase()];
  } catch {
    return null;
  }
};

// Light heuristic: inspect token vs NFT activity to detect contract type
export const detectContractType = async (address: string): Promise<AssetType | null> => {
  try {
    const lower = address.toLowerCase();
    // Bootstrap with explicit type
    if (BOOTSTRAP_TOKENS[lower]?.type) return BOOTSTRAP_TOKENS[lower].type;

    // 1) Token list metadata (may include explicit type; decimals alone are not decisive)
    try {
      const metaRes = await fetchSafe(
        `${EXPLORER_API_V1}?module=token&action=getToken&contractaddress=${address}`
      );
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson.status === "1" && metaJson.result) {
          const info = metaJson.result[0] || metaJson.result;
          const rawType = info.type?.toString().toLowerCase();
          if (
            rawType?.includes("721") ||
            rawType?.includes("1155") ||
            rawType === "erc721" ||
            rawType === "erc1155"
          ) {
            return AssetType.NFT;
          }
          // Only trust explicit token types here; decimals=0 is common for NFTs
          if (rawType?.includes("20")) return AssetType.TOKEN;
        }
      }
    } catch {
      /* ignore */
    }

    // 2) Check V2 token metadata
    try {
      const v2Res = await fetchSafe(`${EXPLORER_API_V2}?path=/v2/tokens/${address}`);
      if (v2Res.ok) {
        const v2Json = await v2Res.json();
        const typeField = v2Json?.type?.toString().toLowerCase();
        if (typeField?.includes("721") || typeField?.includes("1155")) return AssetType.NFT;
        if (typeField?.includes("20")) return AssetType.TOKEN;
      }
    } catch {
      /* ignore */
    }

    // 3) Inspect ABI from sourcecode for NFT interfaces
    try {
      const abiRes = await fetchSafe(
        `${EXPLORER_API_V1}?module=contract&action=getsourcecode&address=${address}`
      );
      if (abiRes.ok) {
        const abiJson = await abiRes.json();
        const abiStr = abiJson?.result?.[0]?.ABI;
        if (abiStr && abiStr !== "Contract source code not verified") {
          const abi = JSON.parse(abiStr);
          if (Array.isArray(abi)) {
            const hasOwnerOf = abi.some(
              (item: any) => item?.type === "function" && item?.name === "ownerOf"
            );
            const hasTokenURI = abi.some(
              (item: any) => item?.type === "function" && item?.name === "tokenURI"
            );
            const hasSupportsInterface = abi.some(
              (item: any) => item?.type === "function" && item?.name === "supportsInterface"
            );
            const hasSafeTransfer721 = abi.some(
              (item: any) =>
                item?.type === "function" &&
                item?.name === "safeTransferFrom" &&
                item?.inputs?.length === 3
            );
            const hasSafeTransfer1155 = abi.some(
              (item: any) =>
                item?.type === "function" &&
                item?.name === "safeTransferFrom" &&
                item?.inputs?.length === 5
            );
            if (
              hasOwnerOf ||
              hasTokenURI ||
              hasSupportsInterface ||
              hasSafeTransfer721 ||
              hasSafeTransfer1155
            ) {
              return AssetType.NFT;
            }
            const hasDecimals = abi.some(
              (item: any) => item?.type === "function" && item?.name === "decimals"
            );
            if (hasDecimals) return AssetType.TOKEN;
          }
        }
      }
    } catch {
      /* ignore */
    }

    // 4) Check NFT tx endpoint (can 400 on non-contracts; place late)
    const nftRes = await fetchSafe(
      `${EXPLORER_API_V1}?module=account&action=tokennfttx&contractaddress=${address}&page=1&offset=1&sort=desc`
    );
    if (nftRes.ok) {
      const nftJson = await nftRes.json();
      if (Array.isArray(nftJson.result) && nftJson.result.length > 0) {
        return AssetType.NFT;
      }
    }

    // 5) Check fungible token tx endpoint
    const ftRes = await fetchSafe(
      `${EXPLORER_API_V1}?module=account&action=tokentx&contractaddress=${address}&page=1&offset=1&sort=desc`
    );
    if (ftRes.ok) {
      const ftJson = await ftRes.json();
      if (Array.isArray(ftJson.result) && ftJson.result.length > 0) {
        return AssetType.TOKEN;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const saveMetadataToCache = (
  address: string,
  data: { symbol: string; name: string; decimals: number; type: AssetType }
) => {
  try {
    const cacheRaw = localStorage.getItem(METADATA_CACHE_KEY);
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    cache[address.toLowerCase()] = { ...data, timestamp: Date.now() };
    localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Error handled silently - localStorage write failed
  }
};

// Initial Hardcoded Data (Fallback/Bootstrap)
const BOOTSTRAP_TOKENS: Record<
  string,
  { decimals: number; symbol?: string; name?: string; type?: AssetType }
> = {
  "0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d": {
    decimals: 6,
    symbol: "USDT",
    name: "Tether USD",
    type: AssetType.TOKEN,
  },
  "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101": {
    decimals: 18,
    symbol: "wDOGE",
    name: "Wrapped DOGE",
    type: AssetType.TOKEN,
  },
  "0x7b4328c127b85369d9f82ca0503b000d09cf9180": {
    decimals: 18,
    symbol: "DC",
    name: "Dogechain",
    type: AssetType.TOKEN,
  },
  "0xd38b22794b308a2e55808a13d1e6a80c4be94fd5": {
    decimals: 0,
    symbol: "DPunks",
    name: "RealDogePunks",
    type: AssetType.NFT,
  },
};

// Known Infrastructure Labels
const KNOWN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "Null Address",
  "0x000000000000000000000000000000000000dead": "Burn Address",
  "0x352569c5392c81d2442d66608f4755b967420729": "Dogechain Bridge",
  // Dogechain Ecosystem Wallets
  "0x73b56aa56b35a9eb062ebb0e187fe0f2603dbd25": "Dogechain Ecosystem Treasury",
  "0x64c53d47d879eb3d1a311c7110a3964909a60bec": "Ecosystem DAO Fund",
  "0x6c13d0978d4d1eb1208c93ad630c79d1728495c3": "Network Operations",
  "0x5a3c2e0a005883c598430f1ab303411db1e0ba3a": "Early Shibes",
  "0xbce77b0d91e98e4524e74fd378a3af5c9b94528e": "Loyal Shibes",
  "0x07be55dcbea6ac1bb0a8d89c88485f483e0add80": "Foundation",
  "0x85217a346f3fa64893bab3caea59effd0df8bc9": "Treasury",
  "0xc1efe7aa280f7c63a4b1da26ae0f7e64ce7f2a8a": "Contributing Team",
  "0x9f6a749acb49852ffe423408067938af7a36e15f": "Advisor & Marketing",
  "0xf82e972e10fad1c8856832187adfc436edf38288": "Market Making",
  "0x009d2bff6cade60d8bcce580424c72a67d3961b6": "Robinhood Reserve",
  "0x1d4c74827e3a0b0cd13f76974f145295f7468d41": "Polygon Reserve",
};

// --- Helpers ---
const parseBalance = (raw: string, decimals: number): number => {
  if (!raw) return 0;
  const cleanRaw = raw.toString().replace(/,/g, "");
  if (cleanRaw.includes(".")) {
    const val = parseFloat(cleanRaw);
    return isNaN(val) ? 0 : val;
  }
  const val = parseFloat(cleanRaw);
  if (isNaN(val)) return 0;
  return val / Math.pow(10, decimals);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wrapper around fetchWithRetry for compatibility
const fetchSafe = async (url: string, options: any = {}, retries = 2): Promise<Response> => {
  return fetchWithRetry(() => fetchWithRateLimit(url, options, dogechainApiLimiter), retries, 1000);
};

const getDecimals = (
  address: string,
  apiDecimals: string | number | null | undefined,
  type: AssetType
): number => {
  const clean = address.toLowerCase();

  // 1. Check Bootstrap
  if (BOOTSTRAP_TOKENS[clean]) return BOOTSTRAP_TOKENS[clean].decimals;

  // 2. Check Local Cache
  const cached = getCachedMetadata(clean);
  if (cached) return cached.decimals;

  // 3. API provided
  if (
    apiDecimals !== null &&
    apiDecimals !== undefined &&
    apiDecimals !== "null" &&
    apiDecimals !== ""
  ) {
    return Number(apiDecimals);
  }

  // 4. Default
  return type === AssetType.NFT ? 0 : 18;
};

// Flag to ensure we only log LP pairs once per token
const loggedTokens = new Set<string>();

const resolveKnownLabel = async (
  address: string,
  tokenAddress?: string
): Promise<string | undefined> => {
  const lowerAddr = address.toLowerCase();

  // 1. Check hardcoded labels
  if (KNOWN_LABELS[lowerAddr]) return KNOWN_LABELS[lowerAddr];

  // 2. Check if this is the token contract itself
  if (tokenAddress && lowerAddr === tokenAddress.toLowerCase()) return "Token Contract";

  // 3. Check if this is an LP pair
  try {
    const { isAddressLPPair, loadAllLPPairs } = await import("./lpDetection");

    // Log LP pairs for this token (only once)
    if (tokenAddress && !loggedTokens.has(tokenAddress.toLowerCase())) {
      loggedTokens.add(tokenAddress.toLowerCase());

      const allPairs = await loadAllLPPairs();
      const tokenLPairs = allPairs.filter(
        (p) =>
          p.token0Address.toLowerCase() === tokenAddress.toLowerCase() ||
          p.token1Address.toLowerCase() === tokenAddress.toLowerCase()
      );

      console.log(
        `[LP Detection] Token ${tokenAddress}: Found ${tokenLPairs.length} LP pairs in database:`
      );
      if (tokenLPairs.length > 0) {
        tokenLPairs.forEach((p) => {
          console.log(
            `[LP Detection]   - LP Pair: ${p.pairAddress} (${p.dexName}) [${p.token0Address} / ${p.token1Address}]`
          );
        });
      }
    }

    const lpPair = await isAddressLPPair(lowerAddr);
    if (lpPair && lpPair.isValid) {
      return "LP Pool";
    } else {
      // Not an LP pool
    }
  } catch {
    // Silently fail - don't break existing functionality
  }

  return undefined;
};

const checkContractVerification = async (address: string): Promise<boolean> => {
  try {
    const url = `${EXPLORER_API_V1}?module=contract&action=getsourcecode&address=${address}`;
    const res = await fetchSafe(url);
    const data = await res.json();
    // If SourceCode is present and not empty, it's verified.
    if (data.status === "1" && data.result && data.result[0] && data.result[0].SourceCode) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Helper: Scrape metadata from recent transfers (Self-Healing)
export const fetchMetadataFromTransfers = async (
  address: string
): Promise<{ name?: string; symbol?: string; decimals?: number } | null> => {
  try {
    // Fetch 1 recent transfer. The 'token' object in the transfer usually contains accurate metadata from the logs
    const res = await fetchSafe(`${EXPLORER_API_V2}?path=/v2/tokens/${address}/transfers&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const tokenInfo = data.items[0].token;
        if (tokenInfo) {
          return {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals ? parseInt(tokenInfo.decimals) : undefined,
          };
        }
      }
    }
    return null;
  } catch {
    // Error fetching data
    return null;
  }
};

// Helper: Try to get token info from V1 token list endpoint
const fetchMetadataFromTokenList = async (
  address: string
): Promise<{ name?: string; symbol?: string; decimals?: number } | null> => {
  try {
    const res = await fetchSafe(
      `${EXPLORER_API_V1}?module=token&action=getToken&contractaddress=${address}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.status === "1" && data.result) {
        const tokenInfo = data.result[0] || data.result;
        return {
          name: tokenInfo.tokenName || tokenInfo.name,
          symbol: tokenInfo.tokenSymbol || tokenInfo.symbol,
          decimals:
            tokenInfo.tokenDivisor || tokenInfo.decimals
              ? parseInt(tokenInfo.tokenDivisor || tokenInfo.decimals)
              : undefined,
        };
      }
    }
    return null;
  } catch {
    // Error fetching data
    return null;
  }
};

// --- Core Services ---

export const fetchTokenData = async (
  address: string,
  preferredType: AssetType = AssetType.TOKEN
): Promise<Token | null> => {
  // Validate and sanitize address
  let cleanAddress: string;
  try {
    cleanAddress = validateTokenAddress(address);
  } catch {
    // Error handled silently

    return null;
  }

  // Load from sources
  const bootstrap = BOOTSTRAP_TOKENS[cleanAddress];
  let cached = getCachedMetadata(cleanAddress);

  // Clear stale cached data that has generic names/symbols
  if (
    cached &&
    (cached.symbol === "TOKEN" ||
      cached.symbol === "???" ||
      cached.name === "Unverified Token" ||
      cached.name === "Unknown Token")
  ) {
    try {
      const cacheRaw = localStorage.getItem(METADATA_CACHE_KEY);
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        delete cache[cleanAddress.toLowerCase()];
        localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache));
        cached = null;
      }
    } catch {
      // Error in operation
    }
  }

  try {
    const isVerified = await checkContractVerification(cleanAddress);

    // Always attempt detection to correct stale cache
    const detectedType: AssetType | null = await detectContractType(cleanAddress);

    // Prefer V1 metadata first to avoid V2 400s, then optionally enrich via transfers/token list
    const tokenListData = await fetchMetadataFromTokenList(cleanAddress);

    let finalName = tokenListData?.name || cached?.name || bootstrap?.name;
    let finalSymbol = tokenListData?.symbol || cached?.symbol || bootstrap?.symbol;
    let finalDecimals = tokenListData?.decimals;
    const type = detectedType || cached?.type || bootstrap?.type || preferredType;

    // Attempt lightweight transfer scrape if metadata is still generic/missing
    if (!finalName || !finalSymbol || finalName === "ERC-20" || finalName === "Unverified Token") {
      const healedData = await fetchMetadataFromTransfers(cleanAddress);
      if (healedData) {
        if (healedData.name) finalName = healedData.name;
        if (healedData.symbol) finalSymbol = healedData.symbol;
        if (healedData.decimals !== undefined) finalDecimals = healedData.decimals;
      }
    }

    // Determine decimals/type fallbacks
    finalDecimals = getDecimals(cleanAddress, finalDecimals, type);
    finalName =
      finalName || (type === AssetType.NFT ? "Unverified Collection" : "Unverified Token");
    finalSymbol = finalSymbol || (type === AssetType.NFT ? "NFT" : "TOKEN");

    // Save to cache if valid identifiers
    if (finalName && finalSymbol && finalName !== "Unverified Token") {
      saveMetadataToCache(cleanAddress, {
        symbol: finalSymbol,
        name: finalName,
        decimals: finalDecimals,
        type,
      });
    }

    // Try supply via V1 stats (cheap) — skip if it fails
    let totalSupply = 0;
    try {
      const v1Res = await fetchSafe(
        `${EXPLORER_API_V1}?module=stats&action=tokensupply&contractaddress=${cleanAddress}`
      );
      const v1Data = await v1Res.json();
      if (v1Data.status === "1" || (v1Data.result && !isNaN(parseFloat(v1Data.result)))) {
        totalSupply = parseBalance(v1Data.result, finalDecimals);
      }
    } catch {
      // ignore supply failure
    }

    return {
      address: cleanAddress,
      name: finalName,
      symbol: finalSymbol,
      totalSupply,
      decimals: finalDecimals,
      type,
      priceUsd: 0,
      isVerified,
    };
  } catch {
    // Error handled silently

    return null;
  }
};

export const fetchTokenHolders = async (
  token: Token
): Promise<{ wallets: Wallet[]; links: Link[] }> => {
  console.log(
    `[LP Detection] ===== fetchTokenHolders called for ${token.symbol || token.address} =====`
  );

  const cleanAddress = validateTokenAddress(token.address);
  const decimals =
    token.decimals !== undefined ? token.decimals : token.type === AssetType.NFT ? 0 : 18;

  // V1-only: avoid V2 holders endpoint (returns 400 in production)
  try {
    await sleep(150); // small spacing to be gentle on API
    const v1Response = await fetchSafe(
      `${EXPLORER_API_V1}?module=token&action=getTokenHolders&contractaddress=${cleanAddress}&page=1&offset=100`
    );
    const v1Json = await v1Response.json();

    if (!(v1Json.status === "1" && Array.isArray(v1Json.result))) {
      return { wallets: [], links: [] };
    }

    const holders: { address: string; balance: string; is_contract: boolean }[] = v1Json.result.map(
      (item: any) => ({
        address: item.TokenHolderAddress || item.address,
        balance: item.TokenHolderQuantity || item.value,
        is_contract: false,
      })
    );

    if (holders.length === 0) return { wallets: [], links: [] };

    const processedWallets: Wallet[] = await Promise.all(
      holders.map(async (h) => {
        const balance = parseBalance(h.balance, decimals);
        const label = await resolveKnownLabel(h.address, token.address);
        return {
          id: h.address,
          address: h.address,
          balance,
          percentage: 0,
          isWhale: false,
          isContract: h.is_contract || label === "LP Pool", // Mark LP pairs as contracts
          label: label,
          connections: [],
        };
      })
    );

    // Add LP pairs from database that involve this token
    try {
      const { loadAllLPPairs } = await import("./lpDetection");
      const allLPPairs = await loadAllLPPairs();

      // Filter LP pairs that involve this token
      const tokenLPPairs = allLPPairs.filter(
        (lp) =>
          lp.token0Address.toLowerCase() === cleanAddress.toLowerCase() ||
          lp.token1Address.toLowerCase() === cleanAddress.toLowerCase()
      );

      if (tokenLPPairs.length > 0) {
        // For each LP pair, query its token balance
        for (const lpPair of tokenLPPairs) {
          try {
            await sleep(100); // gentle rate limiting

            // Query the balance of this token in the LP pair contract
            const balanceUrl = `${EXPLORER_API_V1}?module=account&action=tokenbalance&contractaddress=${cleanAddress}&address=${lpPair.pairAddress}`;
            const balanceRes = await fetchSafe(balanceUrl);
            const balanceData = await balanceRes.json();

            if (balanceData.status === "1" && balanceData.result) {
              const lpBalance = parseBalance(balanceData.result, decimals);

              // Only add if LP pair has non-zero balance of this token
              if (lpBalance > 0) {
                const lpWallet: Wallet = {
                  id: lpPair.pairAddress,
                  address: lpPair.pairAddress,
                  balance: lpBalance,
                  percentage: 0, // Will be calculated below
                  isWhale: true, // LP pairs are important
                  isContract: true,
                  label: `LP Pool (${lpPair.dexName})`,
                  connections: [],
                };

                // Check if this LP pair is already in the list (from holder API)
                const existingIndex = processedWallets.findIndex(
                  (w) => w.address.toLowerCase() === lpPair.pairAddress.toLowerCase()
                );

                if (existingIndex >= 0) {
                  // Update existing entry with proper LP label
                  processedWallets[existingIndex] = lpWallet;
                } else {
                  // Add new LP pair to the list
                  processedWallets.push(lpWallet);
                }
              }
            }
          } catch {
            // Error in processing
          }
        }
      }
    } catch {
      // Error in wallet processing
    }

    const labeledBeforeRecalc = processedWallets.filter((w) => w.label);
    if (labeledBeforeRecalc.length > 0) {
      labeledBeforeRecalc.forEach((w) => w.label);
    }

    const totalWalletBalance = processedWallets.reduce((acc, w) => acc + w.balance, 0);
    const effectiveTotalSupply = token.totalSupply > 0 ? token.totalSupply : totalWalletBalance;

    processedWallets.forEach((w, index) => {
      w.percentage = effectiveTotalSupply > 0 ? (w.balance / effectiveTotalSupply) * 100 : 0;
      w.isWhale = index < 10;
    });

    // DIAGNOSTIC: Check labeled wallets after whale recalculation
    const labeledAfterRecalc = processedWallets.filter((w) => w.label);
    console.log(
      `[LP Detection] After recalc - Total: ${processedWallets.length}, Labeled: ${labeledAfterRecalc.length}`
    );
    if (labeledAfterRecalc.length > 0) {
      labeledAfterRecalc.forEach((w) => w.label);
    }

    const links: Link[] = [];
    const topWallets = processedWallets.slice(0, 3);

    for (const whale of topWallets) {
      try {
        await sleep(300);
        const url = `${EXPLORER_API_V1}?module=account&action=tokentx&contractaddress=${cleanAddress}&address=${whale.address}&page=1&offset=20`;
        const res = await fetchSafe(url);
        const data = await res.json();

        if (data.result && Array.isArray(data.result)) {
          data.result.forEach((tx: any) => {
            const other = tx.from.toLowerCase() === whale.address.toLowerCase() ? tx.to : tx.from;
            const match = processedWallets.find(
              (w) => w.address.toLowerCase() === other.toLowerCase()
            );

            if (match && match.id !== whale.id) {
              const linkExists = links.some(
                (l) =>
                  (typeof l.source === "string"
                    ? l.source === whale.id
                    : l.source.id === whale.id) &&
                  (typeof l.target === "string" ? l.target === match.id : l.target.id === match.id)
              );

              if (!linkExists) {
                links.push({ source: whale.id, target: match.id, value: 1 });
                const w = processedWallets.find((wal) => wal.id === whale.id);
                if (w && !w.connections.includes(match.id)) w.connections.push(match.id);
                const m = processedWallets.find((wal) => wal.id === match.id);
                if (m && !m.connections.includes(whale.id)) m.connections.push(whale.id);
              }
            }
          });
        }
      } catch {
        // ignore
      }
    }

    // Debug: Log all wallets with labels to verify LP pairs
    // IMPORTANT: Preserve labeled wallets even if they're outside the top 100
    const top100Wallets = processedWallets.slice(0, 100);
    const labeledWallets = processedWallets.filter((w) => w.label);

    // Create a set of addresses from top 100 to avoid duplicates
    const top100Addresses = new Set(top100Wallets.map((w) => w.address.toLowerCase()));

    // Add labeled wallets that aren't already in the top 100
    const additionalLabeled = labeledWallets.filter(
      (w) => !top100Addresses.has(w.address.toLowerCase())
    );

    // Combine: top 100 + any labeled wallets that were excluded
    const walletsToShow = [...top100Wallets, ...additionalLabeled].slice(0, 105); // Max 105 to prevent huge arrays

    console.log(
      `[LP Detection] Top 100: ${top100Wallets.length}, Labeled wallets: ${labeledWallets.length}, Additional labeled: ${additionalLabeled.length}, Final: ${walletsToShow.length}`
    );
    if (labeledWallets.length > 0) {
      labeledWallets.forEach((w) => {
        console.log(
          `[LP Detection] Labeled wallet: ${w.address} - label: "${w.label}", isContract: ${w.isContract}, balance: ${w.balance}`
        );
      });
    }

    return { wallets: walletsToShow, links };
  } catch {
    return { wallets: [], links: [] };
  }
};

// Track pending fetches to prevent infinite loops and duplicate requests
const pendingFetches = new Map<string, Promise<Transaction[]>>();

// Simple in-memory cache with 5-minute TTL to avoid repeated slow API calls
const txCache = new Map<string, { data: Transaction[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const fetchWalletTransactions = async (
  walletAddress: string,
  tokenAddress?: string,
  type: AssetType = AssetType.TOKEN,
  onProgress?: (message: string) => void
): Promise<Transaction[]> => {
  // Create unique key for this request
  const cacheKey = `${walletAddress}-${tokenAddress || "none"}-${type}`;

  // Check cache first
  const cached = txCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[fetchWalletTransactions] 🎯 Cache hit for ${cacheKey.substring(0, 16)}...`);
    onProgress?.("Using cached transaction data...");
    return cached.data;
  }

  // If already fetching, return existing promise (prevents infinite loops)
  if (pendingFetches.has(cacheKey)) {
    console.log(`[fetchWalletTransactions] 🔄 Request already in progress, waiting...`);
    return pendingFetches.get(cacheKey)!;
  }

  // Create new fetch promise
  const fetchPromise = (async () => {
    try {
      // Sanitize inputs to avoid 400s for malformed addresses
      const cleanWallet = validateWalletAddress(walletAddress);
      const cleanToken = tokenAddress ? validateTokenAddress(tokenAddress) : undefined;

      // Helper function to process raw transaction data
      const processTransactions = async (rawTxs: any[]): Promise<Transaction[]> => {
        let filteredTransactions = rawTxs;

        // For NFTs with specific contract address, filter client-side
        if (type === AssetType.NFT && cleanToken) {
          filteredTransactions = rawTxs.filter((tx: any) => {
            const contract = (tx.contractAddress || tx.contract || "")?.toLowerCase();
            return contract === cleanToken.toLowerCase();
          });
        }

        // For NFTs without specific contract, detect and filter by contract type
        if (type === AssetType.NFT && !cleanToken) {
          // Extract unique contract addresses
          const uniqueContracts = new Set<string>();
          filteredTransactions.forEach((tx: any) => {
            const contract = tx.contractAddress || tx.contract;
            if (contract) uniqueContracts.add(contract.toLowerCase());
          });

          // Detect contract types with caching
          const nftContracts = new Set<string>();
          const contractsArray = Array.from(uniqueContracts);

          // Batch detect types (limit to 10 contracts to avoid rate limits)
          for (let i = 0; i < Math.min(contractsArray.length, 10); i++) {
            const contract = contractsArray[i];

            if (!contract) continue; // Guard against undefined

            // Check cache first
            const cached = getCachedMetadata(contract);
            if (cached?.type === AssetType.NFT) {
              nftContracts.add(contract);
              continue;
            }

            // Detect type (this will cache the result)
            try {
              const detectedType = await detectContractType(contract);
              if (detectedType === AssetType.NFT) {
                nftContracts.add(contract);
              }
            } catch {
              // On detection failure, include transaction to avoid false negatives

              nftContracts.add(contract);
            }
          }

          // Filter to only NFT transactions
          filteredTransactions = filteredTransactions.filter((tx: any) => {
            const contract = (tx.contractAddress || tx.contract)?.toLowerCase();
            return nftContracts.has(contract);
          });
        }

        // Deduplicate transactions by hash (same transaction can appear multiple times)
        const uniqueTransactions = new Map<string, any>();
        filteredTransactions.forEach((tx: any) => {
          if (!uniqueTransactions.has(tx.hash)) {
            uniqueTransactions.set(tx.hash, tx);
          }
        });

        // Map to Transaction format
        return Array.from(uniqueTransactions.values()).map((tx: any) => {
          // Use tokenDecimal from API if available, otherwise use defaults
          let decimals = 18;
          if (type === AssetType.NFT) {
            decimals = 0;
          } else if (tx.tokenDecimal) {
            decimals = parseInt(tx.tokenDecimal);
          }

          // Parse value safely, default to 1 for NFTs if value is invalid
          const rawValue = tx.value;
          let parsedValue = parseFloat(rawValue);

          if (
            isNaN(parsedValue) ||
            rawValue === undefined ||
            rawValue === null ||
            rawValue === ""
          ) {
            // For NFTs, default to 1 (representing 1 NFT transferred)
            // For tokens, default to 0
            parsedValue = type === AssetType.NFT ? 1 : 0;
          }

          const value = parsedValue / Math.pow(10, decimals);

          // Extract token contract address from transaction data (not request parameter)
          const txContractAddress = (tx.contractAddress || tx.contract)?.toLowerCase();

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: value,
            timestamp: parseInt(tx.timeStamp) * 1000,
            tokenAddress: txContractAddress || cleanToken, // From transaction, fallback to request parameter
            tokenSymbol: tx.tokenSymbol,
          };
        });
      };

      // Helper function to fetch transactions with a specific offset and timeout
      const fetchWithOffset = async (offset: number): Promise<Transaction[]> => {
        // RELIABILITY FIX: Always use tokentx endpoint (works for both tokens and NFTs)
        // The tokennfttx endpoint returns 400 errors, so we avoid it completely
        let url = `${EXPLORER_API_V1}?module=account&action=tokentx&address=${cleanWallet}&page=1&offset=${offset}&sort=desc`;

        // For tokens, we can filter by contract address server-side
        if (cleanToken && type === AssetType.TOKEN) {
          url += `&contractaddress=${cleanToken}`;
        }

        // Add timing and timeout to prevent indefinite hanging (15s for better UX)
        const fetchStartTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          const elapsedNumber = performance.now() - fetchStartTime;
          const elapsed = elapsedNumber.toFixed(0);
          console.warn(`[fetchWithOffset] ⏱️ Timeout after ${elapsed}ms (limit: 15000ms)`);
          onProgress?.(`Request timeout after ${Math.floor(elapsedNumber / 1000)}s...`);
          controller.abort();
        }, 15000); // Reduced from 30s to 15s for faster feedback

        try {
          const response = await fetchSafe(url, { signal: controller.signal as any });
          const fetchTime = (performance.now() - fetchStartTime).toFixed(0);
          clearTimeout(timeoutId);

          console.log(`[fetchWithOffset] ✅ Fetch completed in ${fetchTime}ms, parsing JSON...`);

          // Add timeout for JSON parsing (5 seconds) to prevent hanging on large responses
          const data = await Promise.race([
            response.json(),
            new Promise<any>((_, reject) =>
              setTimeout(() => reject(new Error("JSON parse timeout")), 5000)
            ),
          ]);

          const parseTime = (performance.now() - fetchStartTime).toFixed(0);
          console.log(`[fetchWithOffset] ✅ JSON parsed in ${parseTime}ms total`);

          if (data.status === "1" && Array.isArray(data.result)) {
            return processTransactions(data.result);
          }
          return [];
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === "AbortError") {
            console.warn(`[fetchWithOffset] ❌ Request aborted (offset ${offset})`);
            return [];
          }
          if (error instanceof Error && error.message === "JSON parse timeout") {
            console.error(`[fetchWithOffset] ❌ JSON parsing timed out (offset ${offset})`);
            return [];
          }
          console.error(
            `[fetchWithOffset] ❌ Error fetching transactions (offset ${offset}):`,
            error
          );
          return [];
        }
      };

      // SMART AUTO-INCREASING OFFSET STRATEGY
      // Try progressively larger offsets for inactive wallets
      const offsets = [100, 500, 1000, 2500];

      console.log(
        `[fetchWalletTransactions] Starting transaction fetch with offsets: ${offsets.join(", ")}`
      );
      onProgress?.("Fetching transactions...");

      for (let i = 0; i < offsets.length; i++) {
        const offset = offsets[i]!;
        console.log(
          `[fetchWalletTransactions] Attempt ${i + 1}/${offsets.length} with offset ${offset}...`
        );
        onProgress?.(`Fetching transactions (attempt ${i + 1}/${offsets.length})...`);
        const transactions = await fetchWithOffset(offset);

        // If we found transactions, return them immediately
        if (transactions.length > 0) {
          console.log(
            `[fetchWalletTransactions] ✅ Found ${transactions.length} transactions at offset ${offset}`
          );
          onProgress?.(`Found ${transactions.length} transactions`);
          return transactions;
        }

        console.log(`[fetchWalletTransactions] No transactions at offset ${offset}`);

        // If this isn't the last attempt, wait before trying the next offset
        // to respect rate limits
        if (i < offsets.length - 1) {
          console.log(`[fetchWalletTransactions] Waiting 500ms before next attempt...`);
          await sleep(500);
        }
      }

      // No transactions found at any offset
      console.log(`[fetchWalletTransactions] ❌ No transactions found at any offset`);
      onProgress?.("No transactions found");
      return [];
    } catch (error) {
      // Error handled silently
      console.error(`[fetchWalletTransactions] ❌ Error during fetch:`, error);
      onProgress?.("Error fetching transactions");
      return [];
    } finally {
      // Remove from pending cache when done (prevents memory leaks)
      pendingFetches.delete(cacheKey);
    }
  })();

  // Store and return the promise
  pendingFetches.set(cacheKey, fetchPromise);

  // Cache the result when fetch completes
  fetchPromise.then((result) => {
    txCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(
      `[fetchWalletTransactions] 💾 Cached ${result.length} transactions for ${cacheKey.substring(0, 16)}...`
    );
    return result;
  });

  return fetchPromise;
};

// Updated: Accepts knownDecimals to force correct parsing
export const fetchTokenBalance = async (
  walletAddress: string,
  tokenAddress: string,
  knownDecimals?: number
): Promise<number> => {
  try {
    const url = `${EXPLORER_API_V1}?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest`;
    const res = await fetchSafe(url);
    const data = await res.json();
    if (data.status === "1" && data.result) {
      const decimals =
        knownDecimals !== undefined
          ? knownDecimals
          : getDecimals(tokenAddress, null, AssetType.TOKEN);
      return parseBalance(data.result, decimals);
    }
    return 0;
  } catch {
    return 0;
  }
};

// Fetch distinct token/NFT contracts a wallet has interacted with recently
// --- Whale Contract Enumeration ---

// Known high-volume whale addresses on Dogechain for contract discovery
// These are wallets that have interacted with many contracts
const WHALE_ADDRESSES = [
  "0x352569c5392c81d2442d66608f4755b967420729", // Dogechain Bridge
  "0x7b4328c127b85369d9f82ca0503b000d09cf9180", // Dogechain token contract
  // Add more whale addresses as discovered
];

/**
 * Scan whale wallets to discover all contracts they've interacted with
 * This helps find assets that were minted but never transferred by the target wallet
 */
export const scanWhaleContracts = async (
  onProgress?: (message: string) => void
): Promise<Set<string>> => {
  const discoveredContracts = new Set<string>();
  const scheduler = new AdaptiveRequestScheduler();

  onProgress?.("Scanning whale wallets for contracts...");

  for (const whale of WHALE_ADDRESSES) {
    try {
      // Use tokentx endpoint to get all transfers (tokens + NFTs)
      // Reduced from 5 to 3 offsets for better performance
      const offsets = [100, 1000, 5000];

      for (const offset of offsets) {
        await sleep(2000);
        const url = `${EXPLORER_API_V1}?module=account&action=tokentx&address=${whale}&page=1&offset=${offset}&sort=desc`;
        const res = await scheduler.schedule(() => fetchSafe(url));

        if (res.ok) {
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            json.result.forEach((tx: any) => {
              const contract = tx.contractAddress || tx.contract;
              if (contract) {
                discoveredContracts.add(contract.toLowerCase());
              }
            });
          }
        }
      }
    } catch {
      // Error in operation
    }
  }
  onProgress?.(`Discovered ${discoveredContracts.size} contracts from whale wallets`);

  return discoveredContracts;
};

/**
 * Check if a wallet holds a balance in a specific contract
 */
export const checkTokenBalance = async (
  walletAddress: string,
  contractAddress: string
): Promise<{ balance: string; hasBalance: boolean }> => {
  try {
    const url = `${EXPLORER_API_V1}?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}`;
    const res = await fetchSafe(url);

    if (res.ok) {
      const json = await res.json();
      if (json.status === "1" && json.result !== undefined) {
        const balance = json.result;
        const hasBalance = balance !== "0" && balance !== "" && parseFloat(balance) > 0;
        return { balance, hasBalance };
      }
    }

    return { balance: "0", hasBalance: false };
  } catch {
    // Error handled silently

    return { balance: "0", hasBalance: false };
  }
};

// DEPRECATED: Use fetchWalletAssetsHybrid for comprehensive scanning
export const fetchWalletAssets = async (
  walletAddress: string
): Promise<{ tokens: Token[]; nfts: Token[] }> => {
  try {
    const cleanWallet = validateWalletAddress(walletAddress);

    const tokensMap = new Map<string, Token & { hits: number }>();
    const nftsMap = new Map<string, Token & { hits: number }>();

    // Helper to record assets
    const recordAsset = (
      contract: string | undefined,
      symbol: string | undefined,
      name: string | undefined,
      decimals: number | undefined,
      type: AssetType
    ) => {
      if (!contract) return;
      const lower = contract.toLowerCase();
      const targetMap = type === AssetType.NFT ? nftsMap : tokensMap;
      const existing = targetMap.get(lower);
      const base: Token & { hits: number } = existing || {
        address: contract,
        symbol: symbol || (type === AssetType.NFT ? "NFT" : "TOKEN"),
        name: name || (type === AssetType.NFT ? "NFT Collection" : "Token"),
        totalSupply: 0,
        decimals: decimals ?? (type === AssetType.NFT ? 0 : 18),
        type,
        hits: 0,
      };
      base.hits += 1;
      // Update metadata if newly available
      if (symbol && !existing?.symbol) base.symbol = symbol;
      if (name && !existing?.name) base.name = name;
      if (decimals !== undefined && base.decimals === undefined) base.decimals = decimals;
      targetMap.set(lower, base);
    };

    const fetchTransfersV1 = async (action: "tokentx" | "tokennfttx", offsets: number[]) => {
      for (const offset of offsets) {
        try {
          const res = await fetchSafe(
            `${EXPLORER_API_V1}?module=account&action=${action}&address=${cleanWallet}&page=1&offset=${offset}&sort=desc`
          );
          if (!res.ok) continue;
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            return json.result as any[];
          }
        } catch {
          // try next offset on 400/other failures
          continue;
        }
      }
      return [];
    };

    const fetchTransfersV2 = async (maxPages = 3) => {
      const collected: any[] = [];
      for (let page = 1; page <= maxPages; page++) {
        try {
          const res = await fetchSafe(
            `${EXPLORER_API_V2}?path=/v2/addresses/${cleanWallet}/token-transfers&page=${page}&limit=200`
          );
          if (!res.ok) break;
          const json = await res.json();
          if (!Array.isArray(json?.items) || json.items.length === 0) break;
          collected.push(...json.items);
        } catch {
          break;
        }
      }
      return collected;
    };

    const fetchBalancesV2 = async (maxPages = 3) => {
      const collected: any[] = [];
      for (let page = 1; page <= maxPages; page++) {
        try {
          const res = await fetchSafe(
            `${EXPLORER_API_V2}?path=/v2/addresses/${cleanWallet}/token-balances&page=${page}&limit=200`
          );
          if (!res.ok) break;
          const json = await res.json();
          if (!Array.isArray(json?.items) || json.items.length === 0) break;
          collected.push(...json.items);
        } catch {
          break;
        }
      }
      return collected;
    };

    // Fungible transfers (V1 first, fallback to V2 ERC-20)
    let ftTransfers = await fetchTransfersV1("tokentx", [100, 50, 20]);
    if (ftTransfers.length === 0) {
      ftTransfers = await fetchTransfersV2();
    }
    ftTransfers.forEach((tx: any) => {
      // V2 uses different shape (token object)
      const decimals = tx.tokenDecimal
        ? parseInt(tx.tokenDecimal)
        : tx.token?.decimals
          ? parseInt(tx.token.decimals)
          : undefined;
      const address = tx.contractAddress || tx.contract || tx.token?.address;
      const symbol = tx.tokenSymbol || tx.token?.symbol;
      const name = tx.tokenName || tx.token?.name;
      recordAsset(address, symbol, name, decimals, AssetType.TOKEN);
    });

    // NFT discovery: try V2 transfers, then V2 balances, then small V1 probe with tiny offsets to avoid 400 spam
    const nftTransfersV2 = await fetchTransfersV2();
    const nftBalancesV2 = nftTransfersV2.length === 0 ? await fetchBalancesV2() : [];

    const recordFromV2 = (entry: any) => {
      const address = entry.contractAddress || entry.contract || entry.token?.address;
      const symbol = entry.tokenSymbol || entry.token?.symbol;
      const name = entry.tokenName || entry.token?.name;
      recordAsset(address, symbol, name, 0, AssetType.NFT);
    };

    nftTransfersV2.forEach(recordFromV2);
    nftBalancesV2.forEach(recordFromV2);

    if (nftTransfersV2.length === 0 && nftBalancesV2.length === 0) {
      const smallOffsets = [10, 5, 3];
      for (const off of smallOffsets) {
        try {
          const v1 = await fetchTransfersV1("tokennfttx", [off]);
          v1.forEach((tx: any) => {
            recordAsset(
              tx.contractAddress || tx.contract,
              tx.tokenSymbol,
              tx.tokenName,
              0,
              AssetType.NFT
            );
          });
          if (v1.length > 0) break;
        } catch {
          break;
        }
      }
    }

    // Sort by interaction count desc
    const sortByHits = (items: Map<string, Token & { hits: number }>) =>
      Array.from(items.values())
        .sort((a, b) => b.hits - a.hits)
        .map(({ hits: _hits, ...rest }) => rest);

    return {
      tokens: sortByHits(tokensMap),
      nfts: sortByHits(nftsMap),
    };
  } catch {
    // Error handled silently

    return { tokens: [], nfts: [] };
  }
};

// --- HYBRID WALLET SCANNER ---

/**
 * Comprehensive hybrid wallet scanner with multi-pass strategy
 * Detects ALL tokens and NFTs while avoiding rate limits
 */
export const fetchWalletAssetsHybrid = async (
  walletAddress: string,
  onProgress?: (update: ScanProgressUpdate) => void,
  forceRefresh: boolean = false,
  abortSignal?: AbortSignal
): Promise<{ tokens: Token[]; nfts: Token[]; metadata: ScanMetadata }> => {
  const startTime = Date.now();

  // Check for abort request at the start
  if (abortSignal?.aborted) {
    throw new Error("Scan cancelled");
  }
  const scheduler = new AdaptiveRequestScheduler();

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = await loadScanCache(walletAddress);
      if (cached) {
        return {
          tokens: cached.tokens,
          nfts: cached.nfts,
          metadata: cached.scanMetadata,
        };
      }
    } catch {
      // Error in operation
    }
  }

  try {
    const cleanWallet = validateWalletAddress(walletAddress);

    // Asset registries for deduplication
    const tokensMap = new Map<string, Token & { hits: number }>();
    const nftsMap = new Map<string, Token & { hits: number }>();
    let totalRequests = 0;
    const phasesCompleted: string[] = [];
    let newAssetsFound = 0; // Declare here so it's accessible after catch block

    // Helper to record assets
    const recordAsset = (
      contract: string | undefined,
      symbol: string | undefined,
      name: string | undefined,
      decimals: number | undefined,
      type: AssetType
    ) => {
      if (!contract) return;
      const lower = contract.toLowerCase();
      const targetMap = type === AssetType.NFT ? nftsMap : tokensMap;
      const existing = targetMap.get(lower);
      const base: Token & { hits: number } = existing || {
        address: contract,
        symbol: symbol || (type === AssetType.NFT ? "NFT" : "TOKEN"),
        name: name || (type === AssetType.NFT ? "NFT Collection" : "Token"),
        totalSupply: 0,
        decimals: decimals ?? (type === AssetType.NFT ? 0 : 18),
        type,
        hits: 0,
        priceUsd: 0,
      };
      base.hits += 1;
      // Update metadata if newly available
      if (symbol && !existing?.symbol) base.symbol = symbol;
      if (name && !existing?.name) base.name = name;
      if (decimals !== undefined && base.decimals === undefined) base.decimals = decimals;
      targetMap.set(lower, base);
    };

    // Helper to trigger progress callback
    const triggerProgress = (
      phase: ScanProgressUpdate["phase"],
      progress: number,
      operation: string
    ) => {
      if (onProgress) {
        onProgress({
          phase,
          progress,
          tokens: Array.from(tokensMap.values()).map(({ hits: _hits, ...rest }) => rest),
          nfts: Array.from(nftsMap.values()).map(({ hits: _hits, ...rest }) => rest),
          currentOperation: operation,
          totalRequests,
        });
      }
    };

    // Helper to fetch V1 with offsets
    const fetchV1Offsets = async (action: string, offsets: number[], delayMs: number) => {
      const results: any[] = [];
      for (const offset of offsets) {
        try {
          await sleep(delayMs);
          totalRequests++;
          const res = await scheduler.schedule(() =>
            fetchSafe(
              `${EXPLORER_API_V1}?module=account&action=${action}&address=${cleanWallet}&page=1&offset=${offset}&sort=desc`
            )
          );
          if (!res.ok) continue;
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            results.push(...json.result);
          }
        } catch {
          // Error handled silently

          continue;
        }
      }
      return results;
    };

    // --- PHASE 1: QUICK V1 PROBE (2-3 seconds) ---
    triggerProgress("quick", 5, "Starting quick V1 probe...");

    // V1 NFT probe (small offset to detect NFT contracts)
    try {
      await sleep(1000);
      totalRequests++;
      const v1NftProbe = await scheduler.schedule(() =>
        fetchSafe(
          `${EXPLORER_API_V1}?module=account&action=tokennfttx&address=${cleanWallet}&page=1&offset=20&sort=desc`
        )
      );
      if (v1NftProbe.ok) {
        const nftJson = await v1NftProbe.json();
        if (nftJson.status === "1" && Array.isArray(nftJson.result)) {
          nftJson.result.forEach((tx: any) => {
            recordAsset(
              tx.contractAddress || tx.contract,
              tx.tokenSymbol,
              tx.tokenName,
              0,
              AssetType.NFT
            );
          });
        }
      }
    } catch {
      // Error loading cache
    }

    phasesCompleted.push("quick");
    triggerProgress(
      "quick",
      15,
      `Quick V1 probe complete: ${tokensMap.size} tokens, ${nftsMap.size} NFTs found`
    );

    // --- PHASE 2: DEEP V1 SCAN (60-90 seconds) ---
    triggerProgress("deep-v1", 40, "Starting deep V1 scan...");

    // COMPREHENSIVE ASSET SEARCH - Using tokentx for both tokens and NFTs
    // The tokennfttx endpoint returns 400 errors, so we use tokentx instead
    // and detect contract types to distinguish NFTs from tokens
    const nftOffsetsRecent = [10, 20, 50, 100];
    const nftOffsetsMedium = [200, 500, 1000];
    const nftOffsetsLarge = [2000, 5000, 10000];

    // Combine all offsets (removed 20000, 50000 to improve performance)
    const allNftOffsets = [...nftOffsetsRecent, ...nftOffsetsMedium, ...nftOffsetsLarge];

    // Use tokentx endpoint (works for both tokens and NFTs)
    const v1AllTransfers = await fetchV1Offsets("tokentx", allNftOffsets, 2000);

    // Extract unique contract addresses
    const uniqueContracts = new Set<string>();
    v1AllTransfers.forEach((tx: any) => {
      const contract = tx.contractAddress || tx.contract;
      if (contract) uniqueContracts.add(contract.toLowerCase());
    });

    // Detect contract types (batch processing to avoid rate limits)
    const detectedTypes = new Map<string, AssetType>();
    const contractsArray = Array.from(uniqueContracts);

    try {
      // Process in batches of 5 to respect rate limit (60 req/min)
      for (let i = 0; i < contractsArray.length; i += 5) {
        const batch = contractsArray.slice(i, i + 5);

        for (const contract of batch) {
          try {
            // Check cache first to avoid redundant API calls
            const cached = getCachedMetadata(contract);
            if (cached?.type) {
              detectedTypes.set(contract, cached.type);
              continue;
            }

            await sleep(2000); // 2 second delay between detections
            const type = await detectContractType(contract);
            if (type) {
              detectedTypes.set(contract, type);

              // Cache the detected type for future use
              const meta = {
                symbol: cached?.symbol || "UNKNOWN",
                name: cached?.name || "Unknown Asset",
                decimals: type === AssetType.NFT ? 0 : 18,
                type,
              };
              saveMetadataToCache(contract, meta);
            }
          } catch {
            // Continue with other contracts even if one fails
          }
        }

        const progress = 40 + ((i + batch.length) / contractsArray.length) * 25;
        triggerProgress(
          "deep-v1",
          Math.floor(progress),
          `Detecting contract types... ${Math.floor(((i + batch.length) / contractsArray.length) * 100)}%`
        );
      }
    } catch {
      // Continue anyway - transfers will be categorized as TOKEN by default
    }

    // Categorize transfers based on detected contract types
    v1AllTransfers.forEach((tx: any) => {
      const contract = (tx.contractAddress || tx.contract)?.toLowerCase();
      const decimals = tx.tokenDecimal ? parseInt(tx.tokenDecimal) : undefined;
      const symbol = tx.tokenSymbol;
      const name = tx.tokenName;

      // Use detected type or fallback to TOKEN
      const detectedType = detectedTypes.get(contract);
      const type = detectedType || AssetType.TOKEN;

      if (type === AssetType.NFT) {
        recordAsset(contract, symbol, name, decimals, AssetType.NFT);
      } else {
        recordAsset(contract, symbol, name, decimals, AssetType.TOKEN);
      }
    });

    phasesCompleted.push("deep-v1");
    triggerProgress(
      "deep-v1",
      65,
      `Deep V1 scan complete: ${tokensMap.size} tokens, ${nftsMap.size} NFTs found`
    );

    // --- PHASE 3: WHALE ENUMERATION (3-8 minutes) ---
    triggerProgress("whale-scan", 80, "Discovering contracts from whale wallets...");

    try {
      // Try to load discovered contracts from database
      let discoveredContracts = await loadDiscoveredContracts();
      const needsRefresh =
        discoveredContracts.length === 0 ||
        discoveredContracts.some((c) => (c.lastSeenAt || 0) < Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

      if (needsRefresh) {
        triggerProgress("whale-scan", 80, "Scanning whale wallets (one-time setup)...");

        // Scan whale wallets to discover contracts
        const whaleContracts = await scanWhaleContracts((_msg) => {
          // Progress callback
        });

        // Detect types and save to database
        const contractsToSave: DbDiscoveredContracts[] = [];
        const contractsArray = Array.from(whaleContracts);

        // Process contracts in batches
        for (let i = 0; i < contractsArray.length; i += 10) {
          const batch = contractsArray.slice(i, i + 10);

          for (const contract of batch) {
            try {
              await sleep(1000);

              // Check cache for existing metadata
              const cached = getCachedMetadata(contract);
              const type = cached?.type || (await detectContractType(contract));

              if (type) {
                contractsToSave.push({
                  contractAddress: contract,
                  type: type === AssetType.NFT ? "NFT" : "TOKEN",
                  symbol: cached?.symbol,
                  name: cached?.name,
                  discoveredAt: Date.now(),
                  lastSeenAt: Date.now(),
                });
              }
            } catch {
              // Error in discovered contracts
            }
          }

          const progress = 80 + ((i + batch.length) / contractsArray.length) * 5;
          triggerProgress(
            "whale-scan",
            Math.floor(progress),
            `Processing whale contracts... ${Math.floor(((i + batch.length) / contractsArray.length) * 100)}%`
          );
        }

        // Save to database
        if (contractsToSave.length > 0) {
          await saveDiscoveredContracts(contractsToSave);
        }

        discoveredContracts = contractsToSave;
      }

      // Check balances for all discovered contracts
      triggerProgress("whale-scan", 85, "Verifying holdings in discovered contracts...");

      // newAssetsFound already declared above
      const checkedContracts = new Set<string>();

      for (let i = 0; i < discoveredContracts.length; i += 20) {
        const batch = discoveredContracts.slice(i, i + 20);

        for (const dbContract of batch) {
          try {
            const contract = dbContract.contractAddress;

            // Skip if we already found this contract in earlier phases
            if (tokensMap.has(contract) || nftsMap.has(contract)) {
              continue;
            }

            // Check if user holds balance
            await sleep(1000);
            const { hasBalance } = await checkTokenBalance(cleanWallet, contract);

            if (hasBalance) {
              const type = dbContract.type === "NFT" ? AssetType.NFT : AssetType.TOKEN;
              recordAsset(
                contract,
                dbContract.symbol,
                dbContract.name,
                type === AssetType.NFT ? 0 : 18,
                type
              );
              newAssetsFound++;
            }

            checkedContracts.add(contract);
          } catch {
            // Error checking contract
          }
        }

        const progress = 85 + ((i + batch.length) / discoveredContracts.length) * 15;
        triggerProgress(
          "whale-scan",
          Math.floor(progress),
          `Checking discovered contracts... ${Math.floor(((i + batch.length) / discoveredContracts.length) * 100)}%`
        );
      }
    } catch {
      // Continue anyway - this is an optional phase
    }

    if (newAssetsFound > 0) {
      // New assets were found
    }

    phasesCompleted.push("whale-scan");

    // --- PHASE 4: LP POOL DETECTION (5-10 seconds) ---
    try {
      triggerProgress("lp-detection", 95, "Detecting liquidity pool contracts...");

      // Import LP detection utilities
      const { loadAllLPPairs, LP_DETECTION_ENABLED } = await import("./lpDetection");

      // Check if LP detection is enabled
      if (LP_DETECTION_ENABLED) {
        // Load all cached LP pairs from database
        const allLPPairs = await loadAllLPPairs();

        if (allLPPairs.length > 0) {
          let foundLPPairs = 0;

          // Check balances for LP pairs in batches
          for (let i = 0; i < allLPPairs.length; i += 20) {
            const batch = allLPPairs.slice(i, i + 20);

            for (const lpPair of batch) {
              try {
                // Check if wallet holds this LP token
                const { hasBalance } = await checkTokenBalance(walletAddress, lpPair.pairAddress);

                if (hasBalance) {
                  // Add LP token to discovered tokens
                  const tokenKey = lpPair.pairAddress.toLowerCase();

                  if (!tokensMap.has(tokenKey)) {
                    tokensMap.set(tokenKey, {
                      address: lpPair.pairAddress,
                      symbol: "LP",
                      name: `${lpPair.dexName} LP`,
                      decimals: 18, // LP tokens always 18 decimals
                      type: AssetType.TOKEN,
                      totalSupply: 0, // LP pairs don't have a fixed total supply
                      hits: 1,
                    });

                    foundLPPairs++;
                    console.log(
                      `[LP Detection] Found LP pair: ${lpPair.dexName} - ${lpPair.pairAddress}`
                    );
                  }
                }
              } catch {
                // Continue on error - individual LP check failures shouldn't break the scan
              }
            }

            // Update progress
            const progress =
              95 + ((i + Math.min(20, allLPPairs.length - i)) / allLPPairs.length) * 5;
            triggerProgress(
              "lp-detection",
              Math.floor(progress),
              `Checking LP pairs... ${Math.floor(((i + Math.min(20, allLPPairs.length - i)) / allLPPairs.length) * 100)}%`
            );
          }

          if (foundLPPairs > 0) {
            console.log(
              `[LP Detection] Found ${foundLPPairs} LP pairs for wallet ${walletAddress}`
            );
          }
        } else {
          // No LP pairs found
        }
      } else {
        // No transactions to scan
      }
    } catch {
      // Error handled silently
      // Non-critical phase - continue anyway
    }

    phasesCompleted.push("lp-detection");

    // Sort by interaction count
    const sortByHits = (items: Map<string, Token & { hits: number }>) =>
      Array.from(items.values())
        .sort((a, b) => b.hits - a.hits)
        .map(({ hits: _hits, ...rest }) => rest);

    const finalTokens = sortByHits(tokensMap);
    const finalNfts = sortByHits(nftsMap);

    const duration = Date.now() - startTime;
    const metadata: ScanMetadata = {
      totalRequests,
      phasesCompleted,
      totalPages: 0, // V2 pagination removed
      duration,
    };

    // Save to cache
    await saveScanCache(walletAddress, finalTokens, finalNfts, metadata);

    // Submit scan results to learning database (non-blocking, fire-and-forget)
    submitWalletScanResults(walletAddress, finalTokens, finalNfts).catch((_err) => {});

    triggerProgress(
      "complete",
      100,
      `Complete: ${finalTokens.length} tokens, ${finalNfts.length} NFTs in ${Math.floor(duration / 1000)}s`
    );

    return {
      tokens: finalTokens,
      nfts: finalNfts,
      metadata,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Scan cancelled") {
      throw err;
    }

    throw err;
  }
};

export const findInteractions = async (
  targetWallet: Wallet,
  allWallets: Wallet[],
  tokenAddress: string
): Promise<Link[]> => {
  try {
    const url = `${EXPLORER_API_V1}?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${targetWallet.address}&page=1&offset=100`;
    const res = await fetchSafe(url);
    const data = await res.json();
    const newLinks: Link[] = [];

    if (data.result && Array.isArray(data.result)) {
      data.result.forEach((tx: any) => {
        const other =
          tx.from.toLowerCase() === targetWallet.address.toLowerCase() ? tx.to : tx.from;
        const match = allWallets.find((w) => w.address.toLowerCase() === other.toLowerCase());
        if (match && match.id !== targetWallet.id) {
          newLinks.push({ source: targetWallet.id, target: match.id, value: 1 });
        }
      });
    }
    return newLinks;
  } catch {
    return [];
  }
};
