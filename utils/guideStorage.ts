/**
 * Guide localStorage utility for managing Map Analysis page guide state
 *
 * Consolidates storage for three independent context-aware guides:
 * 1. Bubble Visualization Guide (main bubble map)
 * 2. Token Info Panel Guide (left sidebar stats)
 * 3. Wallet Details Guide (right sidebar wallet info)
 */

// Version for all Map Analysis guides
const BUBBLE_GUIDE_VERSION = "1.0.0";
const TOKEN_PANEL_GUIDE_VERSION = "1.0.0";
const WALLET_DETAILS_GUIDE_VERSION = "1.0.0";

export const isHardReload = (): boolean => {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return false;
    return nav.type === "reload" && typeof nav.transferSize === "number" && nav.transferSize > 0;
  } catch {
    return false;
  }
};

/**
 * Storage keys for all three guides
 */
const GUIDE_STORAGE_KEYS = {
  // Bubble Visualization Guide
  BUBBLE_SEEN: "dogechain_bubble_guide_seen",
  BUBBLE_VERSION: "dogechain_bubble_guide_version",
  BUBBLE_DISMISSED: "dogechain_bubble_guide_dismissed_count",
  BUBBLE_LAST_STEP: "dogechain_bubble_guide_last_step",

  // Token Info Panel Guide
  TOKEN_PANEL_SEEN: "dogechain_token_panel_guide_seen",
  TOKEN_PANEL_VERSION: "dogechain_token_panel_guide_version",
  TOKEN_PANEL_DISMISSED: "dogechain_token_panel_guide_dismissed_count",
  TOKEN_PANEL_LAST_STEP: "dogechain_token_panel_guide_last_step",

  // Wallet Details Guide
  WALLET_DETAILS_SEEN: "dogechain_wallet_details_guide_seen",
  WALLET_DETAILS_VERSION: "dogechain_wallet_details_guide_version",
  WALLET_DETAILS_DISMISSED: "dogechain_wallet_details_guide_dismissed_count",
  WALLET_DETAILS_LAST_STEP: "dogechain_wallet_details_guide_last_step",
} as const;

/**
 * Interface for guide state stored in localStorage
 */
export interface GuideState {
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

// =============================================================================
// BUBBLE VISUALIZATION GUIDE FUNCTIONS
// =============================================================================

/**
 * Get the bubble visualization guide state from localStorage
 */
export function getBubbleGuideState(): GuideState | null {
  try {
    const hasSeen = safeGetItem(GUIDE_STORAGE_KEYS.BUBBLE_SEEN);
    const version = safeGetItem(GUIDE_STORAGE_KEYS.BUBBLE_VERSION);
    const lastStep = safeGetItem(GUIDE_STORAGE_KEYS.BUBBLE_LAST_STEP);
    const dismissedCount = safeGetItem(GUIDE_STORAGE_KEYS.BUBBLE_DISMISSED);

    if (!hasSeen && !version) {
      return null;
    }

    return {
      hasSeen: hasSeen === "true",
      version: version || BUBBLE_GUIDE_VERSION,
      lastStep: lastStep ? parseInt(lastStep, 10) : undefined,
      dismissedCount: dismissedCount ? parseInt(dismissedCount, 10) : 0,
    };
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Check if bubble visualization guide should be shown
 */
export function shouldShowBubbleGuide(): boolean {
  const state = getBubbleGuideState();

  // First-time interaction
  if (!state) {
    return true;
  }

  // Version mismatch - re-show guide
  if (state.version !== BUBBLE_GUIDE_VERSION) {
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
 * Mark bubble visualization guide as seen/completed
 */
export function setBubbleGuideSeen(): boolean {
  const success = safeSetItem(GUIDE_STORAGE_KEYS.BUBBLE_SEEN, "true");
  if (success) {
    safeSetItem(GUIDE_STORAGE_KEYS.BUBBLE_VERSION, BUBBLE_GUIDE_VERSION);
  }
  return success;
}

/**
 * Mark bubble visualization guide as skipped (dismissed)
 */
export function setBubbleGuideSkipped(): boolean {
  const state = getBubbleGuideState();
  const currentCount = state?.dismissedCount || 0;

  const success = safeSetItem(GUIDE_STORAGE_KEYS.BUBBLE_DISMISSED, (currentCount + 1).toString());

  if (success) {
    // Bubble guide dismissed successfully
  }

  return success;
}

/**
 * Update bubble visualization guide current step progress
 */
export function updateBubbleGuideProgress(step: number): boolean {
  return safeSetItem(GUIDE_STORAGE_KEYS.BUBBLE_LAST_STEP, step.toString());
}

/**
 * Reset bubble visualization guide state (for testing/development)
 */
export function resetBubbleGuide(): void {
  safeRemoveItem(GUIDE_STORAGE_KEYS.BUBBLE_SEEN);
  safeRemoveItem(GUIDE_STORAGE_KEYS.BUBBLE_VERSION);
  safeRemoveItem(GUIDE_STORAGE_KEYS.BUBBLE_LAST_STEP);
  safeRemoveItem(GUIDE_STORAGE_KEYS.BUBBLE_DISMISSED);
}

// =============================================================================
// TOKEN INFO PANEL GUIDE FUNCTIONS
// =============================================================================

/**
 * Get the token info panel guide state from localStorage
 */
export function getTokenPanelGuideState(): GuideState | null {
  try {
    const hasSeen = safeGetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_SEEN);
    const version = safeGetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_VERSION);
    const lastStep = safeGetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_LAST_STEP);
    const dismissedCount = safeGetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_DISMISSED);

    if (!hasSeen && !version) {
      return null;
    }

    return {
      hasSeen: hasSeen === "true",
      version: version || TOKEN_PANEL_GUIDE_VERSION,
      lastStep: lastStep ? parseInt(lastStep, 10) : undefined,
      dismissedCount: dismissedCount ? parseInt(dismissedCount, 10) : 0,
    };
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Check if token info panel guide should be shown
 */
export function shouldShowTokenPanelGuide(): boolean {
  const state = getTokenPanelGuideState();

  // First-time interaction
  if (!state) {
    return true;
  }

  // Version mismatch - re-show guide
  if (state.version !== TOKEN_PANEL_GUIDE_VERSION) {
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
 * Mark token info panel guide as seen/completed
 */
export function setTokenPanelGuideSeen(): boolean {
  const success = safeSetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_SEEN, "true");
  if (success) {
    safeSetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_VERSION, TOKEN_PANEL_GUIDE_VERSION);
  }
  return success;
}

/**
 * Mark token info panel guide as skipped (dismissed)
 */
export function setTokenPanelGuideSkipped(): boolean {
  const state = getTokenPanelGuideState();
  const currentCount = state?.dismissedCount || 0;

  const success = safeSetItem(
    GUIDE_STORAGE_KEYS.TOKEN_PANEL_DISMISSED,
    (currentCount + 1).toString()
  );

  if (success) {
    // Storage update succeeded
  }

  return success;
}

/**
 * Update token info panel guide current step progress
 */
export function updateTokenPanelGuideProgress(step: number): boolean {
  return safeSetItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_LAST_STEP, step.toString());
}

/**
 * Reset token info panel guide state (for testing/development)
 */
export function resetTokenPanelGuide(): void {
  safeRemoveItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_SEEN);
  safeRemoveItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_VERSION);
  safeRemoveItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_LAST_STEP);
  safeRemoveItem(GUIDE_STORAGE_KEYS.TOKEN_PANEL_DISMISSED);
}

