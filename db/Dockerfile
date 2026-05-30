# One-shot DB migration runner for Railway Postgres.
#
# Runs on every deploy as a Railway service with restartPolicyType "NEVER"
# (see db/railway.json): it applies any supabase/migrations/*.sql not yet in
# public.schema_migrations, then exits. See db/migrate.sh and db/MIGRATIONS.md.
#
# Build context must be the repo root with dockerfilePath = db/Dockerfile, so
# the COPY of supabase/migrations resolves — mirroring cron/ and edge-runtime/.
FROM alpine:3.20

RUN apk add --no-cache bash postgresql-client

WORKDIR /app
COPY db/migrate.sh /app/migrate.sh
COPY supabase/migrations /app/migrations
RUN chmod +x /app/migrate.sh

ENV MIG_DIR=/app/migrations
CMD ["/app/migrate.sh"]
