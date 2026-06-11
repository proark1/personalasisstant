// Pushes a daily morning digest to every linked Telegram family group.
// Runs hourly via pg_cron; for each group, sends only when the owner's local
// hour matches the group's configured `morning_digest_hour` and we haven't
// already sent for that local date.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildSharedFamilyDigest, buildSharedFamilyDigestVoiceScript } from '../_shared/telegram-digest.ts';
import { defaultBriefingVoiceLimit, sendVoiceMessage } from '../_shared/telegram-voice.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tgSend(chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) console.error('tgSend failed', res.status, await res.text());
}

type SupabaseClient = ReturnType<typeof createClient>;

async function getHousehold(supabase: SupabaseClient, ownerId: string, partnerId: string | null) {
  const ids = [ownerId, partnerId].filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name, email, timezone').in('user_id', ids);
  const nameMap = new Map<string, string>();
  let ownerTz: string | undefined;
  (profiles || []).forEach((p: { user_id: string; display_name?: string | null; email?: string | null; timezone?: string | null }) => {
    nameMap.set(p.user_id, p.display_name || (p.email?.split('@')[0]) || 'Member');
    if (p.user_id === ownerId) ownerTz = p.timezone || undefined;
  });
  return {
    ids,
    nameOf: (uid: string) => nameMap.get(uid) || 'Member',
    multi: ids.length > 1,
    timezone: ownerTz,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal/cron only: the gateway does not verify JWTs for /functions/v1,
  // so require the service-role bearer in code (matches the *-cron siblings).
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const force = new URL(req.url).searchParams.get('force') === '1';

  const { data: groups, error } = await supabase
    .from('telegram_group_links')
    .select('id, chat_id, owner_user_id, partner_user_id, morning_digest_enabled, morning_digest_hour, morning_digest_last_sent_on, voice_digest_enabled, title')
    .eq('is_active', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  let sent = 0; let skipped = 0; const errors: string[] = [];

  for (const g of (groups || [])) {
    if (!g.morning_digest_enabled && !force) { skipped++; continue; }

    const household = await getHousehold(supabase, g.owner_user_id, g.partner_user_id);
    const tz = household.timezone || 'UTC';

    const now = new Date();
    const localHour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10);
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

    if (!force) {
      if (localHour !== (g.morning_digest_hour ?? 7)) { skipped++; continue; }
      if (g.morning_digest_last_sent_on === localDate) { skipped++; continue; }
    }

    try {
      const text = await buildSharedFamilyDigest(supabase, household.ids, household, {
        limit: 7,
        tz,
        horizonDays: 14,
        greeting: true,
      });
      if (g.voice_digest_enabled) {
        await sendVoiceMessage({
          chatId: Number(g.chat_id),
          script: buildSharedFamilyDigestVoiceScript(text),
          fallbackText: text,
          caption: `☀️ ${g.title || 'Family'} morning voice digest`,
          telegramKey: TELEGRAM_API_KEY,
          maxChars: defaultBriefingVoiceLimit(),
          sendFallbackText: false,
        });
      }
      await tgSend(Number(g.chat_id), text);
      await supabase
        .from('telegram_group_links')
        .update({ morning_digest_last_sent_on: localDate })
        .eq('id', g.id);
      sent++;
    } catch (e) {
      console.error('digest failed for group', g.id, e);
      errors.push(`${g.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
