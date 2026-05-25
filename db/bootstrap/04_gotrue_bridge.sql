-- GoTrue bridge — apply AFTER GoTrue has booted once.
--
-- GoTrue creates and owns the `auth` schema (auth.users, auth.identities, …)
-- on first start, so this file canNOT run during the initial 00→03 bootstrap
-- (auth.users doesn't exist yet). Run it once after the GoTrue service is up:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/bootstrap/04_gotrue_bridge.sql
--
-- Two jobs:
--   1. Mirror GoTrue's auth.users.id into the app's public.users — the squash
--      repointed every app-table FK at public.users(id), so a row must exist
--      there for each GoTrue user (id is the JWT `sub`, so auth.uid() lines up).
--   2. Seed a public.profiles row per signup — the on_auth_user_created
--      behaviour the squash stripped (the app reads profiles in 42 places).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(coalesce(NEW.email, ''), '@', 1))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Backfill any GoTrue users that already exist (e.g. created before this ran).
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, email, display_name)
SELECT id, email, split_part(coalesce(email, ''), '@', 1) FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
