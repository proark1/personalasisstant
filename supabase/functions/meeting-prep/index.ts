import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');

interface EventRow {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  description: string | null;
  attendees: string[] | null;
  category: string | null;
}

async function sendTelegram(chatId: number, text: string) {
  if (!TELEGRAM_API_KEY) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('[meeting-prep] telegram send failed', e);
  }
}

async function generatePrep(event: EventRow, contactNotes: string): Promise<string> {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are Dori, a concise personal assistant. Generate a 1-2 sentence "what to remember" prep note for an upcoming meeting. Be warm, specific, actionable. No fluff.' },
          { role: 'user', content: `Meeting: ${event.title}\nWhen: ${event.start_time}\nLocation: ${event.location || 'n/a'}\nNotes: ${event.description || 'none'}\nContext from past interactions: ${contactNotes || 'no prior context'}` },
        ],
      }),
    });
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) {
    console.error('[meeting-prep] AI failed', e);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Accept service-role OR anon (cron uses anon). These endpoints take no user input.
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
  const horizon = new Date(now.getTime() + 20 * 60 * 1000); // next 20 min

  // Fetch upcoming events in window
  const { data: events, error } = await supabase
    .from('events')
    .select('id, user_id, title, start_time, end_time, location, description, attendees, category')
    .gte('start_time', now.toISOString())
    .lte('start_time', horizon.toISOString());

  if (error) {
    console.error('[meeting-prep] fetch events failed', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let processed = 0;
  const results: Record<string, unknown>[] = [];

  for (const ev of (events || []) as EventRow[]) {
    const minutesUntil = Math.round((new Date(ev.start_time).getTime() - now.getTime()) / 60000);

    // Get user settings
    const { data: settings } = await supabase
      .from('proactive_settings')
      .select('*')
      .eq('user_id', ev.user_id)
      .maybeSingle();

    if (settings && settings.enabled === false) continue;
    if (settings && settings.meeting_briefing_enabled === false) continue;

    const briefingMinutes: number[] = settings?.meeting_briefing_minutes || [15, 5, 1];

    // Quiet hours check
    if (settings?.quiet_hours_enabled) {
      const hour = now.getHours();
      const startH = parseInt((settings.quiet_hours_start || '22:00').split(':')[0]);
      const endH = parseInt((settings.quiet_hours_end || '07:00').split(':')[0]);
      const inQuiet = startH > endH
        ? (hour >= startH || hour < endH)
        : (hour >= startH && hour < endH);
      if (inQuiet) continue;
    }

    // Determine which reminder bucket this event falls into (±1 min tolerance)
    const bucket = briefingMinutes.find(m => Math.abs(minutesUntil - m) <= 1);
    if (bucket === undefined) continue;

    const reminderType = `briefing_${bucket}`;

    // Idempotency check
    const { data: already } = await supabase
      .from('meeting_reminders_sent')
      .select('id')
      .eq('event_id', ev.id)
      .eq('reminder_type', reminderType)
      .maybeSingle();
    if (already) continue;

    // Pull contact context if attendees match
    let contactNotes = '';
    if (ev.attendees && ev.attendees.length > 0) {
      const { data: contacts } = await supabase
        .from('user_contacts')
        .select('name, notes, last_interaction_at')
        .eq('user_id', ev.user_id)
        .in('name', ev.attendees);
      if (contacts && contacts.length > 0) {
        contactNotes = contacts.map(c => `${c.name}: ${c.notes || 'no notes'}`).join('; ');
      }
    }

    // Generate AI prep note (only at ≥5 min — saves tokens for 1-min ping)
    let prepNote = '';
    if (bucket >= 5) {
      prepNote = await generatePrep(ev, contactNotes);
    }

    const title = bucket === 1
      ? `🔔 Starting now: ${ev.title}`
      : `📅 ${ev.title} in ${bucket} min`;

    const message = [
      ev.location ? `📍 ${ev.location}` : null,
      prepNote || null,
    ].filter(Boolean).join('\n');

    // In-app notification
    if (settings?.in_app_notifications_enabled !== false) {
      await supabase.from('user_notifications').insert({
        user_id: ev.user_id,
        type: 'meeting_briefing',
        title,
        message: message || `Meeting starts in ${bucket} minute${bucket !== 1 ? 's' : ''}`,
        data: {
          event_id: ev.id,
          minutes_until: bucket,
          location: ev.location,
          start_time: ev.start_time,
        },
      });
    }

    // Telegram delivery — prefer family group, fall back to personal
    if (settings?.telegram_proactive_enabled !== false) {
      const tgText = `<b>${title}</b>\n${message}`.trim();
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

    // Mark sent
    await supabase.from('meeting_reminders_sent').insert({
      user_id: ev.user_id,
      event_id: ev.id,
      reminder_type: reminderType,
    });

    processed++;
    results.push({ event_id: ev.id, bucket, title: ev.title });
  }

  return new Response(JSON.stringify({ ok: true, processed, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
