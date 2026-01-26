import React, { useState, useEffect, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console -- Console logging is critical for debugging alert creation */
import { AlertConfig, AlertStatus, AssetType, Transaction, TriggeredEvent } from "../types";
import {
  Trash2,
  Bell,
  Plus,
  X,
  Loader2,
  Save,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Volume2,
  VolumeX,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Download,
  Edit,
  ExternalLink,
  LineChart,
  HelpCircle,
} from "lucide-react";
import { Tooltip } from "./Tooltip";
import { EmbeddedChart } from "./EmbeddedChart";
import { DashboardGuide } from "./DashboardGuide";
import { useDashboardGuide } from "../hooks/useDashboardGuide";
import { CustomSelect } from "./CustomSelect";

import {
  fetchTokenBalance,
  fetchWalletTransactions,
  fetchTokenData,
  clearTransactionCache,
} from "../services/dataService";
import { exportDatabaseAsCSV } from "../services/db";
import { validateTokenAddress, validateWalletAddress } from "../utils/validation";
import { getApiUrl } from "../utils/api";

interface InAppNotification {
  id: string;
  alertId: string;
  alertName: string;
  walletAddress: string;
  transaction?: Transaction;
  timestamp: number;
}

// localStorage key for notification persistence
const NOTIFICATIONS_STORAGE_KEY = "doge_notifications";

// Helper functions for notification persistence with error handling
const loadNotificationsFromStorage = (): InAppNotification[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    // Handle migration from old format if needed
    if (!Array.isArray(parsed)) {
      console.warn("[Notifications] Invalid format in storage, clearing");
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      return [];
    }

    // Validate and filter valid notifications
    const valid: InAppNotification[] = parsed.filter((n) => {
      return (
        n &&
        typeof n === "object" &&
        typeof n.id === "string" &&
        typeof n.alertId === "string" &&
        typeof n.alertName === "string" &&
        typeof n.walletAddress === "string" &&
        typeof n.timestamp === "number"
      );
    });

    // Sort by timestamp descending (newest first)
    return valid.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("[Notifications] Error loading from storage:", error);
    return [];
  }
};

const saveNotificationsToStorage = (notifications: InAppNotification[]): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("[Notifications] Error saving to storage:", error);
  }
};

const clearNotificationsFromStorage = (
  statuses: Record<string, AlertStatus>,
  onUpdateStatuses?: (newStatuses: Record<string, AlertStatus>) => void
): void => {
  if (typeof window === "undefined") return;

  try {
    // Step 1: Clear the transaction cache FIRST to prevent the scan from re-using old data
    clearTransactionCache();

    // Step 2: Clear localStorage
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    localStorage.removeItem("doge_notified_transactions");

    // Step 3: CRITICAL: Reset alert statuses to prevent re-triggering on old transactions
    // This follows the same pattern as the one-time cleanup
    const newStatuses: Record<string, AlertStatus> = {};
    Object.keys(statuses).forEach((alertId) => {
      const status = statuses[alertId];
      if (status) {
        newStatuses[alertId] = {
          currentValue: status.currentValue,
          triggered: false, // Reset triggered state
          checkedAt: Date.now(), // Move check point forward to ignore old transactions
          notified: false, // Reset notified state
          lastSeenTransactions: [], // Clear seen transactions
          newTransactions: undefined, // Clear pending transactions
          baselineEstablished: status.baselineEstablished,
          baselineTimestamp: status.baselineTimestamp,
          pendingInitialScan: false, // Clear pending scan flag
          dismissedAt: Date.now(), // Mark as dismissed to prevent re-trigger
        };
      }
    });
    onUpdateStatuses?.(newStatuses);

    console.log("[Notifications] Cleared all notification storage and alert state");
  } catch (error) {
    console.error("[Notifications] Error clearing storage:", error);
  }
};

// Track notified transactions to prevent duplicates after page refresh
const NOTIFIED_TXS_KEY = "doge_notified_transactions";

const getNotifiedTransactions = (): Set<string> => {
  try {
    const stored = localStorage.getItem(NOTIFIED_TXS_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      return new Set(arr);
    }
  } catch (e) {
    console.error("[Notifications] Error loading notified transactions:", e);
  }
  return new Set();
};

