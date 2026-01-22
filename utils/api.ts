/**
 * API URL utilities for handling development vs production environments
 *
 * In development: Uses relative paths (proxied by Vite to backend)
 * In production: Uses full backend URL directly
 */

/**
 * Get the base URL for API requests
 * Uses environment variable or defaults to production backend
 */
export function getApiBaseUrl(): string {
  // Check if we're in development mode
  const isDev = import.meta.env.DEV;

  if (isDev) {
    // In dev, use relative path (Vite proxy handles it)
    return "";
  }

  // In production, use the backend URL directly
  return import.meta.env.VITE_API_BASE_URL || "https://dogechain-bubblemaps-api.vercel.app";
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
