#!/usr/bin/env bash
# T-06 proof: every /api route answers 200 with live Chikyū data or the explicit
# `{ unavailable: true, reason: "no <x> source on DogeOS Chikyū testnet" }` payload.
#
# What this does, in order:
#   1. ensures the fork-local Postgres cluster is up (the alert routes use it);
#   2. starts the fork API server on a throwaway port;
#   3. curls every route and asserts the JSON contract (this is the transcript);
#   4. runs a real alert round-trip: create → read → trigger → stats → sync → delete;
#   5. greps for the forbidden Dogechain references and runs type-check + build;
#   6. removes the synthetic rows it created and writes the transcript to
#      docs/verification/t06-api-layer.txt.
#
# Run: bash scripts/dogeos-verify/api-layer-proof.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT="${T06_API_PORT:-3141}"
BASE="http://127.0.0.1:$PORT"
OUT="docs/verification/t06-api-layer.txt"
SERVER_LOG="/tmp/t06-api-server-$PORT.log"
WALLET="0x000000000000000000000000000000000000dEaD"
MONITORED="0x1111111111111111111111111111111111111111"
TOKEN_MONITORED="0x2222222222222222222222222222222222222222"
BLOCKSCOUT="https://blockscout.testnet.dogeos.com"

PASS=0
FAIL=0
FAILED_NAMES=()

mkdir -p docs/verification
: > "$OUT"

say() { printf '%s\n' "$*" | tee -a "$OUT"; }
pass() { PASS=$((PASS + 1)); say "PASS $1"; }
fail() { FAIL=$((FAIL + 1)); FAILED_NAMES+=("$1"); say "FAIL $1"; }

cleanup() {
  # Kill whatever owns the proof port, whatever the exit path.
  local pids
  pids="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}
trap cleanup EXIT

say "T-06 API layer proof — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
say "repo: $REPO_ROOT"
say "api : $BASE (chain 6281971 / DogeOS Chikyū testnet)"
say ""

# ---------------------------------------------------------------- 0. database
say "== 0. fork database"
# Note: capture output first — `… | grep -q` under `set -o pipefail` returns SIGPIPE (141)
# from the writer and would look like a failure even on a match.
DB_STATUS="$(bash scripts/dogeos-verify/db-local.sh status 2>/dev/null || true)"
case "$DB_STATUS" in
  *"postgres  : up"*)
    say "database: up (fork-local cluster, 127.0.0.1:55432)"
    ;;
  *)
    say "database: starting fork-local cluster"
    if bash scripts/dogeos-verify/db-local.sh up >>"$OUT" 2>&1; then
      say "database: up (started by this run)"
    else
      say "FAIL database could not start"
      exit 1
    fi
    ;;
esac

# --------------------------------------------------------------- 1. api server
say ""
say "== 1. starting API server"
TSX_BIN="$(command -v tsx || true)"
if [ -z "$TSX_BIN" ]; then
  say "FAIL tsx not found on PATH (npm i -g tsx, or run through npx)"
  exit 1
fi
rm -f "$SERVER_LOG"
API_PORT="$PORT" "$TSX_BIN" src/api/server.ts >"$SERVER_LOG" 2>&1 &
READY=0
for _ in $(seq 1 60); do
  if curl -fsS -m 2 "$BASE/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 0.5
done
if [ "$READY" != "1" ]; then
  say "FAIL API server did not become ready"
  sed -n 1,40p "$SERVER_LOG" >>"$OUT"
  exit 1
fi
say "api server: ready ($(/usr/bin/env sed -n 's/^\[api\] //p' "$SERVER_LOG" | tail -1))"

# ----------------------------------------------------------------- 2. helpers
assert_get() { # name path python-expression-on-d
  local name="$1" path="$2" expr="$3" body code
  body="$(curl -sS -m 45 -w '\n%{http_code}' "$BASE$path")"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  say ""
  say "### GET $path"
  say "HTTP $code"
  say "BODY $body"
  if [ "$code" != "200" ]; then
    fail "$name (HTTP $code)"
    return
  fi
  if printf '%s' "$body" | python3 scripts/dogeos-verify/assert_json.py "$expr" 2>>"$OUT"; then
    pass "$name"
  else
    fail "$name (payload)"
  fi
}

assert_write() { # name path json python-expression
  local name="$1" path="$2" payload="$3" expr="$4" body code
  body="$(curl -sS -m 45 -X POST "$BASE$path" -H 'content-type: application/json' -d "$payload" -w '\n%{http_code}')"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  say ""
  say "### POST $path"
  say "HTTP $code"
  say "BODY $body"
  if [ "$code" != "200" ]; then
    fail "$name (HTTP $code)"
    return
  fi
  if printf '%s' "$body" | python3 scripts/dogeos-verify/assert_json.py "$expr" 2>>"$OUT"; then
    pass "$name"
  else
    fail "$name (payload)"
  fi
}

