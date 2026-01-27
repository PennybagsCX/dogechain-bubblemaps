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
// CRITICAL FIX: Use pointer-events: none to prevent empty portal from blocking bubble map clicks
// When modals are rendered inside, they will have their own pointer-events to receive clicks
// This fixes the bug where bubble map was unclickable after closing modals
modalPortalRoot.style.pointerEvents = "none";
modalPortalRoot.style.zIndex = "60";
document.body.appendChild(modalPortalRoot);

// Register Service Worker for offline search caching
if (import.meta.env.DEV || import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      // New content available - show notification and auto-refresh
      console.log("[PWA] New version available, refreshing...");

      // Show a brief notification then auto-refresh
      const notification = document.createElement("div");
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #9333ea, #7c3aed);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(147, 51, 234, 0.3);
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
      `;
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          <span>Updating to latest version...</span>
        </div>
      `;

      // Add animation keyframes
      if (!document.getElementById("pwa-update-style")) {
        const style = document.createElement("style");
        style.id = "pwa-update-style";
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(notification);

      // Auto-refresh after 1.5 seconds to allow user to see the notification
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onOfflineReady() {
      // Application ready to work offline
      console.log("[PWA] App ready to work offline");
    },
    onRegistered(registration) {
      // Check for updates every 5 minutes (reduced from 1 hour)
      if (registration) {
        // Check immediately on load
        registration.update();

        // Then check every 5 minutes
        setInterval(
          () => {
            registration.update();
          },
          5 * 60 * 1000
        );
      }
    },
    onRegisterError(_error) {
      // Service worker registration error
      console.error("[PWA] Service worker registration error:", _error);
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
