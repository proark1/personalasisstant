-- Predictive scheduler.
--
-- Builds on:
--   - tasks (priority, category, due_date)
--   - events (existing calendar slots)
--   - daily_checkins (energy_level, sleep_quality, mood)
--   - dori_task_stats (per-user category × hour-of-day completion stats)
--   - dori_slip_risk (open task → 0..1 risk score)
--
-- One new table + one view:
--   1. schedule_proposals — drafted weeks. blocks[] is JSONB so the
--      shape can evolve without schema churn. status lifecycle:
--        draft → reviewed → accepted | rejected | superseded
--   2. user_energy_profile view — per-user, per-hour-of-day average
--      energy from morning check-ins, with a sample-size column the
--      planner can use to weight confidence.

-- ============================================================
-- 1. schedule_proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedule_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  -- ISO week start (Monday). Plus end_date so non-week ranges work.
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  -- 'draft'   → just generated; user hasn't reviewed.
  -- 'reviewed' → user opened it.
  -- 'accepted' → user accepted some/all blocks (events created).
  -- 'rejected' → user dismissed without accepting any block.
  -- 'superseded' → a newer proposal replaced this one.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'accepted', 'rejected', 'superseded')),
  -- Each block:
  --   { id (uuid), date (YYYY-MM-DD), start_time (ISO), end_time (ISO),
  --     kind: 'deep'|'shallow'|'meeting'|'admin'|'break'|'errand',
  --     title, rationale, task_id?, event_id?, accepted (bool, default null),
  --     applied_event_id (uuid?), priority (high|medium|low) }
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Free-form planner-side notes ("avoided 14:00 because last week
  -- you reported low energy at that hour").
  rationale TEXT,
  -- AI bookkeeping.
  model TEXT,
  generation_ms INTEGER,
  -- Snapshot of the inputs the planner saw, for debugging without
  -- re-running.
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_proposals_user_recent_idx
  ON public.schedule_proposals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS schedule_proposals_user_active_idx
  ON public.schedule_proposals (user_id, range_start DESC)
  WHERE status IN ('draft', 'reviewed', 'accepted');

ALTER TABLE public.schedule_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own schedule proposals"
  ON public.schedule_proposals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own schedule proposals"
  ON public.schedule_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own schedule proposals"
  ON public.schedule_proposals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own schedule proposals"
  ON public.schedule_proposals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_schedule_proposals_updated_at
  BEFORE UPDATE ON public.schedule_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. user_energy_profile view
-- ============================================================
-- Maps each user's morning energy reports onto an approximate
-- hour-of-day curve. Three time bands (morning 07-12, afternoon
-- 12-17, evening 17-22) with the average self-reported level.
-- Sample size is exposed so the planner can fall back to defaults
-- when a user has only checked in a few times.
--
-- We don't yet have hour-stamped energy from HealthKit; this is a
-- best-effort signal until that arrives.
CREATE OR REPLACE VIEW public.user_energy_profile AS
WITH levels AS (
  SELECT
    user_id,
    energy_level,
    -- 1 = low, 2 = medium, 3 = high. Other values get NULL.
    CASE energy_level
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
      ELSE NULL
    END AS energy_score,
    sleep_quality,
    sleep_hours,
    checkin_date
  FROM public.daily_checkins
  WHERE checkin_type = 'morning'
    AND checkin_date >= CURRENT_DATE - INTERVAL '60 days'
)
SELECT
  user_id,
  COUNT(*) FILTER (WHERE energy_score IS NOT NULL) AS sample_size,
  ROUND(AVG(energy_score) FILTER (WHERE energy_score IS NOT NULL)::numeric, 2) AS avg_energy,
  ROUND(AVG(sleep_quality)::numeric, 2) AS avg_sleep_quality,
  ROUND(AVG(sleep_hours)::numeric, 2) AS avg_sleep_hours,
  -- Most common reported level — useful as a tiebreaker.
  MODE() WITHIN GROUP (ORDER BY energy_level)
    FILTER (WHERE energy_level IS NOT NULL) AS modal_energy
FROM levels
GROUP BY user_id;

GRANT SELECT ON public.user_energy_profile TO authenticated, service_role;

COMMENT ON VIEW public.user_energy_profile IS
  'Rolling 60-day morning-energy summary per user. Drives the predictive scheduler — schedule deep work into the user''s typical high-energy bands.';
