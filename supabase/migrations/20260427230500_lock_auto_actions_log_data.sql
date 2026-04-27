-- The dori-execute-action edge function re-runs `action_data.tool_xml` from
-- auto_actions_log with the chat function's approval gate disabled. Users
-- have UPDATE rights on their own auto_actions_log rows (see migration
-- 20251226224801), which means a user could rewrite tool_xml between AI
-- generation and clicking Approve, then have the executor run the modified
-- tool unchecked. The "approve immutable proposal" UX contract was not
-- enforced at the data layer.
--
-- This trigger pins the immutable fields of an auto_actions_log row at
-- creation. Status, decision timestamps, and execution_result merged onto
-- action_data are still allowed to change; the original AI-generated body
-- (action_data.tool_xml plus action_type / function_name) is locked. The
-- service role bypasses row-level security but for clarity also bypasses
-- this trigger so server-side enrichers can rewrite the row freely.

CREATE OR REPLACE FUNCTION public.lock_auto_action_proposal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Service-role connections (cron, edge functions running with the service
  -- key) skip the lock. Authenticated end-user updates are constrained.
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- The proposal body is fixed at insert.
  IF NEW.action_type   IS DISTINCT FROM OLD.action_type   THEN
    RAISE EXCEPTION 'auto_actions_log.action_type is immutable';
  END IF;
  IF (NEW.action_data -> 'tool_xml') IS DISTINCT FROM (OLD.action_data -> 'tool_xml') THEN
    RAISE EXCEPTION 'auto_actions_log.action_data.tool_xml is immutable';
  END IF;
  IF (NEW.action_data -> 'function_name') IS DISTINCT FROM (OLD.action_data -> 'function_name') THEN
    RAISE EXCEPTION 'auto_actions_log.action_data.function_name is immutable';
  END IF;
  IF (NEW.action_data -> 'arguments') IS DISTINCT FROM (OLD.action_data -> 'arguments') THEN
    RAISE EXCEPTION 'auto_actions_log.action_data.arguments is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_auto_action_proposal_trg ON public.auto_actions_log;
CREATE TRIGGER lock_auto_action_proposal_trg
  BEFORE UPDATE ON public.auto_actions_log
  FOR EACH ROW EXECUTE FUNCTION public.lock_auto_action_proposal();
