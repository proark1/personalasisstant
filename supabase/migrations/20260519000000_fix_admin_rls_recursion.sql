-- Fix infinite recursion in admin_users RLS.
--
-- The original policies (added in 20251219094734_*.sql) query
-- public.admin_users from within an admin_users policy:
--
--   USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
--
-- That triggers the same policy on the inner SELECT, recursing forever.
-- Postgres aborts the query with:
--   "infinite recursion detected in policy for relation 'admin_users'"
-- and the same error bubbles up on every table whose policy also reads
-- admin_users directly (analytics_events, ai_usage). The admin panel
-- can't load any of its three core tables until this is unwound.
--
-- The fix routes the membership check through SECURITY DEFINER helpers
-- (`is_admin`, new `is_superadmin`). Both run with the function owner's
-- privileges and skip RLS on the lookup, so the policies no longer
-- recurse into themselves.

CREATE OR REPLACE FUNCTION public.is_superadmin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id AND role = 'superadmin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated, service_role;

-- analytics_events
DROP POLICY IF EXISTS "Admins can view all analytics events" ON public.analytics_events;
CREATE POLICY "Admins can view all analytics events"
ON public.analytics_events FOR SELECT
USING (public.is_admin(auth.uid()));

-- ai_usage
DROP POLICY IF EXISTS "Admins can view all ai usage" ON public.ai_usage;
CREATE POLICY "Admins can view all ai usage"
ON public.ai_usage FOR SELECT
USING (public.is_admin(auth.uid()));

-- admin_users itself — both of these self-referenced the table.
DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
CREATE POLICY "Admins can view admin users"
ON public.admin_users FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;
CREATE POLICY "Admins can manage admin users"
ON public.admin_users FOR ALL
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Refresh PostgREST's schema cache. Also picks up any earlier migration
-- (dori_active_plans view, schedule_proposals table, …) that the cache
-- never reloaded for — the dashboard was reporting "Could not find the
-- table in the schema cache" for both even though the objects exist.
NOTIFY pgrst, 'reload schema';
