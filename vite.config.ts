import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import removeConsole from 'vite-plugin-remove-console';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // SECURITY: Remove console.log in production builds
        isProduction && removeConsole()
      ].filter(Boolean),
      // SECURITY: Removed API key embedding to prevent exposure in client bundle
      // API keys should only be used server-side through a backend proxy
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Split vendor code into separate chunks for better caching
        rollupOptions: {
          output: {
            manualChunks: {
              // React and React-DOM
              'react-vendor': ['react', 'react-dom'],
              // D3 visualization library
              'd3': ['d3'],
              // Database library
              'dexie': ['dexie'],
              // Icon library
              'lucide-react': ['lucide-react'],
              // AI SDK (optional)
              'genai': ['@google/genai'],
            },
          },
        },
        // Improve chunk size warning threshold
        chunkSizeWarningLimit: 600,
      },
    };
});
