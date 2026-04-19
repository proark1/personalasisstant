ALTER TABLE public.proactive_settings
ADD COLUMN IF NOT EXISTS email_action_alerts_enabled boolean NOT NULL DEFAULT true;