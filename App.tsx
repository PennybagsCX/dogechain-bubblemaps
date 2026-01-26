/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console -- Console logging is critical for debugging sync and database operations */
import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { Analytics } from "@vercel/analytics/react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Search } from "lucide-react";
import { Navbar } from "./components/Navbar";
import { BubbleMap } from "./components/BubbleMap";
import { WalletSidebar } from "./components/WalletSidebar";
import { Dashboard } from "./components/Dashboard";
import { Footer } from "./components/Footer";
import { Tooltip } from "./components/Tooltip";
import { ToastContainer, ToastMessage, ToastType } from "./components/Toast";
import { BlockchainBackground } from "./components/BlockchainBackground";
import { TokenSearchInput } from "./components/TokenSearchInput";
import { TrendingSection } from "./components/TrendingSection";
import { OnboardingModal } from "./components/OnboardingModal";
import { BubbleVisualizationGuide } from "./components/BubbleVisualizationGuide";
import { TokenInfoPanelGuide } from "./components/TokenInfoPanelGuide";
import { WalletDetailsGuide } from "./components/WalletDetailsGuide";
import { DashboardGuide } from "./components/DashboardGuide";
import { useStatsCounters } from "./hooks/useStatsCounters";
import { useOnboarding } from "./hooks/useOnboarding";
import { useBubbleVisualizationGuide } from "./hooks/useBubbleVisualizationGuide";
import { useTokenInfoPanelGuide } from "./hooks/useTokenInfoPanelGuide";
import { useWalletDetailsGuide } from "./hooks/useWalletDetailsGuide";
import { useDashboardGuide } from "./hooks/useDashboardGuide";
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
import { initializeDiagnosticLogger, getDiagnosticLogger } from "./lib/consoleLogger";
import { resetAllGuides } from "./utils/guideStorage";

