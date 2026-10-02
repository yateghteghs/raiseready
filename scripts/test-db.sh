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
  PGOPTIONS="-c client_min_messages=warning" psql "$URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$migration" >/dev/null
done

# Founders re-run supabase/setup.sql on a live database after every update, so
# it must succeed on top of existing data: users in every role and status,
# and rows in the tables later migrations change.
echo "==> Re-running supabase/setup.sql on a database with existing data"
psql "$URL" -X -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('dddddddd-0000-4000-8000-000000000001', 'super@example.com'),
  ('dddddddd-0000-4000-8000-000000000002', 'suspended@example.com');
update public.profiles set role = 'super_admin' where id = 'dddddddd-0000-4000-8000-000000000001';
update public.profiles set role = 'support', status = 'suspended' where id = 'dddddddd-0000-4000-8000-000000000002';
-- A role typed by hand with odd spelling, as if entered while the check was off.
insert into auth.users (id, email) values ('dddddddd-0000-4000-8000-000000000003', 'messy@example.com');
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = ' Admin' where id = 'dddddddd-0000-4000-8000-000000000003';
insert into public.startups (owner_id, name, logo_path)
  values ('dddddddd-0000-4000-8000-000000000001', 'Existing', 'dddddddd-0000-4000-8000-000000000001/logo.png');
insert into public.notifications (title, body) values ('Existing', 'Message');
insert into public.showcase_items (kind, name, permission_confirmed, published) values ('logo', 'Existing', true, true);
insert into public.discount_codes (code, percent_off) values ('EXISTING', 10) on conflict do nothing;
update public.profiles set referral_code = 'EXISTREF' where id = 'dddddddd-0000-4000-8000-000000000001';
update public.referral_settings set friend_percent_off = 15 where id = 1;
SQL
PGOPTIONS="-c client_min_messages=warning" psql "$URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/setup.sql" >/dev/null
role=$(psql "$URL" -X -q -t -A -c "select role from public.profiles where id = 'dddddddd-0000-4000-8000-000000000003'")
pct=$(psql "$URL" -X -q -t -A -c "select friend_percent_off from public.referral_settings where id = 1")
[ "$pct" = "15" ] || { echo "FAIL: re-running setup.sql must keep the referral settings, got '$pct'" >&2; exit 1; }
[ "$role" = "admin" ] || { echo "FAIL: setup.sql should tidy ' Admin' to 'admin', got '$role'" >&2; exit 1; }
psql "$URL" -X -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
delete from public.notifications where title = 'Existing';
delete from public.showcase_items where name = 'Existing';
delete from public.discount_codes where code = 'EXISTING';
update public.referral_settings set friend_percent_off = 10 where id = 1;
delete from auth.users where id in ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000003');
SQL
echo "  ok - setup.sql re-runs cleanly on existing data"

run_tests "$URL"
