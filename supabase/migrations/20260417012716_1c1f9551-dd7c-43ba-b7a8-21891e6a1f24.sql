-- DEFUNCT legacy reference. This Supabase Cloud pg_cron job is superseded by the
-- self-hosted scheduler (cron/scheduler.mjs). On Railway it is baseline-skipped
-- (never executed — see db/migrate.sh) and stripped from db/bootstrap (no
-- pg_cron/pg_net). The old project URL and committed anon key have been removed.
SELECT cron.schedule(
  'poll-telegram-updates',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://legacy.invalid/functions/v1/telegram-poll',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer REMOVED_LEGACY_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);