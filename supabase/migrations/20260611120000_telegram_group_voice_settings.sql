ALTER TABLE public.telegram_group_links
  ADD COLUMN IF NOT EXISTS voice_replies_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_digest_enabled boolean NOT NULL DEFAULT false;
