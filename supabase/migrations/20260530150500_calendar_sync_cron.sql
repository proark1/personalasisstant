-- calendar-sync-all-cron — periodic bidirectional calendar sync.
--
-- Pings the calendar-sync-all edge function every 15 minutes so connected
-- Google/Apple calendars push locally-created events out and pull provider
-- events in without the user pressing "Sync". Uses the same
-- service-role-from-Vault bearer pattern as the other crons (the function
-- rejects anything but the service-role bearer). The operator must have seeded
-- vault.decrypted_secrets:'service_role_key' once (already required by the
-- existing crons).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-sync-all-cron') THEN
    PERFORM cron.unschedule('calendar-sync-all-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'calendar-sync-all-cron',
  '*/15 * * * *',  -- every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/calendar-sync-all',
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
