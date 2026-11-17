#!/usr/bin/env bash
# Bundle the live scanner proof with esbuild (already a vite dependency) and run it with node.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p scripts/dogeos-verify/dist
npx esbuild scripts/dogeos-verify/scan-live.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=scripts/dogeos-verify/dist/scan-live.mjs \
  --log-level=warning
node scripts/dogeos-verify/dist/scan-live.mjs
