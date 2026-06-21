-- Nightly memory consolidation / decay.
--
-- The memory system wrote constantly but never cleaned up: ai_memory had an
-- expires_at column nothing enforced, byte-identical semantic rows piled up,
-- and low-value chat-turn memories grew without bound — all of which dull
-- recall precision over time.
--
-- Three idempotent, cascade-correct SQL passes (no LLM needed) plus a cron
-- that runs them nightly. Each deletes the matching kg_mentions alongside the
-- semantic rows so the knowledge graph's co-occurrence counts stay honest
-- (same cascade forget_memory_target does, but in bulk).
--
-- NOTE: LLM-based cluster summarization ("roll 10 similar memories into one
-- higher-level fact") is intentionally NOT here — that's a riskier,
-- separate step. This migration only does safe hygiene.

-- 1. Enforce ai_memory.expires_at (soft-deactivate; reversible).
CREATE OR REPLACE FUNCTION public.dori_enforce_memory_expiry()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
  UPDATE public.ai_memory
     SET is_active = false, updated_at = now()
   WHERE is_active = true
     AND expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. Collapse byte-identical semantic memories, keeping the most important /
--    newest copy. Cascades kg_mentions for the rows it removes.
CREATE OR REPLACE FUNCTION public.dori_prune_duplicate_memories(p_limit INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
  WITH ranked AS (
    SELECT id, user_id,
           row_number() OVER (
             PARTITION BY user_id, md5(content)
             ORDER BY importance DESC, created_at DESC
           ) AS rn
      FROM public.dori_semantic_memories
  ),
  dupes AS (
    SELECT id, user_id FROM ranked WHERE rn > 1 LIMIT p_limit
  ),
  del_mentions AS (
    DELETE FROM public.kg_mentions km
     USING dupes d
     WHERE km.user_id = d.user_id
       AND km.source_kind = 'semantic'
       AND km.source_id = d.id::text
    RETURNING km.id
  ),
  del_mem AS (
    DELETE FROM public.dori_semantic_memories m
     USING dupes d
     WHERE m.id = d.id
    RETURNING m.id
  )
  SELECT count(*) INTO v_count FROM del_mem;
  RETURN v_count;
END;
$$;

-- 3. Decay: drop old, low-value chat-turn memories so recall isn't drowned
--    in stale small-talk. Durable facts (notes, milestones, high importance)
--    are untouched. Cascades kg_mentions.
CREATE OR REPLACE FUNCTION public.dori_decay_chat_memories(
  p_max_age_days INT DEFAULT 90,
  p_min_importance NUMERIC DEFAULT 0.35,
  p_limit INT DEFAULT 1000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
  WITH old AS (
    SELECT id, user_id
      FROM public.dori_semantic_memories
     WHERE source = 'chat_turn'
       AND importance < p_min_importance
       AND created_at < now() - (p_max_age_days || ' days')::interval
     ORDER BY created_at ASC
     LIMIT p_limit
  ),
  del_mentions AS (
    DELETE FROM public.kg_mentions km
     USING old o
     WHERE km.user_id = o.user_id
       AND km.source_kind = 'semantic'
       AND km.source_id = o.id::text
    RETURNING km.id
  ),
  del_mem AS (
    DELETE FROM public.dori_semantic_memories m
     USING old o
     WHERE m.id = o.id
    RETURNING m.id
  )
  SELECT count(*) INTO v_count FROM del_mem;
  RETURN v_count;
END;
$$;

-- Wrapper that runs all three and returns a summary (also handy to call
-- manually for verification).
CREATE OR REPLACE FUNCTION public.dori_run_memory_consolidation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired INT;
  v_deduped INT;
  v_decayed INT;
BEGIN
  v_expired := public.dori_enforce_memory_expiry();
  v_deduped := public.dori_prune_duplicate_memories(500);
  v_decayed := public.dori_decay_chat_memories(90, 0.35, 1000);
  RETURN jsonb_build_object(
    'expired', v_expired,
    'deduped', v_deduped,
    'decayed', v_decayed,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dori_run_memory_consolidation() TO service_role;

-- Nightly at 03:30 UTC. Runs SQL directly — no edge function / HTTP needed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'memory-consolidation-cron') THEN
    PERFORM cron.unschedule('memory-consolidation-cron');
  END IF;
END $$;

SELECT cron.schedule(
  'memory-consolidation-cron',
  '30 3 * * *',
  $$ SELECT public.dori_run_memory_consolidation(); $$
);
