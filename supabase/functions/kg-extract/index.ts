// On-demand entity extraction.
//
// Two modes:
//   - { source_kind, source_id, text }  → extract entities from `text`,
//     upsert them, and link them to (source_kind, source_id). Used for
//     manual rebuilds and for callers that hold the raw text but didn't
//     write through rememberSemantic() (e.g. note edits).
//   - { backfill: true, source_kind, since? } → re-run extraction over
//     a recent window of an existing source table. Caps at 200 rows
//     per call so it never blows past the 60s edge timeout. Idempotent
//     because kg_link_mention upserts.
//
// All callers must be authenticated; we resolve the user from the
// JWT and never trust a user_id in the body.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractEntities, linkExtraction, type MentionSourceKind } from '../_shared/kg.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_SOURCES: MentionSourceKind[] = [
  'semantic', 'episodic', 'ai_memory', 'task', 'event', 'note', 'contact', 'chat',
];

// Each backfill row triggers a sequential LLM call (~1-3s each) so the
// per-invocation ceiling has to fit comfortably under the 60s edge
// timeout. 20 rows is the sweet spot: it leaves headroom for slow
// gateway responses, and the caller can simply re-invoke to drain a
// larger backfill (the operation is idempotent via kg_link_mention).
const BACKFILL_LIMIT = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));

    // ---- Single-row extraction ----
    if (body.source_kind && body.source_id && typeof body.text === 'string') {
      const sourceKind = body.source_kind as MentionSourceKind;
      if (!ALLOWED_SOURCES.includes(sourceKind)) {
        return json({ error: `unknown source_kind: ${sourceKind}` }, 400);
      }
      const sourceId = String(body.source_id);
      const text = String(body.text || '').slice(0, 4000);
      if (text.length < 12) return json({ entities_linked: 0, reason: 'text too short' });

      const { entities, model } = await extractEntities(text);
      const { linked, entityIds } = await linkExtraction(admin, {
        userId: user.id,
        workspaceId: body.workspace_id ?? null,
        sourceKind,
        sourceId,
        excerpt: text.slice(0, 600),
        entities,
      });
      return json({ entities_linked: linked, entity_ids: entityIds, model });
    }

    // ---- Backfill: re-run extraction over a window ----
    if (body.backfill === true) {
      const sourceKind = (body.source_kind || 'semantic') as MentionSourceKind;
      if (!['semantic', 'episodic', 'ai_memory'].includes(sourceKind)) {
        return json({ error: 'backfill only supports semantic / episodic / ai_memory' }, 400);
      }

      const limit = Math.min(BACKFILL_LIMIT, Math.max(1, Number(body.limit) || BACKFILL_LIMIT));

      let rows: Array<{ id: string; text: string }> = [];
      if (sourceKind === 'semantic') {
        const { data } = await admin
          .from('dori_semantic_memories')
          .select('id, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        rows = (data ?? []).map((r: { id: string; content: string }) => ({ id: r.id, text: r.content }));
      } else if (sourceKind === 'episodic') {
        const { data } = await admin
          .from('episodic_memories')
          .select('id, title, summary')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        rows = (data ?? []).map((r: { id: string; title: string; summary: string }) => ({
          id: r.id,
          text: [r.title, r.summary].filter(Boolean).join(' — '),
        }));
      } else {
        const { data } = await admin
          .from('ai_memory')
          .select('id, key, value, context')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(limit);
        rows = (data ?? []).map((r: { id: string; key: string; value: string; context: string }) => ({
          id: r.id,
          text: [r.key, r.value, r.context].filter(Boolean).join(' — '),
        }));
      }

      let total = 0;
      let processed = 0;
      for (const row of rows) {
        if (!row.text || row.text.length < 12) continue;
        const { entities } = await extractEntities(row.text);
        const { linked } = await linkExtraction(admin, {
          userId: user.id,
          workspaceId: null,
          sourceKind,
          sourceId: row.id,
          excerpt: row.text.slice(0, 600),
          entities,
        });
        total += linked;
        processed += 1;
      }

      return json({ processed, entities_linked: total, source_kind: sourceKind });
    }

    return json({ error: 'unrecognised request shape' }, 400);
  } catch (err) {
    console.error('[kg-extract] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
