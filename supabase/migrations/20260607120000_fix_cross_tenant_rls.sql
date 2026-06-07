-- Fix cross-tenant RLS exposure.
--
-- Several tables carried a "service role manages …" policy written as
--   FOR ALL USING (true) WITH CHECK (true)
-- with NO `TO` clause. In Postgres a clause-less policy applies to PUBLIC
-- (every role, including `authenticated`/`anon`), and permissive policies are
-- OR-combined. So each of these silently defeated the per-user / per-member
-- policies on its table: the effective rule became `(<owner check>) OR true`,
-- i.e. any authenticated user could read AND write every row.
--
-- The service role already has BYPASSRLS (see 03_rls_policies.sql), so these
-- policies were never needed for the edge functions — they only opened the
-- hole. Each table keeps its proper per-user / per-member policies; edge
-- functions continue to operate via the service-role key.
--
-- Idempotent (DROP POLICY IF EXISTS), safe to re-run.

-- ── Cross-tenant FOR ALL USING (true) holes ─────────────────────────────────
DROP POLICY IF EXISTS "Service role manages undo rows"      ON public.dori_undo_log;
DROP POLICY IF EXISTS "Service role manages task comments"  ON public.task_comments;
DROP POLICY IF EXISTS "Service role writes documents"       ON public.telegram_documents;
DROP POLICY IF EXISTS "Service role manages workspaces"     ON public.workspaces;
DROP POLICY IF EXISTS "Service role manages membership"     ON public.workspace_members;
DROP POLICY IF EXISTS "Service role manages invite codes"   ON public.workspace_invite_codes;
DROP POLICY IF EXISTS "Service role manages tg links"       ON public.workspace_telegram_links;

-- ── pinned_messages: SELECT was USING (true) ────────────────────────────────
-- Any authenticated user could list every pinned-message reference across all
-- chats. Scope reads to the pinner, group members (group pins), or the two
-- participants of the underlying direct message (direct pins).
DROP POLICY IF EXISTS "pinned_messages_select" ON public.pinned_messages;
CREATE POLICY "pinned_messages_select" ON public.pinned_messages
  FOR SELECT USING (
    pinned_by = auth.uid()
    OR (message_type = 'group' AND public.is_group_member(auth.uid(), chat_id))
    OR (message_type = 'direct' AND EXISTS (
          SELECT 1 FROM public.direct_messages dm
          WHERE dm.id = public.pinned_messages.message_id
            AND (dm.sender_id = auth.uid() OR dm.recipient_id = auth.uid())))
  );
