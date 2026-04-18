
-- School calendar (term dates, holidays, exams, PT meetings)
CREATE TABLE public.family_school_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  reminder_days_before INTEGER DEFAULT 7,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_school_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own school cal select" ON public.family_school_calendar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own school cal insert" ON public.family_school_calendar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own school cal update" ON public.family_school_calendar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own school cal delete" ON public.family_school_calendar FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_school_cal_updated BEFORE UPDATE ON public.family_school_calendar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pickup rota
CREATE TABLE public.family_pickup_rota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  pickup_time TIME,
  dropoff_time TIME,
  responsible_person TEXT,
  responsible_user_id UUID,
  location TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_pickup_rota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rota select" ON public.family_pickup_rota FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rota insert" ON public.family_pickup_rota FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rota update" ON public.family_pickup_rota FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rota delete" ON public.family_pickup_rota FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_rota_updated BEFORE UPDATE ON public.family_pickup_rota FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Classmates & friends
CREATE TABLE public.family_classmates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  relationship_type TEXT DEFAULT 'classmate',
  birthday DATE,
  notes TEXT,
  last_playdate DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_classmates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own classmates select" ON public.family_classmates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own classmates insert" ON public.family_classmates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own classmates update" ON public.family_classmates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own classmates delete" ON public.family_classmates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_classmates_updated BEFORE UPDATE ON public.family_classmates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipment inventory
CREATE TABLE public.family_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  brand TEXT,
  purchase_date DATE,
  condition TEXT DEFAULT 'good',
  needs_replacement BOOLEAN DEFAULT false,
  replacement_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own equipment select" ON public.family_equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own equipment insert" ON public.family_equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own equipment update" ON public.family_equipment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own equipment delete" ON public.family_equipment FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_equipment_updated BEFORE UPDATE ON public.family_equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Homework / weekly subject schedule
CREATE TABLE public.family_homework_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  subject TEXT NOT NULL,
  estimated_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_homework_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own homework select" ON public.family_homework_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own homework insert" ON public.family_homework_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own homework update" ON public.family_homework_schedule FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own homework delete" ON public.family_homework_schedule FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_school_cal_date ON public.family_school_calendar(user_id, start_date);
CREATE INDEX idx_rota_dow ON public.family_pickup_rota(user_id, day_of_week) WHERE is_active = true;
CREATE INDEX idx_classmates_member ON public.family_classmates(family_member_id);
CREATE INDEX idx_equipment_member ON public.family_equipment(family_member_id) WHERE needs_replacement = true;
