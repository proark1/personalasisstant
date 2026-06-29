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
#   unset on a fresh tracking table, we fail instead of guessing. Operators can
#   set MIGRATE_ASSUME_BOOTSTRAP_CURRENT=true only when they have separately
#   verified that the live DB already matches the current repo bootstrap.
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

# Run a statement and return the bare scalar/rows (tuples-only, unaligned).
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

# Cache the set of already-applied versions in ONE query, so the per-file check
# below is an in-memory lookup rather than a psql round-trip each.
declare -A APPLIED=()
while IFS= read -r ver; do
  [[ -n "$ver" ]] && APPLIED["$ver"]=1
done < <(scalar "SELECT version FROM public.schema_migrations;")

# Batch-insert a newline-free list of versions as applied (one round-trip) and
# mark them in the cache. Usage: mark_applied "v1" "v2" ...
mark_applied() {
  (( $# )) || return 0
  local vals="" v
  for v in "$@"; do vals+="('$v'),"; APPLIED["$v"]=1; done
  scalar "INSERT INTO public.schema_migrations(version) VALUES ${vals%,} ON CONFLICT DO NOTHING;" >/dev/null
}

# ---- First-run baseline ----------------------------------------------------
if [[ ${#APPLIED[@]} -eq 0 ]]; then
  baseline="${MIGRATE_BASELINE:-}"
  if [[ -n "$baseline" ]]; then
    echo "[migrate] first run — baseline=$baseline (recording files <= baseline as applied)"
    seed=()
    for f in "${files[@]}"; do
      v="$(basename "$f")"
      if [[ "$v" < "$baseline" || "$v" == "$baseline" ]]; then seed+=("$v"); fi
    done
    mark_applied "${seed[@]}"
    # fall through: anything newer than the baseline runs below
  else
    if [[ "${MIGRATE_ASSUME_BOOTSTRAP_CURRENT:-}" != "true" ]]; then
      echo "[migrate] ERROR: schema_migrations is empty and MIGRATE_BASELINE is unset." >&2
      echo "[migrate]        Refusing to mark migrations as applied without an explicit baseline." >&2
      echo "[migrate]        Set MIGRATE_BASELINE=<last-applied-file.sql> for first deploy," >&2
      echo "[migrate]        or MIGRATE_ASSUME_BOOTSTRAP_CURRENT=true only after verifying" >&2
      echo "[migrate]        the live DB already matches this repo bootstrap." >&2
      exit 3
    fi

    echo "[migrate] MIGRATE_ASSUME_BOOTSTRAP_CURRENT=true — recording all current migrations as applied"
    seed=()
    for f in "${files[@]}"; do seed+=("$(basename "$f")"); done
    mark_applied "${seed[@]}"
    echo "[migrate] baseline recorded — future deploys apply only newer files"
    exit 0
  fi
fi

# ---- Apply pending ---------------------------------------------------------
applied=0
for f in "${files[@]}"; do
  v="$(basename "$f")"
  [[ -n "${APPLIED[$v]:-}" ]] && continue
  echo "[migrate] applying $v"
  # Migration body + its bookkeeping row, applied as one transaction (-1).
  {
    cat "$f"
    printf '\nINSERT INTO public.schema_migrations(version) VALUES (%s);\n' "'$v'"
  } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -q -f -
  APPLIED["$v"]=1
  applied=$((applied + 1))
done

echo "[migrate] done — applied $applied new migration(s)"
