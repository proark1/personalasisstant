// Approves and executes a pending action from auto_actions_log.
// Called by the web app's AgentActionInbox when a user clicks Approve/Reject.
// Also reachable from the Telegram integration (service-role + x-telegram-user-id
// header) so inline-keyboard confirmations can reuse the same executor.
//
// For Dori-queued actions (containing tool_xml), re-runs the original tool
// through the chat function's executor with the approval gate disabled.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-user-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Resolve requesting user: either an end-user auth token or a trusted
    // service-role call with x-telegram-user-id (used by the Telegram bot).
    let requestingUserId: string | null = null;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const telegramUserIdHeader = req.headers.get('x-telegram-user-id');
    if (token === serviceKey && telegramUserIdHeader) {
      requestingUserId = telegramUserIdHeader;
    } else {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: uErr } = await userClient.auth.getUser();
      if (!uErr && user) requestingUserId = user.id;
    }

    if (!requestingUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { actionId, decision } = await req.json();
    if (!actionId || !['approve', 'reject'].includes(decision)) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: action, error: aErr } = await admin
      .from('auto_actions_log')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', requestingUserId)
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

    const toolXml = (action.action_data as Record<string, unknown>)?.tool_xml as string | undefined;
    if (!toolXml) {
      await admin.from('auto_actions_log').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', actionId);
      return new Response(JSON.stringify({ ok: true, decision: 'approved', message: 'Marked approved (no tool to execute)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Re-run the tool through the chat executor. We forward the user id via the
    // x-telegram-user-id header because the chat function interprets that, paired
    // with a service-role token, as an authenticated user context.
    const chatUrl = `${supabaseUrl}/functions/v1/chat`;
    const resp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': action.user_id,
      },
      body: JSON.stringify({
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
      action_data: { ...(action.action_data as Record<string, unknown>), execution_result: data?.toolResults || data },
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
