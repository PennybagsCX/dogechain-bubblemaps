import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { initSentry } from "./utils/sentry.config";
import { registerSW } from "virtual:pwa-register";

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
