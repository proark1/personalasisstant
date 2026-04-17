// Generates a one-time link code and bot deep link for personal OR family group linking.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

async function getBotUsername(lovableKey: string, tgKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${GATEWAY_URL}/getMe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': tgKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const data = await r.json();
    return data?.result?.username ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';
    const scope = body.scope || 'personal'; // 'personal' | 'group'

    if (action === 'unlink') {
      if (scope === 'group') {
        await admin.from('telegram_group_links').delete().eq('owner_user_id', user.id);
      } else {
        await admin.from('telegram_links').delete().eq('user_id', user.id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate code
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const botUsername = await getBotUsername(LOVABLE_API_KEY, TELEGRAM_API_KEY);

    if (scope === 'group') {
      // Find an accepted partner (first one) for this owner
      const { data: partner } = await admin
        .from('space_members')
        .select('id, member_id')
        .eq('owner_id', user.id)
        .eq('status', 'accepted')
        .limit(1)
        .maybeSingle();

      await admin.from('telegram_group_links').upsert({
        owner_user_id: user.id,
        partner_user_id: partner?.member_id ?? null,
        space_member_id: partner?.id ?? null,
        link_code: code,
        link_code_expires_at: expires,
        is_active: false,
      }, { onConflict: 'owner_user_id' });

      // Group bots cannot use ?start= deep link from a group; user must add bot then send /linkfamily <code>
      const addToGroupUrl = botUsername ? `https://t.me/${botUsername}?startgroup=true` : null;

      return new Response(JSON.stringify({
        code,
        expiresAt: expires,
        botUsername,
        addToGroupUrl,
        instructions: `1) Tap "Add to group" and choose your family group.\n2) In the group, send: /linkfamily ${code}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Personal
    await admin.from('telegram_links').upsert({
      user_id: user.id,
      link_code: code,
      link_code_expires_at: expires,
      is_active: false,
    }, { onConflict: 'user_id' });

    const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

    return new Response(JSON.stringify({
      code,
      expiresAt: expires,
      botUsername,
      deepLink,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('telegram-link error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
