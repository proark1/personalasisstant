-- Family households: multi-member Telegram authorization + shared family calendar.
--
-- Model: the family Telegram group IS the household. We add an explicit,
-- multi-member roster (telegram_group_members) so members can be pre-authorized
-- by @username, and a household_id on events so a single shared event is visible
-- to every member in their own (individual) calendar.
--
-- SELF-HOSTED NOTE: apply this SQL to the Railway Postgres directly (there is no
-- pg-based migration runner). The same DDL is mirrored into db/bootstrap so a
-- fresh bootstrap stays consistent.

-- ============================================================
-- 1. telegram_group_members — the authorized-members roster
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegram_group_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_link_id      uuid NOT NULL REFERENCES public.telegram_group_links(id) ON DELETE CASCADE,
  -- Pre-authorization key. Stored without the leading '@', lower-cased.
  telegram_username  text,
  -- Bound once the member is recognized in the group.
  telegram_user_id   bigint,
  -- The app user this member maps to, when they have an account. NULL = the
  -- member only uses Telegram; their actions are attributed to the household.
  user_id            uuid,
  display_name       text,
  role               text NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  status             text NOT NULL DEFAULT 'invited',  -- 'invited' | 'active'
  invited_at         timestamptz NOT NULL DEFAULT now(),
  joined_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One roster row per username per group, and per telegram user per group.
-- Usernames are always stored lower-cased by the app, so a plain (non-
-- expression) unique index works as a PostgREST on_conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_group_members_uname_uniq
  ON public.telegram_group_members (group_link_id, telegram_username)
  WHERE telegram_username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_group_members_tgid_uniq
  ON public.telegram_group_members (group_link_id, telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_group_members_user_idx
  ON public.telegram_group_members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_group_members_group_idx
  ON public.telegram_group_members (group_link_id);

-- ============================================================
-- 2. events.household_id — shared family calendar scope
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.telegram_group_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS events_household_idx
  ON public.events (household_id) WHERE household_id IS NOT NULL;

-- ============================================================
-- 3. Membership helper (SECURITY DEFINER → bypasses RLS, so the
--    policies below can reference member tables without recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_household_member(p_group uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_group IS NOT NULL AND p_user IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.telegram_group_links gl
      WHERE gl.id = p_group
        AND (gl.owner_user_id = p_user OR gl.partner_user_id = p_user)
    )
    OR EXISTS (
      SELECT 1 FROM public.telegram_group_members m
      WHERE m.group_link_id = p_group
        AND m.user_id = p_user
        AND m.status = 'active'
    )
  );
$$;

-- ============================================================
-- 4. RLS: household events visible/editable to every member
-- ============================================================
ALTER TABLE public.telegram_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their household roster" ON public.telegram_group_members;
CREATE POLICY "Members can view their household roster" ON public.telegram_group_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_household_member(group_link_id, auth.uid())
  );
-- Writes to the roster happen via the service role (telegram-link edge function),
-- which bypasses RLS; no end-user write policy is granted.

DROP POLICY IF EXISTS "Members can view household events" ON public.events;
CREATE POLICY "Members can view household events" ON public.events
  FOR SELECT USING (
    household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can update household events" ON public.events;
CREATE POLICY "Members can update household events" ON public.events
  FOR UPDATE USING (
    household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete household events" ON public.events;
CREATE POLICY "Members can delete household events" ON public.events
  FOR DELETE USING (
    household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid())
  );

-- Seed roster from existing links so current owner/partner couples keep working.
-- Idempotent via NOT EXISTS (roster rows seeded here carry no username/tg-id,
-- so the partial unique indexes don't apply).
INSERT INTO public.telegram_group_members (group_link_id, user_id, role, status, joined_at)
SELECT gl.id, gl.owner_user_id, 'owner', 'active', now()
FROM public.telegram_group_links gl
WHERE gl.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.telegram_group_members m
    WHERE m.group_link_id = gl.id AND m.user_id = gl.owner_user_id
  );

INSERT INTO public.telegram_group_members (group_link_id, user_id, role, status, joined_at)
SELECT gl.id, gl.partner_user_id, 'member', 'active', now()
FROM public.telegram_group_links gl
WHERE gl.partner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.telegram_group_members m
    WHERE m.group_link_id = gl.id AND m.user_id = gl.partner_user_id
  );

NOTIFY pgrst, 'reload schema';
