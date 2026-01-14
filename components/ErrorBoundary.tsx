import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send error to Sentry if initialized
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-space-900 p-4">
          <div className="max-w-md w-full bg-space-800 border border-red-500/30 rounded-xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-6 text-sm">
              The application encountered an unexpected error. This often happens due to network
              interruptions or invalid blockchain data.
            </p>
            <div className="bg-space-900/50 p-4 rounded-lg border border-red-500/30 mb-6 text-left overflow-auto max-h-32">
              <code className="text-xs text-red-300 font-mono break-all">
                {this.state.error?.message || "Unknown Error"}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full py-3 bg-doge-600 hover:bg-doge-500 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={18} /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export Sentry-wrapped version for easier use
export const SentryErrorBoundary = Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: ({ resetError }) => (
    <div className="min-h-screen flex items-center justify-center bg-space-900 p-4">
      <div className="max-w-md w-full bg-space-800 border border-red-500/30 rounded-xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-slate-400 mb-6 text-sm">
          The application encountered an unexpected error. This has been reported to our team.
        </p>
        <div className="bg-space-900/50 p-4 rounded-lg border border-red-500/30 mb-6 text-left overflow-auto max-h-32">
          <code className="text-xs text-red-300 font-mono break-all">
            An error has occurred. Please try refreshing the page.
          </code>
        </div>
        <button
          onClick={resetError}
          className="flex items-center justify-center gap-2 w-full py-3 bg-doge-600 hover:bg-doge-500 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw size={18} /> Try Again
        </button>
      </div>
    </div>
  ),
});
