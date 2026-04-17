// Classifies inbound Telegram group messages and writes to the right module.
// Called by telegram-poll for messages from a linked family group.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tgSend(chatId: number, text: string) {
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('tgSend failed', e);
  }
}

interface ClassifyResult {
  intent: 'task' | 'shopping_item' | 'event' | 'note' | 'question';
  task?: { title: string; due?: string | null; category?: 'personal' | 'business' };
  shopping_item?: { item: string; quantity?: number };
  event?: { title: string; start: string; end?: string | null; location?: string | null };
  note?: { title: string; body: string };
}

async function classify(text: string): Promise<ClassifyResult> {
  const today = new Date().toISOString();
  const sys = `You are a routing classifier for a family assistant. Given a short message, decide if it should be saved as a task, shopping item, calendar event, note, or treated as a question.
Rules:
- "buy X", "we need X", "get X" → shopping_item
- A specific time/date with a verb → event (resolve relative dates against ${today}, return ISO)
- "remind me to X", "X tomorrow", "do X" → task
- A factual statement worth remembering → note
- A question or anything ambiguous → question
Return ONLY valid JSON matching the schema. No prose.`;

  const schema = {
    type: 'object',
    properties: {
      intent: { type: 'string', enum: ['task', 'shopping_item', 'event', 'note', 'question'] },
      task: { type: 'object', properties: { title: { type: 'string' }, due: { type: ['string', 'null'] }, category: { type: 'string', enum: ['personal', 'business'] } } },
      shopping_item: { type: 'object', properties: { item: { type: 'string' }, quantity: { type: 'number' } } },
      event: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string' }, end: { type: ['string', 'null'] }, location: { type: ['string', 'null'] } } },
      note: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } } },
    },
    required: ['intent'],
  };

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: text },
        ],
        tools: [{ type: 'function', function: { name: 'route', description: 'Route the message', parameters: schema } }],
        tool_choice: { type: 'function', function: { name: 'route' } },
      }),
    });
    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (args) return JSON.parse(args);
  } catch (e) {
    console.error('classify failed', e);
  }
  return { intent: 'question' };
}

async function getOrCreateDefaultShoppingList(supabase: any, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('shopping_lists')
    .insert({ user_id: userId, name: 'Family Shopping', category: 'grocery' })
    .select('id')
    .single();
  return created?.id ?? null;
}

async function handleAgenda(supabase: any, userIds: string[]): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const { data: events } = await supabase
    .from('events')
    .select('title, start_time, location, user_id')
    .in('user_id', userIds)
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time');

  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, due_date, user_id')
    .in('user_id', userIds)
    .eq('completed', false)
    .eq('trashed', false)
    .or(`due_date.gte.${start.toISOString()},due_date.is.null`)
    .lte('due_date', end.toISOString())
    .order('due_date', { nullsFirst: false })
    .limit(15);

  const lines: string[] = ['<b>📅 Today\'s agenda</b>'];
  if (events?.length) {
    lines.push('\n<b>Events</b>');
    events.forEach((e: any) => {
      const t = new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${t} — ${e.title}${e.location ? ` (${e.location})` : ''}`);
    });
  }
  if (tasks?.length) {
    lines.push('\n<b>Open tasks</b>');
    tasks.forEach((t: any) => lines.push(`• ${t.title}`));
  }
  if (!events?.length && !tasks?.length) lines.push('\nNothing scheduled — enjoy the day. ☕');
  return lines.join('\n');
}

async function handleShoppingList(supabase: any, ownerId: string): Promise<string> {
  const { data: lists } = await supabase
    .from('shopping_lists')
    .select('id, name')
    .eq('user_id', ownerId)
    .eq('is_completed', false)
    .order('created_at', { ascending: true });

  if (!lists?.length) return '🛒 No active shopping lists.';

  const out: string[] = [];
  for (const list of lists) {
    const { data: items } = await supabase
      .from('shopping_list_items')
      .select('name, quantity, is_checked')
      .eq('list_id', list.id)
      .eq('is_checked', false);
    out.push(`<b>🛒 ${list.name}</b>`);
    if (items?.length) {
      items.forEach((i: any) => out.push(`• ${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`));
    } else {
      out.push('  (empty)');
    }
  }
  return out.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal-only: must come from telegram-poll with service key
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { chat_id, text, telegram_user_id, telegram_first_name, telegram_username } = await req.json();

  // Resolve group → owner
  const { data: group } = await supabase
    .from('telegram_group_links')
    .select('owner_user_id, partner_user_id')
    .eq('chat_id', chat_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!group) {
    await tgSend(chat_id, '🔒 This group is not linked to a Dori family space yet.');
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  const memberIds = [group.owner_user_id, group.partner_user_id].filter(Boolean) as string[];

  // Resolve sender → app user
  let senderUserId: string | null = null;
  let senderName = telegram_first_name || telegram_username || 'someone';
  if (telegram_user_id) {
    const { data: mapped } = await supabase
      .from('telegram_user_map')
      .select('user_id')
      .eq('telegram_user_id', telegram_user_id)
      .maybeSingle();
    if (mapped) senderUserId = mapped.user_id;
  }

  // Built-in slash commands
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === '/today' || lower === '/agenda') {
    const reply = await handleAgenda(supabase, memberIds);
    await tgSend(chat_id, reply);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  if (lower === '/shopping' || lower === '/list') {
    const reply = await handleShoppingList(supabase, group.owner_user_id);
    await tgSend(chat_id, reply);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  if (lower.startsWith('/help') || lower === '/start') {
    await tgSend(chat_id, `<b>Dori family assistant</b>\nJust write naturally — I'll save tasks, shopping items, and events to your shared space.\n\nCommands:\n/today — today's agenda\n/shopping — current shopping list\n/add &lt;task&gt; — force-add a task\n/buy &lt;item&gt; — add to shopping list\n/linkme — link your Telegram account to your Dori user`);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // Force commands
  let forced: 'task' | 'shopping_item' | null = null;
  let payloadText = trimmed;
  if (lower.startsWith('/add ')) { forced = 'task'; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/buy ')) { forced = 'shopping_item'; payloadText = trimmed.slice(5); }

  // For ALL natural-language messages (and unknown slash commands), route to the
  // full Dori brain with server-side tool execution so Dori can create/update/delete
  // tasks, events, contacts, contracts, properties, businesses, family members,
  // emails (drafts), notes, shopping, reminders — anywhere from the family group.
  const userForChat = senderUserId || group.owner_user_id;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userForChat,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: trimmed }],
        personality: 'balanced',
        executeServerSide: true,
      }),
    });

    if (!r.ok) {
      await tgSend(chat_id, "Sorry, I couldn't reach Dori right now.");
      return new Response('{"ok":true}', { headers: corsHeaders });
    }

    const json = await r.json();
    const reply = (json.reply || '').trim();
    const toolResults = (json.toolResults || []) as { ok: boolean; message: string }[];

    const parts: string[] = [];
    if (reply) parts.push(reply);
    if (toolResults.length > 0) {
      parts.push(toolResults.map(t => t.message).join('\n'));
    }
    const finalMsg = parts.join('\n\n').trim() || 'Got it.';
    // Telegram has a 4096 char limit
    await tgSend(chat_id, finalMsg.slice(0, 4000));
    return new Response('{"ok":true}', { headers: corsHeaders });
  } catch (e) {
    console.error('router error', e);
    await tgSend(chat_id, '⚠️ Something went wrong.');
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { headers: corsHeaders });
  }
});
