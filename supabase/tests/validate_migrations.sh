#!/usr/bin/env bash
# ============================================================================
# Dry-run validate every supabase/migrations file against a throwaway local
# Postgres, stubbing only what a real Supabase project provisions out of band
# (the auth/storage schemas, auth.uid()/auth.role(), storage.foldername(), and
# the anon/authenticated/service_role roles -- see stub_supabase.sql). Then run
# assertions.sql: RLS is enabled on every table and the security/correctness
# migrations behave as intended. This is the "standard step" docs/DEPLOYMENT.md
# refers to, made reproducible.
#
# Usage:   supabase/tests/validate_migrations.sh
# Requires a local Postgres (initdb/pg_ctl/psql), version 15+. Nothing is left
# running or on disk afterward; no network access and no Supabase CLI needed.
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MIGRATIONS="$REPO/supabase/migrations"
SEED="$REPO/supabase/seed.sql"
STUB="$HERE/stub_supabase.sql"
ASSERTIONS="$HERE/assertions.sql"
DB="ntitt_validate"
PORT="${PGVALIDATE_PORT:-5433}"

# Locate the Postgres server binaries (initdb/pg_ctl aren't always on PATH even
# when psql is -- e.g. Debian/Ubuntu keep them under /usr/lib/postgresql/<v>/bin).
BIN="$(pg_config --bindir 2>/dev/null || true)"
if [ ! -x "${BIN:-}/initdb" ] && command -v initdb >/dev/null 2>&1; then
  BIN="$(dirname "$(command -v initdb)")"
fi
if [ ! -x "${BIN:-}/initdb" ]; then
  for d in /usr/lib/postgresql/*/bin /usr/pgsql-*/bin; do
    [ -x "$d/initdb" ] && BIN="$d" && break
  done
fi
[ -x "${BIN:-}/initdb" ] || { echo "ERROR: Postgres server binaries (initdb) not found." >&2; exit 2; }

# Postgres refuses to run as root: if we are root, run the server as the
# 'postgres' OS user and stage the cluster where that user can traverse it.
RUNUSER=""
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || { echo "ERROR: running as root but no 'postgres' user to drop to." >&2; exit 2; }
  RUNUSER="postgres"
fi
as_server() { if [ -n "$RUNUSER" ]; then su "$RUNUSER" -c "$1"; else bash -lc "$1"; fi; }

if [ -n "$RUNUSER" ]; then
  WORK="$(su "$RUNUSER" -c 'mktemp -d')"
else
  WORK="$(mktemp -d)"
fi
DATADIR="$WORK/data"; SOCK="$WORK/sock"; LOG="$WORK/server.log"

cleanup() {
  as_server "'$BIN/pg_ctl' -D '$DATADIR' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$DATADIR" "$SOCK"
[ -n "$RUNUSER" ] && chown -R "$RUNUSER" "$WORK"

as_server "'$BIN/initdb' -D '$DATADIR' -U postgres --auth=trust --no-sync" >/dev/null
as_server "'$BIN/pg_ctl' -D '$DATADIR' -l '$LOG' -o '-p $PORT -k \"$SOCK\" -c listen_addresses=\"\"' -w start" >/dev/null

PSQL=( "$BIN/psql" -v ON_ERROR_STOP=1 -X -q -h "$SOCK" -p "$PORT" -U postgres )
"$BIN/createdb" -h "$SOCK" -p "$PORT" -U postgres "$DB"
run() { "${PSQL[@]}" -d "$DB" "$@"; }

echo "Postgres: $(run -tAc 'select version()')"
echo "── applying Supabase stub"
run -f "$STUB" >/dev/null
echo "── applying migrations (fail-fast)"
i=0
for f in "$MIGRATIONS"/*.sql; do
  i=$((i+1)); printf '   [%02d] %s\n' "$i" "$(basename "$f")"
  run -f "$f" >/dev/null
done
echo "── applying seed.sql"
run -f "$SEED" >/dev/null
echo "── running assertions"
run -f "$ASSERTIONS"
echo ""
echo "VALIDATION OK — $i migrations + seed applied cleanly, all assertions passed."
