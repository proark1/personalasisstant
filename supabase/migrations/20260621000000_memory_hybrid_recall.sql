-- Hybrid semantic recall ranking.
--
-- Before: match_semantic_memories() returned the top-k purely by cosine
-- similarity. A stale, low-value "chat_turn" could outrank a durable
-- milestone just because its wording was a hair closer to the query.
--
-- After: we over-fetch the closest candidates by vector distance (still
-- index-accelerated via HNSW), then re-rank that small pool by a blended
-- score that nudges durable + recent memories up:
--
--   score = similarity                       -- relevance, 0..1, dominant
--         + 0.05 * importance                -- durable facts/milestones
--         + 0.05 * recency_decay             -- exp decay, ~45-day half-ish
--
-- Signature and return columns are UNCHANGED, so this is a drop-in
-- CREATE OR REPLACE — the TS caller (retrieveRelevantMemories) and
-- formatMemoriesForPrompt keep working as-is. `similarity` is still the
-- true cosine value for display; only the ORDER BY changed.

CREATE OR REPLACE FUNCTION public.match_semantic_memories(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_workspace_id UUID DEFAULT NULL,
  p_match_count INT DEFAULT 8,
  p_min_similarity NUMERIC DEFAULT 0.65
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  source_ref TEXT,
  content TEXT,
  metadata JSONB,
  importance NUMERIC,
  created_at TIMESTAMPTZ,
  similarity NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH candidates AS (
    SELECT
      m.id,
      m.source,
      m.source_ref,
      m.content,
      m.metadata,
      m.importance,
      m.created_at,
      1 - (m.embedding <=> p_query_embedding) AS similarity
    FROM public.dori_semantic_memories m
    WHERE m.user_id = p_user_id
      AND m.embedding IS NOT NULL
      AND (
        p_workspace_id IS NULL
          AND m.workspace_id IS NULL
        OR p_workspace_id IS NOT NULL
          AND (m.workspace_id = p_workspace_id OR m.workspace_id IS NULL)
      )
      AND 1 - (m.embedding <=> p_query_embedding) >= p_min_similarity
    ORDER BY m.embedding <=> p_query_embedding
    LIMIT GREATEST(p_match_count * 4, 24)
  )
  SELECT
    c.id, c.source, c.source_ref, c.content, c.metadata, c.importance, c.created_at, c.similarity
  FROM candidates c
  ORDER BY
    c.similarity
      + 0.05 * COALESCE(c.importance, 0.5)
      + 0.05 * exp(-EXTRACT(EPOCH FROM (now() - c.created_at)) / (86400.0 * 45.0))
    DESC
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_semantic_memories(UUID, vector, UUID, INT, NUMERIC) TO authenticated, service_role;
