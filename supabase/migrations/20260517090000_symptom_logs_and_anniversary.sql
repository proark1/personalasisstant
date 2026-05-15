-- Round-3 audit follow-ups.
--
-- 1) symptom_logs: track a single symptom across multiple days so the
--    bot can answer "headache day 3" or "how long has my throat hurt?".
--    Distinct from wellbeing_logs (one row per checkin) — this is a
--    continuous symptom thread keyed by (user, symptom).
--
-- 2) family_members.anniversary_date: mirror of birth_date so the same
--    yearly-event-plus-prep-task chain that powers birthdays works for
--    weddings, work-iversaries, etc.

CREATE TABLE IF NOT EXISTS public.symptom_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  symptom text NOT NULL,
  severity smallint CHECK (severity BETWEEN 1 AND 10),
  notes text,
  -- Day this entry is for. Defaults to today in UTC; the tool handler
  -- can override with the user's local date.
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One row per (user, symptom, day) so re-logging the same symptom
  -- the same day upserts rather than creating duplicates.
  UNIQUE (user_id, symptom, log_date)
);

CREATE INDEX IF NOT EXISTS symptom_logs_user_symptom_idx
  ON public.symptom_logs (user_id, symptom, log_date DESC);

ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own symptom logs"
  ON public.symptom_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS anniversary_date date;

COMMENT ON COLUMN public.family_members.anniversary_date IS
  'Wedding / partnership / work anniversary. Birthdays live on birth_date — this is the other yearly milestone.';

NOTIFY pgrst, 'reload schema';
