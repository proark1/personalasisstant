// Plan executor.
//
// One endpoint, four actions:
//   - execute_next  → run the next pending step. Returns the step result
//                     and the new plan state. Does NOT auto-advance to
//                     step N+1; the user has to click again.
//   - skip          → mark current step skipped, advance.
//   - abort         → cancel the whole plan (also marks remaining steps).
//   - pause         → flip plan status to 'paused' (resumable later).
//   - resume        → flip from 'paused' back to 'awaiting_confirm'.
//
// Step execution model:
//   A step has either a `tool_hint` (pre-baked tool_xml) or just a
//   `description` (natural-language goal). Either way we POST to
//   `/functions/v1/chat` with executeServerSide + skipApprovalGate.
//   When tool_hint is present we pass it as `preformedToolText`; when
//   only description is present we send it as a single user message
//   and let the agent loop pick the right tool.
//
// Auth: standard end-user JWT. We resolve user.id from the token and
// scope every read/write to that user via RLS.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-user-id',
};

type PlanAction = 'execute_next' | 'skip' | 'abort' | 'pause' | 'resume';
const ALLOWED_ACTIONS: PlanAction[] = ['execute_next', 'skip', 'abort', 'pause', 'resume'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Resolve user. End-user JWT is the common path; Telegram service
    // role + x-telegram-user-id mirrors the dori-execute-action pattern
    // so the inline-keyboard surface can drive plans too.
    let userId: string | null = null;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const tgUserId = req.headers.get('x-telegram-user-id');
    if (token === serviceKey && tgUserId) {
      userId = tgUserId;
    } else {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action as PlanAction;
    const planId = String(body.plan_id || '');

    if (!ALLOWED_ACTIONS.includes(action)) return json({ error: 'invalid action' }, 400);
    if (!planId || !UUID_RE.test(planId)) return json({ error: 'invalid plan_id' }, 400);

    // Load plan + verify ownership.
    const { data: plan, error: planErr } = await admin
      .from('dori_action_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single();
    if (planErr || !plan) return json({ error: 'plan not found' }, 404);

    if (action === 'abort') {
      const { data: cnt } = await admin.rpc('dori_cancel_plan', {
        p_user_id: userId,
        p_plan_id: planId,
        p_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      });
      return json({ ok: true, action, steps_changed: Number(cnt) || 0 });
    }

    if (action === 'pause') {
      if (!['awaiting_confirm', 'running'].includes(plan.status)) {
        return json({ error: `cannot pause plan in status ${plan.status}` }, 400);
      }
      await admin.from('dori_action_plans')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', planId);
      return json({ ok: true, action, status: 'paused' });
    }

    if (action === 'resume') {
      if (plan.status !== 'paused') {
        return json({ error: `cannot resume plan in status ${plan.status}` }, 400);
      }
      await admin.from('dori_action_plans')
        .update({ status: 'awaiting_confirm', updated_at: new Date().toISOString() })
        .eq('id', planId);
      return json({ ok: true, action, status: 'awaiting_confirm' });
    }

    if (action === 'skip') {
      const { data: result } = await admin.rpc('dori_skip_current_step', {
        p_user_id: userId,
        p_plan_id: planId,
        p_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
      });
      return json({ ok: true, action, result });
    }

    // ----- execute_next -----
    if (!['awaiting_confirm', 'running'].includes(plan.status)) {
      return json({ error: `plan not executable (status: ${plan.status})` }, 400);
    }

    // Load the current step. We re-query rather than trust plan.current_step_idx
    // so a concurrent advance doesn't double-execute.
    const { data: step } = await admin
      .from('dori_plan_steps')
      .select('*')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .in('status', ['pending', 'awaiting_confirm'])
      .order('idx', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!step) {
      // Nothing left to do — sync the plan to 'completed' and return.
      await admin.from('dori_action_plans')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_step_idx: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .neq('status', 'completed');
      return json({ ok: true, action, plan_status: 'completed', step: null });
    }

    // Mark step running + plan running. Use the previous status as a
    // crude lock — if another execute_next races us we'll lose the
    // update and return.
    const { data: claim } = await admin
      .from('dori_plan_steps')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', step.id)
      .in('status', ['pending', 'awaiting_confirm'])
      .select('id')
      .maybeSingle();
    if (!claim) {
      return json({ error: 'step is already running' }, 409);
    }

    await admin.from('dori_action_plans')
      .update({
        status: 'running',
        current_step_idx: step.idx,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    // Dispatch via the chat function. Two paths:
    //   1. tool_hint present → preformedToolText path (no agent round-trip).
    //   2. description only  → single-message agent invocation.
    let execOk = false;
    let execSummary = '';
    let execError: string | null = null;
    let toolResults: unknown = null;

    try {
      const chatUrl = `${supabaseUrl}/functions/v1/chat`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userId,
      };
      const payload = step.tool_hint
        ? {
          executeServerSide: true,
          skipApprovalGate: true,
          preformedToolText: step.tool_hint,
          messages: [],
        }
        : {
          executeServerSide: true,
          skipApprovalGate: true,
          messages: [
            { role: 'user', content: planStepPrompt(step.title, step.description, plan.title) },
          ],
        };
      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      toolResults = data?.toolResults ?? null;
      const results = Array.isArray(data?.toolResults) ? data.toolResults : [];

      if (resp.ok && results.length > 0) {
        const allOk = results.every((r: Record<string, unknown>) => r?.ok !== false);
        execOk = allOk;
        execSummary = results
          .map((r: Record<string, unknown>) => (r?.message as string) || (r?.summary as string) || '')
          .filter(Boolean)
          .join(' · ')
          .slice(0, 600);
        if (!allOk) {
          execError = results
            .filter((r: Record<string, unknown>) => r?.ok === false)
            .map((r: Record<string, unknown>) => (r?.message as string) || 'tool failed')
            .join(' · ')
            .slice(0, 600);
        }
      } else if (resp.ok && results.length === 0) {
        // No tools fired (the agent answered conversationally). For a
        // plan step this is a failure: we expected an action.
        execOk = false;
        execError = data?.reply
          ? `no tool fired; agent replied: ${String(data.reply).slice(0, 300)}`
          : 'no tool fired';
      } else {
        execOk = false;
        execError = data?.error || `chat returned ${resp.status}`;
      }
    } catch (err) {
      execOk = false;
      execError = (err as Error).message;
    }

    // Look up the most recent undo row associated with this user; if
    // it was created within the last 30s we attribute it to this step.
    // Imperfect but cheap, and the undo log is short-lived enough that
    // false attribution is rare.
    let undoLogId: string | null = null;
    if (execOk) {
      const { data: undo } = await admin
        .from('dori_undo_log')
        .select('id, created_at')
        .eq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 30_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (undo) undoLogId = undo.id;
    }

    // Update step + plan in two writes.
    await admin.from('dori_plan_steps')
      .update({
        status: execOk ? 'succeeded' : 'failed',
        result_summary: execSummary || null,
        error_message: execError,
        executed_at: new Date().toISOString(),
        undo_log_id: undoLogId,
        metadata: { ...(step.metadata as Record<string, unknown> ?? {}), tool_results: toolResults },
        updated_at: new Date().toISOString(),
      })
      .eq('id', step.id);

    // Recompute progress + decide plan status with a single query
    // over the just-mutated step rows. We avoid an aggregate RPC
    // because we need the next pending step's `idx` too.
    const { data: agg } = await admin
      .from('dori_plan_steps')
      .select('status, idx')
      .eq('plan_id', planId);
    const rows = (agg ?? []) as Array<{ status: string; idx: number }>;
    const completedCount = rows.filter(r => r.status === 'succeeded' || r.status === 'skipped').length;
    const failedCount = rows.filter(r => r.status === 'failed').length;
    const nextPending = rows
      .filter(r => r.status === 'pending' || r.status === 'awaiting_confirm')
      .sort((a, b) => a.idx - b.idx)[0];

    let newPlanStatus: string;
    if (failedCount > 0 && !nextPending) newPlanStatus = 'failed';
    else if (!nextPending) newPlanStatus = 'completed';
    else newPlanStatus = 'awaiting_confirm';

    await admin.from('dori_action_plans')
      .update({
        status: newPlanStatus,
        completed_step_count: completedCount,
        current_step_idx: nextPending?.idx ?? null,
        completed_at: newPlanStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    return json({
      ok: execOk,
      action,
      step_id: step.id,
      step_status: execOk ? 'succeeded' : 'failed',
      result_summary: execSummary || null,
      error: execError,
      plan_status: newPlanStatus,
      completed_step_count: completedCount,
      total_steps: rows.length,
    });
  } catch (err) {
    console.error('[dori-plan-execute] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function planStepPrompt(title: string, description: string | null, planTitle: string): string {
  const goal = description?.trim() || title;
  return [
    `You are executing one step of a previously-approved plan: "${planTitle}".`,
    `The user already approved this plan, so do NOT call propose_plan again.`,
    `Step goal: ${goal}`,
    `Pick the right single tool and execute it. Do not chain into multiple unrelated tool calls.`,
    `If the goal is purely informational ("review X") and no tool fits, return a one-line summary tool call that records the finding (e.g. save_memory).`,
  ].join('\n');
}

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
