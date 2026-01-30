/**
 * Alert First-Time Creation localStorage utility
 * Tracks whether a user has created their first alert to enable auto-redirect to Dashboard
 */

const STORAGE_KEY = "dogechain_first_alert_created";

/**
 * Safely get data from localStorage
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
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
    return false;
  }
}

/**
 * Check if the user has already created their first alert
 * @returns true if first alert has been created, false otherwise
 */
export function hasCreatedFirstAlert(): boolean {
  return safeGetItem(STORAGE_KEY) === "true";
}

/**
 * Mark that the user has created their first alert
 * This should be called immediately after the first successful alert creation
 */
export function markFirstAlertCreated(): void {
  safeSetItem(STORAGE_KEY, "true");
}

/**
 * Reset the first alert flag (for testing/development purposes)
 */
export function resetFirstAlertFlag(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fail
  }
}
