
-- Extend proactive_settings with meeting briefing options
ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS meeting_briefing_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS meeting_briefing_minutes integer[] DEFAULT '{15,5,1}',
  ADD COLUMN IF NOT EXISTS meeting_followup_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_proactive_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS meeting_prep_enabled boolean DEFAULT true;

-- Track sent meeting reminders to avoid duplicates
CREATE TABLE IF NOT EXISTS public.meeting_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  reminder_type text NOT NULL, -- 'briefing_15', 'briefing_5', 'briefing_1', 'prep', 'followup'
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_meeting_reminders_user ON public.meeting_reminders_sent(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_event ON public.meeting_reminders_sent(event_id);

ALTER TABLE public.meeting_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meeting reminders"
  ON public.meeting_reminders_sent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts meeting reminders"
  ON public.meeting_reminders_sent FOR INSERT
  WITH CHECK (true);
