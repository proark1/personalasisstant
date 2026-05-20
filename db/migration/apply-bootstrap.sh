#!/usr/bin/env bash
# Applies the Railway PG schema bootstrap in order:
#   00_extensions.sql  →  01_auth_js.sql  →  02_app_schema.sql
#
# Each file is idempotent on its own (CREATE ... IF NOT EXISTS), and the
# whole script aborts on the first error via -e + ON_ERROR_STOP=1 so a
# failure leaves the DB in the last good state instead of half-applied.
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
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$path"
done

echo
echo "==> verifying: tables in public.*"
psql "$DATABASE_URL" -tA -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
