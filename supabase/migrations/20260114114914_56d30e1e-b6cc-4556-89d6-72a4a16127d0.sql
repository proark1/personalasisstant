-- Life Scores table for unified dashboard
CREATE TABLE IF NOT EXISTS public.life_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_score INTEGER NOT NULL DEFAULT 0,
  productivity_score INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0,
  relationships_score INTEGER DEFAULT 0,
  spiritual_score INTEGER DEFAULT 0,
  family_score INTEGER DEFAULT 0,
  focus_minutes INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  habits_logged INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

ALTER TABLE public.life_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own life scores" ON public.life_scores;
DROP POLICY IF EXISTS "Users can insert their own life scores" ON public.life_scores;
DROP POLICY IF EXISTS "Users can update their own life scores" ON public.life_scores;

CREATE POLICY "Users can view their own life scores" ON public.life_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own life scores" ON public.life_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own life scores" ON public.life_scores FOR UPDATE USING (auth.uid() = user_id);

-- Mood Logs table for tracking mood/energy
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mood_score INTEGER NOT NULL,
  energy_score INTEGER NOT NULL,
  context_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mood logs" ON public.mood_logs;
DROP POLICY IF EXISTS "Users can insert their own mood logs" ON public.mood_logs;
DROP POLICY IF EXISTS "Users can delete their own mood logs" ON public.mood_logs;

CREATE POLICY "Users can view their own mood logs" ON public.mood_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mood logs" ON public.mood_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mood logs" ON public.mood_logs FOR DELETE USING (auth.uid() = user_id);

-- Automation Rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  condition_type TEXT,
  condition_config JSONB DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own automation rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Users can insert their own automation rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Users can update their own automation rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Users can delete their own automation rules" ON public.automation_rules;

CREATE POLICY "Users can view their own automation rules" ON public.automation_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own automation rules" ON public.automation_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own automation rules" ON public.automation_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own automation rules" ON public.automation_rules FOR DELETE USING (auth.uid() = user_id);

-- Challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL DEFAULT 'weekly',
  target_value INTEGER NOT NULL DEFAULT 1,
  target_metric TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 100,
  badge_name TEXT,
  start_date DATE,
  end_date DATE,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global challenges" ON public.challenges;
CREATE POLICY "Anyone can view global challenges" ON public.challenges FOR SELECT USING (is_global = true);

-- User Challenges table
CREATE TABLE IF NOT EXISTS public.user_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  current_value INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can join challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can update their challenges" ON public.user_challenges;

CREATE POLICY "Users can view their own challenges" ON public.user_challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can join challenges" ON public.user_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their challenges" ON public.user_challenges FOR UPDATE USING (auth.uid() = user_id);

-- Insert default global challenges if they don't exist
INSERT INTO public.challenges (title, description, challenge_type, target_value, target_metric, xp_reward, badge_name, is_global) 
SELECT 'Focus Champion', 'Complete 5 hours of focused work this week', 'weekly', 300, 'focus_minutes', 250, 'focus_champion', true
WHERE NOT EXISTS (SELECT 1 FROM public.challenges WHERE title = 'Focus Champion');

INSERT INTO public.challenges (title, description, challenge_type, target_value, target_metric, xp_reward, badge_name, is_global)
SELECT 'Habit Master', 'Log all your habits for 7 days straight', 'weekly', 7, 'habit_days', 200, 'habit_master', true
WHERE NOT EXISTS (SELECT 1 FROM public.challenges WHERE title = 'Habit Master');

INSERT INTO public.challenges (title, description, challenge_type, target_value, target_metric, xp_reward, badge_name, is_global)
SELECT 'Task Crusher', 'Complete 20 tasks this week', 'weekly', 20, 'tasks_completed', 150, 'task_crusher', true
WHERE NOT EXISTS (SELECT 1 FROM public.challenges WHERE title = 'Task Crusher');

INSERT INTO public.challenges (title, description, challenge_type, target_value, target_metric, xp_reward, badge_name, is_global)
SELECT 'Early Bird', 'Complete morning check-in 5 days in a row', 'weekly', 5, 'morning_checkins', 100, 'early_bird', true
WHERE NOT EXISTS (SELECT 1 FROM public.challenges WHERE title = 'Early Bird');

INSERT INTO public.challenges (title, description, challenge_type, target_value, target_metric, xp_reward, badge_name, is_global)
SELECT 'Connection Keeper', 'Reach out to 3 contacts this week', 'weekly', 3, 'contact_touches', 150, 'connection_keeper', true
WHERE NOT EXISTS (SELECT 1 FROM public.challenges WHERE title = 'Connection Keeper');

-- Create triggers for updating timestamps (only if they don't exist)
DROP TRIGGER IF EXISTS update_life_scores_updated_at ON public.life_scores;
CREATE TRIGGER update_life_scores_updated_at BEFORE UPDATE ON public.life_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_challenges_updated_at ON public.user_challenges;
CREATE TRIGGER update_user_challenges_updated_at BEFORE UPDATE ON public.user_challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();