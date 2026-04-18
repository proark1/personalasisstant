-- Family Chores
CREATE TABLE public.family_chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'weekly',
  day_of_week INTEGER,
  points INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  last_completed_at TIMESTAMPTZ,
  next_due_date DATE,
  rotation_members UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_chores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family_chores select" ON public.family_chores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own family_chores insert" ON public.family_chores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own family_chores update" ON public.family_chores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own family_chores delete" ON public.family_chores FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_family_chores_updated BEFORE UPDATE ON public.family_chores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Family Chore Completions (log)
CREATE TABLE public.family_chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chore_id UUID NOT NULL REFERENCES public.family_chores(id) ON DELETE CASCADE,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  points_awarded INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_chore_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chore_completions select" ON public.family_chore_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own chore_completions insert" ON public.family_chore_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own chore_completions update" ON public.family_chore_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own chore_completions delete" ON public.family_chore_completions FOR DELETE USING (auth.uid() = user_id);

-- Family Allowance
CREATE TABLE public.family_allowance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'allowance',
  reason TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_allowance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own allowance select" ON public.family_allowance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own allowance insert" ON public.family_allowance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own allowance update" ON public.family_allowance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own allowance delete" ON public.family_allowance FOR DELETE USING (auth.uid() = user_id);

-- Family Meal Preferences
CREATE TABLE public.family_meal_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  loves TEXT[],
  dislikes TEXT[],
  dietary_restrictions TEXT[],
  favorite_meals TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_member_id)
);
ALTER TABLE public.family_meal_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meal_prefs select" ON public.family_meal_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meal_prefs insert" ON public.family_meal_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meal_prefs update" ON public.family_meal_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meal_prefs delete" ON public.family_meal_preferences FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meal_prefs_updated BEFORE UPDATE ON public.family_meal_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Family Sleep Schedule
CREATE TABLE public.family_sleep_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  bedtime TIME,
  wake_time TIME,
  nap_time TIME,
  nap_duration_minutes INTEGER,
  screen_time_limit_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_member_id)
);
ALTER TABLE public.family_sleep_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep_sched select" ON public.family_sleep_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sleep_sched insert" ON public.family_sleep_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sleep_sched update" ON public.family_sleep_schedule FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sleep_sched delete" ON public.family_sleep_schedule FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_sleep_sched_updated BEFORE UPDATE ON public.family_sleep_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_family_chores_user ON public.family_chores(user_id, is_active);
CREATE INDEX idx_chore_completions_chore ON public.family_chore_completions(chore_id, completed_at DESC);
CREATE INDEX idx_allowance_member ON public.family_allowance(family_member_id, entry_date DESC);