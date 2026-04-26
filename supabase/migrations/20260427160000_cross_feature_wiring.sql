-- Cross-feature wiring.
--
-- Two existing-feature pairs that needed glue:
--
--   1. Subscription audit ↔ cancellation drafter:
--      The contracts table didn't track cancellation state, so the
--      "still charging" half of subscription_audit had no way to flip
--      true. Adds cancellation_drafts (audit log of every drafted
--      cancellation email), cancellation_requested_at (user clicked
--      "cancel"), and cancelled_at (user confirmed they sent it).
--
--   2. Trip → pack task:
--      The trip-prep flow needs a sentinel so the cron / on-demand
--      job is idempotent (won't duplicate the "Pack for X" task on
--      re-runs). Adds trips.prep_run_at + a generic metadata JSONB.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS cancellation_drafts JSONB
    NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Help the subscription_audit "ghost vs. still-charging" sort.
CREATE INDEX IF NOT EXISTS contracts_cancellation_pending_idx
  ON public.contracts (user_id, cancellation_requested_at DESC)
  WHERE cancellation_requested_at IS NOT NULL AND cancelled_at IS NULL;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS prep_run_at TIMESTAMPTZ;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS metadata JSONB
    NOT NULL DEFAULT '{}'::jsonb;
