# Self-hosted scheduler for DarAI edge functions (Railway).
#
# Replaces Supabase pg_cron, which isn't available on our self-hosted Postgres
# (see db/bootstrap/00_extensions.sql). A tiny zero-dependency Node process
# POSTs to each edge function on its schedule. See cron/README.md for setup.
#
# Build path must be the repo root so this Dockerfile path is cron/Dockerfile,
# mirroring how edge-runtime/Dockerfile is configured.
FROM node:20-alpine

WORKDIR /app
COPY cron/scheduler.mjs ./scheduler.mjs

# Railway injects $PORT; the scheduler reads it for its health server.
EXPOSE 8080
CMD ["node", "scheduler.mjs"]
