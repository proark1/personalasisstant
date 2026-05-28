// Returns health / status info for the Telegram integration so users can
// self-diagnose from Settings → Telegram → Diagnose.
//
// Checks:
//   - Env var presence (GEMINI_API_KEY, TELEGRAM_API_KEY) — booleans only, never values
//   - Telegram bot reachability via getMe (confirms TELEGRAM_API_KEY is valid)
//   - telegram_bot_state.update_offset + updated_at (confirms cron is actually running)
//   - Current user's personal + group link rows
//   - On request (runPoll = true): invokes telegram-poll and returns its response
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const runPoll = body?.runPoll === true;

    // 1. Env vars
    const envVars = {
      GEMINI_API_KEY: Boolean(GEMINI_API_KEY),
      TELEGRAM_API_KEY: Boolean(TELEGRAM_API_KEY),
    };

    // 2. getMe — confirms bot token is valid
    let botInfo: { ok: boolean; username?: string; first_name?: string; id?: number; error?: string } = { ok: false };
    if (TELEGRAM_API_KEY) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/getMe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          botInfo = { ok: false, error: `telegram ${r.status}: ${JSON.stringify(data)}` };
        } else if (data?.result) {
          botInfo = {
            ok: true,
            username: data.result.username,
            first_name: data.result.first_name,
            id: data.result.id,
          };
        } else {
          botInfo = { ok: false, error: 'unexpected response shape' };
        }
      } catch (e) {
        botInfo = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    } else {
      botInfo = { ok: false, error: 'missing TELEGRAM_API_KEY' };
    }

    // 3. Cron / bot state — updated_at moves forward every tick
    const { data: botState } = await admin
      .from('telegram_bot_state')
      .select('update_offset, updated_at')
      .eq('id', 1)
      .maybeSingle();
    const lastTickSeconds = botState?.updated_at
      ? Math.round((Date.now() - new Date(botState.updated_at).getTime()) / 1000)
      : null;

    // 4. Current user links
    const [{ data: link }, { data: group }] = await Promise.all([
      admin.from('telegram_links')
        .select('is_active, chat_id, telegram_username, telegram_first_name, linked_at, link_code_expires_at')
        .eq('user_id', user.id).maybeSingle(),
      admin.from('telegram_group_links')
        .select('is_active, chat_id, title, linked_at, link_code_expires_at')
        .eq('owner_user_id', user.id).maybeSingle(),
    ]);

    // 5. Optional manual poll trigger
    let pollResult: { ok: boolean; status?: number; body?: unknown; error?: string } | null = null;
    if (runPoll) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/telegram-poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const text = await r.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* keep as text */ }
        pollResult = { ok: r.ok, status: r.status, body: parsed };
      } catch (e) {
        pollResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }

    return new Response(JSON.stringify({
      envVars,
      botInfo,
      botState: botState ? { ...botState, lastTickSeconds } : null,
      link,
      group,
      pollResult,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('telegram-diagnostics error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
