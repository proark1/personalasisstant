#!/usr/bin/env bash
# Incremental migration runner for Railway Postgres.
#
# Applies any supabase/migrations/*.sql not yet recorded in
# public.schema_migrations, in filename (timestamp) order. Designed to run on
# every deploy as a Railway one-shot service (see db/Dockerfile + db/railway.json),
# but also runnable by hand:
#
#   DATABASE_URL=postgres://... MIG_DIR=supabase/migrations ./db/migrate.sh
#
# Why a baseline:
#   The Railway DB is provisioned from db/bootstrap (the squash), which already
#   contains every historical migration — and many of those use Supabase-only
#   statements (cron./net./vault./RLS) that error if replayed. So on the FIRST
#   run we record existing files as already-applied WITHOUT executing them, and
#   only run files newer than the baseline from then on.
#
#   Set MIGRATE_BASELINE to the last migration you KNOW is already applied (e.g.
#   the most recent file at the time you add this service). Everything up to and
#   including it is marked applied; anything newer runs. If MIGRATE_BASELINE is
#   unset on a fresh tracking table, we assume the DB matches the whole repo and
#   record all current files as applied (with a loud warning).
#
# Each migration is applied AND recorded in a single transaction, so a crash can
# never leave one half-applied or unrecorded. Write migrations idempotently
# (CREATE ... IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS) so a retry is
# always safe.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
MIG_DIR="${MIG_DIR:-./migrations}"

if ! command -v psql >/dev/null 2>&1; then
  echo "[migrate] error: psql not found on PATH" >&2
  exit 2
fi

# Run a query and return the bare scalar result (tuples-only, unaligned).
scalar() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c "$1"; }

scalar "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);" >/dev/null

shopt -s nullglob
files=("$MIG_DIR"/*.sql)   # bash expands globs in sorted order
if [[ ${#files[@]} -eq 0 ]]; then
  echo "[migrate] no .sql files in $MIG_DIR"; exit 0
fi

applied_count="$(scalar "SELECT count(*) FROM public.schema_migrations;")"

# ---- First-run baseline ----------------------------------------------------
if [[ "$applied_count" == "0" ]]; then
  baseline="${MIGRATE_BASELINE:-}"
  if [[ -n "$baseline" ]]; then
    echo "[migrate] first run — baseline=$baseline (recording files <= baseline as applied)"
    for f in "${files[@]}"; do
      v="$(basename "$f")"
      if [[ "$v" < "$baseline" || "$v" == "$baseline" ]]; then
        scalar "INSERT INTO public.schema_migrations(version) VALUES ('$v') ON CONFLICT DO NOTHING;" >/dev/null
      fi
    done
    # fall through: anything newer than the baseline runs below
  else
    echo "[migrate] WARNING: schema_migrations is empty and MIGRATE_BASELINE is unset."
    echo "[migrate]          Recording ALL current migrations as applied WITHOUT executing them,"
    echo "[migrate]          assuming this DB already matches the repo. If that is wrong, set"
    echo "[migrate]          MIGRATE_BASELINE=<last-applied-file.sql> and redeploy."
    for f in "${files[@]}"; do
      v="$(basename "$f")"
      scalar "INSERT INTO public.schema_migrations(version) VALUES ('$v') ON CONFLICT DO NOTHING;" >/dev/null
    done
    echo "[migrate] baseline recorded — future deploys apply only newer files"
    exit 0
  fi
fi

# ---- Apply pending ---------------------------------------------------------
applied=0
for f in "${files[@]}"; do
  v="$(basename "$f")"
  exists="$(scalar "SELECT 1 FROM public.schema_migrations WHERE version = '$v';")"
  [[ "$exists" == "1" ]] && continue
  echo "[migrate] applying $v"
  # Migration body + its bookkeeping row, applied as one transaction (-1).
  {
    cat "$f"
    printf '\nINSERT INTO public.schema_migrations(version) VALUES (%s);\n' "'$v'"
  } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -q -f -
  applied=$((applied + 1))
done

echo "[migrate] done — applied $applied new migration(s)"
