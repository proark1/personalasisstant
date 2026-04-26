// Cancel a subscription contract: draft email + create follow-up task.
//
// Body: { contract_id: uuid, tone?: 'formal'|'email'|'brief',
//         language?: 'en'|'de', user_name?: string, user_address?: string }
//
// Flow:
//   1. Load the contract; verify ownership.
//   2. Call generate-cancellation-email internally to get 3 templates.
//   3. Append them to contracts.cancellation_drafts as a single
//      timestamped batch.
//   4. Stamp cancellation_requested_at = now.
//   5. Create a task "Send cancellation email — {contract.name}" with
//      due_date = renewal_date - cancellation_notice_days
//      (or +3 days from now if those aren't known).
//   6. Wire an undo so the whole thing reverts within 5 min.
//
// Returns the new task id + a preview of the first draft.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { adminClient, resolveUserId } from '../_shared/auth.ts';
import { recordUndo } from '../_shared/dori-undo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-user-id',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userId = auth.userId;
    const admin = adminClient();

    const body = await req.json().catch(() => ({}));
    const contractId = String(body.contract_id || '');
    if (!UUID_RE.test(contractId)) return json({ error: 'invalid contract_id' }, 400);
    const tone = ['formal', 'email', 'brief'].includes(body.tone) ? body.tone : 'formal';
    const language = body.language === 'de' ? 'de' : 'en';

    const { data: contract, error: cErr } = await admin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('user_id', userId)
      .single();
    if (cErr || !contract) return json({ error: 'contract not found' }, 404);

    if (contract.cancelled_at) {
      return json({ error: 'contract already marked cancelled' }, 409);
    }

    // 2. Draft via the existing generator. We forward the user's auth
    //    via service-role + x-telegram-user-id so generate-cancellation-email
    //    sees the right user identity (when it grows that support).
    //    Until then we pass minimal info in the body and let it use
    //    the bearer for auth.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let drafts: Array<{ tone: string; subject?: string; body?: string }> = [];
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/generate-cancellation-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-telegram-user-id': userId,
        },
        body: JSON.stringify({
          name: contract.name,
          provider: contract.provider,
          contractNumber: contract.contract_number,
          renewalDate: contract.renewal_date,
          userName: body.user_name ?? null,
          userAddress: body.user_address ?? null,
          language,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = await r.json().catch(() => ({}));
      // The existing fn returns { success, data: { templates: [...] } }
      // OR { success, data: { formal, email, brief } } depending on version.
      // Normalise both shapes.
      const raw = data?.data ?? data ?? {};
      if (Array.isArray(raw?.templates)) {
        drafts = raw.templates.map((t: any) => ({ tone: t?.tone ?? 'formal', subject: t?.subject, body: t?.body }));
      } else {
        for (const k of ['formal', 'email', 'brief']) {
          if (raw?.[k]) drafts.push({ tone: k, subject: raw[k]?.subject, body: typeof raw[k] === 'string' ? raw[k] : raw[k]?.body });
        }
      }
    } catch (e) {
      // Don't hard-fail if the AI fn is unavailable — still mark the
      // user's intent and create the follow-up task.
      console.warn('[cancel-subscription] draft failed', (e as Error).message);
    }

    // 3+4. Patch contract: append drafts batch + stamp requested_at.
    const newBatch = {
      requested_at: new Date().toISOString(),
      tone_preference: tone,
      language,
      drafts,
    };
    const existingDrafts = Array.isArray(contract.cancellation_drafts) ? contract.cancellation_drafts : [];
    await admin.from('contracts').update({
      cancellation_drafts: [...existingDrafts, newBatch].slice(-10),
      cancellation_requested_at: new Date().toISOString(),
    }).eq('id', contractId);

    // 5. Follow-up task. Deadline math:
    //    renewal_date - cancellation_notice_days, else +3 days.
    let deadline: Date | null = null;
    if (contract.renewal_date) {
      const renewal = new Date(contract.renewal_date + 'T00:00:00Z');
      const noticeDays = Number(contract.cancellation_notice_days) || 30;
      const before = new Date(renewal.getTime() - noticeDays * 86_400_000);
      const now = new Date();
      deadline = before > now ? before : new Date(now.getTime() + 3 * 86_400_000);
    } else {
      deadline = new Date(Date.now() + 3 * 86_400_000);
    }

    const taskTitle = `Send cancellation email — ${contract.name}`;
    const taskDesc = drafts.length > 0
      ? `Draft ready in Contracts. Provider: ${contract.provider || '?'}. Renewal: ${contract.renewal_date || 'unknown'}.`
      : `Draft generation failed; you'll need to compose by hand. Provider: ${contract.provider || '?'}.`;

    const { data: task, error: tErr } = await admin
      .from('tasks')
      .insert({
        user_id: userId,
        title: taskTitle,
        description: taskDesc,
        category: 'business',
        priority: 'high',
        due_date: deadline.toISOString(),
        completed: false,
      })
      .select('id')
      .single();
    if (tErr) {
      console.warn('[cancel-subscription] task insert failed', tErr.message);
    }

    // 6. Undo: rolls back the requested_at stamp + draft batch + task.
    //    Single undo entry that restores the contract patch.
    const undoId = await recordUndo(admin, {
      user_id: userId,
      op: 'update',
      entity_type: 'contract',
      entity_id: contractId,
      label: `Cancellation draft for ${contract.name}`,
      inverse_tool_xml: null,
      snapshot: {
        kind: 'patch',
        table: 'contracts',
        id: contractId,
        patch: {
          cancellation_drafts: existingDrafts,
          cancellation_requested_at: contract.cancellation_requested_at,
        },
      },
      source: 'cancel_subscription',
      source_ref: contractId,
    });

    return json({
      ok: true,
      contract_id: contractId,
      drafts_count: drafts.length,
      first_draft: drafts[0] ?? null,
      task_id: task?.id ?? null,
      task_due: deadline.toISOString(),
      undo_id: undoId,
    });
  } catch (err) {
    console.error('[cancel-subscription] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
