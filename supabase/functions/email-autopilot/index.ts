// Email autopilot — runs hourly. For each user with Gmail connected and autopilot enabled:
//   1. Auto-archive obvious newsletters/promotions/spam from the last 2 hours.
//   2. If 1+ "action_required" emails arrived, push a Telegram digest to their private chat.
// Reuses gmail-sync's prior classification (category/priority_score/ai_summary already populated).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDoriReply } from '../_shared/telegram-voice.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProactiveSettings {
  user_id: string;
  email_autopilot?: boolean;
  email_autoarchive_categories?: string[]; // e.g. ['newsletter','promotion','spam']
  telegram_chat_id?: number | null;
  prefer_voice_replies?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const telegramKey = Deno.env.get('TELEGRAM_API_KEY') || '';

  const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const summary: any[] = [];

  try {
    // Find users with autopilot on (default off — opt-in).
    const { data: rawUsers, error: uErr } = await sb
      .from('proactive_settings')
      .select('user_id, email_autopilot, email_autoarchive_categories, prefer_voice_replies')
      .eq('email_autopilot', true);

    if (uErr) throw uErr;

    // Resolve telegram chat_id from telegram_links
    const userIds = (rawUsers || []).map((u: any) => u.user_id);
    const { data: links } = userIds.length
      ? await sb.from('telegram_links').select('user_id, chat_id').in('user_id', userIds).eq('is_active', true)
      : { data: [] as any[] };
    const chatIdByUser = new Map<string, number>();
    (links || []).forEach((l: any) => { if (l.chat_id) chatIdByUser.set(l.user_id, Number(l.chat_id)); });

    const users = (rawUsers || []).map((u: any) => ({ ...u, telegram_chat_id: chatIdByUser.get(u.user_id) ?? null }));

    for (const u of (users as ProactiveSettings[]) || []) {
      const archiveCats = u.email_autoarchive_categories?.length
        ? u.email_autoarchive_categories
        : ['newsletter', 'promotion', 'spam'];

      // 1) Auto-archive bulk noise from last 2h that user hasn't touched.
      const { data: archived } = await sb
        .from('user_emails')
        .update({ user_archived: true })
        .eq('user_id', u.user_id)
        .gte('received_at', sinceIso)
        .eq('user_archived', false)
        .eq('is_read', false)
        .in('category', archiveCats)
        .select('id');

      // 2) Find action-required emails from last 2h.
      const { data: actionEmails } = await sb
        .from('user_emails')
        .select('id, from_name, from_email, subject, ai_summary, ai_suggested_action, priority_score')
        .eq('user_id', u.user_id)
        .gte('received_at', sinceIso)
        .eq('user_archived', false)
        .eq('category', 'action_required')
        .order('priority_score', { ascending: true })
        .limit(5);

      // 3) Push Telegram digest if there's something the human needs to decide on.
      if (u.telegram_chat_id && actionEmails && actionEmails.length > 0 && telegramKey) {
        // Dedupe: only send digest once per hour per user.
        const dedupKey = `email_digest_${new Date().toISOString().slice(0, 13)}`; // hour bucket
        const { data: dup } = await sb
          .from('dori_proactive_log')
          .select('id')
          .eq('user_id', u.user_id)
          .eq('trigger_key', dedupKey)
          .maybeSingle();

        if (!dup) {
          const lines = actionEmails.map((e, i) =>
            `${i + 1}. <b>${escapeHtml(e.from_name || e.from_email || 'Unknown')}</b> — ${escapeHtml(e.subject || '(no subject)')}` +
            (e.ai_summary ? `\n   <i>${escapeHtml(e.ai_summary.slice(0, 140))}</i>` : ''),
          ).join('\n\n');

          const text = `📬 <b>${actionEmails.length} email${actionEmails.length > 1 ? 's' : ''} need your attention</b>\n\n${lines}\n\nReply to me with what to do — I can draft replies or archive.`;

          await sendDoriReply({
            chatId: u.telegram_chat_id,
            text,
            preferVoice: false, // digests are always text — too long for voice
            telegramKey,
          });

          await sb.from('dori_proactive_log').insert({
            user_id: u.user_id,
            trigger_type: 'email_digest',
            trigger_key: dedupKey,
            channel: 'tg_private',
            channel_ref: String(u.telegram_chat_id),
            message: `${actionEmails.length} action emails`,
          });
        }
      }

      summary.push({
        user_id: u.user_id,
        archived: archived?.length || 0,
        action_required: actionEmails?.length || 0,
        digest_sent: !!(u.telegram_chat_id && actionEmails && actionEmails.length > 0),
      });
    }

    return new Response(JSON.stringify({ ok: true, processed: summary.length, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-autopilot error', e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
