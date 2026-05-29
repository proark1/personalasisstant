-- Standard (local) calendar for every user.
--
-- Goal: each user always has a built-in "DarAI Calendar" from the moment their
-- account exists, so the Calendar surface is never empty/orphaned. When they
-- link Google / Outlook / Apple, those connections appear alongside the
-- standard calendar and their events already flow into the same unified
-- `events` table (see calendar-sync / outlook-sync / apple-caldav-sync), so
-- everything shows in one place.
--
-- The standard calendar is represented as an external_calendar_connections row
-- with provider='local' and is_default=true. It is not synced to any external
-- provider; it simply marks the home calendar that local/manual/Dori/Telegram
-- events belong to.

-- 1. Flag column for the built-in calendar.
ALTER TABLE public.external_calendar_connections
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 2. Allow the 'local' provider and auth_type.
ALTER TABLE public.external_calendar_connections
  DROP CONSTRAINT IF EXISTS external_calendar_connections_provider_check;
ALTER TABLE public.external_calendar_connections
  ADD CONSTRAINT external_calendar_connections_provider_check
  CHECK (provider IN ('local', 'google', 'outlook', 'apple', 'ics'));

ALTER TABLE public.external_calendar_connections
  DROP CONSTRAINT IF EXISTS external_calendar_connections_auth_type_check;
ALTER TABLE public.external_calendar_connections
  ADD CONSTRAINT external_calendar_connections_auth_type_check
  CHECK (auth_type IN ('local', 'oauth', 'caldav', 'ics'));

-- 3. At most one default calendar per user.
CREATE UNIQUE INDEX IF NOT EXISTS external_calendar_connections_one_default
  ON public.external_calendar_connections (user_id)
  WHERE is_default;

-- 4. Idempotent helper that ensures a user has their standard calendar.
CREATE OR REPLACE FUNCTION public.ensure_default_calendar(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.external_calendar_connections
    (user_id, provider, auth_type, name, color, sync_enabled, is_default)
  SELECT p_user_id, 'local', 'local', 'DarAI Calendar', '#14b8a6', false, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.external_calendar_connections
    WHERE user_id = p_user_id AND is_default
  );
END;
$$;

-- 5. Backfill every existing user (set-based, single statement).
INSERT INTO public.external_calendar_connections
  (user_id, provider, auth_type, name, color, sync_enabled, is_default)
SELECT p.user_id, 'local', 'local', 'DarAI Calendar', '#14b8a6', false, true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.external_calendar_connections ecc
  WHERE ecc.user_id = p.user_id AND ecc.is_default
);

-- 6. Create the standard calendar for new users at signup (alongside profile).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  PERFORM public.ensure_default_calendar(NEW.id);
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
