-- Refresh PostgREST's schema cache so the dori_create_plan RPC (and any
-- other functions added since the last reload) are reachable through
-- supabase.rpc(...).
--
-- Symptom that prompted this:
--   chat function -> supabase.rpc('dori_create_plan', { ... }) returned
--   "Could not find the function public.dori_create_plan(...) in the
--   schema cache", surfaced in Telegram as
--   "Plan create failed: Could not find the function ...".
--
-- The function itself is defined in 20260426170000_dori_action_plans and
-- granted to authenticated + service_role. PostgREST's in-memory cache
-- just hadn't been told to reload after that migration ran (same root
-- cause as the auto_actions_log.expires_at miss).
--
-- NOTIFY is global; it refreshes every table + function in one shot.

NOTIFY pgrst, 'reload schema';
