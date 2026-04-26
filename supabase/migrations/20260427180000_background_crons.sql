-- Background cron jobs for the new feature surfaces.
--
-- Three pg_cron entries that ping their respective edge functions:
--   1. plaid-sync-cron               — every hour at :15
--   2. meeting-bot-reconciler-cron   — every 30 minutes
--   3. trip-prep-cron                — daily at 09:00 UTC
--
-- All three use the same service-role-from-Vault auth pattern as the
-- existing crons (workspace-recap-cron, telegram-poll). The bearer
-- comes from vault.decrypted_secrets:'service_role_key' — operator
-- must seed it once.
--
-- Hardcoded URL matches the rest of the cron migrations. A cross-
-- cutting fix that reads the project URL from Vault should change
-- all crons together — out of scope here.

-- ============================================================
-- 1. plaid-sync-cron — hourly
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'plaid-sync-cron') THEN
    PERFORM cron.unschedule('plaid-sync-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'plaid-sync-cron',
  '15 * * * *',  -- :15 of every hour
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/plaid-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 2. meeting-bot-reconciler-cron — every 30 min
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meeting-bot-reconciler-cron') THEN
    PERFORM cron.unschedule('meeting-bot-reconciler-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'meeting-bot-reconciler-cron',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/meeting-bot-reconciler-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- 3. trip-prep-cron — daily 09:00 UTC
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trip-prep-cron') THEN
    PERFORM cron.unschedule('trip-prep-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'trip-prep-cron',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/trip-prep-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
