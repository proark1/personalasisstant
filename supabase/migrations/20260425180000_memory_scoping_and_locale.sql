-- Chunk C of the second top-10 arc: Gmail send + per-workspace memory + locale.
--
-- 1) ai_memory.workspace_id: today memory is per-user only, so work and
--    personal facts pollute each other. When a user has an active
--    workspace, new memories land in it and loadDoriIntelligence
--    filters the intelligence block by scope.
-- 2) profiles.locale: optional IANA-like tag ('en-US', 'de', 'fr-FR', …)
--    so the chat function can inject a "respond in {locale}" hint into
--    the system prompt and the TG TTS voice can pick a matching voice
--    code. Null = let Dori auto-detect.

ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_memory_workspace_idx
  ON public.ai_memory (user_id, workspace_id);

COMMENT ON COLUMN public.ai_memory.workspace_id IS
  'When set, the memory is scoped to this workspace. NULL = personal. The chat function filters intelligence by the active scope.';

-- Uniqueness has to include scope, otherwise a workspace memory with the
-- same key as a personal one would overwrite it via upsert. A partial
-- unique index on (user_id, key) WHERE workspace_id IS NULL and another
-- on (user_id, key, workspace_id) WHERE NOT NULL would work, but
-- PostgREST's on_conflict needs one column set it can point at, so we
-- use a STORED generated column that folds NULL into a sentinel uuid.
ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS workspace_scope uuid
  GENERATED ALWAYS AS (COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_user_key_scope_uidx
  ON public.ai_memory (user_id, key, workspace_scope);

COMMENT ON COLUMN public.ai_memory.workspace_scope IS
  'Generated column: folds NULL workspace_id into a sentinel uuid so a single unique index covers both personal and workspace scopes.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text;

COMMENT ON COLUMN public.profiles.locale IS
  'IANA-like locale tag (e.g. "en-US", "de", "fr-FR"). NULL lets Dori auto-detect from the user''s messages.';
