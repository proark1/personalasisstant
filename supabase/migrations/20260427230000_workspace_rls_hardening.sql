-- Hardens RLS on tasks/events/notes/projects after the workspace foundation
-- migration (20260424210000). The original workspace INSERT/UPDATE/DELETE
-- policies used `workspace_id IS NULL OR is_workspace_member(workspace_id)`.
-- Postgres RLS combines permissive policies with OR, so the NULL branch made
-- it possible for any authenticated user to INSERT/UPDATE/DELETE rows owned
-- by other users as long as workspace_id was NULL — bypassing the personal
-- `auth.uid() = user_id` policies entirely.
--
-- This migration drops those policies and recreates them so they ONLY grant
-- access for actual workspace rows (workspace_id IS NOT NULL AND member),
-- and additionally pin user_id to the caller. Personal-data access continues
-- to flow through the original `Users can ... own ...` policies unchanged.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tasks', 'events', 'notes', 'projects']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members read %1$s"   ON public.%1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members write %1$s"  ON public.%1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members update %1$s" ON public.%1$s', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members delete %1$s" ON public.%1$s', tbl);
  END LOOP;
END $$;

-- tasks
CREATE POLICY "Workspace members read tasks"   ON public.tasks  FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write tasks"  ON public.tasks  FOR INSERT
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Workspace members update tasks" ON public.tasks  FOR UPDATE
  USING      (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete tasks" ON public.tasks  FOR DELETE
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- events
CREATE POLICY "Workspace members read events"   ON public.events FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write events"  ON public.events FOR INSERT
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Workspace members update events" ON public.events FOR UPDATE
  USING      (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete events" ON public.events FOR DELETE
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- notes
CREATE POLICY "Workspace members read notes"   ON public.notes  FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write notes"  ON public.notes  FOR INSERT
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Workspace members update notes" ON public.notes  FOR UPDATE
  USING      (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete notes" ON public.notes  FOR DELETE
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- projects
CREATE POLICY "Workspace members read projects"   ON public.projects FOR SELECT
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members write projects"  ON public.projects FOR INSERT
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Workspace members update projects" ON public.projects FOR UPDATE
  USING      (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members delete projects" ON public.projects FOR DELETE
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- The workspace UPDATE policies above intentionally let any workspace member
-- edit collaborative rows (that's the whole point of a shared workspace).
-- Without a guard, though, a member could UPDATE another member's row and
-- set user_id = auth.uid(), then claim it as their own personal row through
-- the existing `Users can update own ...` policy. Lock user_id post-insert
-- with a trigger so collaborative editing stays open but ownership transfer
-- is impossible. Service-role calls bypass so server-side enrichers (data
-- migrations, support tooling) can still rewrite ownership when needed.

CREATE OR REPLACE FUNCTION public.lock_owner_user_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION '%.user_id is immutable', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tasks', 'events', 'notes', 'projects']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS lock_owner_user_id_trg ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER lock_owner_user_id_trg BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lock_owner_user_id()',
      tbl
    );
  END LOOP;
END $$;
