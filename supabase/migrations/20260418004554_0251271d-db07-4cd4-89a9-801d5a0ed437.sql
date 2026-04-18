-- Unified cross-channel conversation log
CREATE TABLE public.dori_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'tg_private', 'tg_family', 'voice')),
  channel_ref TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dori_conv_user_time ON public.dori_conversations (user_id, created_at DESC);
CREATE INDEX idx_dori_conv_channel ON public.dori_conversations (user_id, channel, created_at DESC);

ALTER TABLE public.dori_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dori conversations"
  ON public.dori_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dori conversations"
  ON public.dori_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dori conversations"
  ON public.dori_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-learned preferences
CREATE TABLE public.dori_learned_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  times_seen INTEGER NOT NULL DEFAULT 1,
  source TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX idx_dori_prefs_user ON public.dori_learned_preferences (user_id, confidence DESC);

ALTER TABLE public.dori_learned_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dori prefs"
  ON public.dori_learned_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dori prefs"
  ON public.dori_learned_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dori prefs"
  ON public.dori_learned_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own dori prefs"
  ON public.dori_learned_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_dori_prefs_updated_at
  BEFORE UPDATE ON public.dori_learned_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();