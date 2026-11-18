#!/usr/bin/env bash
# Explorer-API proof for DogeOS Chikyū blockscout.
#
# Each check exercises exactly one endpoint shape that the app's explorer clients call,
# using the URLs lib/chain.ts produces (EXPLORER_API / EXPLORER_API_V2). A check passes only
# when the HTTP status is 200 AND the documented field parses out of the body.
#
# Run: bash scripts/dogeos-verify/explorer-api-proof.sh
set -uo pipefail

HOST="https://blockscout.testnet.dogeos.com"
V1="$HOST/api"
V2="$HOST/api/v2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
FAILED_NAMES=()

fetch() { # name url outfile
  local name="$1" url="$2" out="$3"
  local code
  code=$(curl -sS -m 45 -o "$out" -w '%{http_code}' "$url") || code="000"
  if [ "$code" != "200" ]; then
    printf 'FAIL %-34s HTTP %s\n' "$name" "$code"
    FAIL=$((FAIL + 1)); FAILED_NAMES+=("$name (HTTP $code)"); return 1
  fi
}

assert() { # name outfile python-expression-on-d
  local name="$1" out="$2" expr="$3"
  if python3 - "$out" "$expr" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
with open(path) as f:
    raw = f.read()
d = json.loads(raw)
ok = bool(eval(expr, {"d": d, "json": json}))
print(("PASS " if ok else "FAIL ") + expr)
sys.exit(0 if ok else 1)
PY
  then
    PASS=$((PASS + 1))
  else
    printf 'FAIL %-34s unparseable/field missing\n' "$name"
    FAIL=$((FAIL + 1)); FAILED_NAMES+=("$name (field)")
  fi
}

echo "== discovering live fixtures =="
fetch "fixture:token-list" "$V2/tokens?type=ERC-20" "$TMP/tokens.json" || exit 1
TOKEN=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["items"][0]["address"])' "$TMP/tokens.json")
fetch "fixture:nft-list" "$V2/tokens?type=ERC-721" "$TMP/nfts.json" || exit 1
NFT=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["items"][0]["address"])' "$TMP/nfts.json")
fetch "fixture:holders" "$V2/tokens/$TOKEN/holders" "$TMP/holders0.json" || exit 1
WALLET=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["items"][0]["address"]["hash"])' "$TMP/holders0.json")

# Contract-metadata endpoints (getsourcecode/getabi/smart-contracts) only answer for *verified*
# contracts. WDOGE is a verified contract on this testnet (probed 2026-11-17); using it as the
# fixture keeps these three checks meaningful.
VERIFIED="0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE"
SEARCH_Q="wdo"

echo "TOKEN=$TOKEN"
echo "NFT=$NFT"
echo "WALLET=$WALLET"
echo "VERIFIED=$VERIFIED"
echo "SEARCH_Q=$SEARCH_Q"
echo

echo "== dataService.ts =="
# 1. detectContractType step 1 / fetchMetadataFromTokenList
if fetch "v1 getToken" "$V1?module=token&action=getToken&contractaddress=$TOKEN" "$TMP/1.json"; then
  assert "v1 getToken" "$TMP/1.json" 'd["status"]=="1" and bool(d["result"].get("symbol"))'
fi
# 2. detectContractType step 2 / fetchTokenDataInternal
if fetch "v2 token" "$V2/tokens/$TOKEN" "$TMP/2.json"; then
  assert "v2 token" "$TMP/2.json" 'bool(d.get("name")) and bool(d.get("type"))'
fi
# 3. detectContractType step 3 / checkContractVerification
if fetch "v1 getsourcecode" "$V1?module=contract&action=getsourcecode&address=$VERIFIED" "$TMP/3.json"; then
  assert "v1 getsourcecode" "$TMP/3.json" 'd["status"]=="1" and isinstance(d["result"],list) and "ABI" in d["result"][0]'
fi
# 4. detectContractType step 4 (NFT activity probe)
if fetch "v1 tokennfttx" "$V1?module=account&action=tokennfttx&contractaddress=$NFT&page=1&offset=1&sort=desc" "$TMP/4.json"; then
  assert "v1 tokennfttx" "$TMP/4.json" 'd["status"]=="1" and isinstance(d["result"],list)'
fi
# 5. detectContractType step 5 / fetchMetadataFromTransfers
if fetch "v2 token transfers" "$V2/tokens/$TOKEN/transfers?limit=1" "$TMP/5.json"; then
  assert "v2 token transfers" "$TMP/5.json" 'isinstance(d.get("items"),list) and bool(d["items"][0].get("token"))'
