// Polls Telegram getUpdates and routes incoming messages to Dori AI per linked user.
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
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown' }, lovableKey, tgKey);
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
        userId,
        source: 'telegram',
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Dori call failed:', r.status, errText);
      return "Sorry, I'm having trouble reaching Dori right now. Try again in a moment.";
    }

    // Stream response — collect text chunks
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
        } catch {
          // ignore non-JSON
        }
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
      const text: string = msg.text.trim();

      // Handle /start COMMAND with optional link code
      if (text.startsWith('/start')) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (code) {
          const { data: link } = await supabase
            .from('telegram_links')
            .select('*')
            .eq('link_code', code)
            .maybeSingle();
          if (link && (!link.link_code_expires_at || new Date(link.link_code_expires_at) > new Date())) {
            await supabase
              .from('telegram_links')
              .update({
                chat_id: chatId,
                telegram_username: msg.from?.username ?? null,
                telegram_first_name: msg.from?.first_name ?? null,
                is_active: true,
                linked_at: new Date().toISOString(),
                link_code: null,
                link_code_expires_at: null,
              })
              .eq('id', link.id);
            await sendMessage(chatId, `✅ *Linked successfully!*\n\nHi ${msg.from?.first_name ?? 'there'}, I'm Dori — your personal assistant. Send me anything: tasks, questions, reminders, or photos.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else {
            await sendMessage(chatId, '❌ This link code is invalid or expired. Generate a new one in the Dori app.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
        } else {
          await sendMessage(chatId, '👋 Welcome! To connect this chat to your Dori account, open Settings → Telegram in the app and tap "Connect Telegram".', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        continue;
      }

      // Find linked user
      const { data: link } = await supabase
        .from('telegram_links')
        .select('user_id, is_active')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (!link || !link.is_active) {
        await sendMessage(chatId, '🔒 This chat isn\'t linked to a Dori account yet. Open the app → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // Send typing indicator
      tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});

      // Route to Dori
      const reply = await callDori(link.user_id, text, supabaseUrl, serviceKey);
      await sendMessage(chatId, reply, LOVABLE_API_KEY, TELEGRAM_API_KEY);

      // Log
      await supabase.from('telegram_messages').upsert({
        update_id: u.update_id,
        chat_id: chatId,
        text,
        raw_update: u,
        processed: true,
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