const saveNotifiedTransaction = (txHash: string): void => {
  try {
    const notified = getNotifiedTransactions();
    notified.add(txHash);
    // Keep only last 1000 to prevent localStorage bloat
    const arr = Array.from(notified).slice(-1000);
    localStorage.setItem(NOTIFIED_TXS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error("[Notifications] Error saving notified transaction:", e);
  }
};

const isTransactionNotified = (txHash: string): boolean => {
  return getNotifiedTransactions().has(txHash);
};

interface DashboardProps {
  alerts: AlertConfig[];
  statuses: Record<string, AlertStatus>;
  onUpdateStatuses: (newStatuses: Record<string, AlertStatus>) => void;
  onRemoveAlert: (id: string) => void;
  onAddAlert: (alert: {
    name: string;
    walletAddress: string;
    tokenAddress?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  }) => Promise<void>;
  onUpdateAlert: (
    id: string,
    alert: {
      name: string;
      walletAddress: string;
      tokenAddress?: string;
      alertType?: "WALLET" | "TOKEN" | "WHALE";
    }
  ) => Promise<void>;
  triggeredEvents: TriggeredEvent[];
  onTriggeredEventsChange: (events: TriggeredEvent[]) => void;
  isAlertModalOpen?: boolean;
  alertModalPrefill?: {
    editingAlertId?: string;
    name?: string;
    walletAddress?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  } | null;
  onAlertModalClose?: () => void;
  onAlertModalOpen?: (prefill: {
    editingAlertId: string;
    name: string;
    walletAddress: string;
    tokenAddress: string;
    alertType: "WALLET" | "TOKEN" | "WHALE";
  }) => void;
  onAlertTriggered?: () => void; // Callback when alert triggers to refresh stats
}

export const Dashboard: React.FC<DashboardProps> = ({
  alerts,
  statuses,
  onUpdateStatuses,
  onRemoveAlert,
  onAddAlert,
  onUpdateAlert,
  triggeredEvents,
  onTriggeredEventsChange,
  isAlertModalOpen: externalIsModalOpen,
  alertModalPrefill,
  onAlertModalClose,
  onAlertModalOpen,
  onAlertTriggered,
}) => {
  // Alert type options for the dropdown
  const alertTypeOptions = [
    {
      value: "WALLET",
      label: "Wallet Watch",
      description: "Monitor all activity - Get notified of all token transfers",
    },
    {
      value: "TOKEN",
      label: "Token Movement",
      description: "Track specific token - Only monitor transfers of this token",
    },
    {
      value: "WHALE",
      label: "Whale Watch",
      description: "Large transfers - Get alerted to significant movements only",
    },
  ];

  // Safe unique ID generator for triggered events (fixes duplicate key error)
  const generateEventId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `event-${crypto.randomUUID()}`;
    }
    return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const [internalIsModalOpen, setInternalIsModalOpen] = useState(false);

  // Use external modal state if provided, otherwise use internal state
  const isModalOpen = externalIsModalOpen !== undefined ? externalIsModalOpen : internalIsModalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [notificationsLimit, setNotificationsLimit] = useState(10);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedNotificationCharts, setExpandedNotificationCharts] = useState<Set<string>>(
    new Set()
  );

  const [formData, setFormData] = useState({
    name: "",
    walletAddress: "",
    tokenAddress: "",
    alertType: "WALLET" as "WALLET" | "TOKEN" | "WHALE",
  });

  const trackedWalletsCount = new Set(alerts.map((a) => a.walletAddress)).size;
  const activeTriggers = Object.values(statuses).filter((s: AlertStatus) => s.triggered).length;

  // Dashboard guide integration
  const dashboardGuide = useDashboardGuide(true);

  // Helper: Extract primary token from transactions (declared before use)
  const extractPrimaryToken = useCallback(
    (
      transactions: Transaction[],
      alert?: AlertConfig
    ): { address: string; symbol: string } | null => {
      if (!transactions || transactions.length === 0) {
        return null;
      }

      // Count token occurrences
      const tokenCounts = new Map<string, { count: number; address: string; symbol: string }>();

      for (const tx of transactions) {
        if (tx.tokenAddress) {
          const existing = tokenCounts.get(tx.tokenAddress);
          if (existing) {
            existing.count++;
          } else {
            tokenCounts.set(tx.tokenAddress, {
              count: 1,
              address: tx.tokenAddress,
              symbol: tx.tokenSymbol || "Token",
            });
          }
        }
      }

      if (tokenCounts.size === 0) {
        // No token address found in transactions
        return alert?.tokenAddress
          ? { address: alert.tokenAddress, symbol: alert.tokenSymbol || "Token" }
          : null;
      }

      // Find most common token
      let mostCommon = null;
      let maxCount = 0;

      for (const tokenData of tokenCounts.values()) {
        if (tokenData.count > maxCount) {
          maxCount = tokenData.count;
          mostCommon = tokenData;
        }
      }

      return mostCommon;
    },
    []
  );

  // Find the most recent scan time
  const lastScanTime =
    Object.values(statuses).length > 0
      ? Math.max(
          ...Object.values(statuses)
            .map((s: AlertStatus) => s.checkedAt)
            .filter((v): v is number => v !== undefined)
        )
      : null;

  // --- SCAN LOGIC ---
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;

    // Create audio context for notification sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play a pleasant notification sound
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Error handled silently - audio playback failed
    }
  }, [soundEnabled]);

  const runScan = useCallback(
    async (forceRefresh = false) => {
      if (alerts.length === 0) return;

      setIsScanning(true);
      const newStatuses: Record<string, AlertStatus> = {};

      // CRITICAL FIX: Scan ALL alerts, not just new ones
      // New alerts (without status) get initial baseline scan
      // Existing alerts get scanned for new transactions since last check
      const alertsToScan = alerts;

      // Batch processing to prevent rate limiting
      const batchSize = 4;
      const delayBetweenBatches = 750; // milliseconds

      for (let i = 0; i < alertsToScan.length; i += batchSize) {
        const batch = alertsToScan.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (alert) => {
            try {
              // Validate addresses; skip invalid to avoid repeated bad requests
              try {
                validateWalletAddress(alert.walletAddress);
                if (alert.tokenAddress) validateTokenAddress(alert.tokenAddress);
              } catch {
                return;
              }

              // Ensure we have a baseline for new alerts so we don't loop forever
              const existingStatus = statuses[alert.id];

              // Fetch current balance first (needed for WHALE type threshold calculation)
              let currentBalance = 0;
              if (alert.tokenAddress) {
                // Get token info first to ensure correct decimals
                try {
                  const tokenData = await fetchTokenData(alert.tokenAddress);
                  if (tokenData) {
                    currentBalance = await fetchTokenBalance(
                      alert.walletAddress,
                      alert.tokenAddress,
                      tokenData.decimals
                    );
                  }
                } catch {
                  // Fallback without decimals
                  currentBalance = await fetchTokenBalance(alert.walletAddress, alert.tokenAddress);
                }
              } else {
                // Default to wDOGE if no token specified
                const wDogeAddress = "0xb7ddc6414bf4f5515b52d8bdd69973ae205ff101";
                currentBalance = await fetchTokenBalance(alert.walletAddress, wDogeAddress, 18);
              }

              // Fetch transactions based on alert type
              // WALLET: Monitor all token activity (no token filter)
              // TOKEN: Monitor specific token only (filtered by tokenAddress)
              // WHALE: Monitor large transfers (filter by value threshold)
              const transactions = await fetchWalletTransactions(
                alert.walletAddress,
                alert.type === "WALLET" ? undefined : alert.tokenAddress, // WALLET gets all tokens
                AssetType.TOKEN,
                forceRefresh // Bypass cache when manually scanning
              );

              // Check if baseline already established (prevents historical transaction spam)
              const isBaselineEstablished = existingStatus?.baselineEstablished || false;
              // For existing alerts, use baseline timestamp; for new alerts, use creation time
              const alertCreatedAt = isBaselineEstablished
                ? existingStatus?.baselineTimestamp || alert.createdAt || Date.now()
                : alert.createdAt || Date.now();

              // Debug: Log transaction timestamps
              if (transactions.length > 0) {
                const oldestTx = transactions[transactions.length - 1];
                const newestTx = transactions[0];
                // Safe ISO string conversion with validation
                const toSafeISOString = (ts: number | undefined) => {
                  if (!ts || isNaN(ts)) return new Date().toISOString();
                  const d = new Date(ts);
                  if (isNaN(d.getTime())) return new Date().toISOString();
                  return d.toISOString();
                };
                console.log(`[Alert ${alert.id}] Fetched ${transactions.length} transactions`, {
                  oldest: toSafeISOString(oldestTx?.timestamp),
                  newest: toSafeISOString(newestTx?.timestamp),
                  alertCreatedAt: toSafeISOString(alertCreatedAt),
                });
              }

              // For new alerts, filter to only transactions AFTER alert creation
              let transactionsForBaseline = transactions;
              if (!isBaselineEstablished) {
                transactionsForBaseline = transactions.filter(
                  (tx) => tx.timestamp >= alertCreatedAt
                );
                // FIX: For WHALE alerts, also filter by value threshold in initial baseline
                if (alert.type === "WHALE" && transactionsForBaseline.length > 0) {
                  const whaleThreshold = Math.max(10000, currentBalance * 0.01);
                  transactionsForBaseline = transactionsForBaseline.filter(
                    (tx) => tx.value >= whaleThreshold
                  );
                }
              }

              // Get previously seen transactions or initialize baseline
              const previousTxs =
                existingStatus?.lastSeenTransactions ||
                transactionsForBaseline.map((tx) => tx.hash);
              const previousTxSet = new Set(previousTxs);

              // CRITICAL FIX: For established baselines, only consider transactions AFTER last check
              // This ensures we re-trigger on transactions that happened since the last scan
              let newTransactions = transactions.filter((tx) => !previousTxSet.has(tx.hash));

              if (isBaselineEstablished && existingStatus?.checkedAt) {
                // For established alerts, filter to only transactions AFTER last check
                // This re-detects recent transactions instead of only truly unseen ones
                const lastCheckTime = existingStatus.checkedAt;
                newTransactions = transactions.filter((tx) => tx.timestamp > lastCheckTime);

                console.log(
                  `[Alert ${alert.id}] Filtered to ${newTransactions.length} transactions since last check (${new Date(lastCheckTime).toISOString()})`
                );

                // Log each new transaction for debugging
                if (newTransactions.length > 0) {
                  // Safe ISO string conversion for transaction timestamps
                  const toSafeISOString = (ts: number) => {
                    if (!ts || isNaN(ts)) return "Invalid timestamp";
                    const d = new Date(ts);
                    if (isNaN(d.getTime())) return "Invalid timestamp";
                    return d.toISOString();
                  };
                  console.log(
                    `[Alert ${alert.id}] New transactions:`,
                    newTransactions.map((tx) => ({
                      hash: tx.hash,
                      timestamp: toSafeISOString(tx.timestamp),
                      value: tx.value,
                    }))
                  );
                }
              }

              // Apply type-specific filtering for new transactions
              let filteredNewTransactions = newTransactions;

              if (alert.type === "WHALE" && newTransactions.length > 0) {
                // WHALE type: Only trigger on large transactions
                // Define "large" as >= 10,000 tokens or >= 1% of current balance (whichever is larger)
                const whaleThreshold = Math.max(10000, currentBalance * 0.01);
                // FIX: Use >= instead of > to include transactions at the threshold boundary
                filteredNewTransactions = newTransactions.filter(
                  (tx) => tx.value >= whaleThreshold
                );
              }

              // Create new set of all seen transactions
              const allSeenTxs = [
                ...new Set([...previousTxs, ...transactions.map((tx) => tx.hash)]),
              ];

              // Trigger alert if we found new transactions
              // For new alerts (no baseline): trigger on transactions AFTER alert creation
              // For existing alerts: trigger on transactions since last scan
              const hasNewActivity = isBaselineEstablished
                ? filteredNewTransactions.length > 0
                : transactionsForBaseline.length > 0; // New alerts trigger on post-creation transactions

              // Keep triggered state persistent - once triggered, stay triggered until manually reset
              // FIX: But don't persist if the alert was dismissed (dismissedAt > checkedAt)
              const wasTriggered = existingStatus?.triggered || false;
              const dismissedAt = existingStatus?.dismissedAt || 0;
              const checkedAt = existingStatus?.checkedAt || 0;
              // An alert is considered dismissed if dismissedAt is set (not 0) AND >= checkedAt
              // Using >= ensures equal timestamps (from clearNotificationsFromStorage) are treated as dismissed
              const wasDismissedAfterLastTrigger = dismissedAt > 0 && dismissedAt >= checkedAt;
              const shouldTrigger =
                hasNewActivity || (wasTriggered && !wasDismissedAfterLastTrigger);

              newStatuses[alert.id] = {
                currentValue: currentBalance,
                triggered: shouldTrigger,
                checkedAt: Date.now(),
                lastSeenTransactions: allSeenTxs,
                newTransactions: hasNewActivity
                  ? isBaselineEstablished
                    ? filteredNewTransactions
                    : transactionsForBaseline
                  : undefined,
                baselineEstablished: true, // Mark baseline as established
                pendingInitialScan: false, // Clear the pending flag - scan complete
                baselineTimestamp: isBaselineEstablished
                  ? existingStatus?.baselineTimestamp
                  : Date.now(),
                dismissedAt: existingStatus?.dismissedAt, // Preserve dismissal timestamp
              };
            } catch (error) {
              console.error(`[Alert ${alert.id}] Error during scan:`, error);
              // FIX: Clear pendingInitialScan flag to prevent infinite rescans on error
              newStatuses[alert.id] = {
                currentValue: 0,
                triggered: false,
                checkedAt: Date.now(),
                pendingInitialScan: false,
              };
            }
          })
        );

        // Add delay between batches to prevent rate limiting
        if (i + batchSize < alertsToScan.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }

      onUpdateStatuses?.({ ...statuses, ...newStatuses });
      setIsScanning(false);
    },
    [alerts, statuses, onUpdateStatuses]
  );

  // Auto-scan logic: Only run scan for alerts that don't have statuses yet (newly added alerts)
  // This prevents re-scanning all existing alerts when a new alert is created
  useEffect(() => {
    if (alerts.length > 0) {
      // Find alerts without statuses OR have pendingInitialScan flag
      const alertsWithoutStatus = alerts.filter(
        (a) => !statuses[a.id] || statuses[a.id]?.pendingInitialScan
      );
      if (alertsWithoutStatus.length > 0 && !isScanning) {
        runScan();
      }
    }
    // FIX: Use full dependencies to prevent stale closures
    // runScan is excluded because it's memoized with useCallback and depends on these same values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, statuses, isScanning]);

  // Migration: Add baseline tracking to existing alerts
  useEffect(() => {
    const migrateAlertStatuses = () => {
      const migratedStatuses: Record<string, import("../types").AlertStatus> = {};
      let hasMigrations = false;

      Object.entries(statuses).forEach(([alertId, status]) => {
        if (status.baselineEstablished === undefined) {
          const alert = alerts.find((a) => a.id === alertId);
          if (alert) {
            migratedStatuses[alertId] = {
              ...status,
              baselineEstablished: true,
              baselineTimestamp: Date.now(), // Use migration time, not alert creation time
            };
            hasMigrations = true;
          } else {
            migratedStatuses[alertId] = status;
          }
        } else {
          migratedStatuses[alertId] = status;
        }
      });

      if (hasMigrations) {
        onUpdateStatuses?.({ ...statuses, ...migratedStatuses });
      }
    };

    migrateAlertStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]); // Run when alerts load

  // ONE-TIME CLEANUP: Reset all alert statuses to clear old transaction data
  // This prevents old transactions from appearing in new alerts
  useEffect(() => {
    const cleanupOldStatuses = () => {
      const CLEANUP_KEY = "dogechain_bubblemaps_cleanup_v1";
      const alreadyCleaned = localStorage.getItem(CLEANUP_KEY);

      if (alreadyCleaned) {
        console.log("[Cleanup] Already completed, skipping");
        return;
      }

      console.log("[Cleanup] Starting one-time cleanup of alert statuses...");
      const cleanedStatuses: Record<string, import("../types").AlertStatus> = {};
      let hasChanges = false;

      Object.entries(statuses).forEach(([alertId, status]) => {
        // Reset all statuses to clear old transaction data
        cleanedStatuses[alertId] = {
          currentValue: status.currentValue || 0,
          triggered: false, // Reset triggered state
          checkedAt: Date.now(),
          lastSeenTransactions: [], // Clear old transactions
          baselineEstablished: true,
          baselineTimestamp: Date.now(), // Set baseline to NOW
          newTransactions: undefined, // Clear any pending new transactions
        };
        hasChanges = true;
      });

      if (hasChanges) {
        onUpdateStatuses?.({ ...statuses, ...cleanedStatuses });
        localStorage.setItem(CLEANUP_KEY, "true");
        console.log("[Cleanup] ✅ Cleanup complete");
      }
    };

    cleanupOldStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Load notifications from localStorage on mount
  useEffect(() => {
    const loaded = loadNotificationsFromStorage();
    if (loaded.length > 0) {
      setInAppNotifications(loaded);
      setHasMoreNotifications(loaded.length > notificationsLimit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Persist notifications to localStorage when they change
  useEffect(() => {
    saveNotificationsToStorage(inAppNotifications);
  }, [inAppNotifications]);

  // Periodic automatic scanning every 30 seconds
  useEffect(() => {
    // Don't start periodic scanning if there are no alerts
    if (alerts.length === 0) return;

    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Run initial scan
    if (!isScanning) {
      runScan();
    }

    // Set up interval for periodic scanning (every 10 seconds for faster detection)
    const intervalId = setInterval(() => {
      if (!isScanning && alerts.length > 0) {
        runScan();
      }
    }, 10000); // 10 seconds (reduced from 30s for faster alert detection)

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [alerts.length]); // Re-setup when alerts length changes (runScan excluded to prevent rapid interval recreation)

  // Show browser notifications when alerts trigger
  useEffect(() => {
    // Get currently triggered alerts
    const triggeredAlerts = alerts.filter((alert) => {
      const status = statuses[alert.id];
      return (
        status && status.triggered && status.newTransactions && status.newTransactions.length > 0
      );
    });

    // Process each triggered alert's new transactions
    triggeredAlerts.forEach((alert) => {
      const status = statuses[alert.id];
      if (!status || !status.newTransactions) return;

      // Save triggered event to history (once per alert trigger)
      const eventId = generateEventId();
      const alreadyRecorded = triggeredEvents.some(
        (e) =>
          e.alertId === alert.id &&
          e.transactions.some((t) => status.newTransactions?.some((nt) => nt.hash === t.hash))
      );

      if (!alreadyRecorded) {
        // Extract primary token from actual transactions
        const primaryToken = extractPrimaryToken(status.newTransactions, alert);

        const triggeredEvent: TriggeredEvent = {
          id: eventId,
          alertId: alert.id,
          alertName: alert.name,
          walletAddress: alert.walletAddress,
          tokenAddress: primaryToken?.address,
          tokenSymbol: primaryToken?.symbol,
          transactions: status.newTransactions,
          triggeredAt: Date.now(),
          notified: true,
        };

        // Add to triggered events history (keep last 100)
        onTriggeredEventsChange?.([triggeredEvent, ...triggeredEvents].slice(0, 100));

        // Log triggered alert to server (non-blocking, fire-and-forget)
        console.log(`[ALERT TRIGGER] Sending to API:`, {
          alertId: triggeredEvent.alertId,
          alertName: triggeredEvent.alertName,
          transactionCount: triggeredEvent.transactions.length,
        });

        fetch(getApiUrl("/api/alerts?action=trigger"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertId: triggeredEvent.alertId,
            alertName: triggeredEvent.alertName,
            walletAddress: triggeredEvent.walletAddress,
            tokenAddress: triggeredEvent.tokenAddress,
            tokenSymbol: triggeredEvent.tokenSymbol,
            transactionCount: triggeredEvent.transactions.length,
          }),
        })
          .then(async (response) => {
            // Only trigger stats refresh on successful response (2xx status)
            if (response.ok) {
              console.log(`[ALERT TRIGGER] API response:`, response.status, "OK");
              // Wait a moment for database to commit before refreshing stats
              await new Promise((resolve) => setTimeout(resolve, 500));
              onAlertTriggered?.();
            } else {
              console.error(
                `[ALERT TRIGGER] API error response:`,
                response.status,
                response.statusText
              );
              // Try to parse error body for more details
              try {
                const errorBody = await response.json();
                console.error(`[ALERT TRIGGER] Error details:`, errorBody);
              } catch {
                // Response body wasn't JSON
              }
            }
          })
          .catch((err) => {
            console.error(`[ALERT TRIGGER] API network error:`, err);
          });
      }

      // CRITICAL: Clear newTransactions immediately to prevent duplicate notifications
      // This must happen BEFORE processing to prevent race conditions
      const txsToProcess = status.newTransactions || [];
      onUpdateStatuses?.({
        ...statuses,
        [alert.id]: { ...status, newTransactions: undefined },
      });

      txsToProcess.forEach((tx) => {
        const notifId = `notif-${alert.id}-${tx.hash}`;

        // Check if this transaction was already notified (persists across page refreshes)
        if (isTransactionNotified(tx.hash)) {
          console.log(
            `[Notifications] Skipping already notified transaction: ${tx.hash.slice(0, 10)}...`
          );
          return;
        }

        // Check if we already created a notification for this transaction in current session
        const alreadyNotifiedInSession = inAppNotifications.some((n) => n.id === notifId);
        if (alreadyNotifiedInSession) return;

        // Mark this transaction as notified (persists across page refreshes)
        saveNotifiedTransaction(tx.hash);

        // Play sound
        playAlertSound();

        // Determine transaction direction
        const isIncoming = tx.to.toLowerCase() === alert.walletAddress.toLowerCase();
        const txDirection = isIncoming ? "INCOMING" : "OUTGOING";

        // Try browser notification first
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(`${txDirection}: ${alert.name}`, {
            body: `${tx.value.toLocaleString()} ${tx.tokenSymbol || "tokens"}\nFrom: ${tx.from.slice(0, 8)}...\nTo: ${tx.to.slice(0, 8)}...`,
            icon: "/favicon.ico",
            tag: notifId,
            requireInteraction: true,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          // Add to in-app notifications as well
          const inAppNotif: InAppNotification = {
            id: notifId,
            alertId: alert.id,
            alertName: alert.name,
            walletAddress: alert.walletAddress,
            transaction: tx,
            timestamp: Date.now(),
          };

          setInAppNotifications((prev) => {
            const MAX_NOTIFICATIONS = 200; // Prevent unbounded growth
            const updated = [inAppNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
            setHasMoreNotifications(updated.length > notificationsLimit);
            return updated.slice(0, notificationsLimit);
          });
        } else {
          // Fallback to in-app notification only
          const inAppNotif: InAppNotification = {
            id: notifId,
            alertId: alert.id,
            alertName: alert.name,
            walletAddress: alert.walletAddress,
            transaction: tx,
            timestamp: Date.now(),
          };

          setInAppNotifications((prev) => {
            const MAX_NOTIFICATIONS = 200; // Prevent unbounded growth
            const updated = [inAppNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
            setHasMoreNotifications(updated.length > notificationsLimit);
            return updated.slice(0, notificationsLimit);
          });
        }
      });
    });
  }, [
    statuses,
    alerts,
    inAppNotifications,
    triggeredEvents,
    onTriggeredEventsChange,
    playAlertSound,
    onUpdateStatuses,
    extractPrimaryToken,
    notificationsLimit,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.walletAddress) return;

    console.log("[ALERT CREATE] 🚀 Starting alert creation");
    console.log("[ALERT CREATE] Form data:", formData);

    setIsSubmitting(true);
    try {
      if (editingAlertId) {
        console.log("[ALERT CREATE] 📝 Editing existing alert:", editingAlertId);
        // Update existing alert
        await onUpdateAlert?.(editingAlertId, {
          name: formData.name,
          walletAddress: formData.walletAddress,
          tokenAddress: formData.tokenAddress || undefined,
          alertType: formData.alertType,
        });
        console.log("[ALERT CREATE] ✅ Alert updated successfully");
      } else {
        console.log("[ALERT CREATE] ➕ Creating new alert");
        // Create new alert
        await onAddAlert?.({
          name: formData.name,
          walletAddress: formData.walletAddress,
          tokenAddress: formData.tokenAddress || undefined,
          alertType: formData.alertType,
        });
        console.log("[ALERT CREATE] ✅ Alert created successfully, calling closeModal");
      }
      closeModal();
    } catch (error) {
      console.error("[ALERT CREATE] ❌ Error during alert creation:", error);
      // Show user-friendly error message
      alert(
        `Failed to ${editingAlertId ? "update" : "create"} alert: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      console.log("[ALERT CREATE] 🔄 Resetting isSubmitting state");
      setIsSubmitting(false);
    }
  };

  const openEditModal = (alert: AlertConfig) => {
    const prefillData = {
      editingAlertId: alert.id,
      name: alert.name,
      walletAddress: alert.walletAddress,
      tokenAddress: alert.tokenAddress || "",
      alertType: alert.type || "WALLET",
    };

    // If external modal control is being used, notify parent to open modal
    if (externalIsModalOpen !== undefined && onAlertModalOpen) {
      onAlertModalOpen(prefillData);
    } else {
      // Otherwise, use internal state management
      setEditingAlertId(alert.id);
      setFormData(prefillData);
      setInternalIsModalOpen(true);
    }
  };

  const closeModal = () => {
    // Use external close handler if provided, otherwise use internal state
    if (onAlertModalClose) {
      onAlertModalClose();
    } else {
      setInternalIsModalOpen(false);
    }
    setEditingAlertId(null);
    setFormData({
      name: "",
      walletAddress: "",
      tokenAddress: "",
      alertType: "WALLET",
    });
  };

  const handleDismissTrigger = (alertId: string) => {
    const existingStatus = statuses[alertId];
    if (!existingStatus) return;

    onUpdateStatuses?.({
      ...statuses,
      [alertId]: {
        ...existingStatus,
        triggered: false,
        newTransactions: undefined, // FIX: Clear pending transactions to prevent re-notification
        checkedAt: Date.now(),
        dismissedAt: Date.now(), // FIX: Track dismissal time to prevent re-triggering on old transactions
      },
    });
  };

  // Export data
  const handleExport = async () => {
    try {
      const blob = await exportDatabaseAsCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dogechain-bubblemaps-backup-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data. Please try again.");
    }
  };

  // Toggle event expansion
  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const toggleNotificationChart = (notificationId: string) => {
    setExpandedNotificationCharts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  // Migration: Update triggered events with actual transaction token data
  useEffect(() => {
    const updateEventTokens = () => {
      const updatedEvents = triggeredEvents.map((event: TriggeredEvent) => {
        // Skip if no transactions
        if (!event.transactions || event.transactions.length === 0) {
          return event;
        }

        // Find the alert config for this event (if available)
        const alert = alerts.find((a: AlertConfig) => a.id === event.alertId);

        // Use extractPrimaryToken to get the correct token from transactions
        const primaryToken = extractPrimaryToken(event.transactions, alert);

        // Only update if we found a token and it's different from current
        if (!primaryToken) {
          return event;
        }

        // Check if token address is different from current
        const currentTokenAddress = event.tokenAddress?.toLowerCase();
        const newTokenAddress = primaryToken.address?.toLowerCase();

        if (currentTokenAddress === newTokenAddress) {
          return event; // Already correct, no update needed
        }

        // Update with correct token data from transactions
        return {
          ...event,
          tokenAddress: primaryToken.address,
          tokenSymbol: primaryToken.symbol,
        };
      });

      // Only trigger update if something changed
      const hasChanges = updatedEvents.some((updatedEvent, index) => {
        const originalEvent = triggeredEvents[index];
        if (!originalEvent) return false;
        return (
          updatedEvent.tokenAddress !== originalEvent.tokenAddress ||
          updatedEvent.tokenSymbol !== originalEvent.tokenSymbol
        );
      });

      if (hasChanges) {
        onTriggeredEventsChange?.(updatedEvents);
      }
    };

    // Run when triggeredEvents or alerts change
    updateEventTokens();
  }, [triggeredEvents, alerts, extractPrimaryToken, onTriggeredEventsChange]);

  // Handle pre-fill data when opening modal from WalletSidebar or edit button
  useEffect(() => {
    if (alertModalPrefill && isModalOpen) {
      setFormData({
        name: alertModalPrefill.name || "",
        walletAddress: alertModalPrefill.walletAddress || "",
        tokenAddress: alertModalPrefill.tokenAddress || "",
        alertType: alertModalPrefill.alertType || "WALLET",
      });
      // Set editingAlertId if provided (for editing existing alerts)
      setEditingAlertId(alertModalPrefill.editingAlertId || null);
    }
  }, [alertModalPrefill, isModalOpen]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-white">My Dashboard</h1>
          <Tooltip content="View dashboard guide">
            <button
              onClick={dashboardGuide.openGuide}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-space-700"
              aria-label="View dashboard guide"
            >
              <HelpCircle size={20} />
            </button>
          </Tooltip>
        </div>
        <div className="flex gap-3 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => runScan(true)}
            disabled={isScanning || alerts.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-space-800 border border-space-700 text-slate-300 rounded-lg hover:bg-space-700 hover:text-white hover:border-space-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? "Scanning..." : "Scan Now"}
          </button>
          <button
            onClick={() => {
              // Clear any pre-fill data for new alert
              setEditingAlertId(null);
              setFormData({
                name: "",
                walletAddress: "",
                tokenAddress: "",
                alertType: "WALLET",
              });
              // Use external modal control if available
              if (externalIsModalOpen !== undefined && onAlertModalOpen) {
                onAlertModalOpen({
                  editingAlertId: "",
                  name: "",
                  walletAddress: "",
                  tokenAddress: "",
                  alertType: "WALLET",
                });
              } else {
                setInternalIsModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-doge-600 text-white rounded-lg hover:bg-doge-500 transition-colors shadow-lg shadow-doge-600/20"
          >
            <Plus size={18} /> New Alert
          </button>
          <Tooltip content={soundEnabled ? "Mute notifications" : "Enable notification sound"}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-space-800 text-slate-300 rounded-lg hover:bg-space-700 hover:text-white transition-colors"
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </Tooltip>
          <Tooltip content="Export all data as CSV file">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-space-800 text-slate-300 rounded-lg hover:bg-space-700 hover:text-white transition-colors"
            >
              <Download size={18} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Notifications Button */}
      <button
        onClick={() => {
          const notificationsSection = document.querySelector(
            '[role="status"][aria-live="polite"]'
          );
          notificationsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className="flex items-center gap-3 px-5 py-3 bg-space-800 hover:bg-space-700 rounded-xl transition-all border border-space-700 hover:border-purple-500/50 mb-6 w-full sm:w-auto shadow-lg hover:shadow-purple-500/10 group"
        aria-label={`View ${inAppNotifications.length} notification${inAppNotifications.length === 1 ? "" : "s"}`}
      >
        <div className="relative">
          <Bell
            size={20}
            className="text-purple-400 group-hover:text-purple-300 transition-colors"
          />
          {inAppNotifications.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {inAppNotifications.length > 99 ? "99+" : inAppNotifications.length}
            </span>
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-white font-medium">
            {inAppNotifications.length === 0
              ? "No new notifications"
              : `${inAppNotifications.length} notification${inAppNotifications.length === 1 ? "" : "s"}`}
          </div>
          {inAppNotifications.length > 0 && (
            <div className="text-xs text-slate-400">Click to view</div>
          )}
        </div>
      </button>

      {/* In-App Notifications */}
      {inAppNotifications.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mb-6 space-y-3"
          aria-label={`New notifications: ${inAppNotifications.length} alert${inAppNotifications.length === 1 ? "" : "s"}`}
        >
          {inAppNotifications.map((notif) => {
            const isIncoming =
              notif.transaction &&
              notif.transaction.to.toLowerCase() === notif.walletAddress.toLowerCase();
            const txColor = isIncoming
              ? "from-green-900/30 to-green-800/30 border-green-500/50"
              : "from-red-900/30 to-orange-900/30 border-red-500/50";
            const txIcon = isIncoming ? (
              <ArrowDownLeft size={20} className="text-green-400" />
            ) : (
              <ArrowUpRight size={20} className="text-red-400" />
            );

            return (
              <div
                key={notif.id}
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className={`bg-gradient-to-r ${txColor} rounded-xl p-4 animate-in slide-in-from-top-2 shadow-lg`}
                aria-label={`${notif.alertName}: ${isIncoming ? "Received" : "Sent"} ${notif.transaction?.value.toLocaleString()} ${notif.transaction?.tokenSymbol || "tokens"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`p-2 rounded-lg ${isIncoming ? "bg-green-500/20" : "bg-red-500/20"}`}
                    >
                      {txIcon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-white">{notif.alertName}</h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${isIncoming ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                        >
                          {isIncoming ? "RECEIVED" : "SENT"}
                        </span>
                      </div>
                      {notif.transaction && (
                        <>
                          <p className="text-lg font-bold text-white mb-1">
                            {notif.transaction.value.toLocaleString()}{" "}
                            {notif.transaction.tokenSymbol || "tokens"}
                          </p>
                          <div className="space-y-1 text-sm">
                            {/* From Address with Tooltip and Link */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">From:</span>
                              <div className="flex items-center gap-1">
                                <Tooltip content={notif.transaction.from}>
                                  <a
                                    href={`https://explorer.dogechain.dog/address/${notif.transaction.from}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 transition-colors font-mono text-xs"
                                  >
                                    {notif.transaction.from.slice(0, 8)}...
                                    {notif.transaction.from.slice(-6)}
                                  </a>
                                </Tooltip>
                                <Tooltip content="View sender on Dogechain Explorer">
                                  <a
                                    href={`https://explorer.dogechain.dog/address/${notif.transaction.from}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-black/20"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </Tooltip>
                              </div>
                            </div>

                            {/* To Address with Tooltip and Link */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">To:</span>
                              <div className="flex items-center gap-1">
                                <Tooltip content={notif.transaction.to}>
                                  <a
                                    href={`https://explorer.dogechain.dog/address/${notif.transaction.to}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 transition-colors font-mono text-xs"
                                  >
                                    {notif.transaction.to.slice(0, 8)}...
                                    {notif.transaction.to.slice(-6)}
                                  </a>
                                </Tooltip>
                                <Tooltip content="View receiver on Dogechain Explorer">
                                  <a
                                    href={`https://explorer.dogechain.dog/address/${notif.transaction.to}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-black/20"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </Tooltip>
                              </div>
                            </div>

                            {/* Transaction Hash with Link */}
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-slate-400">Tx:</span>
                              <div className="flex items-center gap-1">
                                <Tooltip content={notif.transaction.hash}>
                                  <a
                                    href={`https://explorer.dogechain.dog/tx/${notif.transaction.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 transition-colors font-mono text-xs truncate max-w-[200px]"
                                  >
                                    {notif.transaction.hash.slice(0, 10)}...
                                    {notif.transaction.hash.slice(-8)}
                                  </a>
                                </Tooltip>
                                <Tooltip content="View transaction on Dogechain Explorer">
                                  <a
                                    href={`https://explorer.dogechain.dog/tx/${notif.transaction.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-black/20"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </Tooltip>
                              </div>
                            </div>

                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(notif.transaction.timestamp).toLocaleString()}
                            </p>
                          </div>

                          {/* Dexscreener Chart Section - Only show if valid token address */}
                          {notif.transaction.tokenAddress &&
                            /^0x[a-fA-F0-9]{40}$/.test(notif.transaction.tokenAddress) && (
                              <div className="mt-3 pt-3 border-t border-black/20">
                                <button
                                  onClick={() => toggleNotificationChart(notif.id)}
                                  className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded hover:bg-purple-500/10 w-fit"
                                  aria-expanded={expandedNotificationCharts.has(notif.id)}
                                  aria-label={`Toggle ${notif.transaction.tokenSymbol || "token"} chart`}
                                >
                                  <LineChart size={14} />
                                  {expandedNotificationCharts.has(notif.id)
                                    ? `Hide ${notif.transaction.tokenSymbol || "Token"} Chart`
                                    : `View ${notif.transaction.tokenSymbol || "Token"} Chart`}
                                </button>

                                {/* Inline Chart Container */}
                                {expandedNotificationCharts.has(notif.id) && (
                                  <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                                    <EmbeddedChart
                                      tokenAddress={notif.transaction.tokenAddress}
                                      tokenSymbol={notif.transaction.tokenSymbol || "Token"}
                                      className="w-full"
                                      theme="dark"
                                      expanded={true}
                                      showToggle={false}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setInAppNotifications((prev) => prev.filter((n) => n.id !== notif.id))
                    }
                    className="flex-none p-1 hover:bg-black/20 rounded-lg transition-colors text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Load More button */}
          {hasMoreNotifications && (
            <button
              onClick={() => setNotificationsLimit((prev) => Math.min(prev + 20, 200))}
              className="w-full py-2 text-sm text-doge-500 hover:text-doge-400 transition-colors border border-doge-500/30 rounded-lg hover:bg-doge-500/10 mt-3"
            >
              Load More Notifications
            </button>
          )}

          {/* Notification count */}
          <div className="text-xs text-slate-500 text-center mt-2">
            Showing {Math.min(notificationsLimit, inAppNotifications.length)} of{" "}
            {inAppNotifications.length} notifications
          </div>

          {/* Clear All button */}
          {inAppNotifications.length > 0 && (
            <button
              onClick={() => {
                setInAppNotifications([]);
                clearNotificationsFromStorage(statuses, onUpdateStatuses);
              }}
              className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors mt-2"
            >
              Clear All Notifications
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-space-800 rounded-xl border border-space-700">
          <p className="text-slate-400 text-sm">Tracked Wallets</p>
          <p className="text-3xl font-bold text-white mt-2">{trackedWalletsCount}</p>
        </div>
        <div className="p-6 bg-space-800 rounded-xl border border-space-700">
          <p className="text-slate-400 text-sm">Active Alerts</p>
          <p className="text-3xl font-bold text-white mt-2">{alerts.length}</p>
        </div>
        <div className="p-6 bg-space-800 rounded-xl border border-space-700 relative overflow-hidden">
          {activeTriggers > 0 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/20 rounded-bl-full -mr-8 -mt-8"></div>
          )}
          <p className="text-slate-400 text-sm">Triggered Events</p>
          <div className="flex items-center gap-2 mt-2">
            <p
              className={`text-3xl font-bold ${activeTriggers > 0 ? "text-red-500" : "text-green-500"}`}
            >
              {activeTriggers}
            </p>
            {activeTriggers > 0 && <AlertTriangle size={24} className="text-red-500" />}
          </div>
        </div>
      </div>

      {/* Triggered Events History */}
      {triggeredEvents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock size={20} /> Event History
            </h2>
            <button
              onClick={() => {
                if (confirm("Clear all event history?")) {
                  // Clear transaction cache first to prevent re-triggering
                  clearTransactionCache();
                  // Clear the triggered events
                  onTriggeredEventsChange?.([]);
                  // Also clear notification tracking to prevent re-creating events for old transactions
                  localStorage.removeItem("doge_notified_transactions");

                  // Also reset alert dismissedAt state to prevent re-triggering on old transactions
                  const resetStatuses: Record<string, AlertStatus> = {};
                  Object.keys(statuses).forEach((alertId) => {
                    const status = statuses[alertId];
                    if (status) {
                      resetStatuses[alertId] = {
                        ...status,
                        dismissedAt: Date.now(), // Set dismissedAt to now to prevent old transactions from re-triggering
                        checkedAt: Date.now(), // Move check point forward
                        triggered: false, // Reset triggered state
                      };
                    }
                  });
                  onUpdateStatuses?.(resetStatuses);
                }
              }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          </div>
          <div className="space-y-3">
            {triggeredEvents.slice(0, 10).map((event) => {
              const isExpanded = expandedEvents.has(event.id);
              const displayedTransactions = isExpanded
                ? event.transactions
                : event.transactions.slice(0, 3);

              return (
                <div key={event.id} className="bg-space-800 rounded-xl border border-space-700 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">{event.alertName}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(event.triggeredAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                      {event.transactions.length}{" "}
                      {event.transactions.length === 1 ? "Transaction" : "Transactions"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {displayedTransactions.map((tx, idx) => {
                      const isIncoming = tx.to.toLowerCase() === event.walletAddress.toLowerCase();
                      const txChartId = `tx-chart-${event.id}-${tx.hash}`;
                      const hasValidToken =
                        tx.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(tx.tokenAddress);
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-lg ${isIncoming ? "bg-green-500/10" : "bg-red-500/10"}`}
                        >
                          <div className="flex-none pt-1">
                            {isIncoming ? (
                              <ArrowDownLeft size={16} className="text-green-400" />
                            ) : (
                              <ArrowUpRight size={16} className="text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <Tooltip content="View transaction on Dogechain Explorer">
                                <a
                                  href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-white hover:text-purple-400 transition-colors truncate"
                                >
                                  {tx.value.toLocaleString()} {tx.tokenSymbol || "tokens"}
                                </a>
                              </Tooltip>
                              {hasValidToken && (
                                <button
                                  onClick={() => toggleNotificationChart(txChartId)}
                                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded hover:bg-purple-500/10"
                                  aria-expanded={expandedNotificationCharts.has(txChartId)}
                                  aria-label={`Toggle ${tx.tokenSymbol || "token"} chart`}
                                >
                                  <LineChart size={12} />
                                  {expandedNotificationCharts.has(txChartId) ? "Hide" : "Chart"}
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {isIncoming ? "From" : "To"}:{" "}
                              <Tooltip
                                content={`View ${isIncoming ? "sender" : "receiver"} on Dogechain Explorer`}
                              >
                                <a
                                  href={`https://explorer.dogechain.dog/address/${isIncoming ? tx.from : tx.to}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  {isIncoming ? tx.from.slice(0, 10) : tx.to.slice(0, 10)}...
                                </a>
                              </Tooltip>
                            </p>
                            {/* Inline Chart for this transaction */}
                            {expandedNotificationCharts.has(txChartId) && hasValidToken && (
                              <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <EmbeddedChart
                                  tokenAddress={tx.tokenAddress!}
                                  tokenSymbol={tx.tokenSymbol || "Token"}
                                  className="w-full"
                                  theme="dark"
                                  expanded={true}
                                  showToggle={false}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {event.transactions.length > 3 && (
                      <button
                        onClick={() => toggleEventExpansion(event.id)}
                        className="w-full text-xs text-doge-500 hover:text-doge-400 font-medium text-center py-2 px-3 rounded-lg hover:bg-doge-500/10 transition-all cursor-pointer flex items-center justify-center gap-1 group"
                        title={isExpanded ? "Show fewer transactions" : "Show all transactions"}
                      >
                        {isExpanded ? (
                          <>
                            <span>Show less</span>
                            <ArrowUpRight
                              size={14}
                              className="group-hover:-translate-y-0.5 transition-transform"
                            />
                          </>
                        ) : (
                          <>
                            <span>+{event.transactions.length - 3} more transactions</span>
                            <ArrowDownLeft
                              size={14}
                              className="group-hover:translate-y-0.5 transition-transform"
                            />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell size={20} /> Alert Configurations
        </h2>
        {lastScanTime && (
          <span className="text-xs text-slate-500">
            Last scanned: {new Date(lastScanTime).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Screen reader announcement for triggered alerts */}
      {activeTriggers > 0 && (
        <div role="status" aria-live="polite" className="sr-only">
          {activeTriggers} alert{activeTriggers === 1 ? "" : "s"} currently triggered
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="bg-space-800 rounded-xl border border-space-700 p-12 text-center">
          <ShieldCheck size={48} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Alerts Configured</h3>
          <p className="text-slate-400 mb-6">
            Create your first alert to start monitoring wallet activity.
          </p>
          <button
            onClick={() => {
              // Use external modal control if available, otherwise use internal state
              if (onAlertModalOpen) {
                onAlertModalOpen({
                  editingAlertId: "",
                  name: "",
                  walletAddress: "",
                  tokenAddress: "",
                  alertType: "WALLET",
                });
              } else if (externalIsModalOpen === undefined) {
                setInternalIsModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-doge-600 text-white rounded-lg hover:bg-doge-500 transition-colors shadow-lg shadow-doge-600/20"
          >
            <Plus size={18} /> Create Alert
          </button>
        </div>
      ) : (
        <div className="bg-space-800 rounded-xl border border-space-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-space-900 border-b border-space-700">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Alert Name
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-space-700">
                {alerts.map((alert) => {
                  const status = statuses[alert.id];
                  return (
                    <tr key={alert.id} className="hover:bg-space-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">{alert.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Tooltip content="View wallet on Dogechain Explorer">
                          <a
                            href={`https://explorer.dogechain.dog/address/${alert.walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-mono text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1"
                          >
                            {alert.walletAddress.slice(0, 8)}...{alert.walletAddress.slice(-6)}
                          </a>
                        </Tooltip>
                        {alert.tokenAddress && (
                          <div className="text-xs text-slate-400 mt-1">
                            Token:{" "}
                            <Tooltip content="View token on Dogechain Explorer">
                              <a
                                href={`https://explorer.dogechain.dog/address/${alert.tokenAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                {alert.tokenSymbol ||
                                  alert.tokenName ||
                                  alert.tokenAddress.slice(0, 8)}
                              </a>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {status ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 text-xs font-bold rounded-full ${
                                status.triggered
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-green-500/20 text-green-400"
                              }`}
                            >
                              {status.triggered ? "Triggered" : "Normal"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {triggeredEvents.filter((e) => e.alertId === alert.id).length}{" "}
                              {triggeredEvents.filter((e) => e.alertId === alert.id).length === 1
                                ? "event"
                                : "events"}
                            </span>
                            {status.triggered && (
                              <Tooltip content="Reset triggered status to normal">
                                <button
                                  onClick={() => handleDismissTrigger(alert.id)}
                                  className="text-xs text-slate-400 hover:text-green-400 transition-colors underline"
                                >
                                  Dismiss
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-bold rounded-full bg-slate-500/20 text-slate-400">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Tooltip content="Edit alert configuration">
                          <button
                            onClick={() => openEditModal(alert)}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors mr-1"
                          >
                            <Edit size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Remove this alert">
                          <button
                            onClick={() => onRemoveAlert?.(alert.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Alert Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="alert-modal-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
        >
          <div className="bg-space-800 rounded-xl border border-space-700 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-space-700 flex justify-between items-center">
              <h3 id="alert-modal-title" className="text-xl font-bold text-white">
                {editingAlertId ? "Edit Alert" : "Create New Alert"}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="alert-name"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Alert Name
                </label>
                <input
                  id="alert-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-space-900 border border-space-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-space-600"
                  placeholder={
                    formData.tokenAddress ? "e.g., wDOGE Wallet Alert" : "e.g., My Wallet Monitor"
                  }
                  aria-describedby="alert-name-description"
                  required
                />
                <p id="alert-name-description" className="text-xs text-slate-500 mt-1">
                  Tip: Include token symbol for clarity, e.g., &quot;wDOGE Alert&quot;
                </p>
              </div>

              <div>
                <label
                  htmlFor="alert-type"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Alert Type
                </label>
                <CustomSelect
                  value={formData.alertType}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      alertType: value as "WALLET" | "TOKEN" | "WHALE",
                    })
                  }
                  options={alertTypeOptions}
                  ariaDescribedBy="alert-type-description"
                />
                <p id="alert-type-description" className="text-xs text-slate-500 mt-1">
                  {formData.alertType === "WALLET" && "Get notified of any activity in this wallet"}
                  {formData.alertType === "TOKEN" &&
                    "Get notified when this wallet transfers the specific token"}
                  {formData.alertType === "WHALE" && "Monitor large holder movements"}
                </p>
              </div>

              <div>
                <label
                  htmlFor="wallet-address"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Wallet Address
                </label>
                <input
                  id="wallet-address"
                  type="text"
                  value={formData.walletAddress}
                  onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                  className="w-full px-4 py-2 bg-space-900 border border-space-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-space-600"
                  placeholder="0x..."
                  required
                />
              </div>

              {(formData.alertType === "TOKEN" || formData.alertType === "WHALE") && (
                <div>
                  <label
                    htmlFor="token-address"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Token Address{" "}
                    {formData.alertType === "TOKEN" && "(required for token-specific alerts)"}
                  </label>
                  <input
                    id="token-address"
                    type="text"
                    value={formData.tokenAddress}
                    onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
                    className="w-full px-4 py-2 bg-space-900 border border-space-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-space-600"
                    placeholder="0x..."
                    required={formData.alertType === "TOKEN"}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.alertType === "TOKEN" && "Enter the token contract address to track"}
                    {formData.alertType === "WHALE" &&
                      "Optional: Specify token for whale monitoring (leave blank for all tokens)"}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-space-700 text-slate-300 rounded-lg hover:bg-space-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-doge-600 text-white rounded-lg hover:bg-doge-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isSubmitting
                    ? editingAlertId
                      ? "Updating..."
                      : "Creating..."
                    : editingAlertId
                      ? "Update Alert"
                      : "Create Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
