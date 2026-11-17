/**
 * API URL utilities for handling development vs production environments
 *
 * In development: Uses relative paths (proxied by Vite to backend)
 * In production: Uses full backend URL directly
 */

/**
 * Check if we're running in development mode
 * Uses runtime hostname check instead of build-time env var for reliability
 */
function isDevelopmentMode(): boolean {
  // Check if running on localhost or local IP
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname === "[::1]";

  // In development, use the DEV env var if available
  // Otherwise fall back to hostname check
  return import.meta.env.DEV || isLocalhost;
}

/**
 * Get the base URL for API requests
 * Uses environment variable or defaults to production backend
 */
export function getApiBaseUrl(): string {
  // In dev, use relative path (Vite proxy handles it)
  if (isDevelopmentMode()) {
    if (typeof window !== "undefined") {
      console.debug("[API] Development mode detected - using relative paths");
    }
    return "";
  }

  // In production, use a relative path so this fork's own deployment serves /api/*.
  // (The upstream build rewrote /api/* to its own backend; this fork must never
  // call that backend.) Check for an env-var override first (for testing).
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl;
  }

  return "";
}

/**
 * Build a full API URL for the given endpoint
 *
 * @param endpoint - The API endpoint path (e.g., "/api/stats")
 * @returns Full URL for the API endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
}
