-- Workspaces = startup / team spaces. Each user can belong to any number of
-- workspaces, with a role. Existing personal data stays personal by keeping
-- workspace_id NULL. Everything we surface through the assistant can be
-- scoped to the user's active workspace via the same mechanism.
--
-- The existing `family_agent_groups` / `telegram_group_links` tables stay
-- intact so family-mode continues to work unchanged alongside workspaces.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,                              -- optional; lowercased handle for mentions
  description text,
  icon text,                              -- emoji or short code, e.g. "🚀"
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT workspaces_slug_fmt CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9_-]{1,39}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_lower_idx ON public.workspaces (lower(slug)) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  display_name text,                      -- overrides profile name for this workspace
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT workspace_members_role_chk CHECK (role IN ('owner', 'admin', 'member', 'viewer'))
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members (user_id);

-- Invite codes the workspace owner/admin can generate + share. Join-by-code is
-- much easier than setting up email invites end-to-end.
CREATE TABLE IF NOT EXISTS public.workspace_invite_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  max_uses integer,                       -- NULL = unlimited
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invite_codes_role_chk CHECK (role IN ('admin', 'member', 'viewer'))
);

CREATE INDEX IF NOT EXISTS workspace_invite_codes_ws_idx ON public.workspace_invite_codes (workspace_id);

-- Links a Telegram group chat to a workspace, mirroring how family_agent_groups
-- handles households. A chat can only be linked to one workspace at a time.
CREATE TABLE IF NOT EXISTS public.workspace_telegram_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL UNIQUE,
  title text,
  link_code text,
  link_code_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_telegram_links_ws_idx ON public.workspace_telegram_links (workspace_id);

-- ── Add workspace_id / assignee_id to the core collaborative tables. ───────
-- Keeping columns nullable means existing "personal" data continues to work
-- without any backfill.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_workspace_idx     ON public.tasks     (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_assignee_idx      ON public.tasks     (assignee_id)  WHERE assignee_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_workspace_idx    ON public.events    (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_assignee_idx     ON public.events    (assignee_id)  WHERE assignee_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS notes_workspace_idx     ON public.notes     (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_workspace_idx  ON public.projects  (workspace_id) WHERE workspace_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invite_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_telegram_links ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user a member of a workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = ws AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(ws uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM public.workspace_members
   WHERE workspace_id = ws AND user_id = auth.uid()
   LIMIT 1;
$$;

-- workspaces: visible to any member; owner/admin can update; service role does anything.
CREATE POLICY "Members read workspace"         ON public.workspaces FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY "Owner creates workspace"        ON public.workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner admin update workspace"   ON public.workspaces FOR UPDATE USING (public.workspace_role(id) IN ('owner', 'admin'));
CREATE POLICY "Owner delete workspace"         ON public.workspaces FOR DELETE USING (owner_id = auth.uid());
CREATE POLICY "Service role manages workspaces" ON public.workspaces FOR ALL USING (true) WITH CHECK (true);

-- workspace_members: member sees own + other members; owner/admin can invite or remove.
CREATE POLICY "Member reads workspace membership"   ON public.workspace_members FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admin writes workspace membership"   ON public.workspace_members FOR INSERT WITH CHECK (public.workspace_role(workspace_id) IN ('owner', 'admin'));
CREATE POLICY "Admin updates workspace membership"  ON public.workspace_members FOR UPDATE USING (public.workspace_role(workspace_id) IN ('owner', 'admin'));
CREATE POLICY "Admin removes workspace membership"  ON public.workspace_members FOR DELETE USING (public.workspace_role(workspace_id) IN ('owner', 'admin') OR user_id = auth.uid());
CREATE POLICY "Service role manages membership"     ON public.workspace_members FOR ALL USING (true) WITH CHECK (true);

-- invite codes: members can view (to share); admins can create/revoke.
CREATE POLICY "Member reads invite codes"           ON public.workspace_invite_codes FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admin creates invite codes"          ON public.workspace_invite_codes FOR INSERT WITH CHECK (public.workspace_role(workspace_id) IN ('owner', 'admin'));
CREATE POLICY "Admin updates invite codes"          ON public.workspace_invite_codes FOR UPDATE USING (public.workspace_role(workspace_id) IN ('owner', 'admin'));
CREATE POLICY "Service role manages invite codes"   ON public.workspace_invite_codes FOR ALL USING (true) WITH CHECK (true);

-- telegram links
CREATE POLICY "Member reads tg links"               ON public.workspace_telegram_links FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admin writes tg links"               ON public.workspace_telegram_links FOR ALL USING (public.workspace_role(workspace_id) IN ('owner', 'admin')) WITH CHECK (public.workspace_role(workspace_id) IN ('owner', 'admin'));
CREATE POLICY "Service role manages tg links"       ON public.workspace_telegram_links FOR ALL USING (true) WITH CHECK (true);

-- Extend existing RLS: let workspace members see/edit collaborative rows in
-- the workspace. The existing personal-data policies (user_id = auth.uid())
-- stay in place; these new policies ADD access when workspace_id matches.

CREATE POLICY "Workspace members read tasks"        ON public.tasks  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write tasks"       ON public.tasks  FOR INSERT WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members update tasks"      ON public.tasks  FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete tasks"      ON public.tasks  FOR DELETE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members read events"       ON public.events FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write events"      ON public.events FOR INSERT WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members update events"     ON public.events FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete events"     ON public.events FOR DELETE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members read notes"        ON public.notes  FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write notes"       ON public.notes  FOR INSERT WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members update notes"      ON public.notes  FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete notes"      ON public.notes  FOR DELETE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members read projects"     ON public.projects FOR SELECT USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write projects"    ON public.projects FOR INSERT WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members update projects"   ON public.projects FOR UPDATE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete projects"   ON public.projects FOR DELETE USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- Auto-add the creator as owner when a workspace is inserted.
CREATE OR REPLACE FUNCTION public.add_owner_to_new_workspace()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id, now(), now())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_add_owner ON public.workspaces;
CREATE TRIGGER workspaces_add_owner
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_to_new_workspace();

-- updated_at auto-touch on workspaces
CREATE OR REPLACE FUNCTION public.touch_workspace_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS workspaces_touch_updated ON public.workspaces;
CREATE TRIGGER workspaces_touch_updated
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_updated_at();
