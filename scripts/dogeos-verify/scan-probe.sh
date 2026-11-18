#!/usr/bin/env bash
# Live gate for T-03: chunk bound, anchor walk, timestamps, empty state. Needs network.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p scripts/dogeos-verify/dist
npx esbuild scripts/dogeos-verify/scan-probe.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=scripts/dogeos-verify/dist/scan-probe.mjs \
  --log-level=warning
node scripts/dogeos-verify/dist/scan-probe.mjs
