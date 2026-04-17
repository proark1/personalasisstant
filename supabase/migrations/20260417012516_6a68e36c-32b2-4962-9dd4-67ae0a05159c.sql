
-- Link table: connects a Lovable user to a Telegram chat
CREATE TABLE public.telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  chat_id bigint UNIQUE,
  telegram_username text,
  telegram_first_name text,
  link_code text UNIQUE,
  link_code_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_links_chat_id ON public.telegram_links(chat_id);
CREATE INDEX idx_telegram_links_link_code ON public.telegram_links(link_code);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own telegram link"
  ON public.telegram_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own telegram link"
  ON public.telegram_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own telegram link"
  ON public.telegram_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own telegram link"
  ON public.telegram_links FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_links_updated_at
  BEFORE UPDATE ON public.telegram_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Polling state singleton
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
-- No policies = service role only

-- Incoming messages buffer
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages(processed) WHERE processed = false;

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
-- No policies = service role only
