import React, { useState, useEffect, useCallback, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Navbar } from "./components/Navbar";
import { BubbleMap } from "./components/BubbleMap";
import { WalletSidebar } from "./components/WalletSidebar";
import { Dashboard } from "./components/Dashboard";
import { Footer } from "./components/Footer";
import { ToastContainer, ToastMessage, ToastType } from "./components/Toast";
import { BlockchainBackground } from "./components/BlockchainBackground";
import { TokenSearchInput } from "./components/TokenSearchInput";
import {
  Token,
  Wallet,
  Link,
  Connection,
  ViewState,
  AssetType,
  AlertConfig,
  AlertStatus,
  TriggeredEvent,
  ScanProgressUpdate,
} from "./types";
import {
  fetchTokenData,
  fetchTokenHolders,
  fetchTokenBalance,
  fetchWalletTransactions,
  findInteractions,
  fetchWalletAssetsHybrid,
  checkTokenBalance,
  detectContractType,
  fetchMetadataFromTransfers,
} from "./services/dataService";
import { logSearchQuery, getTrendingAssets } from "./services/trendingService";
import { fetchConnectionDetails } from "./services/connectionService";

// Helper functions from dataService (accessed via global scope or re-export)
const getCachedMetadata = (address: string) => {
  try {
    const cacheRaw = localStorage.getItem("doge_token_metadata_cache_v2");
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw);
    return cache[address.toLowerCase()];
  } catch {
    return null;
  }
};

const saveMetadataToCache = (
  address: string,
  data: { symbol: string; name: string; decimals: number; type: AssetType }
) => {
  try {
    const cacheRaw = localStorage.getItem("doge_token_metadata_cache_v2");
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    cache[address.toLowerCase()] = { ...data, timestamp: Date.now() };
    localStorage.setItem("doge_token_metadata_cache_v2", JSON.stringify(cache));
  } catch (_e) {
    console.warn("Failed to save token metadata");
  }
};
import {
  db,
  toDbAlert,
  fromDbAlert,
  toDbTriggeredEvent,
  fromDbTriggeredEvent,
  deduplicateTrendingAssets,
  deduplicateRecentSearches,
  saveWalletForcedContracts,
  loadWalletForcedContracts,
  loadScanCache,
} from "./services/db";
import {
  Loader2,
  Users,
  Layers,
  Image as ImageIcon,
  Coins,
  History,
  Menu,
  X,
  Share2,
  Download,
  RefreshCw,
  TrendingUp,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Box,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Wallet as WalletIcon,
  ScanLine,
  CircleDollarSign,
  Shield,
  ExternalLink,
} from "lucide-react";

interface RecentSearch {
  query: string;
  type: AssetType;
  timestamp: number;
  symbol?: string;
}

// Interface for Trending Data
interface TrendingAsset {
  symbol: string;
  name: string;
  address: string;
  type: AssetType;
  hits: number; // Number of times searched/viewed
}

// Initial Real Data (Verified Contracts)
const INITIAL_TRENDING: TrendingAsset[] = [
  {
    symbol: "wDOGE",
    name: "Wrapped Doge",
    address: "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101",
    type: AssetType.TOKEN,
    hits: 100,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xe3f5a90f9cb311505cd691a46596599aa1a0ad7d",
    type: AssetType.TOKEN,
    hits: 85,
  },
  {
    symbol: "DC",
    name: "Dogechain",
    address: "0x7B4328c127B85369D9f82ca0503B000D09CF9180",
    type: AssetType.TOKEN,
    hits: 70,
  },
  {
    symbol: "DPunks",
    name: "RealDogePunks",
    address: "0xd38b22794b308a2e55808a13d1e6a80c4be94fd5",
    type: AssetType.NFT,
    hits: 50,
  },
];

// Deduplicate trending assets in memory by address
function deduplicateTrendingAssetsInMemory(assets: TrendingAsset[]): TrendingAsset[] {
  const seen = new Map<string, TrendingAsset>();

  for (const asset of assets) {
    const normalizedAddress = asset.address.toLowerCase();
    const existing = seen.get(normalizedAddress);

    // Keep the asset with higher hits count
    if (!existing || asset.hits > existing.hits) {
      seen.set(normalizedAddress, asset);
    }
  }

  return Array.from(seen.values());
}

