-- One-off, Railway-safe creation of the Custom Daily Briefings tables.
--
-- Apply this to the live Railway Postgres after the feature ships, since the
-- source migration (supabase/migrations/20260528120000_briefings.sql) also
-- contains a pg_cron block that does NOT exist on Railway (no pg_cron / pg_net
-- / vault). This file has the cron stripped, is idempotent, and can be run
-- against a database that may already have part of the schema.
--
-- Usage:
--   DATABASE_URL="postgres://USER:PASS@HOST:PORT/DB" \
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f db/migration/apply-briefings.sql
--
-- Scheduling on Railway is NOT handled here: add a Railway cron job that POSTs
-- to /functions/v1/briefing-dispatch-cron every 15 minutes with the service-
-- role bearer (see db/RAILWAY_DB_MIGRATION.md).

-- ============================================================
-- briefings — user-defined briefing configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.briefings (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL DEFAULT 'My Briefing',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  topics        TEXT[] NOT NULL DEFAULT '{}',
  deliver_at    TIME NOT NULL DEFAULT '08:00',
  days_of_week  INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  channels      TEXT[] NOT NULL DEFAULT '{telegram,push}',
  max_items     INT NOT NULL DEFAULT 5,
  last_sent_on  DATE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS briefings_user_id_idx ON public.briefings (user_id);
CREATE INDEX IF NOT EXISTS briefings_enabled_idx ON public.briefings (enabled) WHERE enabled;

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own briefings" ON public.briefings;
CREATE POLICY "Users can view their own briefings"
  ON public.briefings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own briefings" ON public.briefings;
CREATE POLICY "Users can insert their own briefings"
  ON public.briefings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own briefings" ON public.briefings;
CREATE POLICY "Users can update their own briefings"
  ON public.briefings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own briefings" ON public.briefings;
CREATE POLICY "Users can delete their own briefings"
  ON public.briefings FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- briefing_deliveries — delivery history / archive
-- ============================================================
CREATE TABLE IF NOT EXISTS public.briefing_deliveries (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id   UUID REFERENCES public.briefings(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL,
  generated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  content       JSONB NOT NULL DEFAULT '[]'::jsonb,
  channels_sent TEXT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS briefing_deliveries_user_id_idx
  ON public.briefing_deliveries (user_id, generated_at DESC);

ALTER TABLE public.briefing_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own briefing deliveries" ON public.briefing_deliveries;
CREATE POLICY "Users can view their own briefing deliveries"
  ON public.briefing_deliveries FOR SELECT USING (auth.uid() = user_id);

-- Tell PostgREST to refresh its schema cache so /rest/v1/briefings resolves.
NOTIFY pgrst, 'reload schema';
