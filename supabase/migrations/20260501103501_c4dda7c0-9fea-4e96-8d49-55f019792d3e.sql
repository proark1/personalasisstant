-- Period tracking
CREATE TABLE IF NOT EXISTS public.period_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  flow TEXT CHECK (flow IN ('light','medium','heavy')),
  symptoms TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.period_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own period_logs" ON public.period_logs USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_period_logs_user_date ON public.period_logs(user_id, start_date DESC);

-- Fasting logs (Ramadan or general)
CREATE TABLE IF NOT EXISTS public.fasting_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fast_date DATE NOT NULL,
  fast_type TEXT NOT NULL DEFAULT 'ramadan',
  completed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fast_date, fast_type)
);
ALTER TABLE public.fasting_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fasting_logs" ON public.fasting_logs USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Pantry inventory
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT,
  expires_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pantry_items" ON public.pantry_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_pantry_user ON public.pantry_items(user_id);

-- Flight tracking
CREATE TABLE IF NOT EXISTS public.flight_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_event_id UUID,
  flight_number TEXT NOT NULL,
  airline TEXT,
  origin TEXT,
  destination TEXT,
  depart_at TIMESTAMPTZ NOT NULL,
  checkin_reminder_at TIMESTAMPTZ,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flight_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flights" ON public.flight_tracking USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_flights_user_date ON public.flight_tracking(user_id, depart_at);

-- Presence status (visible to space members)
CREATE TABLE IF NOT EXISTS public.presence_status (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'home',
  message TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.presence_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presence" ON public.presence_status USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "space members can view presence" ON public.presence_status FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.space_members sm
    WHERE sm.owner_id = presence_status.user_id
      AND sm.member_id = auth.uid()
      AND sm.status = 'accepted'
  )
);

-- Email snoozed (provider-agnostic)
CREATE TABLE IF NOT EXISTS public.email_snoozed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  external_id TEXT NOT NULL,
  subject TEXT,
  snooze_until TIMESTAMPTZ NOT NULL,
  resurfaced BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_id)
);
ALTER TABLE public.email_snoozed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own email_snoozed" ON public.email_snoozed USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_email_snoozed_due ON public.email_snoozed(user_id, snooze_until) WHERE resurfaced = false;

-- Task enrichments
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimate_minutes INTEGER;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON public.tasks USING GIN(tags);

-- updated_at triggers where needed
CREATE TRIGGER trg_period_logs_updated BEFORE UPDATE ON public.period_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pantry_updated BEFORE UPDATE ON public.pantry_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_flights_updated BEFORE UPDATE ON public.flight_tracking FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_presence_updated BEFORE UPDATE ON public.presence_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();