fi
# 6. fetchTokenHolders (v2 primary, paged)
if fetch "v2 token holders" "$V2/tokens/$TOKEN/holders" "$TMP/6.json"; then
  assert "v2 token holders" "$TMP/6.json" 'isinstance(d.get("items"),list) and bool(d["items"][0]["address"].get("hash"))'
fi
NEXT=$(python3 -c 'import json,sys;np=json.load(open(sys.argv[1])).get("next_page_params") or {};print("&".join(f"{k}={v}" for k,v in np.items()))' "$TMP/6.json")
if [ -n "$NEXT" ]; then
  if fetch "v2 holders page 2" "$V2/tokens/$TOKEN/holders?$NEXT" "$TMP/6b.json"; then
    assert "v2 holders page 2" "$TMP/6b.json" 'isinstance(d.get("items"),list) and len(d["items"])>0'
  fi
fi
# 7. total supply via v1 stats
if fetch "v1 tokensupply" "$V1?module=stats&action=tokensupply&contractaddress=$TOKEN" "$TMP/7.json"; then
  assert "v1 tokensupply" "$TMP/7.json" 'd["status"]=="1" and str(d["result"]).isdigit()'
fi
# 8/9. wallet asset scan (v2 fallbacks)
if fetch "v2 addr token-transfers" "$V2/addresses/$WALLET/token-transfers?page=1&limit=200" "$TMP/8.json"; then
  assert "v2 addr token-transfers" "$TMP/8.json" 'isinstance(d.get("items"),list)'
fi
if fetch "v2 addr token-balances" "$V2/addresses/$WALLET/token-balances?page=1&limit=200" "$TMP/9.json"; then
  assert "v2 addr token-balances" "$TMP/9.json" 'isinstance(d,list) and bool(d[0].get("token"))'
fi
# 10. wallet transaction feed (v1, address-scoped)
if fetch "v1 tokentx" "$V1?module=account&action=tokentx&address=$WALLET&page=1&offset=20&sort=desc" "$TMP/10.json"; then
  assert "v1 tokentx" "$TMP/10.json" 'isinstance(d.get("result"),list)'
fi
# 11. holder balance probe
if fetch "v1 tokenbalance" "$V1?module=account&action=tokenbalance&contractaddress=$TOKEN&address=$WALLET" "$TMP/11.json"; then
  assert "v1 tokenbalance" "$TMP/11.json" 'd["status"]=="1" and str(d["result"]).isdigit()'
fi

echo "== factoryDiscovery.ts =="
if fetch "v1 getabi" "$V1?module=contract&action=getabi&address=$VERIFIED" "$TMP/12.json"; then
  assert "v1 getabi" "$TMP/12.json" 'd["status"]=="1" and isinstance(json.loads(d["result"]),list)'
fi

echo "== lpBatchScanner.ts / discoverFactories.ts =="
# getLogs with an ERC-20 Transfer topic over a bounded window
TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
HEAD=$(curl -sS -m 20 -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
  https://rpc.testnet.dogeos.com/ | python3 -c 'import json,sys;print(int(json.load(sys.stdin)["result"],16))')
FROM=$((HEAD - 5000))
if fetch "v1 getLogs(address)" "$V1?module=logs&action=getLogs&address=$TOKEN&topic0=$TOPIC&fromBlock=$FROM&toBlock=$HEAD" "$TMP/13.json"; then
  assert "v1 getLogs(address)" "$TMP/13.json" 'isinstance(d.get("result"),list) and len(d["result"])>0 and "blockNumber" in d["result"][0]'
fi

echo "== userContributions.ts =="
if fetch "v2 smart-contracts" "$V2/smart-contracts/$VERIFIED" "$TMP/14.json"; then
  assert "v2 smart-contracts" "$TMP/14.json" 'bool(d.get("creation_bytecode") or d.get("abi"))'
fi

echo "== tokenSearchService.ts =="
if fetch "v2 search" "$V2/search?q=$SEARCH_Q" "$TMP/15.json"; then
  assert "v2 search" "$TMP/15.json" 'any(i.get("type")=="token" for i in d.get("items",[]))'
fi

echo
echo "passed=$PASS failed=$FAIL"
if [ "$FAIL" -ne 0 ]; then
  printf 'FAILED: %s\n' "${FAILED_NAMES[*]}"
  exit 1
fi
echo "ALL EXPLORER-API CHECKS PASSED (head=$HEAD)"
