import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ApiError, isRateLimitError } from "../types";

interface RateLimitWarningProps {
  error: Error | ApiError | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

/**
 * Component to display rate limit warnings with user-friendly messages
 * and retry functionality.
 */
export const RateLimitWarning: React.FC<RateLimitWarningProps> = ({
  error,
  onRetry,
  isRetrying = false,
  className = "",
}) => {
  if (!error) return null;

  // Check if this is a rate limit error
  const isRateLimit = isRateLimitError(error);

  if (!isRateLimit) return null;

  // Extract user-friendly message
  const userMessage =
    (error as ApiError).userFriendlyMessage ||
    error.message ||
    "API rate limit exceeded. Please wait a moment and try again.";

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-200">{userMessage}</p>
        <p className="text-xs text-amber-300/70 mt-1">
          The app will automatically retry with exponential backoff. You can continue using other
          features while this completes.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? "Retrying..." : "Retry Now"}
        </button>
      )}
    </div>
  );
};

interface ErrorBannerProps {
  error: Error | ApiError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

/**
 * General error banner component that displays appropriate messages
 * based on error type (rate limit, network, etc.)
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onDismiss,
  onRetry,
  isRetrying = false,
  className = "",
}) => {
  if (!error) return null;

  const isRateLimit = isRateLimitError(error);
  const bgColor = isRateLimit ? "bg-amber-500/10" : "bg-red-500/10";
  const borderColor = isRateLimit ? "border-amber-500/30" : "border-red-500/30";
  const textColor = isRateLimit ? "text-amber-200" : "text-red-200";
  const iconColor = isRateLimit ? "text-amber-500" : "text-red-500";
  const subtextColor = isRateLimit ? "text-amber-300/70" : "text-red-300/70";

  // Extract user-friendly message
  const userMessage =
    (error as ApiError).userFriendlyMessage ||
    error.message ||
    "An unexpected error occurred. Please try again.";

  return (
    <div
      className={`flex items-start gap-3 p-4 ${bgColor} border ${borderColor} rounded-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor}`}>{userMessage}</p>
        {isRateLimit && (
          <p className={`text-xs ${subtextColor} mt-1`}>
            The app will automatically retry with exponential backoff. You can continue using other
            features while this completes.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className={`px-3 py-1.5 text-xs font-medium ${textColor} bg-current/10 hover:bg-current/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1.5 text-${isRateLimit ? "amber" : "red"}-200 hover:bg-current/10 rounded-md transition-colors`}
            aria-label="Dismiss error"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default RateLimitWarning;
