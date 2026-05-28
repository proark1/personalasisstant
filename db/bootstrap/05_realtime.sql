-- Realtime setup for self-hosted supabase/realtime on Railway.
--
-- Prerequisites (must be done BEFORE applying this file, since CREATE
-- PUBLICATION requires logical decoding to be available):
--   1. On Railway → Postgres service → Variables, add the following
--      config overrides (Railway's PG image picks these up via the
--      POSTGRES_* / PG* env, but for server-level settings we use
--      ALTER SYSTEM below):
--        max_replication_slots >= 10
--        max_wal_senders       >= 10
--   2. ALTER SYSTEM SET wal_level = 'logical';  -- run once via psql
--      Then RESTART the Postgres service from the Railway UI for the
--      setting to take effect. Verify with: SHOW wal_level;
--
-- The app subscribes to changes on a small set of tables (see
-- src/lib/realtimeCoordinator.ts + the useSharedRealtime call sites).
-- We only add those tables to the publication — adding everything
-- would mean Postgres streams every UPDATE on every table to the
-- realtime service, which is wasted bandwidth.
--
-- If you add a new useSharedRealtime('foo', …) call, remember to
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.foo;

-- Ensure the publication exists and is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Tables the app currently subscribes to (keep in sync with the
-- useSharedRealtime call sites in src/).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'public.dori_action_plans',
    'public.dori_plan_steps',
    'public.meeting_bots',
    'public.schedule_proposals'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname || '.' || tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', t);
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL means UPDATE/DELETE replication frames include
-- the *old* row values, which the realtime client needs to compute
-- diffs and to apply RLS to old values (a user shouldn't see updates
-- to rows they previously had access to but no longer do). Default
-- is just the primary key, which is too thin for RLS-aware realtime.
ALTER TABLE IF EXISTS public.dori_action_plans   REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.dori_plan_steps     REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.meeting_bots        REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.schedule_proposals  REPLICA IDENTITY FULL;
