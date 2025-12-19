-- Create family_members table for tracking all family members
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- 'child', 'spouse', 'parent', 'sibling', 'grandparent', 'grandchild', 'aunt', 'uncle', 'cousin', 'in-law', 'other'
  birth_date DATE,
  avatar_url TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  -- Child-specific fields
  school_name TEXT,
  school_grade TEXT,
  teacher_name TEXT,
  teacher_contact TEXT,
  allergies TEXT[],
  medical_notes TEXT,
  clothing_sizes JSONB DEFAULT '{}'::jsonb, -- {"shirt": "M", "pants": "32", "shoes": "10"}
  -- Activity tracking
  activities JSONB DEFAULT '[]'::jsonb, -- [{"name": "Soccer", "schedule": "Tues 4pm", "location": "Field A"}]
  -- Milestones
  milestones JSONB DEFAULT '[]'::jsonb, -- [{"date": "2024-01-15", "title": "First steps", "notes": "..."}]
  -- Preferences
  preferences JSONB DEFAULT '{}'::jsonb, -- {"favorite_food": "Pizza", "interests": ["dinosaurs", "lego"]}
  -- Living situation
  lives_with_user BOOLEAN DEFAULT true,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own family members"
  ON public.family_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own family members"
  ON public.family_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family members"
  ON public.family_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own family members"
  ON public.family_members FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create household_tasks table for family task coordination
CREATE TABLE public.household_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general', -- 'cleaning', 'cooking', 'shopping', 'childcare', 'maintenance', 'general'
  assigned_to UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  recurrence_rule TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.household_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for household_tasks
CREATE POLICY "Users can view own household tasks"
  ON public.household_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own household tasks"
  ON public.household_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own household tasks"
  ON public.household_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own household tasks"
  ON public.household_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_household_tasks_updated_at
  BEFORE UPDATE ON public.household_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create family_events table for family calendar
CREATE TABLE public.family_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'general', -- 'birthday', 'school', 'medical', 'activity', 'holiday', 'general'
  related_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  is_all_day BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  reminder_before INTEGER, -- minutes
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for family_events
CREATE POLICY "Users can view own family events"
  ON public.family_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own family events"
  ON public.family_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own family events"
  ON public.family_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own family events"
  ON public.family_events FOR DELETE
  USING (auth.uid() = user_id);