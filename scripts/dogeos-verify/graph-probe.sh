#!/usr/bin/env bash
# Live gate for T-04: build the bubble-map graph payload from real Chikyū logs.
#   TOKEN=<erc20> [BLOCKS=<n>] [OUT=docs/verification/x.json] bash scripts/dogeos-verify/graph-probe.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p scripts/dogeos-verify/dist
npx esbuild scripts/dogeos-verify/graph-live.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=scripts/dogeos-verify/dist/graph-live.mjs \
  --log-level=warning
node scripts/dogeos-verify/dist/graph-live.mjs
