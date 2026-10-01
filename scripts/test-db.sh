#!/usr/bin/env bash
# Applies the migrations and runs the SQL test suite in supabase/tests.
#
# Two modes:
#   * DATABASE_URL set   -> run the tests against that database, which must
#                           already have the migrations applied (e.g. a local
#                           Supabase stack after `supabase db reset`).
#   * DATABASE_URL unset -> start a throwaway Postgres cluster, load a minimal
#                           Supabase shim + every migration, run the tests,
#                           then delete the cluster. Needs initdb/pg_ctl/psql.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
TESTS_DIR="$ROOT/supabase/tests"

run_tests() {
  local url="$1"
  local status=0
  for test_file in "$TESTS_DIR"/*.test.sql; do
    echo "==> $(basename "$test_file")"
    psql "$url" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$test_file" 2>&1 \
      | sed -e 's/^psql:[^ ]*: NOTICE:  /  /' -e 's/^NOTICE:  /  /' || status=1
    [ "${PIPESTATUS[0]}" -eq 0 ] || status=1
  done
  return "$status"
}

if [ -n "${DATABASE_URL:-}" ]; then
  run_tests "$DATABASE_URL"
  exit $?
fi

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}"
if [ ! -x "$PG_BIN/initdb" ]; then
  echo "initdb not found. Install PostgreSQL or set PG_BIN / DATABASE_URL." >&2
  exit 1
fi

# Postgres refuses to run as root; drop to the postgres user when needed.
as_pg() {
  if [ "$(id -u)" -eq 0 ]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

WORK_DIR="$(mktemp -d)"
chmod 755 "$WORK_DIR"
[ "$(id -u)" -eq 0 ] && chown postgres "$WORK_DIR"
PG_DATA="$WORK_DIR/data"
PORT="${PG_TEST_PORT:-54329}"

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

as_pg "$PG_BIN/initdb" -D "$PG_DATA" -U postgres -A trust >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$WORK_DIR/postgres.log" -w \
  -o "-p $PORT -k $WORK_DIR -c listen_addresses=''" start >/dev/null

URL="postgresql://postgres@/postgres?host=$WORK_DIR&port=$PORT"

echo "==> Loading Supabase shim"
psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$TESTS_DIR/support/supabase-shim.sql" >/dev/null

for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "==> Applying $(basename "$migration")"
  psql "$URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$migration" >/dev/null
done

run_tests "$URL"