// =============================================================================
// WALLET DETAILS GUIDE FUNCTIONS
// =============================================================================

/**
 * Get the wallet details guide state from localStorage
 */
export function getWalletDetailsGuideState(): GuideState | null {
  try {
    const hasSeen = safeGetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_SEEN);
    const version = safeGetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_VERSION);
    const lastStep = safeGetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_LAST_STEP);
    const dismissedCount = safeGetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_DISMISSED);

    if (!hasSeen && !version) {
      return null;
    }

    return {
      hasSeen: hasSeen === "true",
      version: version || WALLET_DETAILS_GUIDE_VERSION,
      lastStep: lastStep ? parseInt(lastStep, 10) : undefined,
      dismissedCount: dismissedCount ? parseInt(dismissedCount, 10) : 0,
    };
  } catch {
    // Error handled silently

    return null;
  }
}

/**
 * Check if wallet details guide should be shown
 */
export function shouldShowWalletDetailsGuide(): boolean {
  const state = getWalletDetailsGuideState();

  // First-time interaction
  if (!state) {
    return true;
  }

  // Version mismatch - re-show guide
  if (state.version !== WALLET_DETAILS_GUIDE_VERSION) {
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
 * Mark wallet details guide as seen/completed
 */
export function setWalletDetailsGuideSeen(): boolean {
  const success = safeSetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_SEEN, "true");
  if (success) {
    safeSetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_VERSION, WALLET_DETAILS_GUIDE_VERSION);
  }
  return success;
}

/**
 * Mark wallet details guide as skipped (dismissed)
 */
export function setWalletDetailsGuideSkipped(): boolean {
  const state = getWalletDetailsGuideState();
  const currentCount = state?.dismissedCount || 0;

  const success = safeSetItem(
    GUIDE_STORAGE_KEYS.WALLET_DETAILS_DISMISSED,
    (currentCount + 1).toString()
  );

  if (success) {
    // Wallet details guide dismissed successfully
  }

  return success;
}

/**
 * Update wallet details guide current step progress
 */
export function updateWalletDetailsGuideProgress(step: number): boolean {
  return safeSetItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_LAST_STEP, step.toString());
}

/**
 * Reset wallet details guide state (for testing/development)
 */
export function resetWalletDetailsGuide(): void {
  safeRemoveItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_SEEN);
  safeRemoveItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_VERSION);
  safeRemoveItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_LAST_STEP);
  safeRemoveItem(GUIDE_STORAGE_KEYS.WALLET_DETAILS_DISMISSED);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Reset all Map Analysis guide states (for testing/development)
 */
export function resetAllGuides(): void {
  resetBubbleGuide();
  resetTokenPanelGuide();
  resetWalletDetailsGuide();
}

/**
 * Get current version for a specific guide
 */
export function getBubbleGuideVersion(): string {
  return BUBBLE_GUIDE_VERSION;
}

export function getTokenPanelGuideVersion(): string {
  return TOKEN_PANEL_GUIDE_VERSION;
}

export function getWalletDetailsGuideVersion(): string {
  return WALLET_DETAILS_GUIDE_VERSION;
}