/**
 * Format number with commas (e.g., 1,234,567)
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

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
  } catch {
    // Silently fail if localStorage is unavailable
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
  safeDbOperation,
  syncAlerts,
  syncAlertsToServer,
  saveAlertToServer, // FIX: Import for immediate server sync on alert creation
  deleteAlertFromServer,
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
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Wallet as WalletIcon,
  ScanLine,
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
  // Wagmi hooks for wallet connection
  const { address: userAddress, isConnected } = useAccount();

  // Stats counters hook
  const {
    totalSearches,
    totalAlerts,
    isLoading: isLoadingStats,
    refresh: refreshStats,
  } = useStatsCounters();

  // Version check to detect new builds and force refresh
  useEffect(() => {
    const currentBuildNumber = parseInt(__BETA_BUILD_NUMBER__, 10);
    const storedBuildNumber = localStorage.getItem("doge_build_number");

    if (storedBuildNumber) {
      const storedNum = parseInt(storedBuildNumber, 10);
      if (!isNaN(storedNum) && !isNaN(currentBuildNumber) && currentBuildNumber !== storedNum) {
        console.log(`[App] New build detected: ${storedNum} → ${currentBuildNumber}`);
        // Save new build number BEFORE reloading to prevent infinite loop
        localStorage.setItem("doge_build_number", currentBuildNumber.toString());
        // Force refresh to get latest code
        console.log("[App] Forcing page refresh to load new version...");
        window.location.reload();
        return;
      }
    }

    // Save current build number on first load or when missing
    if (!storedBuildNumber) {
      localStorage.setItem("doge_build_number", currentBuildNumber.toString());
    }
  }, []);

  // View state (must be declared before onboarding hook since it depends on it)
  const [view, setView] = useState<ViewState>(ViewState.HOME);

  // Onboarding: show once per session (resets on hard refresh naturally via sessionStorage)
  const sessionOnboardingKey = "dogechain_onboarding_session_shown";

  const hasSeenOnboardingThisSession = () => {
    try {
      return sessionStorage.getItem(sessionOnboardingKey) === "true";
    } catch {
      return false;
    }
  };

  const [hasShownOnboardingSession, setHasShownOnboardingSession] = useState<boolean>(
    hasSeenOnboardingThisSession()
  );

  const shouldAutoOpen = view === ViewState.HOME && !hasShownOnboardingSession;

  const {
    isOpen: isOnboardingOpen,
    currentStep: onboardingStep,
    totalSteps: onboardingTotalSteps,
    progress: onboardingProgress,
    openOnboarding,
    closeOnboarding,
    nextStep: nextOnboardingStep,
    prevStep: prevOnboardingStep,
    skipOnboarding,
  } = useOnboarding();

  // Trigger onboarding when the auto-open condition is met (once per session unless hard reload)
  useEffect(() => {
    if (!shouldAutoOpen) return;

    setHasShownOnboardingSession(true);

    openOnboarding();
  }, [shouldAutoOpen, openOnboarding]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<AssetType>(AssetType.TOKEN);

  // Map Analysis guide interaction tracking state
  const [hasInteractedWithBubbles, setHasInteractedWithBubbles] = useState(false);
  const [hasInteractedWithTokenPanel, setHasInteractedWithTokenPanel] = useState(false);
  const [hasInteractedWithWalletDetails, setHasInteractedWithWalletDetails] = useState(false);

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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  // Map Analysis Context-Aware Guides hooks
  // Trigger conditions: guides show when respective sections are active/interacted with
  const bubbleGuide = useBubbleVisualizationGuide(view === ViewState.ANALYSIS && !!token);
  const tokenPanelGuide = useTokenInfoPanelGuide(
    view === ViewState.ANALYSIS && !!token && wallets.length > 0
  );
  const walletDetailsGuide = useWalletDetailsGuide(!!selectedWallet);
  const dashboardGuide = useDashboardGuide(view === ViewState.DASHBOARD);

  // When overlays/wizards are open (or loading overlay), freeze map layout updates to avoid churn
  const isMapLayoutFrozen =
    loading ||
    isOnboardingOpen ||
    bubbleGuide.isOpen ||
    tokenPanelGuide.isOpen ||
    walletDetailsGuide.isOpen;

  // Onboarding close/skip should mark session as shown to prevent re-opening
  const handleOnboardingClose = useCallback(() => {
    try {
      sessionStorage.setItem(sessionOnboardingKey, "true");
    } catch {
      /* ignore */
    }
    setHasShownOnboardingSession(true);
    closeOnboarding();
  }, [closeOnboarding]);

  const handleOnboardingSkip = useCallback(() => {
    try {
      sessionStorage.setItem(sessionOnboardingKey, "true");
    } catch {
      /* ignore */
    }
    setHasShownOnboardingSession(true);
    skipOnboarding();
  }, [skipOnboarding]);

  useEffect(() => {
    // Expose guide testing helpers on window object for development
    // @ts-expect-error Exposing for testing
    window.__DOGECCHAIN_GUIDES__ = {
      resetAllGuides: () => {
        resetAllGuides();
        // Reset interaction tracking
        setHasInteractedWithBubbles(false);
        setHasInteractedWithTokenPanel(false);
      },
      openBubbleGuide: () => {
        resetAllGuides();
        setHasInteractedWithBubbles(true);
        bubbleGuide.openGuide();
      },
      openTokenPanelGuide: () => {
        resetAllGuides();
        setHasInteractedWithTokenPanel(true);
        tokenPanelGuide.openGuide();
      },
      openWalletDetailsGuide: () => {
        resetAllGuides();
        setHasInteractedWithWalletDetails(true);
        walletDetailsGuide.openGuide();
      },
      getGuideStatus: () => {
        return {
          bubble: { isOpen: bubbleGuide.isOpen, step: bubbleGuide.currentStep },
          tokenPanel: { isOpen: tokenPanelGuide.isOpen, step: tokenPanelGuide.currentStep },
          walletDetails: {
            isOpen: walletDetailsGuide.isOpen,
            step: walletDetailsGuide.currentStep,
          },
        };
      },
    };
  }, [bubbleGuide, tokenPanelGuide, walletDetailsGuide]);

  // Mobile UI State
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";

  // State with IndexedDB persistence
  const [trendingTokens, setTrendingTokens] = useState<TrendingAsset[]>([]);
  const [trendingNfts, setTrendingNfts] = useState<TrendingAsset[]>([]);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, AlertStatus>>({});
  const [triggeredEvents, setTriggeredEvents] = useState<TriggeredEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Refs to prevent duplicate toast messages
  const lastAddedToken = useRef<string | null>(null);
  const lastAddedAddress = useRef<string | null>(null);

  // Alert modal state for unified creation flow
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertModalPrefill, setAlertModalPrefill] = useState<{
    editingAlertId?: string;
    name?: string;
    walletAddress?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  } | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Prevent duplicate alert creation calls (fixes infinite loop)
  const isCreatingAlert = useRef(false);
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

          // Separate into tokens and NFTs
          const tokens = deduplicated.filter((asset) => asset.type === AssetType.TOKEN).slice(0, 4);
          const nfts = deduplicated.filter((asset) => asset.type === AssetType.NFT).slice(0, 4);

          setTrendingTokens(tokens);
          setTrendingNfts(nfts);

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

          // Set state with initial trending assets
          const tokens = INITIAL_TRENDING.filter((asset) => asset.type === AssetType.TOKEN).slice(
            0,
            4
          );
          const nfts = INITIAL_TRENDING.filter((asset) => asset.type === AssetType.NFT).slice(0, 4);
          setTrendingTokens(tokens);
          setTrendingNfts(nfts);
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
        const tokens = INITIAL_TRENDING.filter((asset) => asset.type === AssetType.TOKEN).slice(
          0,
          4
        );
        const nfts = INITIAL_TRENDING.filter((asset) => asset.type === AssetType.NFT).slice(0, 4);
        setTrendingTokens(tokens);
        setTrendingNfts(nfts);
        setDbLoaded(true);
      }
    };

    loadData();
  }, []);

  // Sync alerts with server when wallet connects and db is loaded
  useEffect(() => {
    if (!dbLoaded || !userAddress || !isConnected) return;

    const performSync = async () => {
      try {
        console.log("[SYNC] Syncing alerts with server...");
        const result = await syncAlerts(userAddress);

        if (result.success) {
          console.log(
            `[SYNC] ✅ Sync complete: ${result.downloaded} downloaded, ${result.uploaded} uploaded, ${result.conflicts} conflicts`
          );

          // If we downloaded new alerts, reload them from IndexedDB
          if (result.downloaded > 0) {
            const dbAlerts = await db.alerts.toArray();
            const loadedAlerts = dbAlerts.map(fromDbAlert);
            setAlerts(loadedAlerts);
          }
        } else {
          console.warn("[SYNC] ⚠️ Sync failed:", result.error);
        }
      } catch (error) {
        console.error("[SYNC] ❌ Error during sync:", error);
      }
    };

    performSync();
  }, [dbLoaded, userAddress, isConnected]);

  // Initialize diagnostic logger for remote debugging
  useEffect(() => {
    const logger = initializeDiagnosticLogger();
    const browserInfo = logger.getBrowserInfo();

    console.log("[App] 📊 Diagnostic logger initialized:", {
      sessionId: logger.getSessionId(),
      browser: browserInfo,
    });

    // Send initial diagnostic data
    logger.sendLogs().catch((err) => {
      console.warn("[App] Failed to send initial diagnostics:", err);
    });

    return () => {
      // Send final logs before unmount
      logger.sendLogs().catch((err) => {
        console.warn("[App] Failed to send final diagnostics:", err);
      });
    };
  }, []);

  // Fetch server-side trending on mount and refresh periodically
  useEffect(() => {
    // Skip server trending fetch in local dev to avoid CORS errors; rely on local trending
    if (isLocalDev) return;

    const fetchServerTrending = async () => {
      try {
        // Fetch tokens and NFTs in parallel
        const [tokensResult, nftsResult] = await Promise.allSettled([
          getTrendingAssets("TOKEN", 4),
          getTrendingAssets("NFT", 4),
        ]);

        // Process tokens
        if (tokensResult.status === "fulfilled" && tokensResult.value.length > 0) {
          const convertedTokens = tokensResult.value.map((asset) => ({
            symbol: asset.symbol || "TOKEN",
            name: asset.name || "Token",
            address: asset.address,
            type: asset.type as AssetType,
            hits: Math.round(asset.velocityScore),
          }));
          setTrendingTokens(convertedTokens);
        }

        // Process NFTs
        if (nftsResult.status === "fulfilled" && nftsResult.value.length > 0) {
          const convertedNfts = nftsResult.value.map((asset) => ({
            symbol: asset.symbol || "NFT",
            name: asset.name || "NFT Collection",
            address: asset.address,
            type: asset.type as AssetType,
            hits: Math.round(asset.velocityScore),
          }));
          setTrendingNfts(convertedNfts);
        }
      } catch {
        // Server fetch failed, keeping local trending
      }
    };

    // Fetch server trending immediately after mount
    fetchServerTrending();

    // Refresh server trending every 10 minutes
    const intervalId = setInterval(fetchServerTrending, 10 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [isLocalDev]);

  // Save alerts to IndexedDB when they change
  useEffect(() => {
    if (!dbLoaded) return;

    const saveAlerts = async () => {
      const startTime = performance.now();
      await safeDbOperation("Save alerts", async () => {
        console.log(`[DB SAVE] Saving ${alerts.length} alerts to IndexedDB...`);
        const dbAlerts = alerts.map(toDbAlert);
        await db.alerts.clear();
        await db.alerts.bulkAdd(dbAlerts);
        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`[DB SAVE] ✅ Alerts saved in ${duration}ms`);
      });

      // Sync to server if wallet is connected
      if (userAddress && isConnected) {
        try {
          await syncAlertsToServer(userAddress);
          console.log("[SYNC] ✅ Alerts synced to server");
        } catch (error) {
          console.error("[SYNC] ⚠️ Failed to sync alerts to server:", error);
          // Don't fail the save operation if sync fails
        }
      }
    };

    saveAlerts();
  }, [alerts, dbLoaded, userAddress, isConnected]);

  // Save alert statuses to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveStatuses = async () => {
      await safeDbOperation("Save alert statuses", async () => {
        await db.alertStatuses.clear();
        const payload = Object.entries(alertStatuses).map(([alertId, status]) => ({
          alertId,
          currentValue: status.currentValue,
          triggered: status.triggered,
          checkedAt: status.checkedAt,
          notified: status.notified,
          lastSeenTransactions: status.lastSeenTransactions,
          dismissedAt: status.dismissedAt,
          baselineTimestamp: status.baselineTimestamp,
          baselineEstablished: status.baselineEstablished,
          pendingInitialScan: status.pendingInitialScan,
        }));
        // bulkPut avoids duplicate-key failures when the array contains the same alertId
        await db.alertStatuses.bulkPut(payload);
      });
    };

    saveStatuses();
  }, [alertStatuses, dbLoaded]);

  // Normalize alerts in-memory to guarantee unique IDs and keep related state aligned
  // Skip normalization during initial data load to avoid duplicate processing
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (!dbLoaded || alerts.length === 0) return;

    // Skip normalization on initial load to avoid processing the same data twice
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    console.log("[ALERT NORMALIZE] Checking for duplicate alert IDs...");
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
        console.warn(`[ALERT NORMALIZE] Found duplicate ID: ${originalId}, remapping to: ${newId}`);
        return { ...alert, id: newId };
      }
      seen.add(originalId);
      return alert;
    });

    if (!changed) {
      console.log("[ALERT NORMALIZE] No duplicates found, skipping normalization");
      return;
    }

    console.log(`[ALERT NORMALIZE] Remapping ${idRemap.size} duplicate alert IDs`);

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
    console.log("[ALERT NORMALIZE] ✅ Normalization complete");
  }, [alerts, dbLoaded]);

  // Save triggered events to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveEvents = async () => {
      await safeDbOperation("Save triggered events", async () => {
        const dbEvents = triggeredEvents.map(toDbTriggeredEvent);
        await db.triggeredEvents.clear();
        await db.triggeredEvents.bulkAdd(dbEvents);
      });
    };

    saveEvents();
  }, [triggeredEvents, dbLoaded]);

  // Save trending assets to IndexedDB
  useEffect(() => {
    if (!dbLoaded) return;

    const saveTrending = async () => {
      try {
        await db.trendingAssets.clear();
        // Combine both tokens and NFTs for storage
        const allAssets = [...trendingTokens, ...trendingNfts];
        await db.trendingAssets.bulkAdd(
          allAssets.map((asset) => ({
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
  }, [trendingTokens, trendingNfts, dbLoaded]);

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

  // --- MAP ANALYSIS GUIDE TRIGGERS ---

  // Trigger bubble visualization guide when ANALYSIS view loads or first bubble interaction
  useEffect(() => {
    if (view === ViewState.ANALYSIS && token && !hasInteractedWithBubbles) {
      setHasInteractedWithBubbles(true);
    }
  }, [view, token, hasInteractedWithBubbles]);

  // Trigger token panel guide when ANALYSIS view loads with holders data
  useEffect(() => {
    if (
      view === ViewState.ANALYSIS &&
      token &&
      wallets.length > 0 &&
      !hasInteractedWithTokenPanel
    ) {
      // Small delay to let panel render and holders display
      setTimeout(() => {
        setHasInteractedWithTokenPanel(true);
      }, 1000);
    }
  }, [view, token, wallets.length, hasInteractedWithTokenPanel]);

  // Trigger wallet details guide when wallet sidebar opens
  useEffect(() => {
    console.log(
      "[App] selectedWallet changed:",
      selectedWallet ? { id: selectedWallet.id, address: selectedWallet.address } : null
    );
    if (selectedWallet && !hasInteractedWithWalletDetails) {
      setHasInteractedWithWalletDetails(true);
    }
  }, [selectedWallet, hasInteractedWithWalletDetails]);

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

  const clearHistory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);

    // Clear from IndexedDB as well
    try {
      await db.recentSearches.clear();
    } catch (error) {
      console.error("Failed to clear recent searches from IndexedDB:", error);
    }

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
    // Sync with the main selection handler
    handleWalletClickOnMap(wallet);

    // Close the mobile stats drawer when selecting an address
    setIsMobileStatsOpen(false);

    // Scroll to map on mobile
    if (window.innerWidth < 1024) {
      const mapElement = document.querySelector('[role="img"]');
      mapElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // --- MAP CLICK HANDLER (BUBBLE) ---
  const handleWalletClickOnMap = useCallback(
    (wallet: Wallet | null) => {
      setSelectedWallet(wallet);
      setTargetWalletId(wallet ? wallet.id : null);

      // Clear connection selection when clicking a wallet or background
      setSelectedConnection(null);
      setSelectedConnectionId(null);

      // Desktop-only: sync token info panel page to the clicked wallet (even beyond top 10)
      if (wallet && typeof window !== "undefined" && window.innerWidth >= 1024) {
        const index = wallets.findIndex((w) => w.id === wallet.id);
        if (index !== -1) {
          const page = Math.floor(index / 10) + 1;
          setHoldersPage(page);
          if (!hasInteractedWithTokenPanel) setHasInteractedWithTokenPanel(true);
        }
      }
    },
    [wallets, hasInteractedWithTokenPanel]
  );

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
        // Keep sidebar open but clear connection state to focus on the wallet
        setSelectedConnection(null);
        setSelectedConnectionId(null);
        // Force re-zoom even if tracing the same wallet consecutively
        setTargetWalletId(null);
        requestAnimationFrame(() => setTargetWalletId(wallet.id));
      } else {
        addToast("No new connections found among current holders.", "warning");
      }
    } else {
      addToast("No connections found to other mapped wallets.", "warning");
    }
  };

  // --- CONNECTION DETAILS ---
  const handleConnectionClick = useCallback(
    async (link: Link) => {
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
    },
    [token]
  );

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
        } catch {
          // Failed to inject user wallet
        }
      }
      return currentWallets;
    },
    []
  );

  // --- UPDATE TRENDING ASSETS ---
  const updateTrending = useCallback((tokenData: Token) => {
    const isToken = tokenData.type === AssetType.TOKEN;
    const setState = isToken ? setTrendingTokens : setTrendingNfts;

    setState((prev) => {
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

      // Sort by hits desc and keep top 4 of each type
      const sorted = newAssets.sort((a, b) => b.hits - a.hits).slice(0, 4);

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

    // Update input immediately for visual feedback
    if (overrideQuery) setSearchQuery(cleanQuery);
    if (overrideType) setSearchType(overrideType);

    // Small delay to let user see the address in the search bar
    await new Promise((resolve) => setTimeout(resolve, 100));

    setLoading(true);
    setSummary(null);
    setWallets([]);
    setLinks([]);
    setIsMobileStatsOpen(false);

    try {
      const userAgent = navigator.userAgent;
      const isArcMobile = /Arc\/.*Mobile/.test(userAgent);

      const tokenData = await fetchTokenData(cleanQuery, typeToUse);

      if (!tokenData) {
        // Log to diagnostic system
        try {
          const logger = getDiagnosticLogger();
          logger.logTokenSearch(cleanQuery, typeToUse, false, 0, "Token data is NULL");
          logger.sendLogs().catch(() => {
            // Ignore send errors
          });
        } catch {
          // Ignore logger errors
        }
        addToast("Token not found. Please verify the address.", "error");
        setLoading(false);
        return;
      }

      // Log successful token search to diagnostic system
      try {
        const logger = getDiagnosticLogger();
        logger.logTokenSearch(cleanQuery, typeToUse, true, 1);
      } catch {
        // Ignore logger errors
      }

      // Enforce type match; if mismatch, prompt user
      if (tokenData.type !== typeToUse) {
        const targetLabel = tokenData.type === AssetType.NFT ? "NFT" : "Token";
        console.warn(`[App] ⚠️ Type mismatch: expected ${typeToUse}, got ${tokenData.type}`);
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
        () => {
          // Silently handle logging errors
        }
      );

      // Fetch Data (Live)
      const result = await fetchTokenHolders(tokenData);

      // Log token holder fetch to diagnostic system
      try {
        const logger = getDiagnosticLogger();
        logger.logTokenHolderFetch(
          tokenData.address,
          tokenData.symbol || "UNKNOWN",
          result.wallets.length > 0,
          result.wallets.length,
          result.links.length
        );
      } catch {
        // Ignore logger errors
      }

      let finalWallets = result.wallets;

      // Inject User if connected
      if (userAddress) {
        finalWallets = await injectUserWallet(finalWallets, tokenData, userAddress);
      }

      if (finalWallets.length === 0) {
        console.error(`[App] ❌ No wallets found. Token holders API returned empty result.`);
        console.error(`[App] 📋 Debug info:`, {
          tokenAddress: tokenData.address,
          tokenSymbol: tokenData.symbol,
          isArcMobile,
          originalWalletsCount: result.wallets.length,
          finalWalletsCount: finalWallets.length,
        });

        // Log failure to diagnostic system and send immediately
        try {
          const logger = getDiagnosticLogger();
          logger.logTokenHolderFetch(
            tokenData.address,
            tokenData.symbol || "UNKNOWN",
            false,
            0,
            0,
            "No wallets found"
          );
          logger.sendLogs().catch(() => {
            // Ignore send errors
          });
        } catch {
          // Ignore logger errors
        }

        if (isArcMobile) {
          addToast(
            "No active holders found. If you're on Arc mobile, please clear your browser cache and refresh (Arc menu → Clear Browsing Data).",
            "warning"
          );
        } else {
          addToast("No active holders found or API limit reached.", "warning");
        }
        setLoading(false);
        return;
      }

      setWallets(finalWallets);
      setLinks(result.links);
      setHoldersPage(1);
      setTargetWalletId(null);
      setSelectedWallet(null);
      setSelectedConnection(null);
      setSelectedConnectionId(null);
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
    } catch {
      addToast("An unexpected error occurred while fetching live data.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- WALLET EVENT HANDLERS ---
  // Note: RainbowKit handles the connection/disconnection flow via ConnectButton component
  // wagmi hooks (useAccount) provide the wallet state

  // Listen for account changes from wagmi
  useEffect(() => {
    if (userAddress && isConnected) {
      // Clear disconnect flag if user connects their wallet
      sessionStorage.removeItem("wallet-intentionally-disconnected");

      // Re-inject user if we are currently viewing a map
      if (token && wallets.length > 0) {
        const injectUserWalletAsync = async () => {
          const updatedWallets = await injectUserWallet(wallets, token, userAddress);
          if (updatedWallets.length !== wallets.length) {
            setWallets(updatedWallets);

            // Check if we've already added this user for this token to prevent duplicate toasts
            const alreadyAdded =
              lastAddedToken.current === token.address && lastAddedAddress.current === userAddress;

            if (!alreadyAdded) {
              addToast("You have been added to the map!", "success");
              lastAddedToken.current = token.address;
              lastAddedAddress.current = userAddress;
            }
          }
        };
        injectUserWalletAsync();
      }
    }
  }, [userAddress, isConnected, token, wallets, injectUserWallet]);

  // Monitor RainbowKit/wagmi connection state for modal management
  useEffect(() => {
    // Force close any open RainbowKit modals if we're connected
    if (isConnected && userAddress) {
      const rainbowKitModal = document.querySelector("[data-rk]");
      if (rainbowKitModal) {
        // Trigger escape key to close modal
        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
        document.dispatchEvent(escapeEvent);
      }
    }
  }, [isConnected, userAddress]);

  // --- INITIAL ROUTING & URL STATE ---
  useEffect(() => {
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
    if (tokenParam && viewParam !== "dashboard") {
      // Only trigger search if NOT on dashboard (preserves dashboard view on refresh)
      const type = typeParam === "NFT" ? AssetType.NFT : AssetType.TOKEN;
      handleSearch(undefined, tokenParam, type);
    } else if (tokenParam && viewParam === "dashboard") {
      // On dashboard, load token data but don't switch view
      const type = typeParam === "NFT" ? AssetType.NFT : AssetType.TOKEN;
      setSearchQuery(tokenParam);
      setSearchType(type);
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Intentional: only run on mount

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

  const handleCreateAlert = async (data: {
    name: string;
    walletAddress: string;
    tokenAddress?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  }) => {
    // Prevent duplicate calls (fixes infinite loop)
    if (isCreatingAlert.current) {
      console.warn("[ALERT CREATE] ⚠️ Already creating alert, skipping duplicate call");
      return;
    }

    isCreatingAlert.current = true;
    console.log("[ALERT CREATE] 🎯 handleCreateAlert called with:", data);

    try {
      let tokenInfo = {
        symbol: undefined as string | undefined,
        name: undefined as string | undefined,
      };

      addToast("Initializing alert...", "info");
      let initialVal = 0;

      if (data.tokenAddress) {
        console.log("[ALERT CREATE] 💰 Token address provided, fetching token data");
        try {
          const fetchedToken = await fetchTokenData(data.tokenAddress);
          if (fetchedToken) {
            tokenInfo = { symbol: fetchedToken.symbol, name: fetchedToken.name };
            console.log("[ALERT CREATE] ✅ Token data fetched:", tokenInfo);
          }
          initialVal = await fetchTokenBalance(data.walletAddress, data.tokenAddress);
          console.log("[ALERT CREATE] 💵 Token balance fetched:", initialVal);
        } catch (e) {
          console.warn("[ALERT CREATE] ⚠️ Could not fetch token info for alert", e);
        }
      } else {
        console.log("[ALERT CREATE] 💰 No token address, using wDOGE fallback");
        // Fallback for general wallet monitoring (wDOGE)
        const wDogeAddress = "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101";
        initialVal = await fetchTokenBalance(data.walletAddress, wDogeAddress);
        console.log("[ALERT CREATE] 💵 wDOGE balance fetched:", initialVal);
      }

      // NOTE: Baseline transactions will be established by Dashboard's runScan()
      // This prevents duplicate fetches and improves alert creation performance
      console.log("[ALERT CREATE] 📊 Baseline will be established by first scan");
      const initialTxs: string[] = [];

      console.log("[ALERT CREATE] 🔨 Creating alert object");
      const newAlert: AlertConfig = {
        id: generateAlertId(),
        walletAddress: data.walletAddress,
        tokenAddress: data.tokenAddress,
        name: data.name,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        initialValue: initialVal,
        type: data.alertType || "WALLET",
        createdAt: Date.now(), // Set creation timestamp
      };
      console.log("[ALERT CREATE] ✅ Alert object created:", newAlert);

      // CRITICAL: Initialize alert status BEFORE adding alert to the list
      // Using flushSync ensures status is set synchronously, preventing Dashboard's
      // useEffect from treating the new alert as "pending" and triggering a full scan
      // IMPORTANT: pendingInitialScan flag tells the auto-scan this alert needs its initial scan
      console.log("[ALERT CREATE] 📊 Updating alert status state (synchronous)");
      ReactDOM.flushSync(() => {
        setAlertStatuses((prev) => ({
          ...prev,
          [newAlert.id]: {
            currentValue: initialVal,
            triggered: false,
            checkedAt: undefined, // Don't set checkedAt - scan will establish the baseline
            lastSeenTransactions: initialTxs,
            pendingInitialScan: true, // Flag to indicate this alert needs its first scan
          },
        }));
      });
      console.log("[ALERT CREATE] ✅ Alert status state updated (synchronous)");

      // Add alert to list AFTER status is set (prevents cascading scan of all alerts)
      console.log("[ALERT CREATE] 📝 Adding alert to list");
      setAlerts((prev) => [...prev, newAlert]);
      addToast("New alert saved", "success");

      // FIX: Immediate server sync (don't wait for useEffect to sync)
      if (userAddress && isConnected) {
        saveAlertToServer(userAddress, newAlert).catch((error) => {
          console.error("[ALERT CREATE] ⚠️ Failed to sync new alert to server:", error);
          addToast("Alert saved locally but not synced to server", "warning");
        });
      }

      console.log("[ALERT CREATE] ✅ Alert creation flow complete");
    } finally {
      // Reset flag after a short delay to prevent rapid duplicate calls
      setTimeout(() => {
        console.log("[ALERT CREATE] 🔓 Resetting creation guard flag");
        isCreatingAlert.current = false;
      }, 1000);
    }
  };

  const handleOpenAlertModal = (prefill?: {
    walletAddress?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  }) => {
    // Switch to Dashboard view if not already there
    // IMPORTANT: Use handleViewChange to ensure browser history is properly updated
    if (view !== ViewState.DASHBOARD) {
      handleViewChange(ViewState.DASHBOARD);
    }
    // Set pre-fill data and open modal
    setAlertModalPrefill(prefill || null);
    setIsAlertModalOpen(true);
    // Close wallet sidebar if open
    if (prefill?.walletAddress) {
      setSelectedWallet(null);
      setSelectedConnection(null);
      setSelectedConnectionId(null);
    }
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    addToast("Alert removed", "info");

    // Delete from server if wallet is connected
    if (userAddress && isConnected) {
      deleteAlertFromServer(userAddress, id).catch((error) => {
        console.error("[SYNC] Failed to delete alert from server:", error);
        // Don't show error toast - alert was already removed locally
      });
    }
  };

  const handleUpdateAlert = async (
    id: string,
    data: {
      name: string;
      walletAddress: string;
      tokenAddress?: string;
      alertType?: "WALLET" | "TOKEN" | "WHALE";
    }
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
        name: data.name,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        initialValue: existingAlert.initialValue,
        type: data.alertType || existingAlert.type || "WALLET",
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

      // Sync to server if wallet is connected
      if (userAddress && isConnected) {
        try {
          await syncAlertsToServer(userAddress);
          console.log("[UPDATE] ✅ Alert synced to server");
        } catch (error) {
          console.error("[UPDATE] ⚠️ Failed to sync updated alert to server:", error);
          // Don't fail the update operation if sync fails
        }
      }

      addToast("Alert updated successfully", "success");
    } catch (error) {
      console.error("Failed to update alert", error);
      addToast("Failed to update alert", "error");
    }
  };

  // Callback to refresh stats when an alert triggers
  const handleAlertTriggered = useCallback(() => {
    console.log("[App] handleAlertTriggered called - refreshing stats");
    // Invalidate local cache
    try {
      localStorage.removeItem("doge_stats_cache");
      console.log("[App] Stats cache cleared");
    } catch (e) {
      console.error("[App] Error clearing stats cache:", e);
    }
    // Refresh stats from server
    refreshStats()
      .then(() => {
        console.log("[App] Stats refresh completed");
      })
      .catch((e) => {
        console.error("[App] Stats refresh failed:", e);
      });
  }, [refreshStats]);

  return (
    <div className="min-h-screen bg-space-900 text-slate-100 font-sans selection:bg-purple-500 selection:text-white flex flex-col overflow-x-hidden">
      <Analytics />
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Diagnostic Mode Indicator */}
      {import.meta.env.MODE === "production" && (
        <div className="fixed bottom-2 left-2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-purple-500/30 shadow-lg">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-purple-300 font-medium">Diagnostic Mode Active</span>
        </div>
      )}

      <Navbar currentView={view} onChangeView={handleViewChange} hasAnalysisData={!!token} />

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

                {/* Stats Counters */}
                <div className="mt-6 flex justify-center items-center gap-6 text-xs">
                  {/* Search Counter */}
                  <Tooltip content="Since January 12, 2026">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Search size={14} className="text-purple-500" />
                      <span className="text-slate-500">Total Searches:</span>
                      <span className="font-mono font-semibold text-purple-400">
                        {isLoadingStats ? "..." : formatNumber(totalSearches)}
                      </span>
                    </div>
                  </Tooltip>

                  {/* Alert Counter */}
                  <Tooltip content="Since January 12, 2026">
                    <div className="flex items-center gap-2 text-slate-400">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span className="text-slate-500">Alerts Fired:</span>
                      <span className="font-mono font-semibold text-amber-400">
                        {isLoadingStats ? "..." : formatNumber(totalAlerts)}
                      </span>
                    </div>
                  </Tooltip>
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
                  value={searchQuery}
                  onChange={setSearchQuery}
                  inputRef={searchInputRef}
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
                          onClick={(e) => {
                            // Scroll to search input and focus it for visual feedback
                            searchInputRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            setTimeout(() => {
                              searchInputRef.current?.focus();
                            }, 300);

                            handleSearch(e, item.query, item.type);
                          }}
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
                      <Tooltip content="Fresh scan (bypasses cache)">
                        <button
                          onClick={handleManualScan}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors"
                          disabled={isScanningWallet || !userAddress}
                        >
                          {isScanningWallet ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <WalletIcon size={14} />
                          )}
                          <span>{isScanningWallet ? "Scanning" : "Scan"}</span>
                        </button>
                      </Tooltip>
                      <Tooltip content="Quick reload (uses cache if available)">
                        <button
                          onClick={handleRefreshScan}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-space-700 hover:bg-space-600 text-white disabled:opacity-50 transition-colors border border-space-600"
                          disabled={isScanningWallet || !userAddress}
                        >
                          <RefreshCw size={14} className={isScanningWallet ? "animate-spin" : ""} />
                          <span className="hidden sm:inline">Refresh</span>
                        </button>
                      </Tooltip>
                      {isScanningWallet && (
                        <Tooltip content="Stop scan">
                          <button
                            onClick={handleCancelScan}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                          >
                            <X size={14} />
                            <span className="hidden sm:inline">Stop</span>
                          </button>
                        </Tooltip>
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
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      // Scroll to search input and focus it for visual feedback
                                      searchInputRef.current?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                      });
                                      setTimeout(() => {
                                        searchInputRef.current?.focus();
                                      }, 300);

                                      handleSearch(e, asset.address, asset.type);
                                    }}
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
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      // Scroll to search input and focus it for visual feedback
                                      searchInputRef.current?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                      });
                                      setTimeout(() => {
                                        searchInputRef.current?.focus();
                                      }, 300);

                                      handleSearch(e, asset.address, asset.type);
                                    }}
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

              {/* Trending Sections */}
              <TrendingSection
                title="Trending Tokens"
                icon={<Coins size={14} />}
                assets={trendingTokens}
                onAssetClick={(e, asset) => {
                  e.preventDefault();
                  e.stopPropagation();
                  searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                  }, 300);
                  handleSearch(e, asset.address, asset.type);
                }}
              />

              <TrendingSection
                title="Trending NFTs"
                icon={<ImageIcon size={14} />}
                assets={trendingNfts}
                onAssetClick={(e, asset) => {
                  e.preventDefault();
                  e.stopPropagation();
                  searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                  }, 300);
                  handleSearch(e, asset.address, asset.type);
                }}
              />
            </div>

            {/* Footer */}
            <div className="w-full mt-auto">
              <Footer onOpenGuide={openOnboarding} />
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
                        <Tooltip content="Verified Source">
                          <span className="text-green-500">
                            <ShieldCheck size={16} />
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Unverified Source">
                          <span className="text-slate-500">
                            <AlertTriangle size={16} />
                          </span>
                        </Tooltip>
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
                        const isSelected = selectedWallet?.id === w.id || targetWalletId === w.id;
                        return (
                          <div
                            key={w.id}
                            className={`flex items-center justify-between text-sm p-2 rounded cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-purple-500/30 border border-purple-500/50"
                                : "hover:bg-space-700"
                            }`}
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
                              <span
                                className={`w-4 shrink-0 ${isSelected ? "text-purple-300" : "text-slate-500"}`}
                              >
                                {globalIndex + 1}
                              </span>
                              <span
                                className={`font-mono text-xs ${isSelected ? "text-purple-400" : "text-slate-300"}`}
                                title={w.address}
                              >
                                {w.address.slice(0, 6)}...{w.address.slice(-4)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-xs ${
                                  isSelected
                                    ? "text-purple-400"
                                    : token.type === AssetType.NFT
                                      ? "text-purple-400"
                                      : "text-doge-500"
                                }`}
                              >
                                {w.percentage.toFixed(1)}%
                              </span>
                              <Tooltip content="View wallet on Dogechain Explorer">
                                <a
                                  href={`https://explorer.dogechain.dog/address/${w.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`transition-colors p-2 rounded min-w-[44px] min-h-[44px] inline-flex items-center justify-center [touch-action:manipulation] ${
                                    isSelected
                                      ? "text-purple-300 hover:text-white bg-purple-900/30 hover:bg-purple-900/50"
                                      : "text-slate-500 hover:text-white hover:bg-space-600"
                                  }`}
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
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {wallets.length > 10 && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            setHoldersPage(Math.max(1, holdersPage - 1));
                            if (!hasInteractedWithTokenPanel) setHasInteractedWithTokenPanel(true);
                          }}
                          disabled={holdersPage === 1}
                          className="px-3 py-1 text-xs bg-space-800 border border-space-700 rounded hover:bg-space-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Prev
                        </button>
                        <span className="text-xs text-slate-400">
                          Page {holdersPage} of {Math.ceil(wallets.length / 10)}
                        </span>
                        <button
                          onClick={() => {
                            setHoldersPage(
                              Math.min(Math.ceil(wallets.length / 10), holdersPage + 1)
                            );
                            if (!hasInteractedWithTokenPanel) setHasInteractedWithTokenPanel(true);
                          }}
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
                    <Tooltip content="Export all data as CSV file">
                      <button
                        onClick={handleExportCSV}
                        className="bg-space-800 border border-space-700 text-slate-200 px-3 sm:px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg hover:bg-space-700 transition-colors"
                      >
                        <Download size={14} /> <span className="hidden sm:inline">CSV</span>
                      </button>
                    </Tooltip>

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
                    onWalletClick={handleWalletClickOnMap}
                    targetWalletId={targetWalletId}
                    onConnectionClick={handleConnectionClick}
                    selectedConnectionId={selectedConnectionId}
                    freezeLayout={isMapLayoutFrozen}
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
                  onOpenAlertModal={() =>
                    selectedWallet &&
                    handleOpenAlertModal({
                      walletAddress: selectedWallet.address,
                      tokenAddress: token.address,
                      tokenSymbol: token.symbol,
                    })
                  }
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
            {!userAddress ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
                <div className="w-20 h-20 bg-space-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                  <WalletIcon size={40} className="text-slate-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Wallet Connection Required</h2>
                <p className="text-slate-400 max-w-md mb-8">
                  Please connect your wallet to access the Dashboard and manage your alerts.
                </p>
                {/* RainbowKit Connect Button handles wallet connection */}
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            ) : (
              <Dashboard
                alerts={alerts}
                statuses={alertStatuses}
                onUpdateStatuses={setAlertStatuses}
                onRemoveAlert={handleRemoveAlert}
                onAddAlert={handleCreateAlert}
                onUpdateAlert={handleUpdateAlert}
                triggeredEvents={triggeredEvents}
                onTriggeredEventsChange={setTriggeredEvents}
                isAlertModalOpen={isAlertModalOpen}
                alertModalPrefill={alertModalPrefill}
                onAlertModalOpen={(prefill) => {
                  setAlertModalPrefill(prefill);
                  setIsAlertModalOpen(true);
                }}
                onAlertModalClose={() => {
                  setIsAlertModalOpen(false);
                  setAlertModalPrefill(null);
                }}
                onAlertTriggered={handleAlertTriggered}
              />
            )}
            <div className="mt-auto">
              <Footer onOpenGuide={openOnboarding} />
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        currentStep={onboardingStep}
        totalSteps={onboardingTotalSteps}
        progress={onboardingProgress}
        onNext={nextOnboardingStep}
        onPrevious={prevOnboardingStep}
        onClose={handleOnboardingClose}
        onSkip={handleOnboardingSkip}
      />

      {/* Map Analysis Context-Aware Guides */}
      <BubbleVisualizationGuide
        isOpen={bubbleGuide.isOpen}
        currentStep={bubbleGuide.currentStep}
        totalSteps={bubbleGuide.totalSteps}
        progress={bubbleGuide.progress}
        onNext={bubbleGuide.nextStep}
        onPrevious={bubbleGuide.prevStep}
        onClose={bubbleGuide.closeGuide}
        onSkip={bubbleGuide.skipGuide}
      />

      <TokenInfoPanelGuide
        isOpen={tokenPanelGuide.isOpen}
        currentStep={tokenPanelGuide.currentStep}
        totalSteps={tokenPanelGuide.totalSteps}
        progress={tokenPanelGuide.progress}
        onNext={tokenPanelGuide.nextStep}
        onPrevious={tokenPanelGuide.prevStep}
        onClose={tokenPanelGuide.closeGuide}
        onSkip={tokenPanelGuide.skipGuide}
      />

      <WalletDetailsGuide
        isOpen={walletDetailsGuide.isOpen}
        currentStep={walletDetailsGuide.currentStep}
        totalSteps={walletDetailsGuide.totalSteps}
        progress={walletDetailsGuide.progress}
        onNext={walletDetailsGuide.nextStep}
        onPrevious={walletDetailsGuide.prevStep}
        onClose={walletDetailsGuide.closeGuide}
        onSkip={walletDetailsGuide.skipGuide}
      />

      {/* Dashboard Guide */}
      <DashboardGuide
        isOpen={dashboardGuide.isOpen}
        currentStep={dashboardGuide.currentStep}
        totalSteps={dashboardGuide.totalSteps}
        progress={dashboardGuide.progress}
        onNext={dashboardGuide.nextStep}
        onPrevious={dashboardGuide.prevStep}
        onClose={dashboardGuide.closeGuide}
        onSkip={dashboardGuide.skipGuide}
      />
    </div>
  );
};

export default App;