assert_delete() { # name path python-expression
  local name="$1" path="$2" expr="$3" body code
  body="$(curl -sS -m 45 -X DELETE "$BASE$path" -w '\n%{http_code}')"
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  say ""
  say "### DELETE $path"
  say "HTTP $code"
  say "BODY $body"
  if [ "$code" != "200" ]; then
    fail "$name (HTTP $code)"
    return
  fi
  if printf '%s' "$body" | python3 scripts/dogeos-verify/assert_json.py "$expr" 2>>"$OUT"; then
    pass "$name"
  else
    fail "$name (payload)"
  fi
}

ALL_UNAVAILABLE='d["unavailable"] is True and d["reason"].startswith("no ") and " source on DogeOS Chikyū testnet" in d["reason"]'

# ------------------------------------------------------------------ 3. reads
say ""
say "== 2. route transcript (real data or explicit unavailable)"

assert_get "health" "/api/health" \
  "d['status']=='healthy' and d['chain']['id']==6281971 and d['database']=='connected' and d['cache']['namespace']=='chain-6281971'"

assert_get "stats: live chain counters + honest searches:null" "/api/stats" \
  "d['chain']['id']==6281971 and isinstance(d['blockNumber'],int) and d['blockNumber']>0 and d['explorer']['totalTransactions']>0 and d['explorer']['totalAddresses']>0 and d['searches'] is None and d['unavailable']['searches']['unavailable'] is True and 'no search-analytics source on DogeOS Chikyū testnet' in d['unavailable']['searches']['reason']"

assert_get "tvl: unavailable" "/api/tvl" "$ALL_UNAVAILABLE and 'no TVL source' in d['reason']"
assert_get "chain-metrics: unavailable" "/api/chain-metrics" "$ALL_UNAVAILABLE and d['metrics'] is None"
assert_get "market: unavailable" "/api/market" "$ALL_UNAVAILABLE and 'priceUsd' not in d"
assert_get "price: unavailable" "/api/price?token=$TOKEN_MONITORED" "$ALL_UNAVAILABLE and 'priceUsd' not in d"
assert_get "candles: unavailable" "/api/candles?token=$TOKEN_MONITORED&interval=1h" "$ALL_UNAVAILABLE and d['candles']==[]"
assert_get "trending: unavailable" "/api/trending?type=TOKEN&limit=10&cache=true" "$ALL_UNAVAILABLE and d['assets']==[]"
assert_get "trending-wallet: unavailable" "/api/trending-wallet?type=TOKEN&limit=5" "$ALL_UNAVAILABLE and d['assets']==[]"
assert_get "learned-tokens: unavailable" "/api/learned-tokens?type=TOKEN&limit=5&min_popularity=10" "$ALL_UNAVAILABLE and d['tokens']==[]"
assert_get "popularity: unavailable" "/api/trending/popularity?addresses[]=$MONITORED" "$ALL_UNAVAILABLE and d['popularity']=={}"
assert_get "peer recommendations: unavailable" "/api/recommendations/peers?query=DOGE&type=TOKEN&limit=5" "$ALL_UNAVAILABLE and d['recommendations']==[]"
assert_get "cache: every key chain-namespaced" "/api/cache" \
  "d['namespace']=='chain-6281971' and all(k.startswith('chain-6281971:') for k in d['keys'])"

# Explorer proxy needs a live contract address; discover one from blockscout itself.
PROXY_TOKEN="$(curl -sS -m 30 "$BLOCKSCOUT/api/v2/tokens?type=ERC-20" | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['address'])" 2>/dev/null || true)"
if [ -n "${PROXY_TOKEN:-}" ]; then
  assert_get "explorer-proxy: live chain data" "/api/explorer-proxy?module=stats&action=tokensupply&contractaddress=$PROXY_TOKEN" \
    "str(d.get('result','')).isdigit() and d.get('status')=='1'"
else
  fail "explorer-proxy (no token discovered from blockscout)"
fi

# ------------------------------------------------------------ 4. alert writes
say ""
say "== 3. alert routes against the fork database (real rows, then cleaned up)"

assert_write "alerts: create" "/api/alerts" \
  "{\"walletAddress\":\"$WALLET\",\"alertId\":\"t06-proof-alert\",\"name\":\"T-06 proof alert\",\"monitoredWallet\":\"$MONITORED\",\"tokenAddress\":\"$TOKEN_MONITORED\",\"tokenName\":\"Proof Token\",\"tokenSymbol\":\"PRF\",\"initialValue\":123.5,\"type\":\"TOKEN\",\"createdAt\":1794940000000}" \
  "d['success'] is True and d['alertId']=='t06-proof-alert'"

assert_get "alerts: read back the stored row" "/api/alerts?wallet=$WALLET" \
  "d['success'] is True and d['count']==1 and d['data'][0]['alert_id']=='t06-proof-alert' and d['data'][0]['initial_value']==123.5 and d['data'][0]['type']=='TOKEN' and d['data'][0]['is_active'] is True"

