import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
const TELEGRAM_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

async function sendTelegram(chatId: number, text: string) {
  if (!TELEGRAM_API_KEY) return;
  try {
    await fetch(`${TELEGRAM_GATEWAY}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('[meeting-followup] telegram send failed', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('Authorization') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
  const okAuth = auth === `Bearer ${SERVICE_KEY}` || (anon && auth === `Bearer ${anon}`);
  if (!okAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const past = new Date(now.getTime() - 10 * 60 * 1000); // ended in last 10 min

  const { data: events } = await supabase
    .from('events')
    .select('id, user_id, title, end_time')
    .gte('end_time', past.toISOString())
    .lte('end_time', now.toISOString());

  let processed = 0;

  for (const ev of events || []) {
    const { data: settings } = await supabase
      .from('proactive_settings')
      .select('enabled, meeting_followup_enabled, in_app_notifications_enabled, telegram_proactive_enabled, telegram_group_enabled')
      .eq('user_id', ev.user_id)
      .maybeSingle();

    if (settings && settings.enabled === false) continue;
    if (settings && settings.meeting_followup_enabled === false) continue;

    // Idempotency
    const { data: already } = await supabase
      .from('meeting_reminders_sent')
      .select('id')
      .eq('event_id', ev.id)
      .eq('reminder_type', 'followup')
      .maybeSingle();
    if (already) continue;

    const title = `How did "${ev.title}" go?`;
    const message = 'Tap to log outcome, create a follow-up task, or add notes.';

    if (settings?.in_app_notifications_enabled !== false) {
      await supabase.from('user_notifications').insert({
        user_id: ev.user_id,
        type: 'meeting_followup',
        title,
        message,
        data: { event_id: ev.id, end_time: ev.end_time },
      });
    }

    if (settings?.telegram_proactive_enabled !== false) {
      const tgText = `<b>${title}</b>\n${message}`;
      let sentToGroup = false;
      if (settings?.telegram_group_enabled !== false) {
        const { data: glink } = await supabase
          .from('telegram_group_links')
          .select('chat_id')
          .eq('owner_user_id', ev.user_id)
          .eq('is_active', true)
          .maybeSingle();
        if (glink?.chat_id) {
          await sendTelegram(Number(glink.chat_id), tgText);
          sentToGroup = true;
        }
      }
      if (!sentToGroup) {
        const { data: link } = await supabase
          .from('telegram_links')
          .select('chat_id')
          .eq('user_id', ev.user_id)
          .eq('is_active', true)
          .maybeSingle();
        if (link?.chat_id) {
          await sendTelegram(Number(link.chat_id), tgText);
        }
      }
    }

    await supabase.from('meeting_reminders_sent').insert({
      user_id: ev.user_id,
      event_id: ev.id,
      reminder_type: 'followup',
    });

    processed++;
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
