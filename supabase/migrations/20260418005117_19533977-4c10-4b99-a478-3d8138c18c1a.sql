
-- Track proactive messages sent so we don't double-send
CREATE TABLE IF NOT EXISTS public.dori_proactive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'tg_private',
  channel_ref TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dori_proactive_log_user_trigger
  ON public.dori_proactive_log(user_id, trigger_type, trigger_key);
CREATE INDEX IF NOT EXISTS idx_dori_proactive_log_sent
  ON public.dori_proactive_log(sent_at DESC);

ALTER TABLE public.dori_proactive_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own proactive log"
  ON public.dori_proactive_log FOR SELECT
  USING (auth.uid() = user_id);

-- Add voice-reply preference + timezone to proactive_settings
ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS prefer_voice_replies BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin',
  ADD COLUMN IF NOT EXISTS stale_contact_days INTEGER DEFAULT 60;