assert_write "alerts: trigger event" "/api/alerts?action=trigger" \
  "{\"alertId\":\"t06-proof-alert\",\"alertName\":\"T-06 proof alert\",\"walletAddress\":\"$MONITORED\",\"tokenAddress\":\"$TOKEN_MONITORED\",\"tokenSymbol\":\"PRF\",\"transactionCount\":3,\"sessionId\":\"t06-proof\"}" \
  "d['success'] is True and d['logged'] is True and isinstance(d['id'],int) and d['chainId']==6281971"

assert_get "stats: alert counter reflects the real row" "/api/stats?t=$(date +%s)" \
  "isinstance(d['alerts'],int) and d['alerts']>=1"

assert_write "alerts: sync uploads without inventing downloads" "/api/alerts?action=sync" \
  "{\"walletAddress\":\"$WALLET\",\"localAlerts\":[{\"alertId\":\"t06-sync-alert\",\"name\":\"T-06 sync alert\",\"walletAddress\":\"$MONITORED\",\"type\":\"WALLET\",\"createdAt\":1794940001000}]}" \
  "d['success'] is True and d['uploaded']==1 and d['downloaded']==0 and d['conflicts']==0 and isinstance(d['syncTimestamp'],int)"

assert_get "alerts: both rows present after sync" "/api/alerts?wallet=$WALLET" \
  "d['count']==2 and {r['alert_id'] for r in d['data']}=={'t06-proof-alert','t06-sync-alert'}"

assert_delete "alerts: delete the created row" "/api/alerts?wallet=$WALLET&alertId=t06-proof-alert" \
  "d['success'] is True and d['deleted']==1"
assert_delete "alerts: delete the synced row" "/api/alerts?wallet=$WALLET&alertId=t06-sync-alert" \
  "d['success'] is True and d['deleted']==1"

assert_get "alerts: empty after delete (a real zero)" "/api/alerts?wallet=$WALLET" \
  "d['success'] is True and d['count']==0 and d['data']==[]"

assert_write "analytics: write endpoint reports recorded:false" "/api/analytics/search" \
  '{"sessionId":"t06","query":"WDOGE","results":[],"resultCount":0,"timestamp":1794940000000}' \
  "d['success'] is False and d['recorded'] is False and d['unavailable'] is True"

assert_write "interactions: write endpoint reports recorded:false" "/api/interactions" \
  '{"tokenAddress":"0x2222222222222222222222222222222222222222","interactionType":"search"}' \
  "d['success'] is False and d['recorded'] is False and d['unavailable'] is True"

# ------------------------------------------------------------ 5. static gates
say ""
say "== 4. static gates"

DOGECHAIN_HITS="$(grep -rn "dogechain" app src/api --include=*.ts 2>/dev/null | wc -l | tr -d ' ')"
say "grep -rn \"dogechain\" app src/api --include=*.ts → $DOGECHAIN_HITS hits"
if [ "$DOGECHAIN_HITS" = "0" ]; then pass "no Dogechain references under app/ or src/api/"; else fail "Dogechain references under app/ or src/api/"; fi

say ""
say "### npx tsc --noEmit"
if npx tsc --noEmit >>"$OUT" 2>&1; then pass "type-check clean"; else fail "type-check"; fi

say ""
say "### npm run build"
if npm run build >>"$OUT" 2>&1; then pass "npm run build green"; else fail "npm run build"; fi

# --------------------------------------------------------------- 6. cleanup
say ""
say "== 5. cleanup"
# The proof trigger row is real data in triggered_alerts; remove the synthetic one.
# psql rejects Prisma's `?schema=public` query parameter, so strip the query string.
# (The DSN stays in this shell variable and is never printed.)
PROOF_PSQL_URL="$(bash scripts/dogeos-verify/db-local.sh exec bash -c 'printf "%s" "${DATABASE_URL%%\?*}"')"
if [ -n "$PROOF_PSQL_URL" ]; then
  if bash scripts/dogeos-verify/db-local.sh exec psql "$PROOF_PSQL_URL" -q -tAc \
    "DELETE FROM triggered_alerts WHERE session_id = 't06-proof';" >>"$OUT" 2>&1; then
    say "cleanup: synthetic triggered_alerts row removed"
  else
    say "WARN cleanup: could not remove synthetic triggered_alerts row"
  fi
else
  say "WARN cleanup: no DATABASE_URL available for cleanup"
fi
unset PROOF_PSQL_URL
say "cleanup: proof API server stopped"

# ------------------------------------------------------------------ 7. summary
say ""
say "== summary"
say "PASS: $PASS"
say "FAIL: $FAIL"
if [ "$FAIL" -ne 0 ]; then
  say "failed checks: ${FAILED_NAMES[*]}"
  say "transcript: $OUT"
  exit 1
fi
say "all checks passed — transcript: $OUT"
