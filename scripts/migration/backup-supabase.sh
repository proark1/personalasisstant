#!/usr/bin/env bash
# Phase 0 of the Railway/Vercel migration: snapshot the entire Supabase
# project before we touch anything. Every later phase assumes you can
# roll back to this dump, so treat the output of this script as the only
# safety net you have.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres:[PW]@db.<project>.supabase.co:5432/postgres'
#   ./scripts/migration/backup-supabase.sh           # writes to ./backups/<timestamp>/
#   ./scripts/migration/backup-supabase.sh /path     # custom output dir
#
# Get the connection string from:
#   Supabase Studio → Project Settings → Database → Connection string → URI
# Use the "Session" pooler URL (port 5432) — the transaction pooler on
# 6543 doesn't support pg_dump.
#
# What you get in the output directory:
#   public.dump          custom-format dump of the public schema (data + DDL)
#   public.sql           plain SQL of the public schema (grep-able)
#   auth_users.sql       auth.users + auth.identities rows + DDL
#   storage_meta.sql     storage schema DDL + buckets/objects metadata
#                         (does NOT include the actual file bytes — those
#                          live in object storage; download separately)
#   row_counts.txt       SELECT count(*) per public table, for sanity-checking
#                         the restore in Phase 1
#   manifest.txt         timestamp, project ref, pg_dump version, file sizes
#
# All dumps use --no-owner --no-acl so they restore into Railway (which
# uses a different role) without permission errors.

set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: SUPABASE_DB_URL is not set" >&2
  echo "  export SUPABASE_DB_URL='postgresql://postgres:[PW]@db.<ref>.supabase.co:5432/postgres'" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${1:-./backups/${TIMESTAMP}}"
mkdir -p "${OUT_DIR}"

echo "→ backup target: ${OUT_DIR}"
echo "→ pg_dump:       $(pg_dump --version)"

# Fail fast if we can't reach the DB — better than a half-written dump.
echo "→ probing connection..."
psql "${SUPABASE_DB_URL}" -tAc "SELECT current_database(), current_user, version();" \
  | tee "${OUT_DIR}/manifest.txt" > /dev/null
echo "  ok"

# 1. public schema — the actual application data. Custom format (-Fc)
#    so Phase 1 can use pg_restore with --schema/--table filters.
echo "→ dumping public schema (custom format)..."
pg_dump "${SUPABASE_DB_URL}" \
  --no-owner --no-acl \
  --schema=public \
  -Fc \
  -f "${OUT_DIR}/public.dump"

# 2. Same data as plain SQL. Useful for grep, diff, and small-table
#    surgical restores. Big — gzipped to keep the repo-adjacent backups
#    folder manageable.
echo "→ dumping public schema (plain SQL, gzipped)..."
pg_dump "${SUPABASE_DB_URL}" \
  --no-owner --no-acl \
  --schema=public \
  | gzip > "${OUT_DIR}/public.sql.gz"

# 3. auth.users + auth.identities. The rest of the auth schema is
#    Supabase-internal (rate limiting, MFA factors, refresh tokens) and
#    won't restore anywhere useful, so we skip it. Lucia migration in
#    Phase 2 only needs users + their OAuth identity links.
echo "→ dumping auth.users + auth.identities..."
pg_dump "${SUPABASE_DB_URL}" \
  --no-owner --no-acl \
  --schema=auth \
  -t auth.users -t auth.identities \
  > "${OUT_DIR}/auth_users.sql"

# 4. Storage metadata only. The file bytes themselves live in S3-backed
#    buckets — those need to be pulled with the Supabase Storage API or
#    the dashboard. This dump captures bucket config + object rows so
#    we can re-link paths after we re-upload to R2/S3 in Phase 6.
echo "→ dumping storage metadata..."
pg_dump "${SUPABASE_DB_URL}" \
  --no-owner --no-acl \
  --schema=storage \
  > "${OUT_DIR}/storage_meta.sql"

# 5. Per-table row counts. Phase 1 will diff against the restored DB
#    and refuse to proceed if any table comes up short.
echo "→ recording row counts..."
psql "${SUPABASE_DB_URL}" -tA -F $'\t' <<'SQL' > "${OUT_DIR}/row_counts.txt"
SELECT n.nspname || '.' || c.relname AS qualified_name,
       (xpath('/row/cnt/text()',
              query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', n.nspname, c.relname),
                           true, false, '')))[1]::text::bigint AS row_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r'
   AND n.nspname = 'public'
 ORDER BY 1;
SQL

# 6. Append file sizes to the manifest so a casual `cat manifest.txt`
#    tells you whether anything looks suspiciously empty.
{
  echo ""
  echo "files:"
  (cd "${OUT_DIR}" && ls -lh public.dump public.sql.gz auth_users.sql storage_meta.sql row_counts.txt)
  echo ""
  echo "public table count: $(wc -l < "${OUT_DIR}/row_counts.txt")"
  echo "total rows:         $(awk -F'\t' '{s+=$2} END {print s}' "${OUT_DIR}/row_counts.txt")"
} >> "${OUT_DIR}/manifest.txt"

echo ""
echo "✓ backup complete: ${OUT_DIR}"
echo ""
cat "${OUT_DIR}/manifest.txt"
echo ""
echo "next: ./scripts/migration/verify-backup.sh ${OUT_DIR}"
