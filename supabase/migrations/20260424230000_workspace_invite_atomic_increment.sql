-- Atomic increment + exhaustion guard for workspace invite codes.
-- Using this RPC from workspace-join avoids the read-modify-write race
-- where two users who join simultaneously can both see uses=0 and both
-- succeed past a max_uses=1 cap.

CREATE OR REPLACE FUNCTION public.increment_workspace_invite_uses(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code public.workspace_invite_codes;
  v_claimed boolean;
BEGIN
  -- Row lock for the duration of the transaction so concurrent callers
  -- serialize through here.
  SELECT * INTO v_code FROM public.workspace_invite_codes
   WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_code.revoked_at IS NOT NULL THEN RETURN false; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN RETURN false; END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.uses >= v_code.max_uses THEN RETURN false; END IF;

  UPDATE public.workspace_invite_codes
     SET uses = uses + 1
   WHERE id = p_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_workspace_invite_uses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_workspace_invite_uses(uuid) TO service_role;
