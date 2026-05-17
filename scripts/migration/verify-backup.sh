#!/usr/bin/env bash
# Restore a backup produced by backup-supabase.sh into a throwaway local
# Postgres, then compare row counts. If this script doesn't pass, the
# dump is not a valid safety net and you should NOT proceed to Phase 1.
#
# Usage:
#   ./scripts/migration/verify-backup.sh ./backups/<timestamp>/
#
# Requires a running Postgres you can create databases in. Defaults to
# a local socket connection as the current user; override with
# VERIFY_DB_URL if you need to point at a remote staging instance.
#
# This is intentionally paranoid — restore failures here are how you
# find out about pg_dump version mismatches, missing extensions, or
# objects that referenced the Supabase-only `auth` schema. Better now
# than during cutover.

set -euo pipefail

BACKUP_DIR="${1:?usage: $0 <backup-dir>}"
if [[ ! -f "${BACKUP_DIR}/public.dump" ]]; then
  echo "error: ${BACKUP_DIR}/public.dump not found" >&2
  exit 1
fi

VERIFY_DB="darai_verify_$(date -u +%Y%m%d%H%M%S)"
VERIFY_URL="${VERIFY_DB_URL:-postgresql:///postgres}"
TARGET_URL="${VERIFY_URL%/*}/${VERIFY_DB}"

echo "→ creating throwaway database: ${VERIFY_DB}"
psql "${VERIFY_URL}" -c "CREATE DATABASE \"${VERIFY_DB}\";" >/dev/null

cleanup() {
  echo "→ dropping ${VERIFY_DB}"
  psql "${VERIFY_URL}" -c "DROP DATABASE IF EXISTS \"${VERIFY_DB}\";" >/dev/null || true
}
trap cleanup EXIT

# The public dump references a handful of extensions that Supabase
# pre-installs. We install the ones the dump definitely needs; anything
# else surfaces as a clear error from pg_restore so we can decide
# whether to add it to Railway in Phase 1.
echo "→ pre-installing extensions..."
psql "${TARGET_URL}" <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL

echo "→ restoring public.dump..."
# --exit-on-error makes pg_restore stop at the first failure instead of
# silently logging dozens of errors and reporting "success". -j 4 just
# parallelises the data load.
pg_restore \
  --no-owner --no-acl \
  --schema=public \
  --exit-on-error \
  -j 4 \
  -d "${TARGET_URL}" \
  "${BACKUP_DIR}/public.dump"

echo "→ comparing row counts..."
DIFFS=$(
  psql "${TARGET_URL}" -tA -F $'\t' <<'SQL'
SELECT n.nspname || '.' || c.relname,
       (xpath('/row/cnt/text()',
              query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', n.nspname, c.relname),
                           true, false, '')))[1]::text::bigint
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r'
   AND n.nspname = 'public'
 ORDER BY 1;
SQL
)

# diff the source and restored row counts; print any mismatches.
MISMATCH=$(diff <(sort "${BACKUP_DIR}/row_counts.txt") <(echo "${DIFFS}" | sort) || true)
if [[ -n "${MISMATCH}" ]]; then
  echo "✗ row count mismatch between source and restore:"
  echo "${MISMATCH}"
  exit 1
fi

TABLES=$(wc -l < "${BACKUP_DIR}/row_counts.txt")
ROWS=$(awk -F'\t' '{s+=$2} END {print s}' "${BACKUP_DIR}/row_counts.txt")
echo ""
echo "✓ verified: ${TABLES} tables, ${ROWS} rows match between source and local restore"
echo "  the dump in ${BACKUP_DIR} is a valid Phase 1 input."
