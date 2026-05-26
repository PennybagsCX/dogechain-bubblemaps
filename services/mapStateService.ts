/**
 * Map State Service
 *
 * Persists and restores bubble map state per token:
 * - Node positions (x, y per wallet)
 * - Zoom/pan transform (scale, translate)
 * - Traced connections (links)
 * - Selected wallet
 * - Physics pause state
 *
 * Uses localStorage for simple key-value storage keyed by token address.
 */

export interface MapTransform {
  x: number;
  y: number;
  k: number; // scale
}

export interface SavedLink {
  source: string;
  target: string;
  value: number;
}

export interface MapState {
  tokenAddress: string;
  nodePositions: Record<string, { x: number; y: number }>;
  transform: MapTransform | null;
  tracedLinks: SavedLink[];
  selectedWalletId: string | null;
  isPaused: boolean;
  savedAt: number;
}

const STORAGE_PREFIX = "bubblemap_state_";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getKey(tokenAddress: string): string {
  return `${STORAGE_PREFIX}${tokenAddress.toLowerCase()}`;
}

/**
 * Save the current map state for a token
 */
export function saveMapState(state: MapState): void {
  try {
    const key = getKey(state.tokenAddress);
    const data: MapState = { ...state, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn("[MapState] Failed to save map state:", error);
  }
}

/**
 * Load a previously saved map state for a token
 */
export function loadMapState(tokenAddress: string): MapState | null {
  try {
    const key = getKey(tokenAddress);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const data: MapState = JSON.parse(raw);

    // Expire old saves
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn("[MapState] Failed to load map state:", error);
    return null;
  }
}

/**
 * Delete a saved map state
 */
export function deleteMapState(tokenAddress: string): void {
  try {
    localStorage.removeItem(getKey(tokenAddress));
  } catch {
    // Ignore
  }
}

/**
 * List all saved map state token addresses
 */
export function listSavedMapStates(): string[] {
  const addresses: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      addresses.push(key.slice(STORAGE_PREFIX.length));
    }
  }
  return addresses;
}
