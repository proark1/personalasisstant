-- Family agent groups
CREATE TABLE public.family_agent_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  telegram_chat_id BIGINT,
  shared_calendar_enabled BOOLEAN DEFAULT true,
  shared_tasks_enabled BOOLEAN DEFAULT true,
  shared_shopping_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.family_agent_groups ENABLE ROW LEVEL SECURITY;

-- Family agent members
CREATE TABLE public.family_agent_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.family_agent_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_family_agent_members_user ON public.family_agent_members(user_id);
ALTER TABLE public.family_agent_members ENABLE ROW LEVEL SECURITY;

-- Helper to check membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_family_agent_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_agent_members
    WHERE user_id = _user_id AND group_id = _group_id AND status = 'accepted'
  )
$$;

-- Group policies
CREATE POLICY "Owner can manage group" ON public.family_agent_groups
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Members can view group" ON public.family_agent_groups
  FOR SELECT USING (public.is_family_agent_member(auth.uid(), id));

-- Member policies
CREATE POLICY "Owner can manage members" ON public.family_agent_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.family_agent_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.family_agent_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );
CREATE POLICY "Members can view fellow members" ON public.family_agent_members
  FOR SELECT USING (public.is_family_agent_member(auth.uid(), group_id) OR user_id = auth.uid());
CREATE POLICY "Member can accept own invite" ON public.family_agent_members
  FOR UPDATE USING (user_id = auth.uid());

-- Mental load log
CREATE TABLE public.mental_load_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.family_agent_groups(id) ON DELETE CASCADE,
  handled_by UUID NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT,
  source_ref TEXT,
  weight INTEGER DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mental_load_group_date ON public.mental_load_log(group_id, occurred_at DESC);
ALTER TABLE public.mental_load_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view group load" ON public.mental_load_log
  FOR SELECT USING (public.is_family_agent_member(auth.uid(), group_id));
CREATE POLICY "Members log own entries" ON public.mental_load_log
  FOR INSERT WITH CHECK (handled_by = auth.uid() AND public.is_family_agent_member(auth.uid(), group_id));
CREATE POLICY "Owner can edit load entries" ON public.mental_load_log
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.family_agent_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );
CREATE POLICY "Owner can delete load entries" ON public.mental_load_log
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.family_agent_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- Morning thread items
CREATE TABLE public.morning_thread_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  thread_date DATE NOT NULL,
  item_type TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 100,
  title TEXT NOT NULL,
  body TEXT,
  action_label TEXT,
  action_payload JSONB,
  source_ref TEXT,
  pushed_to_telegram BOOLEAN DEFAULT false,
  pushed_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_morning_thread_user_date ON public.morning_thread_items(user_id, thread_date DESC, rank);
ALTER TABLE public.morning_thread_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own thread" ON public.morning_thread_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own thread" ON public.morning_thread_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own thread" ON public.morning_thread_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own thread" ON public.morning_thread_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_family_agent_groups_updated_at
  BEFORE UPDATE ON public.family_agent_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();