-- ============================================
-- PHASE 1: Cross-Domain Intelligence Engine
-- ============================================

-- Life Correlations table - stores detected cross-domain patterns
CREATE TABLE public.life_correlations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  correlation_type TEXT NOT NULL, -- 'health_productivity', 'sleep_mood', 'exercise_focus', etc.
  domain_a TEXT NOT NULL, -- 'health', 'tasks', 'calendar', 'habits', 'finances', 'family'
  domain_b TEXT NOT NULL,
  pattern_description TEXT NOT NULL,
  correlation_strength NUMERIC NOT NULL DEFAULT 0, -- -1 to 1 (negative to positive correlation)
  confidence_score NUMERIC NOT NULL DEFAULT 0, -- 0-100%
  data_points INTEGER NOT NULL DEFAULT 0, -- number of observations
  sample_data JSONB DEFAULT '{}'::jsonb, -- example data points
  insight_text TEXT, -- human-readable insight
  is_dismissed BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Day Predictions table - stores daily productivity forecasts
CREATE TABLE public.day_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prediction_date DATE NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  label TEXT NOT NULL CHECK (label IN ('challenging', 'moderate', 'good', 'excellent')),
  factors JSONB NOT NULL DEFAULT '{"positive": [], "negative": []}'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  insight TEXT,
  weather_data JSONB DEFAULT '{}'::jsonb,
  actual_outcome INTEGER, -- filled at end of day from check-in
  accuracy_score NUMERIC, -- how close prediction was to actual
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, prediction_date)
);

-- ============================================
-- PHASE 2: Auto-Pilot Mode
-- ============================================

-- Auto Actions Log - tracks automated actions taken by AI
CREATE TABLE public.auto_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'reschedule_task', 'create_followup', 'suggest_break', 'create_shopping_list'
  entity_type TEXT, -- 'task', 'event', 'habit', 'contact'
  entity_id UUID,
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_applied')),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- PHASE 3: Weekly AI Coach
-- ============================================

-- Weekly Coach Reports - comprehensive weekly summaries
CREATE TABLE public.weekly_coach_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Performance metrics
  tasks_completed INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  focus_minutes INTEGER DEFAULT 0,
  habits_completed INTEGER DEFAULT 0,
  habits_missed INTEGER DEFAULT 0,
  average_mood NUMERIC,
  average_energy NUMERIC,
  average_sleep NUMERIC,
  
  -- AI-generated content
  summary_text TEXT,
  wins JSONB DEFAULT '[]'::jsonb, -- what went well
  improvements JSONB DEFAULT '[]'::jsonb, -- areas to improve
  recommendations JSONB DEFAULT '[]'::jsonb, -- specific actionable suggestions
  correlations_found JSONB DEFAULT '[]'::jsonb, -- correlations discovered this week
  goal_progress JSONB DEFAULT '{}'::jsonb, -- progress toward goals
  
  -- Scores
  productivity_score INTEGER, -- 1-100
  wellbeing_score INTEGER, -- 1-100
  balance_score INTEGER, -- 1-100
  
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- ============================================
-- PHASE 4: AI Memory System
-- ============================================

-- AI Memory - long-term memory for personalization
CREATE TABLE public.ai_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL, -- 'preference', 'goal', 'fact', 'pattern', 'milestone'
  category TEXT, -- 'work', 'health', 'family', 'personal', 'communication'
  key TEXT NOT NULL, -- e.g., 'preferred_meeting_time', 'coffee_preference'
  value TEXT NOT NULL,
  context TEXT, -- when/how this was learned
  confidence NUMERIC DEFAULT 0.8,
  source TEXT, -- 'chat', 'behavior', 'explicit', 'inferred'
  last_referenced_at TIMESTAMP WITH TIME ZONE,
  reference_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE, -- for time-sensitive memories
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast memory lookups
CREATE INDEX idx_ai_memory_user_type ON public.ai_memory(user_id, memory_type) WHERE is_active = true;
CREATE INDEX idx_ai_memory_user_category ON public.ai_memory(user_id, category) WHERE is_active = true;

-- ============================================
-- Enable RLS on all new tables
-- ============================================

ALTER TABLE public.life_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_coach_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Life Correlations policies
CREATE POLICY "Users can view own correlations" ON public.life_correlations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own correlations" ON public.life_correlations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own correlations" ON public.life_correlations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own correlations" ON public.life_correlations FOR DELETE USING (auth.uid() = user_id);

-- Day Predictions policies
CREATE POLICY "Users can view own predictions" ON public.day_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own predictions" ON public.day_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own predictions" ON public.day_predictions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own predictions" ON public.day_predictions FOR DELETE USING (auth.uid() = user_id);

-- Auto Actions Log policies
CREATE POLICY "Users can view own auto actions" ON public.auto_actions_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own auto actions" ON public.auto_actions_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own auto actions" ON public.auto_actions_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own auto actions" ON public.auto_actions_log FOR DELETE USING (auth.uid() = user_id);

-- Weekly Coach Reports policies
CREATE POLICY "Users can view own reports" ON public.weekly_coach_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reports" ON public.weekly_coach_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON public.weekly_coach_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON public.weekly_coach_reports FOR DELETE USING (auth.uid() = user_id);

-- AI Memory policies
CREATE POLICY "Users can view own memories" ON public.ai_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own memories" ON public.ai_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.ai_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.ai_memory FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX idx_life_correlations_user ON public.life_correlations(user_id) WHERE is_dismissed = false;
CREATE INDEX idx_day_predictions_user_date ON public.day_predictions(user_id, prediction_date);
CREATE INDEX idx_auto_actions_user_status ON public.auto_actions_log(user_id, status);
CREATE INDEX idx_weekly_reports_user_week ON public.weekly_coach_reports(user_id, week_start);

-- ============================================
-- Updated_at trigger for ai_memory
-- ============================================

CREATE TRIGGER update_ai_memory_updated_at
  BEFORE UPDATE ON public.ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();