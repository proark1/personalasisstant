// Apply accepted blocks from a schedule proposal.
//
// Body: { proposal_id: uuid, action: 'accept_blocks'|'reject_all'|'accept_all',
//         block_ids?: string[] }
//
//   accept_blocks: only the ids in block_ids are accepted. Each
//                  becomes an `events` row (with task_id stashed in
//                  description). Already-applied blocks are skipped.
//   accept_all:    accepts every block.
//   reject_all:    marks the whole proposal rejected; no events created.
//
// Block-level accepted/applied_event_id flags are mutated in-place
// inside the proposal's blocks JSONB so the UI can show what was
// actually committed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['accept_blocks', 'accept_all', 'reject_all', 'mark_reviewed'] as const;

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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const proposalId = String(body.proposal_id || '');
    if (!UUID_RE.test(proposalId)) return json({ error: 'invalid proposal_id' }, 400);
    const action = String(body.action || '');
    if (!ACTIONS.includes(action as typeof ACTIONS[number])) return json({ error: 'invalid action' }, 400);
    const blockIds: Set<string> = new Set(
      Array.isArray(body.block_ids) ? body.block_ids.filter((s: unknown) => typeof s === 'string') : [],
    );

    const { data: prop, error: pErr } = await admin
      .from('schedule_proposals')
      .select('*')
      .eq('id', proposalId)
      .eq('user_id', user.id)
      .single();
    if (pErr || !prop) return json({ error: 'proposal not found' }, 404);
    if (['rejected', 'superseded'].includes(prop.status)) {
      return json({ error: `cannot mutate ${prop.status} proposal` }, 409);
    }

    if (action === 'mark_reviewed') {
      await admin.from('schedule_proposals')
        .update({ status: 'reviewed' })
        .eq('id', proposalId)
        .eq('status', 'draft');
      return json({ ok: true, status: 'reviewed' });
    }

    if (action === 'reject_all') {
      await admin.from('schedule_proposals').update({ status: 'rejected' }).eq('id', proposalId);
      return json({ ok: true, status: 'rejected' });
    }

    // accept_blocks / accept_all
    const blocks = Array.isArray(prop.blocks) ? [...(prop.blocks as any[])] : [];
    const targetIds = action === 'accept_all'
      ? new Set(blocks.map((b: any) => b.id))
      : blockIds;

    let applied = 0;
    const errors: string[] = [];

    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (!b || !targetIds.has(b.id)) continue;
      // Already applied — skip.
      if (b.applied_event_id) continue;

      const startIso = typeof b.start_time === 'string' ? b.start_time : null;
      const endIso = typeof b.end_time === 'string' ? b.end_time : null;
      if (!startIso || !endIso) {
        errors.push(`block ${b.id}: missing times`);
        continue;
      }
      const description = [
        b.rationale ? `${b.rationale}` : null,
        b.task_id ? `\n\nLinked task: ${b.task_id}` : null,
        `\n\n_From schedule proposal ${prop.id}, kind=${b.kind}_`,
      ].filter(Boolean).join('');
      try {
        const { data: ev, error: insErr } = await admin.from('events').insert({
          user_id: user.id,
          title: String(b.title || 'Block').slice(0, 200),
          description,
          start_time: startIso,
          end_time: endIso,
        }).select('id').single();
        if (insErr || !ev) {
          errors.push(`block ${b.id}: ${insErr?.message || 'insert failed'}`);
          blocks[i] = { ...b, accepted: false };
          continue;
        }
        blocks[i] = { ...b, accepted: true, applied_event_id: ev.id };
        applied += 1;
      } catch (e) {
        errors.push(`block ${b.id}: ${(e as Error).message}`);
      }
    }

    // Mark blocks the user explicitly NOT in targetIds as rejected
    // (only when the user did accept_all-vs-explicit-list).
    if (action === 'accept_blocks') {
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i];
        if (!b) continue;
        if (b.applied_event_id) continue;          // already kept
        if (!targetIds.has(b.id) && b.accepted == null) {
          blocks[i] = { ...b, accepted: false };
        }
      }
    }

    const newStatus = applied > 0 ? 'accepted' : prop.status;
    await admin.from('schedule_proposals')
      .update({ blocks, status: newStatus })
      .eq('id', proposalId);

    return json({
      ok: true,
      applied,
      total: blocks.length,
      errors,
      status: newStatus,
    });
  } catch (err) {
    console.error('[apply-schedule] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
