-- Content Studio — a daily content-idea engine for creators.
--
-- The user describes who they are and what they talk about (creator_profiles).
-- Each day the AI searches the live web (Gemini + Google Search grounding) and
-- produces a batch of ideas (content_ideas) — roughly half trending-now, half
-- evergreen — each linked to a real source article. Ideas the user likes are
-- expanded into platform-tuned short- and long-form scripts (content_scripts),
-- and scheduled ideas drop a real row into the existing `events` table so they
-- show up in the main calendar and sync to Google/Apple like any other event.
--
--   1. public.creator_profiles  — one row per user (the "brain")
--   2. public.content_ideas     — generated daily ideas (RLS by owner)
--   3. public.content_scripts   — generated scripts per liked idea (RLS by owner)
--
-- The daily generation job is NOT scheduled here: this self-hosted Postgres has
-- no pg_cron (see db/bootstrap/00_extensions.sql). The Railway scheduler
-- (cron/scheduler.mjs) pings `content-ideas-cron` every 15 minutes instead.

-- ============================================================
-- 1. creator_profiles — the creator's persona + preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE,
  persona          text NOT NULL DEFAULT '',                       -- who I am / my story / my angle
  tone             text[] NOT NULL DEFAULT '{}',                   -- voice chips (energetic, no-fluff, ...)
  topics           text[] NOT NULL DEFAULT '{}',                   -- what I want to talk about
  audience         text NOT NULL DEFAULT '',                       -- who I'm talking to
  business_context text NOT NULL DEFAULT '',                       -- what my business does / sells
  default_cta      text NOT NULL DEFAULT '',                       -- preferred call-to-action
  platforms        text[] NOT NULL DEFAULT '{youtube,instagram,tiktok}',
  primary_language text NOT NULL DEFAULT 'en',
  ideas_per_day    int NOT NULL DEFAULT 10 CHECK (ideas_per_day BETWEEN 1 AND 20),
  trending_ratio   numeric NOT NULL DEFAULT 0.5 CHECK (trending_ratio >= 0 AND trending_ratio <= 1),
  enabled          boolean NOT NULL DEFAULT true,
  deliver_at       time NOT NULL DEFAULT '08:00',
  channels         text[] NOT NULL DEFAULT '{push,telegram}',
  last_generated_on date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_profiles_enabled_idx
  ON public.creator_profiles (enabled) WHERE enabled;

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own creator profile" ON public.creator_profiles;
CREATE POLICY "own creator profile" ON public.creator_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. content_ideas — the generated daily ideas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_ideas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  generated_on       date NOT NULL DEFAULT (now()::date),
  kind               text NOT NULL DEFAULT 'current' CHECK (kind IN ('current', 'evergreen')),
  topic              text NOT NULL DEFAULT '',
  headline           text NOT NULL,
  hook               text NOT NULL DEFAULT '',                     -- the angle for THIS creator
  summary            text NOT NULL DEFAULT '',
  source_url         text,
  source_title       text,
  rank               int NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'liked', 'dismissed', 'scheduled')),
  scheduled_for      timestamptz,
  scheduled_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_ideas_user_day_idx
  ON public.content_ideas (user_id, generated_on DESC);
CREATE INDEX IF NOT EXISTS content_ideas_user_status_idx
  ON public.content_ideas (user_id, status);

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own content ideas" ON public.content_ideas;
CREATE POLICY "own content ideas" ON public.content_ideas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. content_scripts — short/long scripts for a liked idea
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_scripts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  idea_id           uuid NOT NULL REFERENCES public.content_ideas(id) ON DELETE CASCADE,
  format            text NOT NULL DEFAULT 'short' CHECK (format IN ('short', 'long')),
  platform          text NOT NULL DEFAULT 'generic',              -- youtube | instagram | tiktok | generic
  title_options     text[] NOT NULL DEFAULT '{}',
  hook              text NOT NULL DEFAULT '',                      -- the 0-3s opener
  script            text NOT NULL DEFAULT '',                      -- the full spoken text
  shot_list         text NOT NULL DEFAULT '',                      -- b-roll / visual plan
  caption           text NOT NULL DEFAULT '',
  hashtags          text[] NOT NULL DEFAULT '{}',
  cta               text NOT NULL DEFAULT '',
  thumbnail_concept text NOT NULL DEFAULT '',                      -- long-form (YouTube) thumbnail idea
  description       text NOT NULL DEFAULT '',                      -- long-form (YouTube) SEO description
  duration_seconds  int,                                           -- target spoken duration
  platform_variants jsonb NOT NULL DEFAULT '[]'::jsonb,            -- per-platform tweaks for short-form
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- One script per (idea, format): regenerating a script upserts in place.
  CONSTRAINT content_scripts_idea_format_unique UNIQUE (idea_id, format)
);

CREATE INDEX IF NOT EXISTS content_scripts_user_idea_idx
  ON public.content_scripts (user_id, idea_id);

ALTER TABLE public.content_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own content scripts" ON public.content_scripts;
CREATE POLICY "own content scripts" ON public.content_scripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
