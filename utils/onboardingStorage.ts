/**
 * Onboarding localStorage utility for managing user onboarding state
 */

const ONBOARDING_VERSION = "1.0.0";

const STORAGE_KEYS = {
  HAS_SEEN_ONBOARDING: "dogechain_onboarding_seen",
  ONBOARDING_VERSION: "dogechain_onboarding_version",
  LAST_STEP: "dogechain_onboarding_last_step",
  DISMISSED_COUNT: "dogechain_onboarding_dismissed_count",
  COMPLETED_AT: "dogechain_onboarding_completed_at",
} as const;

/**
 * Interface for onboarding state stored in localStorage
 */
export interface OnboardingState {
  hasSeen: boolean;
  version: string;
  lastStep?: number;
  dismissedCount: number;
  completedAt?: number;
}

/**
 * Safely get data from localStorage
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("[Onboarding] localStorage access failed:", error);
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
  } catch (error) {
    console.warn("[Onboarding] localStorage write failed:", error);
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
  } catch (error) {
    console.warn("[Onboarding] localStorage remove failed:", error);
    return false;
  }
}

/**
 * Get the complete onboarding state from localStorage
 */
export function getOnboardingState(): OnboardingState | null {
  try {
    const hasSeen = safeGetItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
    const version = safeGetItem(STORAGE_KEYS.ONBOARDING_VERSION);
    const lastStep = safeGetItem(STORAGE_KEYS.LAST_STEP);
    const dismissedCount = safeGetItem(STORAGE_KEYS.DISMISSED_COUNT);
    const completedAt = safeGetItem(STORAGE_KEYS.COMPLETED_AT);

    if (!hasSeen && !version) {
      return null;
    }

    return {
      hasSeen: hasSeen === "true",
      version: version || ONBOARDING_VERSION,
      lastStep: lastStep ? parseInt(lastStep, 10) : undefined,
      dismissedCount: dismissedCount ? parseInt(dismissedCount, 10) : 0,
      completedAt: completedAt ? parseInt(completedAt, 10) : undefined,
    };
  } catch (error) {
    console.error("[Onboarding] Failed to parse state:", error);
    return null;
  }
}

/**
 * Check if onboarding should be shown to the user
 */
export function shouldShowOnboarding(): boolean {
  const state = getOnboardingState();

  // First-time visitor
  if (!state) {
    return true;
  }

  // Version mismatch - re-show onboarding
  if (state.version !== ONBOARDING_VERSION) {
    console.log("[Onboarding] Version mismatch, re-showing onboarding");
    return true;
  }

  // User has already completed onboarding
  if (state.hasSeen) {
    return false;
  }

  // User has dismissed 3+ times, don't auto-show
  if (state.dismissedCount >= 3) {
    return false;
  }

  // Show onboarding
  return true;
}

/**
 * Mark onboarding as seen/completed
 */
export function setOnboardingSeen(): boolean {
  const success = safeSetItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, "true");
  if (success) {
    safeSetItem(STORAGE_KEYS.ONBOARDING_VERSION, ONBOARDING_VERSION);
    safeSetItem(STORAGE_KEYS.COMPLETED_AT, Date.now().toString());
    console.log("[Onboarding] Marked as seen");
  }
  return success;
}

/**
 * Mark onboarding as skipped (dismissed)
 */
export function setOnboardingSkipped(): boolean {
  const state = getOnboardingState();
  const currentCount = state?.dismissedCount || 0;

  const success = safeSetItem(STORAGE_KEYS.DISMISSED_COUNT, (currentCount + 1).toString());

  if (success) {
    console.log(`[Onboarding] Skipped (dismissal count: ${currentCount + 1}/3)`);
  }

  return success;
}

/**
 * Update the current step progress
 */
export function updateOnboardingProgress(step: number): boolean {
  return safeSetItem(STORAGE_KEYS.LAST_STEP, step.toString());
}

/**
 * Reset onboarding state (for testing/development)
 */
export function resetOnboarding(): void {
  console.log("[Onboarding] Resetting onboarding state");
  safeRemoveItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
  safeRemoveItem(STORAGE_KEYS.ONBOARDING_VERSION);
  safeRemoveItem(STORAGE_KEYS.LAST_STEP);
  safeRemoveItem(STORAGE_KEYS.DISMISSED_COUNT);
  safeRemoveItem(STORAGE_KEYS.COMPLETED_AT);
}

/**
 * Get current onboarding version
 */
export function getOnboardingVersion(): string {
  return ONBOARDING_VERSION;
}
