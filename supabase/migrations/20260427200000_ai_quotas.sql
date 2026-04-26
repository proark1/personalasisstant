-- AI cost ledger + per-user caps.
--
-- Builds on the existing `ai_usage` table (rows logged per AI call
-- with token counts + cost_estimate). Adds:
--
--   1. ai_quotas — per-user monthly cap. Defaults to a sane value
--                  for new users; operator can set per-user overrides.
--   2. ai_usage_monthly — view: per-user, per-calendar-month rollup
--                  of total cost and call count.
--   3. ai_usage_summary — view: per-user current-month rollup with
--                  headroom (cap minus spent), capacity_pct, and a
--                  `over_cap` boolean.
--   4. check_ai_quota() — RPC the edge functions call BEFORE making
--                  expensive AI calls. Returns { allowed, used_cents,
--                  cap_cents, headroom_pct, over_cap }.
--
-- The "current month" is bound by date_trunc('month', now()) so it
-- rolls automatically. Operators can implement per-week or per-day
-- caps later by changing the trunc target.

-- ============================================================
-- 1. ai_quotas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_quotas (
  user_id UUID NOT NULL PRIMARY KEY,
  -- Cap in cents (1/100 of a USD). NULL = use the default.
  monthly_cap_cents INTEGER,
  -- Operator-facing notes — useful for "this is the founders' cap" /
  -- "promotional bump for January" annotations.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default cap for users with no override row. Per ai_usage's existing
-- cost_estimate ($0.075/M input, $0.30/M output for Gemini Flash),
-- $5/month is roughly 60M input tokens — generous for normal use.
COMMENT ON COLUMN public.ai_quotas.monthly_cap_cents IS
  'Per-user monthly AI spend cap in cents. NULL falls back to the default (500 cents = $5).';

ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai quota"
  ON public.ai_quotas FOR SELECT USING (auth.uid() = user_id);

-- No user-level INSERT/UPDATE/DELETE — operators manage via service role.

CREATE TRIGGER update_ai_quotas_updated_at
  BEFORE UPDATE ON public.ai_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. ai_usage_monthly view
-- ============================================================
CREATE OR REPLACE VIEW public.ai_usage_monthly AS
SELECT
  user_id,
  date_trunc('month', created_at)::date AS month,
  COUNT(*) AS calls,
  SUM(prompt_tokens) AS prompt_tokens,
  SUM(completion_tokens) AS completion_tokens,
  SUM(total_tokens) AS total_tokens,
  -- Round to whole cents for display; the underlying cost_estimate
  -- is fractional.
  ROUND((SUM(cost_estimate) * 100)::numeric, 2) AS cost_cents
FROM public.ai_usage
WHERE response_status = 'success'
GROUP BY user_id, date_trunc('month', created_at);

GRANT SELECT ON public.ai_usage_monthly TO authenticated, service_role;

-- ============================================================
-- 3. ai_usage_summary view
-- ============================================================
-- Per-user CURRENT-MONTH rollup with cap headroom. RLS-friendly: uses
-- auth.uid() inside a CTE so the result auto-scopes when read by the
-- owning user.
CREATE OR REPLACE VIEW public.ai_usage_summary AS
WITH this_month AS (
  SELECT
    user_id,
    SUM(cost_estimate) AS spent_dollars,
    SUM(total_tokens) AS tokens,
    COUNT(*) AS calls
  FROM public.ai_usage
  WHERE created_at >= date_trunc('month', CURRENT_DATE)
    AND response_status = 'success'
  GROUP BY user_id
)
SELECT
  COALESCE(t.user_id, q.user_id) AS user_id,
  COALESCE(t.spent_dollars, 0) AS spent_dollars,
  COALESCE(ROUND(t.spent_dollars * 100, 2), 0) AS spent_cents,
  COALESCE(t.tokens, 0) AS tokens,
  COALESCE(t.calls, 0) AS calls,
  -- Default to 500 cents = $5/mo if no override.
  COALESCE(q.monthly_cap_cents, 500) AS cap_cents,
  -- Headroom = cap - spent, never negative.
  GREATEST(
    0,
    COALESCE(q.monthly_cap_cents, 500) - COALESCE(ROUND(t.spent_dollars * 100, 2), 0)
  ) AS headroom_cents,
  -- 0..100. Capped at 100 even when spend exceeds the cap so the
  -- progress bar maxes out.
  LEAST(
    100,
    GREATEST(
      0,
      ROUND((COALESCE(t.spent_dollars * 100, 0) / NULLIF(COALESCE(q.monthly_cap_cents, 500), 0)) * 100)
    )
  ) AS used_pct,
  COALESCE(ROUND(t.spent_dollars * 100, 2), 0) > COALESCE(q.monthly_cap_cents, 500) AS over_cap
FROM this_month t
FULL OUTER JOIN public.ai_quotas q ON q.user_id = t.user_id;

GRANT SELECT ON public.ai_usage_summary TO authenticated, service_role;

-- ============================================================
-- 4. check_ai_quota() RPC
-- ============================================================
-- Cheap pre-flight. Edge functions call this before expensive AI ops
-- and bail with a 429-equivalent if `allowed` is false.
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  used_cents NUMERIC,
  cap_cents INTEGER,
  headroom_cents NUMERIC,
  used_pct INTEGER,
  over_cap BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH this_month AS (
    SELECT COALESCE(SUM(cost_estimate), 0) AS spent
      FROM public.ai_usage
     WHERE user_id = p_user_id
       AND response_status = 'success'
       AND created_at >= date_trunc('month', CURRENT_DATE)
  ),
  cap AS (
    SELECT COALESCE(monthly_cap_cents, 500) AS c
      FROM public.ai_quotas
     WHERE user_id = p_user_id
    UNION ALL SELECT 500 LIMIT 1
  )
  SELECT
    -- Allowed when spent < cap. Hard cut-off — no soft band.
    (ROUND(t.spent * 100, 2) < c.c) AS allowed,
    ROUND(t.spent * 100, 2) AS used_cents,
    c.c::int AS cap_cents,
    GREATEST(0, c.c - ROUND(t.spent * 100, 2)) AS headroom_cents,
    LEAST(100, GREATEST(0,
      ROUND((t.spent * 100 / NULLIF(c.c, 0)) * 100)::int
    )) AS used_pct,
    (ROUND(t.spent * 100, 2) > c.c) AS over_cap
  FROM this_month t, cap c
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_quota(UUID) TO authenticated, service_role;
