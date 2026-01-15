import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    css: true,
    passWithNoTests: true,
    env: {
      DATABASE_URL: "postgresql://test:test@localhost/test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["node_modules/", "tests/", "**/*.d.ts", "**/*.config.*", "**/mockData", "dist/"],
      thresholds: {
        // Target 70% coverage
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