// Safe unique ID generator for alerts
const generateAlertId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<AssetType>(AssetType.TOKEN);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Hybrid scan state
  const [scanState, setScanState] = useState<{
    phase:
      | "idle"
      | "quick"
      | "deep-v2"
      | "deep-v1"
      | "balance-check"
      | "whale-scan"
      | "lp-detection"
      | "complete"
      | "error";
    progress: number; // 0-100
    tokensFound: number;
    nftsFound: number;
    currentOperation: string;
    startTime: number;
  }>({
    phase: "idle",
    progress: 0,
    tokensFound: 0,
    nftsFound: 0,
    currentOperation: "",
    startTime: 0,
  });

  // Use ref to track start time without causing re-renders
  const scanStartTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [token, setToken] = useState<Token | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [holdersPage, setHoldersPage] = useState(1);
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Mobile UI State
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // State with IndexedDB persistence
  const [trendingAssets, setTrendingAssets] = useState<TrendingAsset[]>(INITIAL_TRENDING);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, AlertStatus>>({});
  const [triggeredEvents, setTriggeredEvents] = useState<TriggeredEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [walletAssets, setWalletAssets] = useState<{ tokens: Token[]; nfts: Token[] }>({
    tokens: [],
    nfts: [],
  });
  const [forcedAssets, setForcedAssets] = useState<{ tokens: Token[]; nfts: Token[] }>({
    tokens: [],
    nfts: [],
  });
  const [forcedContracts, setForcedContracts] = useState<string[]>([]); // No hardcoded contracts - user adds manually
  const [contractInput, setContractInput] = useState("");
  const [isScanningWallet, setIsScanningWallet] = useState(false);
  const [walletScanError, setWalletScanError] = useState<string | null>(null);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load alerts
        const dbAlerts = await db.alerts.toArray();
        const loadedAlerts = dbAlerts.map(fromDbAlert);

        // Ensure unique alert IDs in case older data used timestamp collisions
        const uniqueAlerts: AlertConfig[] = [];
        const seenIds = new Set<string>();
        const remappedIds = new Map<string, string>(); // oldId -> newId

        for (const alert of loadedAlerts) {
          const originalId = alert.id;
          let id = originalId;
          if (seenIds.has(id)) {
            id = generateAlertId();
            remappedIds.set(originalId, id);
          }
          seenIds.add(id);
          uniqueAlerts.push({ ...alert, id });
        }

        setAlerts(uniqueAlerts);

        // Load alert statuses
        const dbStatuses = await db.alertStatuses.toArray();
        const statusesMap: Record<string, AlertStatus> = {};
        dbStatuses.forEach((s) => {
          const mappedId = remappedIds.get(s.alertId) || s.alertId;
          if (seenIds.has(mappedId)) {
            statusesMap[mappedId] = {
              currentValue: s.currentValue,
              triggered: s.triggered,
              checkedAt: s.checkedAt,
              notified: s.notified,
              lastSeenTransactions: s.lastSeenTransactions,
            };
          }
        });
        setAlertStatuses(statusesMap);

        // Load triggered events
        const dbEvents = await db.triggeredEvents
          .orderBy("triggeredAt")
          .reverse()
          .limit(100)
          .toArray();
        const loadedEvents = dbEvents.map(fromDbTriggeredEvent).map((event) => {
          const mappedId = remappedIds.get(event.alertId) || event.alertId;
          return { ...event, alertId: mappedId };
        });
        setTriggeredEvents(loadedEvents);

        // Load trending assets and deduplicate
        const dbTrending = await db.trendingAssets.toArray();
        if (dbTrending.length > 0) {
          // Deduplicate in-memory to protect state
          const deduplicated = deduplicateTrendingAssetsInMemory(
            dbTrending as unknown as TrendingAsset[]
          );
          setTrendingAssets(deduplicated);

          // Also deduplicate in database to prevent future issues
          await deduplicateTrendingAssets();
        } else {
          // Initialize with default trending assets
          await db.trendingAssets.bulkAdd(
            INITIAL_TRENDING.map((asset) => ({
              symbol: asset.symbol,
              name: asset.name,
              address: asset.address,
              type: asset.type,
              hits: asset.hits,
            }))
          );
        }

        // Load recent searches and deduplicate
        const dbRecents = await db.recentSearches
          .orderBy("timestamp")
          .reverse()
          .limit(20)
          .toArray();
        const seen = new Map<string, any>(); // query -> most recent entry

        // Keep only the most recent entry for each query (case-insensitive)
        for (const r of dbRecents) {
          const key = r.query.toLowerCase();
          if (!seen.has(key)) {
            seen.set(key, {
              query: r.query,
              type: r.type as AssetType,
              timestamp: r.timestamp,
              symbol: r.symbol,
            });
          }
        }

        const deduplicatedRecents = Array.from(seen.values()).slice(0, 5);
        setRecentSearches(deduplicatedRecents);

        // Also deduplicate in database to prevent future issues
        await deduplicateRecentSearches();

        // Initialize token search index
        try {
          const { initializeTokenSearchIndex } = await import("./services/tokenSearchService");
          await initializeTokenSearchIndex();
        } catch (error) {
          console.error("[App] Failed to initialize token search index:", error);
        }

        setDbLoaded(true);
      } catch (error) {
        console.error("Failed to load data from IndexedDB:", error);
        // If there's an error loading from database, just use defaults
        setTrendingAssets(INITIAL_TRENDING);
        setDbLoaded(true);
      }
    };

    loadData();
  }, []);

  // Fetch server-side trending on mount and refresh periodically
  useEffect(() => {
    const fetchServerTrending = async () => {
      try {
        const serverTrending = await getTrendingAssets("ALL", 20);

        if (serverTrending.length > 0) {
          // Convert server format to local TrendingAsset format
          const converted = serverTrending.map((asset) => ({
            symbol: asset.symbol || (asset.type === "NFT" ? "NFT" : "TOKEN"),
            name: asset.name || (asset.type === "NFT" ? "NFT Collection" : "Token"),
            address: asset.address,
            type: asset.type as AssetType,
            hits: Math.round(asset.velocityScore),
          }));

          setTrendingAssets(converted);
        }
      } catch {
        // Server fetch failed, keeping local trending
      }
    };

    // Fetch server trending immediately after mount
    fetchServerTrending();

    // Refresh every 15 minutes
    const interval = setInterval(fetchServerTrending, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Save alerts to IndexedDB when they change
  useEffect(() => {
    if (!dbLoaded) return;

    const saveAlerts = async () => {
      try {
        const dbAlerts = alerts.map(toDbAlert);
        await db.alerts.clear();
        await db.alerts.bulkAdd(dbAlerts);
      } catch (error) {
        console.error("Failed to save alerts to IndexedDB:", error);
      }
    };

    saveAlerts();
  }, [alerts, dbLoaded]);

  // Save alert statuses to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveStatuses = async () => {
      try {
        await db.alertStatuses.clear();
        const payload = Object.entries(alertStatuses).map(([alertId, status]) => ({
          alertId,
          currentValue: status.currentValue,
          triggered: status.triggered,
          checkedAt: status.checkedAt,
          notified: status.notified,
          lastSeenTransactions: status.lastSeenTransactions,
        }));
        // bulkPut avoids duplicate-key failures when the array contains the same alertId
        await db.alertStatuses.bulkPut(payload);
      } catch (error) {
        console.error("Failed to save alert statuses to IndexedDB:", error);
      }
    };

    saveStatuses();
  }, [alertStatuses, dbLoaded]);

  // Normalize alerts in-memory to guarantee unique IDs and keep related state aligned
  useEffect(() => {
    if (!dbLoaded || alerts.length === 0) return;

    const seen = new Set<string>();
    const idRemap = new Map<string, string>(); // oldId -> newId
    let changed = false;

    const normalizedAlerts = alerts.map((alert) => {
      const originalId = alert.id;
      if (seen.has(originalId)) {
        const newId = generateAlertId();
        idRemap.set(originalId, newId);
        seen.add(newId);
        changed = true;
        return { ...alert, id: newId };
      }
      seen.add(originalId);
      return alert;
    });

    if (!changed) return;

    // Remap statuses to new IDs, drop any without a corresponding alert
    setAlertStatuses((prev) => {
      const next: Record<string, AlertStatus> = {};
      normalizedAlerts.forEach((alert) => {
        const sourceId =
          [...idRemap.entries()].find(([, newId]) => newId === alert.id)?.[0] || alert.id;
        if (prev[sourceId]) {
          next[alert.id] = prev[sourceId];
        }
      });
      return next;
    });

    // Remap triggered events to new IDs and drop orphans
    setTriggeredEvents((prev) =>
      prev
        .map((event) => {
          const mappedId = idRemap.get(event.alertId);
          return mappedId ? { ...event, alertId: mappedId } : event;
        })
        .filter((event) => seen.has(event.alertId))
    );

    setAlerts(normalizedAlerts);
  }, [alerts, dbLoaded]);

  // Save triggered events to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveEvents = async () => {
      try {
        const dbEvents = triggeredEvents.map(toDbTriggeredEvent);
        await db.triggeredEvents.clear();
        await db.triggeredEvents.bulkAdd(dbEvents);
      } catch (error) {
        console.error("Failed to save triggered events to IndexedDB:", error);
      }
    };

    saveEvents();
  }, [triggeredEvents, dbLoaded]);

  // Save trending assets to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveTrending = async () => {
      try {
        await db.trendingAssets.clear();
        await db.trendingAssets.bulkAdd(
          trendingAssets.map((asset) => ({
            symbol: asset.symbol,
            name: asset.name,
            address: asset.address,
            type: asset.type,
            hits: asset.hits,
          }))
        );
      } catch (error) {
        console.error("Failed to save trending assets to IndexedDB:", error);
      }
    };

    saveTrending();
  }, [trendingAssets, dbLoaded]);

  // Save recent searches to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveRecents = async () => {
      try {
        await db.recentSearches.clear();
        await db.recentSearches.bulkAdd(
          recentSearches.map((search) => ({
            query: search.query,
            type: search.type,
            timestamp: search.timestamp,
            symbol: search.symbol,
          }))
        );
      } catch (error) {
        console.error("Failed to save recent searches to IndexedDB:", error);
      }
    };

    saveRecents();
  }, [recentSearches, dbLoaded]);

  // --- GLOBAL KEYBOARD HANDLER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedWallet) setSelectedWallet(null);
        if (isMobileStatsOpen) setIsMobileStatsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWallet, isMobileStatsOpen]);

  // --- DYNAMIC TITLE ---
  useEffect(() => {
    if (view === ViewState.HOME) document.title = "Dogechain BubbleMaps - On-Chain Intelligence";
    else if (view === ViewState.DASHBOARD) document.title = "My Dashboard | Dogechain BubbleMaps";
    else if (view === ViewState.ANALYSIS && token)
      document.title = `Analysis: ${token.symbol} | Dogechain BubbleMaps`;
  }, [view, token]);

  // --- NAVIGATION HANDLER ---
  const handleViewChange = (newView: ViewState) => {
    setView(newView);
    try {
      const url = new URL(window.location.href);
      // Clear token params if going home, but keep if going to Dashboard (to allow return)
      if (newView === ViewState.HOME) {
        url.searchParams.delete("token");
        url.searchParams.delete("type");
        url.searchParams.delete("view");
      } else {
        url.searchParams.set("view", newView.toLowerCase());
      }
      window.history.pushState({}, "", url);
    } catch {
      // console.debug('History pushState disabled in this environment');
    }
  };

  // --- TOAST HELPERS ---
  const addToast = (message: string, type: ToastType = "info") => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addToHistory = (query: string, type: AssetType, symbol?: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.query.toLowerCase() !== query.toLowerCase());
      const newItem = { query, type, timestamp: Date.now(), symbol };
      return [newItem, ...filtered].slice(0, 5); // Keep top 5
    });
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    addToast("Search history cleared", "info");
  };

  // --- EXPORT CSV ---
  const handleExportCSV = () => {
    if (!token || wallets.length === 0) return;

    const headers = ["Rank", "Address", "Balance", "Percentage", "Tag"];
    const rows = wallets.map((w, i) => [
      i + 1,
      w.address,
      w.balance,
      `${w.percentage.toFixed(4)}%`,
      w.isContract ? "Contract" : w.isWhale ? "Whale" : "Holder",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${token.symbol}_holders_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast("CSV Download started", "success");
  };

  // --- SELECT WALLET ON MAP ---
  const handleSelectWalletOnMap = (wallet: Wallet) => {
    // When a wallet is selected from the list/drawer, we only center/zoom via targetWalletId.
    // Actual drawer open happens on bubble click inside BubbleMap.
    setSelectedWallet(null);
    setTargetWalletId(wallet.id);
    // Close the mobile stats drawer when selecting an address from the map
    setIsMobileStatsOpen(false);
    // Scroll to map on mobile
    if (window.innerWidth < 1024) {
      const mapElement = document.querySelector('[role="img"]');
      mapElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // --- SHARE FUNCTIONALITY ---
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        addToast("Link copied to clipboard!", "success");
      })
      .catch(() => {
        addToast("Failed to copy link", "error");
      });
  };

  // --- TRACE CONNECTIONS ---
  const handleTraceConnections = async (wallet: Wallet) => {
    if (!token) return;

    addToast(`Tracing connections for ${wallet.address.slice(0, 6)}...`, "info");

    // Find connections for this specific wallet against all currently mapped wallets
    const newLinks = await findInteractions(wallet, wallets, token.address);

    if (newLinks.length > 0) {
      // Avoid duplicates
      const uniqueNewLinks = newLinks.filter(
        (newLink) =>
          !links.some(
            (existingLink) =>
              (typeof existingLink.source === "string"
                ? existingLink.source
                : existingLink.source.id) === (newLink.source as string) &&
              (typeof existingLink.target === "string"
                ? existingLink.target
                : existingLink.target.id) === (newLink.target as string)
          )
      );

      if (uniqueNewLinks.length > 0) {
        setLinks((prev) => [...prev, ...uniqueNewLinks]);
        addToast(`Found ${uniqueNewLinks.length} new connection(s)!`, "success");
      } else {
        addToast("No new connections found among current holders.", "warning");
      }
    } else {
      addToast("No connections found to other mapped wallets.", "warning");
    }
  };

  // --- CONNECTION DETAILS ---
  const handleConnectionClick = async (link: Link) => {
    if (!token) return;

    try {
      // Generate link ID
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      const linkId = `${sourceId}-${targetId}`;

      // Set selected connection ID
      setSelectedConnectionId(linkId);

      // Create connection object with loading state
      const loadingConnection: Connection = {
        ...link,
        loading: true,
      };

      setSelectedConnection(loadingConnection);
      setSelectedWallet(null); // Clear wallet selection

      // Fetch connection details with transactions
      const connectionWithDetails = await fetchConnectionDetails(link, token.address, token.type);

      setSelectedConnection(connectionWithDetails);
    } catch (error) {
      console.error("[App] Failed to load connection details:", error);
      addToast("Failed to load connection details", "error");
    }
  };

  // --- USER INJECTION LOGIC ---
  const injectUserWallet = useCallback(
    async (currentWallets: Wallet[], currentToken: Token, address: string) => {
      // Check if user is already in the list
      const exists = currentWallets.some((w) => w.address.toLowerCase() === address.toLowerCase());

      if (!exists) {
        try {
          // Fetch user specific balance
          const balance = await fetchTokenBalance(address, currentToken.address);

          if (balance > 0) {
            const percentage =
              currentToken.totalSupply > 0 ? (balance / currentToken.totalSupply) * 100 : 0;

            const userWallet: Wallet = {
              id: address, // Use address as ID
              address: address,
              balance: balance,
              percentage: percentage,
              isWhale: false,
              isContract: false,
              connections: [],
            };

            return [...currentWallets, userWallet];
          }
        } catch (e) {
          console.warn("Failed to inject user wallet", e);
        }
      }
      return currentWallets;
    },
    []
  );

  // --- UPDATE TRENDING ASSETS ---
  const updateTrending = useCallback((tokenData: Token) => {
    setTrendingAssets((prev) => {
      // First, deduplicate existing assets
      const cleanPrev = deduplicateTrendingAssetsInMemory(prev);

      // Find existing asset by address (case-insensitive)
      const existingIndex = cleanPrev.findIndex(
        (a) => a.address.toLowerCase() === tokenData.address.toLowerCase()
      );

      let newAssets: TrendingAsset[];

      if (existingIndex > -1) {
        // Update existing: increment hits
        newAssets = cleanPrev.map((asset, idx) =>
          idx === existingIndex ? { ...asset, hits: asset.hits + 1 } : asset
        );
      } else {
        // Add new asset
        newAssets = [
          ...cleanPrev,
          {
            symbol: tokenData.symbol,
            name: tokenData.name,
            address: tokenData.address,
            type: tokenData.type,
            hits: 1,
          },
        ];
      }

      // Sort by hits desc and keep top 8
      const sorted = newAssets.sort((a, b) => b.hits - a.hits).slice(0, 8);

      // Final deduplication to guarantee uniqueness
      return deduplicateTrendingAssetsInMemory(sorted);
    });
  }, []);

  // --- SEARCH LOGIC ---
  const handleSearch = async (
    e?: React.FormEvent,
    overrideQuery?: string,
    overrideType?: AssetType
  ) => {
    if (e) e.preventDefault();

    const cleanQuery = (overrideQuery || searchQuery).trim();
    const typeToUse = overrideType || searchType;

    if (!cleanQuery) return;

    setLoading(true);
    setSummary(null);
    setWallets([]);
    setLinks([]);
    setIsMobileStatsOpen(false);

    // If triggered by UI click (not URL load), update input
    if (overrideQuery) setSearchQuery(cleanQuery);
    if (overrideType) setSearchType(overrideType);

    try {
      const tokenData = await fetchTokenData(cleanQuery, typeToUse);

      if (!tokenData) {
        addToast("Token not found. Please verify the address.", "error");
        setLoading(false);
        return;
      }

      // Enforce type match; if mismatch, prompt user
      if (tokenData.type !== typeToUse) {
        const targetLabel = tokenData.type === AssetType.NFT ? "NFT" : "Token";
        addToast(
          `This address appears to be an ${targetLabel} contract. Switch to ${targetLabel}s and search again.`,
          "error"
        );
        setSearchType(tokenData.type);
        setLoading(false);
        return;
      }

      setToken(tokenData);
      addToHistory(cleanQuery, typeToUse, tokenData.symbol);
      updateTrending(tokenData);

      // Log to server-side trending (fire-and-forget, don't block UI)
      logSearchQuery(tokenData.address, tokenData.type, tokenData.symbol, tokenData.name).catch(
        (err) => console.warn("Failed to log search to server:", err)
      );

      // Fetch Data (Live)
      const result = await fetchTokenHolders(tokenData);

      // DIAGNOSTIC: Check labeled wallets in result
      const _labeledInResult = result.wallets.filter((w) => w.label);

      let finalWallets = result.wallets;

      // Inject User if connected
      if (userAddress) {
        finalWallets = await injectUserWallet(finalWallets, tokenData, userAddress);
      }

      if (finalWallets.length === 0) {
        addToast("No active holders found or API limit reached.", "warning");
        setLoading(false);
        return;
      }

      setWallets(finalWallets);
      setLinks(result.links);
      setHoldersPage(1);
      setTargetWalletId(null);
      setSelectedWallet(null);
      setView(ViewState.ANALYSIS);

      // URL State Persistence (Deep Linking)
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("token", cleanQuery);
        newUrl.searchParams.set("type", typeToUse);
        newUrl.searchParams.set("view", "analysis");
        window.history.pushState({}, "", newUrl);
      } catch {
        /* ignore */
      }

      // AI Summary feature is disabled - coming soon
      // if (import.meta.env.VITE_API_KEY) {
      //      generateTokenSummary(tokenData.name, finalWallets.slice(0, 5), tokenData.type)
      //      .then(setSummary)
      //      .catch(() => setSummary("AI Analysis unavailable"));
      // }
    } catch (err) {
      console.error(err);
      addToast("An unexpected error occurred while fetching live data.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- WALLET & INIT LOGIC ---
  useEffect(() => {
    const initWallet = async () => {
      if (typeof (window as any).ethereum !== "undefined") {
        try {
          const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            setUserAddress(accounts[0]);
          }

          (window as any).ethereum.on("accountsChanged", async (accounts: string[]) => {
            const newAddress = accounts.length > 0 && accounts[0] ? accounts[0] : null;
            setUserAddress(newAddress);

            if (newAddress) {
              addToast("Wallet connected", "success");
              // Re-inject user if we are currently viewing a map
              if (token && wallets.length > 0) {
                const updatedWallets = await injectUserWallet(wallets, token, newAddress);
                if (updatedWallets.length !== wallets.length) {
                  setWallets(updatedWallets);
                  addToast("You have been added to the map!", "success");
                }
              }
            } else {
              addToast("Wallet disconnected", "info");
            }
          });

          (window as any).ethereum.on("chainChanged", () => {
            window.location.reload();
          });
        } catch (err) {
          console.error("Wallet check error:", err);
        }
      }
    };

    initWallet();

    // INITIAL ROUTING: Restore state from URL
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const tokenParam = params.get("token");
    const typeParam = params.get("type");

    // Restore View
    if (viewParam === "dashboard") {
      setView(ViewState.DASHBOARD);
    } else if (viewParam === "analysis") {
      setView(ViewState.ANALYSIS);
    }

    // Restore Data
    if (tokenParam) {
      const type = typeParam === "NFT" ? AssetType.NFT : AssetType.TOKEN;
      handleSearch(undefined, tokenParam, type);
    }

    // Handle Browser Back Button
    const onPopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const v = currentParams.get("view");
      if (v === "dashboard") setView(ViewState.DASHBOARD);
      else if (v === "analysis") setView(ViewState.ANALYSIS);
      else setView(ViewState.HOME);
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      const eth = (window as any).ethereum;
      if (eth && eth.removeListener) {
        eth.removeListener("accountsChanged", () => {});
        eth.removeListener("chainChanged", () => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Intentional: only run on mount

  const handleConnectWallet = async () => {
    if (typeof (window as any).ethereum === "undefined") {
      addToast("Please install MetaMask to connect.", "warning");
      return;
    }

    setIsConnecting(true);

    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });

      const chainId = await ethereum.request({ method: "eth_chainId" });
      const DOGECHAIN_ID = "0x7d0"; // 2000

      if (chainId !== DOGECHAIN_ID) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: DOGECHAIN_ID }],
          });
        } catch (switchError: any) {
          // 4902: Chain not added
          if (switchError.code === 4902) {
            await ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: DOGECHAIN_ID,
                  chainName: "Dogechain Mainnet",
                  nativeCurrency: {
                    name: "Dogecoin",
                    symbol: "DOGE",
                    decimals: 18,
                  },
                  rpcUrls: ["https://rpc.dogechain.dog"],
                  blockExplorerUrls: ["https://explorer.dogechain.dog"],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      if (accounts[0]) {
        setUserAddress(accounts[0]);
        addToast("Wallet connected successfully", "success");
      }
    } catch (error) {
      console.error("Connection error:", error);
      addToast("Failed to connect wallet", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setUserAddress(null);
    setWalletAssets({ tokens: [], nfts: [] });
    addToast("Wallet disconnected", "info");
  };
  // --- WALLET LOGIC END ---

  const fetchForcedContracts = useCallback(async (): Promise<{
    tokens: Token[];
    nfts: Token[];
  }> => {
    if (!userAddress || forcedContracts.length === 0) return { tokens: [], nfts: [] };
    const tokens: Token[] = [];
    const nfts: Token[] = [];
    for (const contract of forcedContracts) {
      try {
        const meta = await fetchTokenData(contract);
        if (!meta) continue;
        // Try to fetch balance, but do not block display if zero or fetch fails
        let bal = 0;
        try {
          bal = await fetchTokenBalance(userAddress, meta.address, meta.decimals);
        } catch {
          bal = 0;
        }
        const enriched = { ...meta, totalSupply: meta.totalSupply || 0, holderCount: bal };
        if (meta.type === AssetType.NFT) nfts.push(enriched);
        else tokens.push(enriched);
      } catch (err) {
        console.warn("Forced contract fetch failed", contract, err);
      }
    }
    setForcedAssets({ tokens, nfts });
    return { tokens, nfts };
  }, [forcedContracts, userAddress]);

  useEffect(() => {
    if (userAddress) {
      // Load saved contracts from database
      loadWalletForcedContracts(userAddress).then((savedContracts) => {
        setForcedContracts(savedContracts);
      });
    } else {
      // Clear contracts when wallet disconnects
      setForcedContracts([]);
    }
  }, [userAddress]);

  // Fetch metadata for forced contracts
  useEffect(() => {
    if (forcedContracts.length > 0) {
      fetchForcedContracts();
    } else {
      setForcedAssets({ tokens: [], nfts: [] });
    }
  }, [forcedContracts, fetchForcedContracts]);

  // Load cached wallet scan results when wallet connects
  useEffect(() => {
    if (userAddress) {
      // Load cached scan results to restore token/NFT list
      loadScanCache(userAddress).then((cached) => {
        if (cached && (cached.tokens.length > 0 || cached.nfts.length > 0)) {
          setWalletAssets({
            tokens: cached.tokens,
            nfts: cached.nfts,
          });

          // Show a toast indicating cache was loaded
          const timeSinceScan = Date.now() - cached.scannedAt;
          const minutesAgo = Math.floor(timeSinceScan / (1000 * 60));
          if (minutesAgo < 48) {
            addToast(
              `Loaded cached scan from ${minutesAgo === 0 ? "just now" : `${minutesAgo}m ago`} (${cached.tokens.length} tokens, ${cached.nfts.length} NFTs)`,
              "info"
            );
          }
        }
      });
    } else {
      // Clear when wallet disconnects
      setWalletAssets({ tokens: [], nfts: [] });
      setWalletScanError(null);
    }
  }, [userAddress]);

  // --- WALLET SCANNER ---
  const scanWalletAssets = useCallback(
    async (address: string, forceRefresh = false) => {
      // Create new AbortController for this scan
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsScanningWallet(true);
      setWalletScanError(null);

      const startTime = Date.now();
      scanStartTimeRef.current = startTime;

      setScanState({
        phase: "quick",
        progress: 0,
        tokensFound: 0,
        nftsFound: 0,
        currentOperation: "Initializing...",
        startTime,
      });

      try {
        const result = await fetchWalletAssetsHybrid(
          address,
          (update: ScanProgressUpdate) => {
            // Progressive update callback
            setScanState({
              phase: update.phase,
              progress: update.progress,
              tokensFound: update.tokens.length,
              nftsFound: update.nfts.length,
              currentOperation: update.currentOperation,
              startTime: scanStartTimeRef.current,
            });

            // Update wallet assets progressively
            setWalletAssets({
              tokens: update.tokens,
              nfts: update.nfts,
            });
          },
          forceRefresh,
          abortController.signal
        );

        setWalletAssets({
          tokens: result.tokens,
          nfts: result.nfts,
        });

        const forced = await fetchForcedContracts();
        const totalFound =
          result.tokens.length + result.nfts.length + forced.tokens.length + forced.nfts.length;

        if (totalFound === 0) {
          setWalletScanError(
            "No token or NFT activity found via explorer. Add contracts to include them manually."
          );
        } else {
          setWalletScanError(null);
        }

        setScanState({
          phase: "complete",
          progress: 100,
          tokensFound: result.tokens.length,
          nftsFound: result.nfts.length,
          currentOperation: "Complete",
          startTime: scanStartTimeRef.current,
        });

        addToast(
          `Scan complete: ${result.tokens.length} tokens, ${result.nfts.length} NFTs (${Math.floor(result.metadata.duration / 1000)}s)`,
          "info"
        );
      } catch (e) {
        // Handle scan cancellation
        if (e instanceof Error && e.message === "Scan cancelled") {
          addToast("Scan cancelled", "info");
          setScanState({
            phase: "idle",
            progress: 0,
            tokensFound: 0,
            nftsFound: 0,
            currentOperation: "",
            startTime: 0,
          });
          return;
        }

        console.error("Wallet scan failed", e);
        setWalletScanError("Failed to scan wallet. Please try again.");
        setScanState({
          phase: "error",
          progress: 0,
          tokensFound: 0,
          nftsFound: 0,
          currentOperation: "Scan failed",
          startTime: Date.now(),
        });
      } finally {
        setIsScanningWallet(false);
        abortControllerRef.current = null;
      }
    },
    [fetchForcedContracts]
  );

  // Cancel scan handler
  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addToast("Cancelling scan...", "info");
    }
  };

  // NOTE: Auto-scan disabled - user must manually click Scan button
  // useEffect(() => {
  //   if (userAddress) {
  //     scanWalletAssets(userAddress);
  //   } else {
  //     setWalletAssets({ tokens: [], nfts: [] });
  //     setWalletScanError(null);
  //   }
  // }, [userAddress, scanWalletAssets]);

  const handleManualScan = () => {
    if (!userAddress) {
      addToast("Connect your wallet to scan assets", "warning");
      return;
    }
    // Clear cache and do a fresh scan
    try {
      db.walletScanCache.delete(userAddress.toLowerCase());
    } catch (e) {
      console.warn("Failed to clear cache:", e);
    }
    scanWalletAssets(userAddress, true); // Force refresh (bypasses cache)
    setTimeout(() => {
      fetchForcedContracts();
    }, 50);
  };

  const handleRefreshScan = async () => {
    if (!userAddress) {
      addToast("Connect your wallet to refresh scan", "warning");
      return;
    }

    // Quick refresh using cache if available
    scanWalletAssets(userAddress, false); // Normal scan (uses cache if available)
    setTimeout(() => {
      fetchForcedContracts();
    }, 50);
  };

  const handleAddContract = async () => {
    const c = contractInput.trim();
    if (!c) return;
    if (!userAddress) {
      addToast("Connect your wallet to add contracts", "warning");
      return;
    }

    // Add loading state
    setContractInput("");
    addToast("Verifying contract and balance...", "info");

    try {
      // 1. Check if wallet has balance in this contract
      const { hasBalance } = await checkTokenBalance(userAddress, c);

      if (!hasBalance) {
        addToast("No balance found in this contract", "warning");
        return;
      }

      // 2. Detect contract type and get metadata
      addToast("Detecting contract type...", "info");

      let type: AssetType | null = null;
      let symbol: string | undefined = undefined;
      let name: string | undefined = undefined;

      // Check cache first
      const cached = getCachedMetadata(c);
      if (cached?.type) {
        type = cached.type;
        symbol = cached.symbol;
        name = cached.name;
      } else {
        // Detect type
        type = await detectContractType(c);

        if (type) {
          // Try to get metadata from transfers
          try {
            const metadata = await fetchMetadataFromTransfers(c);
            if (metadata) {
              symbol = metadata.symbol;
              name = metadata.name;
            }
          } catch (e) {
            console.warn("Failed to fetch metadata from transfers:", e);
          }

          // Cache the metadata
          saveMetadataToCache(c, {
            symbol: symbol || (type === AssetType.NFT ? "NFT" : "TOKEN"),
            name: name || (type === AssetType.NFT ? "NFT Collection" : "Token"),
            decimals: type === AssetType.NFT ? 0 : 18,
            type,
          });
        }
      }

      if (!type) {
        addToast("Could not detect contract type", "warning");
        return;
      }

      // 3. Add to forced contracts
      const updated = Array.from(new Set([...forcedContracts, c]));
      setForcedContracts(updated);

      // 4. Save to database
      await saveWalletForcedContracts(userAddress, updated);

      // 5. Add to wallet assets immediately
      const newAsset: Token = {
        address: c,
        symbol: symbol || (type === AssetType.NFT ? "NFT" : "TOKEN"),
        name: name || (type === AssetType.NFT ? "NFT Collection" : "Token"),
        totalSupply: 0,
        decimals: type === AssetType.NFT ? 0 : 18,
        type,
        priceUsd: 0,
      };

      if (type === AssetType.NFT) {
        setWalletAssets((prev) => ({
          tokens: prev.tokens,
          nfts: [...prev.nfts, newAsset],
        }));
      } else {
        setWalletAssets((prev) => ({
          tokens: [...prev.tokens, newAsset],
          nfts: prev.nfts,
        }));
      }

      addToast(
        `Successfully added ${type === AssetType.NFT ? "NFT" : "TOKEN"} ${symbol || c}`,
        "success"
      );
    } catch (e: any) {
      console.error("Failed to add contract:", e);
      addToast(`Failed to add contract: ${e?.message || "Unknown error"}`, "error");
    }
  };

  const handleSelectWalletAsset = (asset: Token) => {
    setSearchQuery(asset.address);
    setSearchType(asset.type);
    addToast(`${asset.symbol} ready to search`, "info");
  };

  // Enhanced Alert Handler from Sidebar
  const handleAddAlertFromSidebar = async (
    wallet: Wallet,
    config: { type: "WALLET" | "TOKEN" | "WHALE"; threshold?: number }
  ) => {
    let alertName = `Alert: ${wallet.address.substring(0, 6)}`;
    let tAddr = undefined;
    let tSym = undefined;
    let tName = undefined;
    let thresh = config.threshold || 0;

    if (config.type === "TOKEN" || config.type === "WHALE") {
      tAddr = token?.address;
      tSym = token?.symbol;
      tName = token?.name;
      alertName = `${config.type === "WHALE" ? "Whale" : token?.symbol} Watch`;
      if (config.type === "TOKEN" && !thresh) thresh = 1; // Minimal movement
    } else {
      alertName = `Wallet Watch`;
      thresh = 1;
    }

    addToast("Initializing alert...", "info");

    // Fetch initial balance for baseline tracking
    let initialVal = 0;
    try {
      if (tAddr) {
        initialVal = await fetchTokenBalance(wallet.address, tAddr);
      } else {
        const wDogeAddress = "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101";
        initialVal = await fetchTokenBalance(wallet.address, wDogeAddress);
      }
    } catch {
      console.warn("Failed to fetch initial alert balance");
    }

    const newAlert: AlertConfig = {
      id: generateAlertId(),
      walletAddress: wallet.address,
      tokenAddress: tAddr,
      tokenName: tName,
      tokenSymbol: tSym,
      threshold: thresh,
      initialValue: initialVal,
      name: alertName,
    };
    setAlerts((prev) => [...prev, newAlert]);
    addToast("Alert created successfully", "success");
    // Close wallet drawer after creating an alert
    setSelectedWallet(null);
  };

  const handleCreateAlert = async (data: {
    name: string;
    walletAddress: string;
    tokenAddress?: string;
    threshold: number;
  }) => {
    let tokenInfo = {
      symbol: undefined as string | undefined,
      name: undefined as string | undefined,
    };

    addToast("Initializing alert...", "info");
    let initialVal = 0;

    if (data.tokenAddress) {
      try {
        const fetchedToken = await fetchTokenData(data.tokenAddress);
        if (fetchedToken) {
          tokenInfo = { symbol: fetchedToken.symbol, name: fetchedToken.name };
        }
        initialVal = await fetchTokenBalance(data.walletAddress, data.tokenAddress);
      } catch (e) {
        console.warn("Could not fetch token info for alert", e);
      }
    } else {
      // Fallback for general wallet monitoring (wDOGE)
      const wDogeAddress = "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101";
      initialVal = await fetchTokenBalance(data.walletAddress, wDogeAddress);
    }

    // Fetch initial transactions to establish baseline
    let initialTxs: string[] = [];
    try {
      const transactions = await fetchWalletTransactions(data.walletAddress, data.tokenAddress);
      initialTxs = transactions.map((tx) => tx.hash);
    } catch (e) {
      console.warn("Could not fetch initial transactions", e);
    }

    const newAlert: AlertConfig = {
      id: generateAlertId(),
      walletAddress: data.walletAddress,
      tokenAddress: data.tokenAddress,
      threshold: data.threshold,
      name: data.name,
      tokenSymbol: tokenInfo.symbol,
      tokenName: tokenInfo.name,
      initialValue: initialVal,
    };

    // Initialize alert status with transaction history FIRST
    setAlertStatuses((prev) => ({
      ...prev,
      [newAlert.id]: {
        currentValue: initialVal,
        triggered: false,
        checkedAt: Date.now(),
        lastSeenTransactions: initialTxs,
      },
    }));

    // Add alert to list AFTER status is set (use setTimeout to ensure state updates in order)
    setTimeout(() => {
      setAlerts((prev) => [...prev, newAlert]);
      addToast("New alert saved", "success");
    }, 100);
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    addToast("Alert removed", "info");
  };

  const handleUpdateAlert = async (
    id: string,
    data: { name: string; walletAddress: string; tokenAddress?: string; threshold: number }
  ) => {
    try {
      addToast("Updating alert...", "info");

      const existingAlert = alerts.find((a) => a.id === id);
      if (!existingAlert) {
        throw new Error("Alert not found");
      }

      let tokenInfo = {
        symbol: undefined as string | undefined,
        name: undefined as string | undefined,
      };

      // Only fetch token info if tokenAddress is provided and different from existing
      if (data.tokenAddress && data.tokenAddress !== existingAlert.tokenAddress) {
        try {
          const fetchedToken = await fetchTokenData(data.tokenAddress);
          if (fetchedToken) {
            tokenInfo = { symbol: fetchedToken.symbol, name: fetchedToken.name };
          }
        } catch (e) {
          console.warn("Could not fetch token info for alert", e);
        }
      } else if (!data.tokenAddress) {
        // Clear token info if no token address
        tokenInfo = { symbol: undefined, name: undefined };
      } else {
        // Keep existing token info
        tokenInfo = {
          symbol: existingAlert.tokenSymbol,
          name: existingAlert.tokenName,
        };
      }

      // Fetch initial transactions for new wallet address if changed
      let initialTxs: string[] = [];
      if (
        data.walletAddress !== existingAlert.walletAddress ||
        data.tokenAddress !== existingAlert.tokenAddress
      ) {
        try {
          const transactions = await fetchWalletTransactions(data.walletAddress, data.tokenAddress);
          initialTxs = transactions.map((tx) => tx.hash);
        } catch (e) {
          console.warn("Could not fetch initial transactions", e);
        }
      } else {
        // Keep existing transactions
        initialTxs = alertStatuses[id]?.lastSeenTransactions || [];
      }

      const updatedAlert: AlertConfig = {
        id: id, // Keep the same ID
        walletAddress: data.walletAddress,
        tokenAddress: data.tokenAddress,
        threshold: data.threshold,
        name: data.name,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        initialValue: existingAlert.initialValue,
      };

      // Update alert status with new transaction history
      setAlertStatuses((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          currentValue: existingAlert.initialValue || 0,
          triggered: false,
          checkedAt: Date.now(),
          lastSeenTransactions: initialTxs,
        },
      }));

      // Update alert in list
      setAlerts((prev) => prev.map((a) => (a.id === id ? updatedAlert : a)));
      addToast("Alert updated successfully", "success");
    } catch (error) {
      console.error("Failed to update alert", error);
      addToast("Failed to update alert", "error");
    }
  };

  const getAssetIcon = (asset: TrendingAsset, index: number) => {
    const baseClass = "drop-shadow-[0_0_8px_rgba(255,255,255,0.12)]";
    if (asset.type === AssetType.NFT)
      return <ImageIcon className={`${baseClass} text-purple-300`} size={30} strokeWidth={1.5} />;
    if (asset.symbol === "USDT")
      return (
        <CircleDollarSign className={`${baseClass} text-emerald-300`} size={30} strokeWidth={1.5} />
      );
    if (asset.symbol === "DC")
      return <Shield className={`${baseClass} text-amber-300`} size={30} strokeWidth={1.5} />;
    if (asset.symbol === "wDOGE")
      return <Coins className={`${baseClass} text-doge-400`} size={30} strokeWidth={1.5} />;
    return (
      <Box
        className={`${baseClass} ${index % 2 === 0 ? "text-blue-300" : "text-pink-300"}`}
        size={30}
        strokeWidth={1.5}
      />
    );
  };

  return (
    <div className="min-h-screen bg-space-900 text-slate-100 font-sans selection:bg-purple-500 selection:text-white flex flex-col overflow-x-hidden">
      <Analytics />
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <Navbar
        currentView={view}
        onChangeView={handleViewChange}
        userAddress={userAddress}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        isConnecting={isConnecting}
        hasAnalysisData={!!token}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col">
        {/* HOME VIEW */}
        {view === ViewState.HOME && (
          <div className="flex-1 flex flex-col justify-center min-h-screen relative bg-space-900">
            {/* Animated background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.12),transparent_30%)]">
              <BlockchainBackground />
            </div>

            {/* Main Content - Mobile First Design */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-0 sm:px-4 py-8">
              {/* Hero Section - Simplified for Mobile */}
              <div className="text-center space-y-6 mb-8">
                <style>{`
                  @keyframes float-glow {
                    0% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.45)); }
                    50% { transform: translateY(-8px); filter: drop-shadow(0 0 22px rgba(168, 85, 247, 0.85)); }
                    100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.45)); }
                  }
                  .animate-float-glow {
                    animation: float-glow 3.6s ease-in-out infinite;
                  }
                `}</style>
                {/* Logo */}
                <div className="flex justify-center mb-6">
                  <img
                    src="/dogchain-logo.png"
                    alt="Dogchain Logo"
                    className="w-20 h-20 sm:w-32 sm:h-32 animate-float-glow"
                  />
                </div>

                {/* Heading */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight px-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                    Reveal the
                  </span>{" "}
                  <span className="text-purple-500">Dogechain</span>
                </h1>

                {/* Description */}
                <p className="text-sm sm:text-base text-slate-400 px-4 sm:px-0 max-w-2xl mx-auto leading-relaxed">
                  Visualize token & NFT distributions, uncover hidden whale connections, analyze
                  on-chain risks, and set user & token alerts with{" "}
                  <strong className="text-white">100% Live Data</strong>.
                </p>

                {/* Beta Badge */}
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                    Beta Build #{__BETA_BUILD_NUMBER__}
                  </span>
                </div>
              </div>

              {/* Search Section - Completely Redesigned for Mobile */}
              <div className="w-full max-w-lg mx-auto px-3 sm:px-0">
                {/* Type Toggles - Stack on Mobile */}
                <div className="flex justify-center gap-2 mb-4">
                  <button
                    onClick={() => setSearchType(AssetType.TOKEN)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      searchType === AssetType.TOKEN
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-space-800 text-slate-400 border-space-700 hover:bg-space-700"
                    }`}
                  >
                    <Coins size={14} />
                    <span>Tokens</span>
                  </button>
                  <button
                    onClick={() => setSearchType(AssetType.NFT)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      searchType === AssetType.NFT
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-space-800 text-slate-400 border-space-700 hover:bg-space-700"
                    }`}
                  >
                    <ImageIcon size={14} />
                    <span>NFTs</span>
                  </button>
                </div>

                {/* Search Form - Simplified */}
                <TokenSearchInput
                  searchType={searchType}
                  onSearch={(address, type) => handleSearch(undefined, address, type)}
                  placeholder={
                    searchType === AssetType.NFT
                      ? "Search collections..."
                      : "Search token or contract ..."
                  }
                  disabled={loading}
                />

                {/* Recent Searches - Wrapped (moved above scanner) */}
                {recentSearches.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-2 px-2">
                      <History size={12} />
                      <span>Recent</span>
                      <button onClick={clearHistory} className="hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5 px-2">
                      {recentSearches.map((item, index) => (
                        <button
                          key={`${item.query}-${index}`}
                          onClick={(e) => handleSearch(e, item.query, item.type)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-space-800 border border-space-700 text-xs text-slate-300 hover:text-white transition-all"
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${item.type === AssetType.NFT ? "bg-blue-500" : "bg-purple-500"}`}
                          ></span>
                          <span className="max-w-20 truncate">
                            {item.symbol || item.query.slice(0, 8)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet Scanner */}
                <div className="mt-4 p-3 rounded-lg bg-space-800 border border-space-700 shadow-lg">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-space-700 text-purple-300">
                        <ScanLine size={16} />
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Wallet Scanner
                        </p>
                        <p className="text-sm text-white font-semibold">
                          {userAddress
                            ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                            : "Connect wallet to scan"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 w-full">
                      <button
                        onClick={handleManualScan}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors"
                        disabled={isScanningWallet || !userAddress}
                        title="Fresh scan (bypasses cache)"
                      >
                        {isScanningWallet ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <WalletIcon size={14} />
                        )}
                        <span>{isScanningWallet ? "Scanning" : "Scan"}</span>
                      </button>
                      <button
                        onClick={handleRefreshScan}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-space-700 hover:bg-space-600 text-white disabled:opacity-50 transition-colors border border-space-600"
                        disabled={isScanningWallet || !userAddress}
                        title="Quick reload (uses cache if available)"
                      >
                        <RefreshCw size={14} className={isScanningWallet ? "animate-spin" : ""} />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                      {isScanningWallet && (
                        <button
                          onClick={handleCancelScan}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                          title="Stop scan"
                        >
                          <X size={14} />
                          <span className="hidden sm:inline">Stop</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scanner disclaimer */}
                  <div className="mt-3 w-full rounded-md border border-amber-700/60 bg-amber-900/20 px-3 py-2 text-xs text-amber-200 text-center">
                    <p className="font-semibold text-amber-100 uppercase">Heads up</p>
                    <p className="text-amber-200/90">
                      Scanning takes <strong>5-8 minutes</strong>. May find slightly different
                      counts than explorer due to: transfers vs current holdings, timing
                      differences, and API rate limits.
                    </p>
                    <p className="text-amber-200/90 mt-2">
                      <strong>More tokens and NFTs may appear than what you currently hold</strong>,
                      as the scanner may detect tokens and NFTs you&apos;ve held in the past.
                    </p>
                  </div>

                  {/* Scan Progress Indicator */}
                  {scanState.phase !== "idle" && scanState.phase !== "complete" && (
                    <div className="mt-3 p-3 rounded-md bg-space-900 border border-space-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1 rounded ${scanState.phase === "quick" ? "bg-green-900 text-green-300" : scanState.phase === "deep-v2" ? "bg-blue-900 text-blue-300" : scanState.phase === "deep-v1" ? "bg-purple-900 text-purple-300" : "bg-orange-900 text-orange-300"}`}
                          >
                            <Loader2 size={12} className="animate-spin" />
                          </div>
                          <span className="text-xs font-medium text-slate-300">
                            {scanState.phase === "quick"
                              ? "Quick Scan"
                              : scanState.phase === "deep-v2"
                                ? "Deep Scan (V2)"
                                : scanState.phase === "deep-v1"
                                  ? "Deep Scan (V1)"
                                  : "Balance Check"}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">{scanState.progress}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-space-800 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                          style={{ width: `${scanState.progress}%` }}
                        />
                      </div>

                      {/* Current Operation */}
                      <p className="text-xs text-slate-400 mb-2">{scanState.currentOperation}</p>

                      {/* Asset Counts */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-purple-300">
                          <Coins size={12} />
                          {scanState.tokensFound} tokens
                        </span>
                        <span className="flex items-center gap-1 text-blue-300">
                          <ImageIcon size={12} />
                          {scanState.nftsFound} NFTs
                        </span>
                        {scanState.startTime > 0 && (
                          <span className="text-slate-500">
                            {Math.floor((Date.now() - scanState.startTime) / 1000)}s
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Add contract manually */}
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={contractInput}
                      onChange={(e) => setContractInput(e.target.value)}
                      placeholder="Add contract address"
                      className="flex-1 bg-space-900 border border-space-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-space-500"
                    />
                    <button
                      onClick={handleAddContract}
                      className="px-3 py-2 rounded-md bg-space-700 hover:bg-space-600 text-xs font-medium text-white border border-space-600"
                    >
                      Add
                    </button>
                  </div>
                  {(() => {
                    const dedupe = (list: Token[]) => {
                      const seen = new Set<string>();
                      return list.filter((t) => {
                        const key = t.address.toLowerCase();
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                    };
                    const allTokens = dedupe([...forcedAssets.tokens, ...walletAssets.tokens]);
                    const allNfts = dedupe([...forcedAssets.nfts, ...walletAssets.nfts]);

                    if (walletScanError && allTokens.length === 0 && allNfts.length === 0) {
                      return <p className="mt-2 text-xs text-red-400">{walletScanError}</p>;
                    }

                    return (
                      (allTokens.length > 0 || allNfts.length > 0) && (
                        <div className="mt-3 space-y-2">
                          {allTokens.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                                <Coins size={12} /> Tokens{" "}
                                <span className="text-slate-500">({allTokens.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                                {allTokens.map((asset) => (
                                  <button
                                    key={asset.address}
                                    onClick={() => handleSelectWalletAsset(asset)}
                                    className="px-2 py-1 rounded bg-space-900 border border-space-700 text-xs text-slate-200 hover:border-purple-500 hover:text-white transition-colors font-mono truncate max-w-[140px]"
                                    title={`${asset.symbol} • ${asset.address}`}
                                  >
                                    {asset.symbol}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {allNfts.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                                <ImageIcon size={12} /> NFT Collections{" "}
                                <span className="text-slate-500">({allNfts.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                                {allNfts.map((asset) => (
                                  <button
                                    key={asset.address}
                                    onClick={() => handleSelectWalletAsset(asset)}
                                    className="px-2 py-1 rounded bg-space-900 border border-space-700 text-xs text-slate-200 hover:border-blue-500 hover:text-white transition-colors font-mono truncate max-w-[140px]"
                                    title={`${asset.name} • ${asset.address}`}
                                  >
                                    {asset.symbol || asset.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    );
                  })()}
                </div>
              </div>

              {/* Trending Section - Simplified Mobile */}
              <div className="mt-12 px-3 sm:px-0">
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">
                  <TrendingUp size={14} />
                  <span>Trending</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
                  {trendingAssets.slice(0, 4).map((asset, idx) => {
                    const uniqueKey = `${asset.address.toLowerCase()}-${idx}`;
                    return (
                      <button
                        key={uniqueKey}
                        onClick={(e) => handleSearch(e, asset.address, asset.type)}
                        className="relative p-3 bg-space-800 hover:bg-space-700 rounded-lg border border-space-700 transition-all text-center flex flex-col items-center gap-1"
                      >
                        <div className="text-xl sm:text-2xl">{getAssetIcon(asset, idx)}</div>
                        <div className="font-bold text-white text-xs sm:text-sm truncate w-full">
                          {asset.symbol}
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-400 truncate w-full">
                          {asset.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="w-full mt-auto">
              <Footer />
            </div>
          </div>
        )}

        {/* ANALYSIS VIEW */}
        {view === ViewState.ANALYSIS && (
          <>
            {token ? (
              <div className="flex h-[calc(100dvh-64px)] overflow-hidden">
                {/* Sidebar Left (Stats) - Responsive Drawer for Mobile */}
                <div
                  className={`
                        fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-space-800 border-r border-space-700 p-4 lg:p-6 overflow-y-auto transition-transform duration-300 ease-in-out
                        lg:relative lg:translate-x-0 lg:z-0 lg:max-w-none
                        ${isMobileStatsOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
                    `}
                >
                  {/* Mobile Close Button */}
                  <div className="lg:hidden flex justify-end mb-4">
                    <button
                      onClick={() => setIsMobileStatsOpen(false)}
                      className="p-2 text-slate-400 hover:text-white bg-space-700 rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-white truncate" title={token.name}>
                        {token.name}
                      </h2>
                      {token.type === AssetType.NFT && (
                        <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-[10px] font-bold rounded border border-purple-600/20">
                          NFT
                        </span>
                      )}
                      {token.isVerified ? (
                        <span className="text-green-500" title="Verified Source">
                          <ShieldCheck size={16} />
                        </span>
                      ) : (
                        <span className="text-slate-500" title="Unverified Source">
                          <AlertTriangle size={16} />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 font-mono truncate">
                      {token.symbol} - {token.address.slice(0, 8)}...
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-space-900 rounded-lg border border-space-700">
                      <div className="flex items-center justify-between gap-2 text-slate-400 mb-1">
                        <span className="flex items-center gap-1">
                          <Users size={14} /> Holders Tracked
                        </span>
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded live-badge-pulse">
                          Live
                        </span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {wallets.length.toLocaleString()}
                      </div>
                      {/* Mapped Count Detail */}
                      <div className="text-[10px] text-slate-500 mt-1">
                        {wallets.length === 100
                          ? "Showing top 100 holders from blockchain"
                          : `${wallets.length} total holders tracked`}
                      </div>
                    </div>
                    <div className="p-4 bg-space-900 rounded-lg border border-space-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Layers size={14} /> Total Supply
                      </div>
                      <div className="text-xl font-bold text-white">
                        {token.type === AssetType.NFT
                          ? token.totalSupply.toLocaleString()
                          : `${token.totalSupply.toLocaleString(undefined, { notation: "compact" })}`}
                      </div>
                    </div>

                    {/* Gemini Summary Widget - COMING SOON */}
                    <div className="p-4 bg-gradient-to-br from-purple-900/20 to-space-900 rounded-lg border border-purple-500/20 mt-6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-space-900 flex items-center justify-center z-10">
                        <div className="text-center">
                          <p className="text-sm font-bold text-purple-400 mb-1">
                            FEATURE COMING SOON
                          </p>
                          <p className="text-xs text-slate-500">AI-Powered Token Analysis</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-purple-300 mb-2 font-bold text-sm opacity-0 pointer-events-none">
                        <Sparkles size={14} /> AI Summary
                      </div>
                      {summary ? (
                        <p className="text-xs text-slate-300 leading-relaxed animate-fade-in opacity-0 pointer-events-none">
                          {summary}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500 opacity-0 pointer-events-none">
                          <Loader2 className="animate-spin" size={12} /> Analyzing live data...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                        Top Holders
                      </h3>
                      <span className="text-xs text-slate-500">
                        {Math.min(holdersPage * 10, wallets.length)} of {wallets.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {wallets.slice((holdersPage - 1) * 10, holdersPage * 10).map((w, i) => {
                        const globalIndex = (holdersPage - 1) * 10 + i;
                        return (
                          <div
                            key={w.id}
                            className="flex items-center justify-between text-sm p-2 hover:bg-space-700 rounded cursor-pointer transition-colors"
                            onClick={() => handleSelectWalletOnMap(w)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectWalletOnMap(w);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-slate-500 w-4 shrink-0">{globalIndex + 1}</span>
                              <span className="font-mono text-slate-300 text-xs" title={w.address}>
                                {w.address.slice(0, 6)}...{w.address.slice(-4)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`${token.type === AssetType.NFT ? "text-purple-400" : "text-doge-500"} font-bold text-xs`}
                              >
                                {w.percentage.toFixed(1)}%
                              </span>
                              <a
                                href={`https://explorer.dogechain.dog/address/${w.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-white transition-colors p-2 rounded hover:bg-space-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center [touch-action:manipulation]"
                                title="View on Blockscout"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    window.open(
                                      `https://explorer.dogechain.dog/address/${w.address}`,
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }
                                }}
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {wallets.length > 10 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <button
                          onClick={() => setHoldersPage(Math.max(1, holdersPage - 1))}
                          disabled={holdersPage === 1}
                          className="px-3 py-1 text-xs bg-space-800 border border-space-700 rounded hover:bg-space-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Prev
                        </button>
                        <span className="text-xs text-slate-400">
                          Page {holdersPage} of {Math.ceil(wallets.length / 10)}
                        </span>
                        <button
                          onClick={() =>
                            setHoldersPage(
                              Math.min(Math.ceil(wallets.length / 10), holdersPage + 1)
                            )
                          }
                          disabled={holdersPage >= Math.ceil(wallets.length / 10)}
                          className="px-3 py-1 text-xs bg-space-800 border border-space-700 rounded hover:bg-space-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Sidebar Overlay */}
                {isMobileStatsOpen && (
                  <div
                    className="fixed inset-0 bg-black/70 z-40 lg:hidden"
                    onClick={() => setIsMobileStatsOpen(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsMobileStatsOpen(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Close sidebar"
                  />
                )}

                {/* Main Visualization Area */}
                <div className="flex-1 relative bg-space-900">
                  {/* Mobile Stats Toggle Button */}
                  <button
                    className="lg:hidden absolute top-4 left-4 z-30 p-2 bg-space-800 rounded-lg border border-space-700 text-slate-300 hover:text-white shadow-lg"
                    onClick={() => setIsMobileStatsOpen(true)}
                  >
                    <Menu size={20} />
                  </button>

                  {/* Desktop Controls Top Right */}
                  <div className="absolute top-4 right-4 z-30 flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={handleExportCSV}
                      className="bg-space-800 border border-space-700 text-slate-200 px-3 sm:px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg hover:bg-space-700 transition-colors"
                      title="Download CSV"
                    >
                      <Download size={14} /> <span className="hidden sm:inline">CSV</span>
                    </button>

                    <button
                      onClick={handleShare}
                      className="bg-space-800 border border-space-700 text-slate-200 px-3 sm:px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg hover:bg-space-700 transition-colors"
                    >
                      <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
                    </button>

                    <div className="bg-space-800 border border-space-700 text-slate-200 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg whitespace-nowrap">
                      <History size={14} className="text-green-500" />
                      <span className="text-slate-400 hidden sm:inline">Source:</span>
                      <span className="text-white font-bold text-xs sm:text-sm">Explorer</span>
                    </div>
                  </div>

                  {loading && (
                    <div className="absolute inset-0 z-50 bg-space-900/90 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-purple-500" size={48} />
                        <span className="text-white font-medium">Fetching Live Data...</span>
                        <span className="text-xs text-slate-500">
                          Connecting to Dogechain Explorer API
                        </span>
                      </div>
                    </div>
                  )}

                  <BubbleMap
                    wallets={wallets}
                    links={links}
                    assetType={token.type}
                    userAddress={userAddress}
                    onWalletClick={setSelectedWallet}
                    targetWalletId={targetWalletId}
                    onConnectionClick={handleConnectionClick}
                    selectedConnectionId={selectedConnectionId}
                  />
                </div>

                {/* Slide Over Details */}
                <WalletSidebar
                  wallet={selectedWallet}
                  connection={selectedConnection}
                  wallets={wallets}
                  tokenSymbol={token.symbol}
                  tokenName={token.name}
                  tokenAddress={token.address}
                  tokenDecimals={token.decimals}
                  assetType={token.type}
                  iconUrl={token.iconUrl}
                  onClose={() => {
                    setSelectedWallet(null);
                    setSelectedConnection(null);
                    setSelectedConnectionId(null);
                  }}
                  onCreateAlert={(config) => handleAddAlertFromSidebar(selectedWallet!, config)}
                  onTraceConnections={handleTraceConnections}
                />
              </div>
            ) : (
              // EMPTY STATE FOR ANALYSIS
              <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
                <div className="w-20 h-20 bg-space-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <AlertCircle size={40} className="text-slate-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">No Analysis Active</h2>
                <p className="text-slate-400 max-w-md mb-8">
                  You haven&apos;t selected a token to analyze yet. Use the search bar on the home
                  page or check the dashboard.
                </p>
                <button
                  onClick={() => handleViewChange(ViewState.HOME)}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium"
                >
                  <ArrowLeft size={18} /> Return to Search
                </button>
              </div>
            )}
          </>
        )}

        {/* DASHBOARD VIEW */}
        {view === ViewState.DASHBOARD && (
          <div className="flex flex-col min-h-full">
            <Dashboard
              alerts={alerts}
              statuses={alertStatuses}
              onUpdateStatuses={setAlertStatuses}
              onRemoveAlert={handleRemoveAlert}
              onAddAlert={handleCreateAlert}
              onUpdateAlert={handleUpdateAlert}
              triggeredEvents={triggeredEvents}
              onTriggeredEventsChange={setTriggeredEvents}
            />
            <div className="mt-auto">
              <Footer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
