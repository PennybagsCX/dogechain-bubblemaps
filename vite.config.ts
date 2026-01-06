import { defineConfig } from "vite";
import path from "path";
import fs from "fs";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  // Read build metadata
  let buildNumber = 0;
  try {
    const metadataPath = path.resolve(__dirname, "build-metadata.json");
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    buildNumber = metadata.buildNumber;
  } catch (error) {
    console.warn("Could not read build metadata, defaulting to 0");
  }

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        // Proxy API requests to the production deployment during development
        "/api/dogechain-proxy": {
          target: "https://www.dogechain-bubblemaps.xyz",
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    define: {
      __BETA_BUILD_NUMBER__: JSON.stringify(buildNumber),
    },
    plugins: [react()].filter(Boolean),
    // SECURITY: Removed API key embedding to prevent exposure in client bundle
    // API keys should only be used server-side through a backend proxy
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      // SECURITY: Use esbuild to drop console statements in production
      minify: "esbuild",
      esbuild: {
        drop: isProduction ? ["console", "debugger"] : [],
      },
      // Split vendor code into separate chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            // React and React-DOM
            "react-vendor": ["react", "react-dom"],
            // D3 visualization library
            d3: ["d3"],
            // Database library
            dexie: ["dexie"],
            // Icon library
            "lucide-react": ["lucide-react"],
            // AI SDK (optional)
            genai: ["@google/genai"],
          },
        },
      },
      // Improve chunk size warning threshold
      chunkSizeWarningLimit: 600,
    },
  };
});
