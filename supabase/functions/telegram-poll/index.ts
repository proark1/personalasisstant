// Polls Telegram getUpdates and routes incoming messages.
// 1:1 chats → Dori chat; group chats linked via /linkfamily → telegram-router.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function tg(method: string, body: Record<string, unknown>, lovableKey: string, tgKey: string) {
  const r = await fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': tgKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function sendMessage(chatId: number, text: string, lovableKey: string, tgKey: string) {
  try {
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' }, lovableKey, tgKey);
  } catch (e) {
    console.error('sendMessage failed:', e);
  }
}

async function callDori(userId: string, message: string, supabaseUrl: string, serviceKey: string): Promise<string> {
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userId,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        personality: 'balanced',
      }),
    });
    if (!r.ok) {
      console.error(`Dori call failed for user ${userId}:`, r.status, await r.text());
      return "Sorry, I'm having trouble reaching Dori right now. Try again in a moment.";
    }
    const reader = r.body?.getReader();
    if (!reader) return await r.text();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]' || !payload) continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) full += delta;
        } catch { /* ignore */ }
      }
    }
    return full.trim() || "I processed that but didn't have anything to add.";
  } catch (e) {
    console.error('callDori error:', e);
    return "Something went wrong. Please try again.";
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: state } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  let currentOffset = state?.update_offset ?? 0;
  let processed = 0;

  while (Date.now() - startTime < MAX_RUNTIME_MS - MIN_REMAINING_MS) {
    const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime);
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    let data: any;
    try {
      data = await tg('getUpdates', { offset: currentOffset, timeout, allowed_updates: ['message'] }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
    } catch (e) {
      console.error('getUpdates failed:', e);
      break;
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      const msg = u.message;
      if (!msg || !msg.text) continue;

      const chatId = msg.chat.id;
      const chatType = msg.chat.type as string; // 'private' | 'group' | 'supergroup' | 'channel'
      const rawText: string = msg.text.trim();
      // Normalize: strip @botname suffix from commands so "/linkfamily@darai_bot CODE" works
      const text: string = rawText.replace(/^(\/[a-zA-Z_]+)@\w+/, '$1');
      const fromId = msg.from?.id;
      const fromUsername = msg.from?.username ?? null;
      const fromFirstName = msg.from?.first_name ?? null;
      const isGroup = chatType === 'group' || chatType === 'supergroup';

      console.log(`[telegram-poll] chat=${chatId} type=${chatType} from=${fromId} text="${text.slice(0, 80)}"`);

      // ---------- /start (private only — group link uses /linkfamily) ----------
      if (text.startsWith('/start') && !isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (code) {
          const { data: link } = await supabase.from('telegram_links').select('*').eq('link_code', code).maybeSingle();
          if (link && (!link.link_code_expires_at || new Date(link.link_code_expires_at) > new Date())) {
            await supabase.from('telegram_links').update({
              chat_id: chatId,
              telegram_username: fromUsername,
              telegram_first_name: fromFirstName,
              is_active: true,
              linked_at: new Date().toISOString(),
              link_code: null,
              link_code_expires_at: null,
            }).eq('id', link.id);
            // Also map this telegram user to the app user
            if (fromId) {
              await supabase.from('telegram_user_map').upsert({
                telegram_user_id: fromId,
                user_id: link.user_id,
                telegram_username: fromUsername,
                telegram_first_name: fromFirstName,
              }, { onConflict: 'telegram_user_id' });
            }
            await sendMessage(chatId, `✅ <b>Linked successfully!</b>\n\nHi ${fromFirstName ?? 'there'}, I'm Dori — your personal assistant.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else {
            await sendMessage(chatId, '❌ This link code is invalid or expired.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
        } else {
          await sendMessage(chatId, '👋 Welcome! Open the Dori app → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        continue;
      }

      // ---------- /linkfamily <code> (group only) ----------
      if (text.startsWith('/linkfamily') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkfamily <code> — generate a code in Settings → Telegram → Family Group.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: glink } = await supabase.from('telegram_group_links').select('*').eq('link_code', code).maybeSingle();
        if (!glink || (glink.link_code_expires_at && new Date(glink.link_code_expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired family link code.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        await supabase.from('telegram_group_links').update({
          chat_id: chatId,
          title: msg.chat.title ?? 'Family Group',
          is_active: true,
          linked_at: new Date().toISOString(),
          link_code: null,
          link_code_expires_at: null,
        }).eq('id', glink.id);
        // Map the user who ran /linkfamily as the owner-side telegram identity
        if (fromId) {
          await supabase.from('telegram_user_map').upsert({
            telegram_user_id: fromId,
            user_id: glink.owner_user_id,
            telegram_username: fromUsername,
            telegram_first_name: fromFirstName,
          }, { onConflict: 'telegram_user_id' });
        }
        await sendMessage(chatId, `✅ <b>Family group linked!</b>\n\nWrite naturally — I'll save tasks, shopping items, and events for your shared space.\n\nYour partner should send <code>/linkme &lt;their-code&gt;</code> here so I know who's who.\nType /help for more commands.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // ---------- /linkme <personal-code> (group only — partner self-identifies) ----------
      if (text.startsWith('/linkme') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (!code) {
          await sendMessage(chatId, '⚠️ Generate a personal link code in Settings → Telegram, then send: /linkme <code>', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: link } = await supabase.from('telegram_links').select('user_id, link_code_expires_at').eq('link_code', code).maybeSingle();
        if (!link || (link.link_code_expires_at && new Date(link.link_code_expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired code.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        if (fromId) {
          await supabase.from('telegram_user_map').upsert({
            telegram_user_id: fromId,
            user_id: link.user_id,
            telegram_username: fromUsername,
            telegram_first_name: fromFirstName,
          }, { onConflict: 'telegram_user_id' });
        }
        await sendMessage(chatId, `✅ ${fromFirstName ?? 'You'} are now linked. Items you add will be tagged to you.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // ---------- GROUP MESSAGES → router ----------
      if (isGroup) {
        const { data: glink } = await supabase
          .from('telegram_group_links')
          .select('owner_user_id')
          .eq('chat_id', chatId)
          .eq('is_active', true)
          .maybeSingle();
        if (!glink) {
          const hasMention = /@\w*(darai|dori|dora)\w*_?bot\b/i.test(rawText);
          const addressesDori = /^(hey\s+|hi\s+|ok\s+)?(dori|dora)\b[\s,:!?]?/i.test(rawText.trim());
          if (rawText.startsWith('/') || hasMention || addressesDori) {
            await sendMessage(chatId, '🔒 This group is not linked yet. Generate a Family Group code in Settings → Telegram, then send /linkfamily <code> here.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
          continue;
        }

        // Decide if Dori should respond. Stay silent on family chit-chat.
        const repliedToIsBot = msg.reply_to_message?.from?.is_bot === true;
        const hasMention = /@\w*(darai|dori|dora)\w*_?bot\b/i.test(rawText);
        const addressesDori = /^(hey\s+|hi\s+|ok\s+)?(dori|dora)\b[\s,:!?]?/i.test(rawText.trim());
        const actionKeywords = /\b(buy|need|get|pick up|grab|remind|reminder|task|todo|to-do|schedule|meeting|appointment|event|tomorrow|today|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|kaufen|brauchen|besorgen|erinner|termin|morgen|heute)\b/i;
        const looksActionable = actionKeywords.test(rawText);
        const isCommand = rawText.startsWith('/');

        const shouldRespond = hasMention || addressesDori || repliedToIsBot || looksActionable || isCommand;

        if (!shouldRespond) {
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }

        // Strip mention/address prefix before sending to router
        const cleanText = rawText
          .replace(/@\w*(darai|dori|dora)\w*_?bot\b/gi, '')
          .replace(/^(hey\s+|hi\s+|ok\s+)?(dori|dora)\b[\s,:!?]*/i, '')
          .trim() || text;

        tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});

        try {
          await fetch(`${supabaseUrl}/functions/v1/telegram-router`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: cleanText,
              telegram_user_id: fromId,
              telegram_username: fromUsername,
              telegram_first_name: fromFirstName,
            }),
          });
        } catch (e) {
          console.error('router invoke failed', e);
          await sendMessage(chatId, '⚠️ Router unavailable, try again shortly.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }

        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      // ---------- 1:1 PRIVATE CHAT ----------
      const { data: link } = await supabase
        .from('telegram_links')
        .select('user_id, is_active')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (!link || !link.is_active) {
        await sendMessage(chatId, '🔒 This chat isn\'t linked yet. Open Dori → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});
      const reply = await callDori(link.user_id, text, supabaseUrl, serviceKey);
      await sendMessage(chatId, reply, LOVABLE_API_KEY, TELEGRAM_API_KEY);

      await supabase.from('telegram_messages').upsert({
        update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
      }, { onConflict: 'update_id' });
      processed++;
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await supabase.from('telegram_bot_state').update({ update_offset: newOffset, updated_at: new Date().toISOString() }).eq('id', 1);
    currentOffset = newOffset;
  }

  return new Response(JSON.stringify({ ok: true, processed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
