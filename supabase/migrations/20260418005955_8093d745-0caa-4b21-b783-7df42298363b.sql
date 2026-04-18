-- Email autopilot opt-in flags on proactive_settings
ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS email_autopilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_autoarchive_categories text[] NOT NULL DEFAULT ARRAY['newsletter','promotion','spam']::text[];

-- Hourly cron to run the email autopilot (every hour at :05)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-autopilot-hourly') THEN
    PERFORM cron.unschedule('email-autopilot-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'email-autopilot-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://femilfmcmqmdbncmgcxh.supabase.co/functions/v1/email-autopilot',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('cron', true, 'at', now())
  );
  $$
);