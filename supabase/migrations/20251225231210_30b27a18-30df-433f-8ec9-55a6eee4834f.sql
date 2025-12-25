-- Expand daily_checkins with new wellness tracking fields
ALTER TABLE public.daily_checkins 
ADD COLUMN IF NOT EXISTS stress_level integer,
ADD COLUMN IF NOT EXISTS focus_quality integer,
ADD COLUMN IF NOT EXISTS social_interactions integer,
ADD COLUMN IF NOT EXISTS medication_taken boolean,
ADD COLUMN IF NOT EXISTS exercise_minutes integer,
ADD COLUMN IF NOT EXISTS caffeine_intake integer,
ADD COLUMN IF NOT EXISTS alcohol_units integer,
ADD COLUMN IF NOT EXISTS screen_time_minutes integer,
ADD COLUMN IF NOT EXISTS water_glasses integer,
ADD COLUMN IF NOT EXISTS gratitude_note text;

-- Add constraints for valid ranges
ALTER TABLE public.daily_checkins
ADD CONSTRAINT stress_level_range CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
ADD CONSTRAINT focus_quality_range CHECK (focus_quality IS NULL OR (focus_quality >= 1 AND focus_quality <= 10)),
ADD CONSTRAINT social_interactions_range CHECK (social_interactions IS NULL OR (social_interactions >= 0));

-- Create user_patterns table for AI-detected patterns
CREATE TABLE IF NOT EXISTS public.user_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pattern_type text NOT NULL DEFAULT 'correlation',
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text NOT NULL,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  data_points jsonb DEFAULT '[]'::jsonb,
  correlation_strength numeric,
  variables text[] DEFAULT '{}',
  times_detected integer DEFAULT 1,
  first_detected_at timestamp with time zone NOT NULL DEFAULT now(),
  last_detected_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add constraints
ALTER TABLE public.user_patterns
ADD CONSTRAINT pattern_type_check CHECK (pattern_type IN ('correlation', 'trend', 'anomaly', 'prediction')),
ADD CONSTRAINT category_check CHECK (category IN ('sleep', 'productivity', 'mood', 'health', 'exercise', 'general')),
ADD CONSTRAINT confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1);

-- Enable RLS
ALTER TABLE public.user_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_patterns
CREATE POLICY "Users can view own patterns" ON public.user_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own patterns" ON public.user_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns" ON public.user_patterns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns" ON public.user_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Create external_calendar_connections table for calendar integrations
CREATE TABLE IF NOT EXISTS public.external_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  name text NOT NULL,
  calendar_id text,
  sync_enabled boolean DEFAULT true,
  last_synced_at timestamp with time zone,
  sync_token text,
  color text DEFAULT '#3b82f6',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own calendar connections" ON public.external_calendar_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar connections" ON public.external_calendar_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connections" ON public.external_calendar_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connections" ON public.external_calendar_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Create weekly_summaries table for pre-computed weekly stats
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  tasks_completed integer DEFAULT 0,
  tasks_created integer DEFAULT 0,
  focus_minutes integer DEFAULT 0,
  habits_completed integer DEFAULT 0,
  habits_possible integer DEFAULT 0,
  avg_mood numeric,
  avg_energy numeric,
  avg_sleep_hours numeric,
  avg_sleep_quality numeric,
  avg_stress_level numeric,
  avg_focus_quality numeric,
  exercise_minutes integer DEFAULT 0,
  patterns_detected jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own weekly summaries" ON public.weekly_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own weekly summaries" ON public.weekly_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly summaries" ON public.weekly_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly summaries" ON public.weekly_summaries
  FOR DELETE USING (auth.uid() = user_id);