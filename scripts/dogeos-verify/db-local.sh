#!/usr/bin/env bash
# Fork-local Postgres for the DogeOS port — lifecycle + env exec helper.
#
#   bash scripts/dogeos-verify/db-local.sh up       # start the fork cluster (port 55432)
#   bash scripts/dogeos-verify/db-local.sh down     # stop it
#   bash scripts/dogeos-verify/db-local.sh status   # is it up, and which database am I on?
#   bash scripts/dogeos-verify/db-local.sh exec <cmd...>   # run cmd with DATABASE_URL from .env.local
#
# This cluster is intentionally NOT a brew service: a disposable dev database
# should not auto-start at login. It lives outside the repo so no data directory
# can ever be committed.
#
# Isolation contract: this database (`dogechain_bubblemaps_dogeos`) is the only
# one the fork may use. The upstream production Neon project is never contacted.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
DATA="${FORK_PG_DATA:-$HOME/.local-pg/dogechain-bubblemaps-dogeos}"
LOG="${FORK_PG_LOG:-$HOME/.local-pg/dogechain-bubblemaps-dogeos.log}"
PORT="${FORK_PG_PORT:-55432}"
DBNAME="dogechain_bubblemaps_dogeos"

export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export LANG="${LANG:-en_US.UTF-8}"
export PATH="$PG_BIN:$PATH"

[ -x "$PG_BIN/pg_ctl" ] || { echo "postgresql@17 not installed: brew install postgresql@17" >&2; exit 1; }

is_up() { pg_isready -h 127.0.0.1 -p "$PORT" -q >/dev/null 2>&1; }

case "${1:-status}" in
  up)
    if is_up; then echo "already up on 127.0.0.1:$PORT"; else
      pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$LOG" -w start
    fi
    ;;
  down)
    if is_up; then pg_ctl -D "$DATA" -m fast -w stop; else echo "already down"; fi
    ;;
  status)
    if is_up; then
      echo "postgres  : up on 127.0.0.1:$PORT (data: $DATA)"
      PGPASSWORD="$(python3 -c "
import urllib.parse,sys
v=''
for l in open('$REPO_ROOT/.env.local'):
    s=l.strip()
    if s.startswith('DATABASE_URL='): v=s.split('=',1)[1]
u=urllib.parse.urlparse(v)
print(u.password or '',end='')")" \
        psql -h 127.0.0.1 -p "$PORT" -U dogechain_app -d "$DBNAME" -tAc \
        "SELECT 'database  : '||current_database()||' as '||current_user||' on '||inet_server_addr()||':'||inet_server_port();" \
        2>/dev/null || echo "database  : up, but .env.local credentials do not authenticate"
    else
      echo "postgres  : DOWN (start with: bash scripts/dogeos-verify/db-local.sh up)"
    fi
    ;;
  exec)
    shift
    [ $# -gt 0 ] || { echo "usage: db-local.sh exec <command...>" >&2; exit 2; }
    export DATABASE_URL="$(python3 -c "
for l in open('$REPO_ROOT/.env.local'):
    s=l.strip()
    if s.startswith('DATABASE_URL='): print(s.split('=',1)[1],end='')")"
    [ -n "$DATABASE_URL" ] || { echo "DATABASE_URL missing from .env.local" >&2; exit 1; }
    exec "$@"
    ;;
  *)
    echo "usage: db-local.sh {up|down|status|exec <cmd...>}" >&2
    exit 2
    ;;
esac
