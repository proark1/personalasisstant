#!/usr/bin/env bash
# Applies the Railway PG schema bootstrap in order:
#   00_extensions.sql  →  01_auth_js.sql  →  02_app_schema.sql
#
# Each individual file is applied inside a single transaction
# (psql -1 + ON_ERROR_STOP=1) so any failure rolls that file back
# cleanly. The three files are still applied as separate transactions,
# so a failure on (e.g.) 02 leaves 00 + 01 committed — re-running
# without first dropping/recreating the public schema will hit
# "already exists" errors because 02_app_schema.sql contains plenty
# of bare CREATE statements (the squash doesn't add IF NOT EXISTS
# universally). Cleanest recovery: drop the database (or the public
# schema) and re-run from a clean slate.
#
# Usage:
#   DATABASE_URL="postgres://USER:PASS@HOST:PORT/DB" \
#     ./db/migration/apply-bootstrap.sh
#
# Requires: psql on PATH (postgresql-client package).
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set" >&2
  echo "       export DATABASE_URL=\"postgres://...railway.app:.../railway\"" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found on PATH" >&2
  echo "       install postgresql-client (apt: postgresql-client / brew: libpq)" >&2
  exit 2
fi

# Resolve paths relative to this script so it works from any CWD.
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP="$ROOT/bootstrap"

for f in 00_extensions.sql 01_auth_js.sql 02_app_schema.sql; do
  path="$BOOTSTRAP/$f"
  if [[ ! -f "$path" ]]; then
    echo "error: missing $path" >&2
    exit 1
  fi
  echo "==> applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -q -f "$path"
done

echo
echo "==> verifying: tables in public.*"
psql "$DATABASE_URL" -tA -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
