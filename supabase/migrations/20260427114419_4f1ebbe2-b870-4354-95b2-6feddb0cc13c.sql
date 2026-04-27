
-- ============ Columns on existing tables ============
ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS onboarding_checklist_dismissed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT;

-- ============ Workspaces ============
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  icon TEXT,
  owner_id UUID NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  display_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_invite_codes ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of a workspace? (security definer, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND role IN ('owner','admin')
  )
$$;

-- workspaces policies
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update workspaces"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Auto-add owner as a member
CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_workspace_owner ON public.workspaces;
CREATE TRIGGER trg_add_workspace_owner
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_as_member();

-- workspace_members policies
CREATE POLICY "Members can view membership of their workspaces"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can add members"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) OR user_id = auth.uid());

CREATE POLICY "Admins can update members"
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can remove members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id) OR user_id = auth.uid());

-- workspace_invite_codes policies
CREATE POLICY "Admins can view invite codes"
  ON public.workspace_invite_codes FOR SELECT TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can create invite codes"
  ON public.workspace_invite_codes FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update invite codes"
  ON public.workspace_invite_codes FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete invite codes"
  ON public.workspace_invite_codes FOR DELETE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ task_comments ============
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their tasks"
  ON public.task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
    OR author_id = auth.uid()
  );

CREATE POLICY "Users can comment on their tasks"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Authors can delete their comments"
  ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);

-- ============ islamic_notification_settings ============
CREATE TABLE IF NOT EXISTS public.islamic_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  events_enabled BOOLEAN NOT NULL DEFAULT true,
  events_hours_before INTEGER NOT NULL DEFAULT 24,
  events_send_time TEXT NOT NULL DEFAULT '08:00',
  daily_hadith_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_hadith_time TEXT NOT NULL DEFAULT '07:00',
  hadith_source_preference TEXT NOT NULL DEFAULT 'mixed',
  prayer_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  prayer_reminder_minutes_before INTEGER NOT NULL DEFAULT 5,
  prayer_reminders_for_all_five BOOLEAN NOT NULL DEFAULT true,
  prayer_reminders_selected TEXT[] NOT NULL DEFAULT ARRAY['Fajr','Dhuhr','Asr','Maghrib','Isha'],
  notification_language TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.islamic_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own islamic notif settings"
  ON public.islamic_notification_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_islamic_notif_settings_updated_at
  BEFORE UPDATE ON public.islamic_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ user_location_settings ============
CREATE TABLE IF NOT EXISTS public.user_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  city TEXT NOT NULL DEFAULT 'Berlin',
  country TEXT NOT NULL DEFAULT 'Germany',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  show_weather BOOLEAN NOT NULL DEFAULT true,
  temperature_unit TEXT NOT NULL DEFAULT 'celsius',
  prayer_calculation_method INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_location_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own location settings"
  ON public.user_location_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_user_location_settings_updated_at
  BEFORE UPDATE ON public.user_location_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ dori_undo_log ============
CREATE TABLE IF NOT EXISTS public.dori_undo_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  undone BOOLEAN NOT NULL DEFAULT false,
  undone_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dori_undo_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own undo log"
  ON public.dori_undo_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert into their own undo log"
  ON public.dori_undo_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own undo log"
  ON public.dori_undo_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dori_undo_log_user_created
  ON public.dori_undo_log(user_id, created_at DESC);
