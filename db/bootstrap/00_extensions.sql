-- Extensions required by the app schema on Railway Postgres.
--
-- Notes on what was DROPPED vs the Supabase environment:
--   * pg_net — Supabase-only HTTP-from-SQL. Replace by calling our own
--     services over HTTP from the application layer (or Railway cron jobs).
--   * supabase_vault — secrets store. Move secrets to Railway environment
--     variables and read them from the application layer.
--   * pg_graphql / pgsodium / pg_stat_statements / pg_cron — not in this
--     baseline. If we later need cron-style scheduling, install pg_cron
--     via Railway's extension manager and reintroduce here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;
