// Approves and executes a pending action from auto_actions_log.
// Called by the web app's AgentActionInbox when user clicks Approve.
// For Dori-queued actions (containing tool_xml), re-runs the original tool through
// the chat function's executor with the approval gate disabled.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { actionId, decision } = await req.json();
    if (!actionId || !['approve', 'reject'].includes(decision)) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: action, error: aErr } = await admin
      .from('auto_actions_log')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .single();
    if (aErr || !action) {
      return new Response(JSON.stringify({ error: 'Action not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (action.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Action already ${action.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (decision === 'reject') {
      await admin.from('auto_actions_log').update({ status: 'rejected', rejected_at: new Date().toISOString() }).eq('id', actionId);
      return new Response(JSON.stringify({ ok: true, decision: 'rejected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Approve & execute.
    const toolXml = (action.action_data as any)?.tool_xml as string | undefined;
    if (!toolXml) {
      // No re-executable tool — just mark approved (legacy auto-pilot actions handled by useAutoPilot directly).
      await admin.from('auto_actions_log').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', actionId);
      return new Response(JSON.stringify({ ok: true, decision: 'approved', message: 'Marked approved (no tool to execute)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Forward to chat function with skipApprovalGate so the executor will run.
    // We invoke chat with a synthetic message; chat detects executeServerSide=true and runs the tool.
    const chatUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/chat`;
    const resp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        executeServerSide: true,
        skipApprovalGate: true,
        preformedToolText: toolXml,
        messages: [],
      }),
    });
    const data = await resp.json();

    await admin.from('auto_actions_log').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      action_data: { ...(action.action_data as any), execution_result: data?.toolResults || data },
    }).eq('id', actionId);

    return new Response(JSON.stringify({ ok: true, decision: 'approved', result: data?.toolResults || data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('dori-execute-action error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
