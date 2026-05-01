ALTER TABLE public.telegram_group_links
  ADD COLUMN IF NOT EXISTS morning_digest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS morning_digest_hour smallint NOT NULL DEFAULT 7
    CHECK (morning_digest_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS morning_digest_last_sent_on date;