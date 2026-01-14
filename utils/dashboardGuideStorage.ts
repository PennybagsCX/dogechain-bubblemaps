/**
 * Dashboard Guide localStorage utility for managing Dashboard page guide state
 */

// Version for Dashboard guide
const DASHBOARD_GUIDE_VERSION = "1.0.0";

/**
 * Storage keys for Dashboard guide
 */
const DASHBOARD_GUIDE_STORAGE_KEYS = {
  SEEN: "dogechain_dashboard_guide_seen",
  VERSION: "dogechain_dashboard_guide_version",
  DISMISSED: "dogechain_dashboard_guide_dismissed_count",
  LAST_STEP: "dogechain_dashboard_guide_last_step",
} as const;

/**
 * Interface for guide state stored in localStorage
 */
export interface DashboardGuideState {
  hasSeen: boolean;
  version: string;
  lastStep?: number;
  dismissedCount: number;
}

/**
 * Safely get data from localStorage
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Safely set data in localStorage
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Safely remove data from localStorage
 */
function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    // Error handled silently

    return false;
  }
}

/**
 * Get the Dashboard guide state from localStorage
 */
export function getDashboardGuideState(): DashboardGuideState | null {
  try {
    const hasSeen = safeGetItem(DASHBOARD_GUIDE_STORAGE_KEYS.SEEN);
    const version = safeGetItem(DASHBOARD_GUIDE_STORAGE_KEYS.VERSION);
    const lastStep = safeGetItem(DASHBOARD_GUIDE_STORAGE_KEYS.LAST_STEP);
    const dismissedCount = safeGetItem(DASHBOARD_GUIDE_STORAGE_KEYS.DISMISSED);

    if (!hasSeen && !version) {
      return null;
    }

    return {
      hasSeen: hasSeen === "true",
      version: version || DASHBOARD_GUIDE_VERSION,
      lastStep: lastStep ? parseInt(lastStep, 10) : undefined,
      dismissedCount: dismissedCount ? parseInt(dismissedCount, 10) : 0,
    };
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Check if Dashboard guide should be shown
 */
export function shouldShowDashboardGuide(): boolean {
  const state = getDashboardGuideState();

  // First-time interaction
  if (!state) {
    return true;
  }

  // Version mismatch - re-show guide
  if (state.version !== DASHBOARD_GUIDE_VERSION) {
    return true;
  }

  // User has already completed guide
  if (state.hasSeen) {
    return false;
  }

  // User has dismissed 3+ times, don't auto-show
  if (state.dismissedCount >= 3) {
    return false;
  }

  // Show guide
  return true;
}

/**
 * Mark Dashboard guide as seen/completed
 */
export function setDashboardGuideSeen(): boolean {
  const success = safeSetItem(DASHBOARD_GUIDE_STORAGE_KEYS.SEEN, "true");
  if (success) {
    safeSetItem(DASHBOARD_GUIDE_STORAGE_KEYS.VERSION, DASHBOARD_GUIDE_VERSION);
  }
  return success;
}

/**
 * Mark Dashboard guide as skipped (dismissed)
 */
export function setDashboardGuideSkipped(): boolean {
  const state = getDashboardGuideState();
  const currentCount = state?.dismissedCount || 0;

  const success = safeSetItem(
    DASHBOARD_GUIDE_STORAGE_KEYS.DISMISSED,
    (currentCount + 1).toString()
  );

  if (success) {
    // Dismissal count updated successfully
  }

  return success;
}

/**
 * Update Dashboard guide current step progress
 */
export function updateDashboardGuideProgress(step: number): boolean {
  return safeSetItem(DASHBOARD_GUIDE_STORAGE_KEYS.LAST_STEP, step.toString());
}

/**
 * Reset Dashboard guide state (for testing/development)
 */
export function resetDashboardGuide(): void {
  safeRemoveItem(DASHBOARD_GUIDE_STORAGE_KEYS.SEEN);
  safeRemoveItem(DASHBOARD_GUIDE_STORAGE_KEYS.VERSION);
  safeRemoveItem(DASHBOARD_GUIDE_STORAGE_KEYS.LAST_STEP);
  safeRemoveItem(DASHBOARD_GUIDE_STORAGE_KEYS.DISMISSED);
}

/**
 * Get current Dashboard guide version
 */
export function getDashboardGuideVersion(): string {
  return DASHBOARD_GUIDE_VERSION;
}
