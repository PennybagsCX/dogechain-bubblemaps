import React, { useState, useEffect, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertConfig, AlertStatus, Transaction, TriggeredEvent } from "../types";
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
} from "../services/dataService";
import { exportDatabaseAsCSV } from "../services/db";
import { validateTokenAddress, validateWalletAddress } from "../utils/validation";

interface InAppNotification {
  id: string;
  alertId: string;
  alertName: string;
  walletAddress: string;
  transaction?: Transaction;
  timestamp: number;
}

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
    walletAddress?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    alertType?: "WALLET" | "TOKEN" | "WHALE";
  } | null;
  onAlertModalClose?: () => void;
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedChartEvents, setExpandedChartEvents] = useState<Set<string>>(new Set());

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
      ? Math.max(...Object.values(statuses).map((s: AlertStatus) => s.checkedAt))
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

  const runScan = useCallback(async () => {
    if (alerts.length === 0) return;

    setIsScanning(true);
    const newStatuses: Record<string, AlertStatus> = {};

    // Parallel processing for speed
    await Promise.all(
      alerts.map(async (alert) => {
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
            alert.type === "WALLET" ? undefined : alert.tokenAddress // WALLET gets all tokens
          );

          // Get previously seen transactions or initialize baseline
          const previousTxs =
            existingStatus?.lastSeenTransactions || transactions.map((tx) => tx.hash);
          const previousTxSet = new Set(previousTxs);

          // Find new transactions (transactions we haven't seen before)
          const newTransactions = transactions.filter((tx) => !previousTxSet.has(tx.hash));

          // Apply type-specific filtering for new transactions
          let filteredNewTransactions = newTransactions;

          if (alert.type === "WHALE" && newTransactions.length > 0) {
            // WHALE type: Only trigger on large transactions
            // Define "large" as > 10,000 tokens or > 1% of current balance (whichever is larger)
            const whaleThreshold = Math.max(10000, currentBalance * 0.01);
            filteredNewTransactions = newTransactions.filter((tx) => tx.value > whaleThreshold);
          }

          // Create new set of all seen transactions
          const allSeenTxs = [...new Set([...previousTxs, ...transactions.map((tx) => tx.hash)])];

          // Trigger alert if we found new transactions (only after initial baseline)
          const hasNewActivity = existingStatus ? filteredNewTransactions.length > 0 : false;

          // Keep triggered state persistent - once triggered, stay triggered until manually reset
          const wasTriggered = existingStatus?.triggered || false;
          const shouldTrigger = hasNewActivity || wasTriggered;

          newStatuses[alert.id] = {
            currentValue: currentBalance,
            triggered: shouldTrigger,
            checkedAt: Date.now(),
            lastSeenTransactions: allSeenTxs,
            newTransactions: hasNewActivity ? filteredNewTransactions : undefined,
          };
        } catch {
          newStatuses[alert.id] = {
            currentValue: 0,
            triggered: false,
            checkedAt: Date.now(),
          };
        }
      })
    );

    onUpdateStatuses?.({ ...statuses, ...newStatuses });
    setIsScanning(false);
  }, [alerts, statuses, onUpdateStatuses]);

  // Auto-scan logic: Run if we have alerts that are missing statuses (pending)
  useEffect(() => {
    if (alerts.length > 0) {
      const hasPending = alerts.some((a) => !statuses[a.id]);
      if (hasPending && !isScanning) {
        runScan();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length, Object.keys(statuses).length, isScanning, runScan]);

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

    // Set up interval for periodic scanning (every 30 seconds)
    const intervalId = setInterval(() => {
      if (!isScanning && alerts.length > 0) {
        runScan();
      }
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length]); // Re-setup when alerts length changes

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
        fetch("/api/alerts/trigger", {
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
        }).catch((_err) => {
          // Error handled silently
        });
      }

      status.newTransactions.forEach((tx) => {
        const notifId = `notif-${alert.id}-${tx.hash}`;

        // Check if we already created a notification for this transaction
        const alreadyNotified = inAppNotifications.some((n) => n.id === notifId);
        if (alreadyNotified) return;

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

          setInAppNotifications((prev) => [inAppNotif, ...prev].slice(0, 10));
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

          setInAppNotifications((prev) => [inAppNotif, ...prev].slice(0, 10));
        }
      });

      // Mark transactions as notified by clearing newTransactions array
      onUpdateStatuses?.({
        ...statuses,
        [alert.id]: { ...status, newTransactions: undefined },
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
    setEditingAlertId(alert.id);
    setFormData({
      name: alert.name,
      walletAddress: alert.walletAddress,
      tokenAddress: alert.tokenAddress || "",
      alertType: alert.type || "WALLET",
    });
    // Only set internal state if external state is not being used
    if (externalIsModalOpen === undefined) {
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
        checkedAt: Date.now(),
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

  const toggleEventChart = (eventId: string) => {
    setExpandedChartEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
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

  // Handle pre-fill data when opening modal from WalletSidebar
  useEffect(() => {
    if (alertModalPrefill && isModalOpen) {
      setFormData({
        name: "",
        walletAddress: alertModalPrefill.walletAddress || "",
        tokenAddress: alertModalPrefill.tokenAddress || "",
        alertType: alertModalPrefill.alertType || "WALLET",
      });
      setEditingAlertId(null);
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
            onClick={runScan}
            disabled={isScanning || alerts.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-space-800 border border-space-700 text-slate-300 rounded-lg hover:bg-space-700 hover:text-white hover:border-space-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? "Scanning..." : "Scan Now"}
          </button>
          <button
            onClick={() => {
              if (externalIsModalOpen === undefined) {
                setInternalIsModalOpen(true);
              }
              // Clear any pre-fill data when opening from Dashboard button
              setEditingAlertId(null);
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
                  onTriggeredEventsChange?.([]);
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
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-2 rounded-lg ${isIncoming ? "bg-green-500/10" : "bg-red-500/10"}`}
                        >
                          <div className="flex-none">
                            {isIncoming ? (
                              <ArrowDownLeft size={16} className="text-green-400" />
                            ) : (
                              <ArrowUpRight size={16} className="text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Tooltip content="View transaction on Dogechain Explorer">
                              <a
                                href={`https://explorer.dogechain.dog/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-white hover:text-purple-400 transition-colors truncate block"
                              >
                                {tx.value.toLocaleString()} {tx.tokenSymbol || "tokens"}
                              </a>
                            </Tooltip>
                            <p className="text-xs text-slate-500">
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

                  {/* Prominent Chart Toggle Button - Below transactions */}
                  <button
                    onClick={() => toggleEventChart(event.id)}
                    disabled={!event.tokenAddress}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-medium shadow-lg mt-4 ${
                      event.tokenAddress
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-space-700 text-slate-500 cursor-not-allowed"
                    }`}
                    title={
                      !event.tokenAddress
                        ? "Price chart not available for this event"
                        : "View price chart"
                    }
                  >
                    <LineChart size={18} />
                    {event.tokenAddress
                      ? expandedChartEvents.has(event.id)
                        ? "Hide Price Chart"
                        : "View Price Chart"
                      : "Price Chart Unavailable"}
                  </button>

                  {/* Inline Chart Container - Expands on button click */}
                  {expandedChartEvents.has(event.id) && event.tokenAddress && (
                    <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                      <EmbeddedChart
                        tokenAddress={event.tokenAddress}
                        tokenSymbol={event.tokenSymbol || "Token"}
                        className="w-full"
                        theme="dark"
                        expanded={true}
                        showToggle={false}
                      />
                    </div>
                  )}
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
              if (externalIsModalOpen === undefined) {
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
