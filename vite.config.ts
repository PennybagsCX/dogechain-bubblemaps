import { defineConfig } from "vite";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import https from "https";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

async function getGitHubCommitCount(): Promise<number> {
  const repo = process.env.GITHUB_REPOSITORY || "PennybagsCX/dogechain-bubblemaps";
  const token = process.env.GITHUB_TOKEN;

  return new Promise((resolve) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${repo}/commits?per_page=1`,
      method: "HEAD",
      headers: {
        "User-Agent": "vite-build",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = https.request(options, (res) => {
      // Get commit count from Link header
      const linkHeader = res.headers["link"];
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) {
          resolve(parseInt(match[1], 10));
          return;
        }
      }
      // Fallback: try to get from etag or default
      resolve(0);
    });

    req.on("error", () => resolve(0));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });
}

export default defineConfig(async ({ mode }) => {
  const isProduction = mode === "production";

  // Get build number from git commit count
  let buildNumber = 0;

  try {
    buildNumber = parseInt(execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim(), 10);

    // If git returns a small number (shallow clone in CI/CD), use GitHub API
    if (buildNumber < 50) {
      console.log(
        `[vite.config] Shallow clone detected (git count: ${buildNumber}), fetching from GitHub API...`
      );
      const githubCount = await getGitHubCommitCount();
      if (githubCount > 0) {
        buildNumber = githubCount;
        console.log(`[vite.config] Using GitHub API commit count: ${buildNumber}`);
      } else {
        // Last resort: use build-metadata.json
        const metadataPath = path.resolve(__dirname, "build-metadata.json");
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        buildNumber = metadata.buildNumber;
        console.log(`[vite.config] GitHub API failed, using build-metadata.json: ${buildNumber}`);
      }
    } else {
      console.log(`[vite.config] Using local git commit count: ${buildNumber}`);
    }
  } catch (error) {
    console.warn("[vite.config] Could not get build number, defaulting to 0");
  }

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        // Proxy all API requests to the backend deployment during development
        "/api": {
          target: "https://dogechain-bubblemaps-api.vercel.app",
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    define: {
      __BETA_BUILD_NUMBER__: JSON.stringify(buildNumber),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
        // Force immediate service worker activation
        devOptions: {
          enabled: true,
          type: "module",
        },
        workbox: {
          // Force new service worker to become active immediately
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/api/],
          // Cleanup outdated caches on activation
          cleanupOutdatedCaches: true,
          // Skip waiting for immediate activation
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
          runtimeCaching: [
            // Cache API responses for token searches with stale-while-revalidate
            // Cache TTL reduced to 5 minutes to allow force-refresh to work effectively
            {
              urlPattern: /^https:\/\/dogechain-bubblemaps-api\.vercel\.app\/api\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5, // 5 minutes (reduced from 24 hours)
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // CRITICAL: JavaScript files use NetworkFirst to always serve fresh code
            // This prevents stale cached JS from being served to users
            {
              urlPattern: /\.(?:js|css)$/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "js-css-assets",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days backup
                },
                networkTimeoutSeconds: 10, // Wait 10s for network before falling back to cache
              },
            },
            // Other static assets use stale-while-revalidate for performance
            {
              urlPattern: /\.(?:html|ico|png|svg|json)$/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
        manifest: {
          name: "Dogechain Bubblemaps",
          short_name: "Bubblemaps",
          description: "Visualize token distribution on Dogechain",
          theme_color: "#8b5cf6",
          background_color: "#0f172a",
          display: "standalone",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ].filter(Boolean),
    // SECURITY: Removed API key embedding to prevent exposure in client bundle
    // API keys should only be used server-side through a backend proxy
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    worker: {
      format: "es",
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
