
-- Drop the overly permissive service role policy (service role bypasses RLS anyway)
DROP POLICY "Service role can manage all emails" ON public.user_emails;
