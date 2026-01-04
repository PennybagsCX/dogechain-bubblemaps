import * as Sentry from '@sentry/react';

/**
 * Sentry Error Tracking Configuration
 *
 * Initialize Sentry in production to track errors and performance issues.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Sentry project at https://sentry.io
 * 2. Get your DSN from Project Settings > Client Keys (DSN)
 * 3. Add SENTRY_DSN to your environment variables
 * 4. Uncomment the init() call below
 */

const SENTRY_DSN = import.meta.env.SENTRY_DSN || '';

export const initSentry = () => {
  // Only initialize in production if DSN is available
  if (import.meta.env.PROD && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,

      // Environment
      environment: import.meta.env.MODE,

      // Sample rates
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      replaysSessionSampleRate: 0.1, // 10% of sessions for replay
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors for replay

      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true, // Mask sensitive text in replays
          blockAllMedia: true, // Block media in replays
        }),
        Sentry.captureConsoleIntegration({
          levels: ['error'], // Only capture console.error
        }),
      ],

      // Filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data from event
        if (event.request) {
          // Don't send query parameters with potential sensitive data
          delete event.request.query_string;
        }

        // Filter out specific error messages that contain sensitive data
        if (event.message) {
          // Don't log events with wallet addresses in error messages
          if (event.message.includes('0x')) {
            // Mask wallet addresses
            event.message = event.message.replace(/0x[a-fA-F0-9]{40}/g, '0x***MASKED***');
          }
        }

        return event;
      },

      // Ignore specific errors
      ignoreErrors: [
        // Network errors that are expected
        'Failed to fetch',
        'NetworkError',
        'AbortError',
        // Browser extension errors
        'Non-Error promise rejection captured',
      ],

      // Performance monitoring
      beforeSendTransaction(event) {
        // Filter out transaction names with sensitive data
        if (event.transaction) {
          event.transaction = event.transaction.replace(/0x[a-fA-F0-9]{40}/g, '0x***MASKED***');
        }
        return event;
      },
    });

    console.log('Sentry initialized successfully');
  } else {
    if (import.meta.env.DEV) {
      console.log('Sentry not initialized: Development mode');
    } else if (!SENTRY_DSN) {
      console.warn('Sentry not initialized: SENTRY_DSN not configured');
    }
  }
};

/**
 * Capture error with context
 */
export const captureError = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    extra: context,
  });
};

/**
 * Capture message with level
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

/**
 * Set user context for error tracking
 */
export const setUserContext = (walletAddress?: string) => {
  if (walletAddress) {
    // Mask wallet address for privacy
    const maskedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    Sentry.setUser({
      id: maskedAddress,
      username: maskedAddress,
    });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * Add breadcrumb for tracking user actions
 */
export const addBreadcrumb = (message: string, category?: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message,
    category: category || 'custom',
    data,
    level: 'info',
  });
};
