import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { initSentry } from "./utils/sentry.config";
import { registerSW } from "virtual:pwa-register";

// RainbowKit imports
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { config } from "./wagmi";

// Initialize Sentry error tracking
initSentry();

// Register Service Worker for offline search caching
if (import.meta.env.DEV || import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log("[SW] New content available, please refresh");
    },
    onOfflineReady() {
      console.log("[SW] Application ready to work offline");
    },
    onRegistered(registration) {
      console.log("[SW] Service worker registered:", registration);

      // Check for updates every hour
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        );
      }
    },
    onRegisterError(error) {
      console.error("[SW] Service worker registration error:", error);
    },
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Create QueryClient for React Query
const queryClient = new QueryClient();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#9333ea", // Purple-600
            accentColorForeground: "#ffffff",
            borderRadius: "large",
            fontStack: "system",
            overlayBlur: "large",
          })}
        >
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
