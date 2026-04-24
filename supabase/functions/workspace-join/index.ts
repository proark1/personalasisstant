// Accepts a workspace invite code, validates it, and adds the caller as a
// member with the code's role. Idempotent if the user is already a member.
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
    if (!authHeader) return json({ ok: false, error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== 'string') return json({ ok: false, error: 'Missing code' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: invite } = await admin
      .from('workspace_invite_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!invite) return json({ ok: false, error: 'Code not found' }, 404);
    if (invite.revoked_at) return json({ ok: false, error: 'Code revoked' }, 410);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return json({ ok: false, error: 'Code expired' }, 410);
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) return json({ ok: false, error: 'Code exhausted' }, 410);

    // Already a member? Return success without creating a duplicate.
    const { data: existing } = await admin.from('workspace_members')
      .select('workspace_id, role')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', user.id).maybeSingle();
    if (!existing) {
      const { error: mErr } = await admin.from('workspace_members').insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.created_by,
        joined_at: new Date().toISOString(),
      });
      if (mErr) return json({ ok: false, error: mErr.message }, 500);
    }

    // Atomic increment + concurrent-use guard in one round-trip. If the code
    // got exhausted between our earlier read and now (another joiner won the
    // race), the RPC returns false and we refuse the join.
    const { data: claimed } = await admin.rpc('increment_workspace_invite_uses', { p_id: invite.id });
    if (claimed === false) {
      return json({ ok: false, error: 'Code exhausted' }, 410);
    }

    // Return the workspace record the caller needs to set active immediately
    // without waiting for a re-fetch (fixes a UX race in the web client).
    const { data: ws } = await admin.from('workspaces')
      .select('id, name, slug, description, icon, owner_id, archived, created_at, updated_at')
      .eq('id', invite.workspace_id).maybeSingle();

    return json({ ok: true, workspace_id: invite.workspace_id, workspace: ws });
  } catch (e) {
    console.error('workspace-join error', e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
