/**
 * Real-Time Data Refresh Hook
 *
 * Features:
 * - Auto-refresh with configurable intervals
 * - Manual refresh button
 * - Connection status indicator
 * - Pause on hover option
 * - Last updated timestamp
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAutoRefreshOptions {
  enabled: boolean;
  interval: number; // milliseconds
  refreshFn: () => Promise<void>;
}

export interface AutoRefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  error: Error | null;
  isEnabled: boolean;
  interval: number;
}

export interface AutoRefreshActions {
  triggerRefresh: () => Promise<void>;
  toggleEnabled: () => void;
  setInterval: (interval: number) => void;
  clearAutoRefresh: () => void;
}

export function useAutoRefresh(
  options: UseAutoRefreshOptions
): [AutoRefreshState, AutoRefreshActions] {
  const {
    enabled: initialEnabled = true,
    interval: initialInterval = 30000, // 30 seconds default
    refreshFn,
  } = options;

  const [state, setState] = useState<AutoRefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    error: null,
    isEnabled: initialEnabled,
    interval: initialInterval,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  // Clear any existing interval
  const clearAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Trigger manual refresh
  const triggerRefresh = useCallback(async () => {
    if (state.isRefreshing) return;

    setState((prev) => ({ ...prev, isRefreshing: true, error: null }));

    try {
      await refreshFn();
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        lastRefresh: new Date(),
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error as Error,
      }));
      console.error("[useAutoRefresh] Refresh failed:", error);
    }
  }, [refreshFn, state.isRefreshing]);

  // Toggle auto-refresh on/off
  const toggleEnabled = useCallback(() => {
    setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

  // Set new interval
  const setIntervalValue = useCallback((newInterval: number) => {
    setState((prev) => ({ ...prev, interval: newInterval }));
  }, []);

  // Setup auto-refresh interval
  useEffect(() => {
    if (!state.isEnabled || isPausedRef.current) {
      clearAutoRefresh();
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        triggerRefresh();
      }
    }, state.interval);

    return () => clearAutoRefresh();
  }, [state.isEnabled, state.interval, triggerRefresh, clearAutoRefresh]);

  // Initial refresh on mount
  useEffect(() => {
    if (state.isEnabled) {
      triggerRefresh();
    }
  }, []);

  return [
    state,
    {
      triggerRefresh,
      toggleEnabled,
      setInterval: setIntervalValue,
      clearAutoRefresh,
    },
  ];
}
