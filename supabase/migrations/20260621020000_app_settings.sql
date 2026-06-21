-- Global app settings (admin-controlled feature flags).
--
-- First global key/value config table. Used initially for the Telegram
-- token-usage footer toggle, but reusable for any future admin switch.
-- Readable by any authenticated user (flags are non-sensitive); writable
-- only by admins (public.is_admin). Edge functions use the service role,
-- which bypasses RLS for reads.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings readable by authenticated" ON public.app_settings;
CREATE POLICY "app_settings readable by authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- Default: show the token-usage footer on Telegram replies (admin can turn off).
INSERT INTO public.app_settings (key, value)
VALUES ('telegram_token_usage_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
