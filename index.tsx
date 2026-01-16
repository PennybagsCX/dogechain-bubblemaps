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

// Create portal root for tooltips to escape container clipping
const tooltipPortalRoot = document.createElement("div");
tooltipPortalRoot.id = "tooltip-portal-root";
tooltipPortalRoot.style.position = "fixed";
tooltipPortalRoot.style.top = "0";
tooltipPortalRoot.style.left = "0";
tooltipPortalRoot.style.pointerEvents = "none";
tooltipPortalRoot.style.zIndex = "130";
document.body.appendChild(tooltipPortalRoot);

// Create portal root for modals (onboarding, etc.)
const modalPortalRoot = document.createElement("div");
modalPortalRoot.id = "modal-portal-root";
modalPortalRoot.style.position = "fixed";
modalPortalRoot.style.top = "0";
modalPortalRoot.style.left = "0";
modalPortalRoot.style.width = "0";
modalPortalRoot.style.height = "0";
modalPortalRoot.style.overflow = "visible";
modalPortalRoot.style.pointerEvents = "none"; // Don't capture clicks when empty (fixes Arc Browser issue)
modalPortalRoot.style.zIndex = "60";
document.body.appendChild(modalPortalRoot);

// Register Service Worker for offline search caching
if (import.meta.env.DEV || import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      // New content available
    },
    onOfflineReady() {
      // Application ready to work offline
    },
    onRegistered(registration) {
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
    onRegisterError(_error) {
      // Service worker registration error
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
