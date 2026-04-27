// Polls Telegram getUpdates and routes incoming messages.
// 1:1 chats → Dori chat; group chats linked via /linkfamily → telegram-router.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { sendDoriReply } from '../_shared/telegram-voice.ts';
import {
  approveAndExecutePending,
  buildConfirmKeyboard,
  classifyConfirmationText,
  fetchLatestPendingForChat,
  isActionableNow,
  rejectPending,
  sweepExpiredPending,
  tgAnswerCallback,
  tgEditMessageText,
  tgSendWithKeyboard,
} from '../_shared/telegram-confirm.ts';
import {
  buildUndoKeyboard,
  decodeCallback,
  tgEditReplyMarkup,
} from '../_shared/telegram-inline.ts';
import { buildDoriContext } from '../_shared/dori-context.ts';
import {
  fetchLatestUndoableForUser,
  fetchUndoable,
  runUndo,
} from '../_shared/dori-undo.ts';

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

// Download a Telegram file by id and return a base64 data URL suitable for
// the chat function's multimodal imageUrl field.
async function downloadTelegramFile(
  fileId: string,
  mime: string,
  lovableKey: string,
  tgKey: string,
): Promise<string | null> {
  try {
    const fileRes = await tg('getFile', { file_id: fileId }, lovableKey, tgKey);
    const filePath = fileRes?.result?.file_path;
    if (!filePath) return null;
    const dl = await fetch(`${GATEWAY_URL}/file/${filePath}`, {
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'X-Connection-Api-Key': tgKey },
    });
    if (!dl.ok) {
      console.error('file download failed', dl.status);
      return null;
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());
    // std/encoding/base64 uses a native fast path, avoids the call-stack
    // risk of String.fromCharCode.apply(...) on large Uint8Arrays, and doesn't
    // allocate an intermediate Array.
    const b64 = encodeBase64(bytes);
    return `data:${mime || 'application/octet-stream'};base64,${b64}`;
  } catch (e) {
    console.error('downloadTelegramFile error', e);
    return null;
  }
}

// Download a Telegram file (voice/audio) and transcribe via Gemini.
// Returns the transcript text, or null on failure.
async function transcribeTelegramVoice(
  fileId: string,
  mime: string,
  lovableKey: string,
  tgKey: string,
): Promise<string | null> {
  try {
    // 1) Resolve file_path
    const fileRes = await tg('getFile', { file_id: fileId }, lovableKey, tgKey);
    const filePath = fileRes?.result?.file_path;
    if (!filePath) return null;

    // 2) Download file bytes via gateway
    const dl = await fetch(`${GATEWAY_URL}/file/${filePath}`, {
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'X-Connection-Api-Key': tgKey },
    });
    if (!dl.ok) {
      console.error('voice download failed', dl.status);
      return null;
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());

    // 3) Base64 encode via std/encoding/base64 (native, no chunking needed).
    const base64Audio = encodeBase64(bytes);

    // 4) Transcribe via Lovable AI Gateway (Gemini supports audio inline as data URL)
    const audioMime = mime || 'audio/ogg';
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a precise transcriber. Transcribe the audio verbatim in the original language. Output ONLY the transcript, no quotes, no commentary.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this voice message.' },
              { type: 'image_url', image_url: { url: `data:${audioMime};base64,${base64Audio}` } },
            ],
          },
        ],
      }),
    });
    if (!aiRes.ok) {
      console.error('transcription failed', aiRes.status, await aiRes.text());
      return null;
    }
    const aiData = await aiRes.json();
    const transcript = aiData?.choices?.[0]?.message?.content?.trim();
    return transcript || null;
  } catch (e) {
    console.error('transcribeTelegramVoice error', e);
    return null;
  }
}

interface ToolResult {
  ok: boolean;
  message: string;
  tool?: string;
  queued?: boolean;
  actionId?: string;
  summary?: string;
}

interface DoriCallResult {
  reply: string;
  toolResults: ToolResult[];
}

// Calls the chat function in agent-mode so tools actually run for 1:1 Telegram
// messages (previously the private chat path streamed text without executing
// tools, so add/edit/delete silently failed). Returns the reply PLUS any
// tool results, including queued confirmation prompts the bot must surface.
interface StreamCallbacks {
  // Fires when accumulated text changes. Debounced by the caller before
  // hitting Telegram's editMessageText (which rate-limits to ~1/sec).
  onText: (accumulated: string) => void;
}

async function callDori(
  userId: string,
  message: string,
  chatId: number,
  supabaseUrl: string,
  serviceKey: string,
  imageUrl?: string | null,
  streamCbs?: StreamCallbacks,
  workspaceId?: string | null,
): Promise<DoriCallResult> {
  const streaming = !!streamCbs;
  async function doRequest(): Promise<Response> {
    return fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userId,
        'x-dori-channel': 'tg_private',
        'x-dori-channel-ref': String(chatId),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        personality: 'balanced',
        executeServerSide: true,
        actionSource: 'tg_private',
        actionSourceRef: String(chatId),
        streamFinalText: streaming,
        ...(workspaceId ? { workspaceId } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      }),
    });
  }

  try {
    let r = await doRequest();
    // Only retry on *transient* failures. 402 (credit exhaustion) won't self-
    // resolve — retrying just adds latency, so we pass that straight through.
    if (r.status === 429 || r.status === 503) {
      await new Promise((res) => setTimeout(res, 1500));
      r = await doRequest();
    }
    if (!r.ok) {
      const body = await r.text();
      console.error(`Dori call failed for user ${userId}:`, r.status, body);
      const friendly =
        r.status === 429 ? "I'm getting rate-limited right now. Try again in ~30 seconds."
        : r.status === 402 ? "I've run out of AI credits for today — please top up or try again tomorrow."
        : r.status >= 500 ? "My AI service is having a moment. Try again shortly."
        : "I couldn't process that — please try again in a moment.";
      return { reply: friendly, toolResults: [] };
    }

    // Non-streaming path: fall back to the original JSON contract.
    if (!streaming || !r.body) {
      const data = await r.json();
      return {
        reply: (data?.reply || '').trim(),
        toolResults: (data?.toolResults || []) as ToolResult[],
      };
    }

    // Streaming path: consume our SSE envelope (delta / tool / done) and
    // invoke onText every time the accumulated prose grows. Tool-result
    // events are collected but not forwarded to the UI live — the caller
    // decides whether to surface them in the final reply.
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let lineBuf = '';
    let accumulatedText = '';
    const tools: ToolResult[] = [];
    let finalReply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload) as
            | { type: 'delta'; content: string }
            | { type: 'tool'; message: string; ok: boolean; queued?: boolean; actionId?: string; summary?: string; undoId?: string; tool?: string }
            | { type: 'done'; reply: string; toolResults: ToolResult[] }
            | { type: 'error'; detail?: string };
          if (evt.type === 'delta') {
            accumulatedText += evt.content;
            streamCbs?.onText(accumulatedText);
          } else if (evt.type === 'tool') {
            tools.push(evt as ToolResult);
          } else if (evt.type === 'done') {
            finalReply = (evt.reply || accumulatedText).trim();
            // Prefer server's definitive tool list over the accumulated one
            // (the server emits tools as they run AND includes them in done).
            if (Array.isArray(evt.toolResults)) {
              return { reply: finalReply, toolResults: evt.toolResults as ToolResult[] };
            }
          } else if (evt.type === 'error') {
            return { reply: `⚠️ ${evt.detail || 'Something went wrong.'}`, toolResults: tools };
          }
        } catch { /* ignore malformed event */ }
      }
    }
    return { reply: (finalReply || accumulatedText).trim(), toolResults: tools };
  } catch (e) {
    console.error('callDori error:', e);
    return { reply: 'Something went wrong. Please try again.', toolResults: [] };
  }
}

// ── Row-level inline-keyboard action handlers ──────────────────────────────
// Each handler validates ownership, performs the mutation, then either edits
// the originating Telegram message to show the outcome or answers the callback
// with a short toast. They deliberately do NOT go through the AI — row buttons
// are predictable operations, so we skip the AI round-trip for speed.

// Record an undo row for a callback-driven mutation and return its id (or null
// if the insert failed). The resulting id is stapled onto the edited message
// as an ↩️ Undo button so the user can reverse the tap within 5 minutes.
async function recordCallbackUndo(
  supabase: any,
  args: {
    cb: any;
    userId: string;
    op: string;
    entity: string;
    entityId: string | null;
    label: string;
    snapshot: any;
  },
): Promise<string | null> {
  try {
    const { data } = await supabase.from('dori_undo_log').insert({
      user_id: args.userId,
      op: args.op,
      entity_type: args.entity,
      entity_id: args.entityId,
      label: args.label,
      inverse_tool_xml: null,
      snapshot: args.snapshot,
      source: args.cb.message?.chat?.type === 'private' ? 'tg_private' : 'tg_family',
      source_ref: args.cb.message?.chat?.id ? String(args.cb.message.chat.id) : null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }).select('id').single();
    return data?.id || null;
  } catch (e) {
    console.error('recordCallbackUndo failed', e);
    return null;
  }
}

async function handleTaskCallback(
  supabase: any,
  cb: any,
  payload: { op: 'complete' | 'snooze1h' | 'snooze1d' | 'delete'; taskId: string },
  tappingUserId: string | undefined,
  lovableKey: string,
  telegramKey: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const { data: task } = await supabase.from('tasks')
    .select('*').eq('id', payload.taskId).maybeSingle();
  if (!task) {
    await tgAnswerCallback(cb.id, 'Task not found.', lovableKey, telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== task.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this task.', lovableKey, telegramKey);
    return;
  }

  // Snapshot for undo (only for reversible ops).
  const snapshotBefore = { completed: task.completed, completed_at: task.completed_at, due_date: task.due_date };

  let outcome = '';
  let undoSnap: any = null;
  if (payload.op === 'complete') {
    await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', task.id);
    outcome = `✅ Done — ${task.title}`;
    undoSnap = { kind: 'patch', table: 'tasks', id: task.id, patch: snapshotBefore };
  } else if (payload.op === 'snooze1h' || payload.op === 'snooze1d') {
    const base = task.due_date ? new Date(task.due_date) : new Date();
    const newDue = new Date(base.getTime() + (payload.op === 'snooze1h' ? 3600 : 86400) * 1000).toISOString();
    await supabase.from('tasks').update({ due_date: newDue }).eq('id', task.id);
    outcome = `⏰ Snoozed — ${task.title} now due ${new Date(newDue).toLocaleString()}`;
    undoSnap = { kind: 'patch', table: 'tasks', id: task.id, patch: { due_date: task.due_date } };
  } else if (payload.op === 'delete') {
    await supabase.from('tasks').delete().eq('id', task.id);
    outcome = `🗑 Deleted — ${task.title}`;
    undoSnap = { kind: 'reinsert', table: 'tasks', row: task };
  }

  const undoId = await recordCallbackUndo(supabase, {
    cb, userId: task.user_id, op: payload.op, entity: 'task', entityId: task.id,
    label: `${payload.op} task "${task.title}"`, snapshot: undoSnap,
  });

  await tgAnswerCallback(cb.id, outcome.slice(0, 180), lovableKey, telegramKey);
  if (cb.message?.message_id) {
    await tgEditMessageText(cb.message.chat.id, cb.message.message_id, outcome, lovableKey, telegramKey);
    if (undoId) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), lovableKey, telegramKey);
    } else {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    }
  }
  // Silence unused-param warning on supabaseUrl/serviceKey — kept for API uniformity.
  void supabaseUrl; void serviceKey;
}

async function handleShopCallback(
  supabase: any,
  cb: any,
  payload: { op: 'check' | 'uncheck' | 'remove'; itemId: string },
  tappingUserId: string | undefined,
  lovableKey: string,
  telegramKey: string,
) {
  const { data: item } = await supabase.from('shopping_list_items')
    .select('*').eq('id', payload.itemId).maybeSingle();
  if (!item) {
    await tgAnswerCallback(cb.id, 'Item not found.', lovableKey, telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== item.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this item.', lovableKey, telegramKey);
    return;
  }

  let outcome = '';
  let undoSnap: any = null;
  if (payload.op === 'check') {
    await supabase.from('shopping_list_items').update({ is_checked: true, checked_at: new Date().toISOString() }).eq('id', item.id);
    outcome = `☑️ Got — ${item.name}`;
    undoSnap = { kind: 'patch', table: 'shopping_list_items', id: item.id, patch: { is_checked: item.is_checked ?? false, checked_at: item.checked_at ?? null } };
  } else if (payload.op === 'uncheck') {
    await supabase.from('shopping_list_items').update({ is_checked: false, checked_at: null }).eq('id', item.id);
    outcome = `🔲 Unchecked — ${item.name}`;
    undoSnap = { kind: 'patch', table: 'shopping_list_items', id: item.id, patch: { is_checked: item.is_checked ?? true, checked_at: item.checked_at ?? null } };
  } else if (payload.op === 'remove') {
    await supabase.from('shopping_list_items').delete().eq('id', item.id);
    outcome = `🗑 Removed — ${item.name}`;
    undoSnap = { kind: 'reinsert', table: 'shopping_list_items', row: item };
  }

  const undoId = await recordCallbackUndo(supabase, {
    cb, userId: item.user_id, op: payload.op, entity: 'shopping_item', entityId: item.id,
    label: `${payload.op} shopping item "${item.name}"`, snapshot: undoSnap,
  });

  await tgAnswerCallback(cb.id, outcome.slice(0, 180), lovableKey, telegramKey);
  if (cb.message?.message_id) {
    await tgEditMessageText(cb.message.chat.id, cb.message.message_id, outcome, lovableKey, telegramKey);
    if (undoId) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), lovableKey, telegramKey);
    } else {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    }
  }
}

async function handleEventCallback(
  supabase: any,
  cb: any,
  payload: { op: 'details' | 'cancel'; eventId: string },
  tappingUserId: string | undefined,
  lovableKey: string,
  telegramKey: string,
) {
  const { data: ev } = await supabase.from('events')
    .select('*').eq('id', payload.eventId).maybeSingle();
  if (!ev) {
    await tgAnswerCallback(cb.id, 'Event not found.', lovableKey, telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== ev.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this event.', lovableKey, telegramKey);
    return;
  }

  if (payload.op === 'details') {
    const details = [
      `<b>${ev.title}</b>`,
      `🕐 ${new Date(ev.start_time).toLocaleString()} — ${new Date(ev.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ev.location ? `📍 ${ev.location}` : '',
      ev.description ? `\n${ev.description}` : '',
    ].filter(Boolean).join('\n');
    await tgAnswerCallback(cb.id, '', lovableKey, telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, details, lovableKey, telegramKey);
    }
  } else if (payload.op === 'cancel') {
    await supabase.from('events').delete().eq('id', ev.id);
    const undoId = await recordCallbackUndo(supabase, {
      cb, userId: ev.user_id, op: 'delete', entity: 'event', entityId: ev.id,
      label: `cancelled event "${ev.title}"`,
      snapshot: { kind: 'reinsert', table: 'events', row: ev },
    });
    await tgAnswerCallback(cb.id, '❌ Cancelled', lovableKey, telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, `❌ Cancelled event: ${ev.title}`, lovableKey, telegramKey);
      if (undoId) {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), lovableKey, telegramKey);
      } else {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
      }
    }
  }
}

async function handleContractCallback(
  supabase: any,
  cb: any,
  payload: { op: 'snooze7' | 'handled' | 'details'; contractId: string },
  tappingUserId: string | undefined,
  lovableKey: string,
  telegramKey: string,
) {
  const { data: c } = await supabase.from('contracts')
    .select('*').eq('id', payload.contractId).maybeSingle();
  if (!c) {
    await tgAnswerCallback(cb.id, 'Contract not found.', lovableKey, telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== c.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this contract.', lovableKey, telegramKey);
    return;
  }

  if (payload.op === 'details') {
    const details = [
      `<b>${c.name}</b>${c.provider ? ` — ${c.provider}` : ''}`,
      c.cost_amount ? `💶 ${c.cost_amount}${c.cost_frequency ? `/${c.cost_frequency}` : ''}` : '',
      c.renewal_date ? `🔁 Renews ${new Date(c.renewal_date).toLocaleDateString()}` : '',
      c.end_date ? `🏁 Ends ${new Date(c.end_date).toLocaleDateString()}` : '',
      c.notes ? `\n${c.notes}` : '',
    ].filter(Boolean).join('\n');
    await tgAnswerCallback(cb.id, '', lovableKey, telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, details, lovableKey, telegramKey);
    }
  } else if (payload.op === 'handled' || payload.op === 'snooze7') {
    const newReminder = payload.op === 'handled'
      ? new Date().toISOString()
      : new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    await supabase.from('contracts').update({ last_reminded_at: newReminder }).eq('id', c.id);
    const undoId = await recordCallbackUndo(supabase, {
      cb, userId: c.user_id, op: 'update', entity: 'contract', entityId: c.id,
      label: payload.op === 'handled' ? `marked "${c.name}" handled` : `snoozed "${c.name}" 7 days`,
      snapshot: { kind: 'patch', table: 'contracts', id: c.id, patch: { last_reminded_at: c.last_reminded_at ?? null } },
    });
    const text = payload.op === 'handled'
      ? `✅ Marked "${c.name}" as handled.`
      : `⏰ Snoozed "${c.name}" for 7 days.`;
    await tgAnswerCallback(cb.id, payload.op === 'handled' ? '✅ Marked handled' : '⏰ Snoozed 7 days', lovableKey, telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, text, lovableKey, telegramKey);
      if (undoId) {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), lovableKey, telegramKey);
      } else {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
      }
    }
  }
}

// Plan inline-keyboard handler. Mirrors the per-step controls the
// AssistantHubSheet exposes in the web app: Run next / Skip / Abort.
// Delegates to dori-plan-execute for the heavy lifting; we just
// ack the callback and edit the message to reflect the new state.
async function handlePlanCallback(
  supabase: any,
  cb: any,
  payload: { op: 'run_next' | 'skip' | 'abort'; planId: string },
  tappingUserId: string | undefined,
  lovableKey: string,
  telegramKey: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const { data: plan } = await supabase
    .from('dori_action_plans')
    .select('id, user_id, title, status, completed_step_count, step_count')
    .eq('id', payload.planId)
    .maybeSingle();
  if (!plan) {
    await tgAnswerCallback(cb.id, 'Plan not found.', lovableKey, telegramKey);
    if (cb.message?.message_id) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    }
    return;
  }
  if (tappingUserId && tappingUserId !== plan.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can drive this plan.', lovableKey, telegramKey);
    return;
  }

  // Map the inline op to the dori-plan-execute action.
  const action = payload.op === 'run_next'
    ? 'execute_next'
    : payload.op === 'skip'
    ? 'skip'
    : 'abort';

  let resultText = '';
  let updateOk = false;
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/dori-plan-execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': plan.user_id,
      },
      body: JSON.stringify({ plan_id: plan.id, action }),
      signal: AbortSignal.timeout(55_000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data?.error) {
      resultText = `⚠️ ${data?.error || `HTTP ${r.status}`}`;
    } else {
      updateOk = true;
      if (action === 'execute_next') {
        const summary = data?.result_summary ? ` — ${String(data.result_summary).slice(0, 200)}` : '';
        resultText = data?.ok
          ? `▶️ Step done${summary}\n${data.completed_step_count ?? plan.completed_step_count}/${data.total_steps ?? plan.step_count} complete`
          : `⚠️ Step failed: ${data?.error ?? 'unknown'}`;
      } else if (action === 'skip') {
        resultText = `⏭ Step skipped`;
      } else {
        resultText = `⛔ Plan aborted`;
      }
    }
  } catch (e) {
    resultText = `⚠️ ${(e as Error).message}`;
  }

  await tgAnswerCallback(cb.id, updateOk ? '' : 'Failed', lovableKey, telegramKey);
  if (cb.message?.message_id) {
    const header = `📋 <b>${escape(plan.title)}</b>`;
    await tgEditMessageText(
      cb.message.chat.id,
      cb.message.message_id,
      `${header}\n\n${resultText}`,
      lovableKey, telegramKey,
    );
    // Re-attach the keyboard unless we hit a terminal state.
    if (action === 'abort') {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, lovableKey, telegramKey);
    } else {
      try {
        const { buildPlanRowKeyboard } = await import('../_shared/telegram-inline.ts');
        await tgEditReplyMarkup(
          cb.message.chat.id,
          cb.message.message_id,
          buildPlanRowKeyboard(plan.id),
          lovableKey, telegramKey,
        );
      } catch { /* ignore */ }
    }
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Public (cron-only by convention, matching email-autopilot). No in-function
  // auth gate: verify_jwt = false in config.toml and any auth check requires
  // operator setup (Vault + env var) to stay in sync with the cron, which
  // previously broke the integration whenever they drifted. Supabase's
  // built-in function rate limits + timeouts bound worst-case abuse, and
  // expensive paths (voice transcription) only fire on real Telegram inputs.
  const startTime = Date.now();
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: state } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  let currentOffset = state?.update_offset ?? 0;
  let processed = 0;
  console.log(`[telegram-poll] tick: offset=${currentOffset}`);

  while (Date.now() - startTime < MAX_RUNTIME_MS - MIN_REMAINING_MS) {
    const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime);
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    let data: any;
    try {
      data = await tg(
        'getUpdates',
        { offset: currentOffset, timeout, allowed_updates: ['message', 'callback_query'] },
        LOVABLE_API_KEY,
        TELEGRAM_API_KEY,
      );
      // (voice/audio arrive inside 'message' updates — no extra allowed_updates needed)
    } catch (e) {
      console.error('getUpdates failed:', e);
      break;
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    // Opportunistically expire any pending confirmations whose TTL has passed.
    // Cheap; prevents stale prompts from quietly succeeding.
    await sweepExpiredPending(supabase);

    for (const u of updates) {
      // ── Callback query (inline-keyboard tap) ───────────────────────────────
      if (u.callback_query) {
        const cb = u.callback_query;
        const payload = decodeCallback(String(cb.data || ''));
        const cbChatId = cb.message?.chat?.id;
        const cbMessageId = cb.message?.message_id;
        const cbFromId = cb.from?.id;

        // Resolve tapping user → app user (used for ownership checks below).
        let tappingUserId: string | undefined;
        if (cbFromId) {
          const { data: mapped } = await supabase.from('telegram_user_map')
            .select('user_id').eq('telegram_user_id', cbFromId).maybeSingle();
          tappingUserId = mapped?.user_id as string | undefined;
        }

        try {
          if (!cbChatId) {
            await tgAnswerCallback(cb.id, '', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (payload.kind === 'confirm' || payload.kind === 'reject') {
            const actionId = payload.kind === 'confirm' ? payload.actionId : payload.actionId;
            const { data: action } = await supabase.from('auto_actions_log')
              .select('*').eq('id', actionId).maybeSingle();
            if (!action) {
              await tgAnswerCallback(cb.id, 'That action is no longer available.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
            } else if (!isActionableNow(action as any)) {
              await tgAnswerCallback(cb.id, `This expired.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
              if (cbMessageId) {
                await tgEditMessageText(cbChatId, cbMessageId,
                  `⏰ This confirmation expired — ask me again if you still want to "${action.reason}".`,
                  LOVABLE_API_KEY, TELEGRAM_API_KEY);
              }
            } else if (tappingUserId && tappingUserId !== action.user_id) {
              await tgAnswerCallback(cb.id, 'Only the person who asked Dori can confirm this.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
            } else {
              const outcome = payload.kind === 'confirm'
                ? await approveAndExecutePending(supabase, action, supabaseUrl, serviceKey)
                : await rejectPending(supabase, action.id, action.reason);
              await tgAnswerCallback(cb.id, payload.kind === 'confirm' ? '✅ Done' : '❌ Cancelled', LOVABLE_API_KEY, TELEGRAM_API_KEY);
              if (cbMessageId) {
                await tgEditMessageText(cbChatId, cbMessageId, outcome, LOVABLE_API_KEY, TELEGRAM_API_KEY);
              }
              try { await supabase.from('telegram_assistant_replies').insert({ chat_id: cbChatId, reply: outcome }); } catch { /* ignore */ }
            }
          } else if (payload.kind === 'undo') {
            const entry = await fetchUndoable(supabase, payload.undoId);
            if (!entry) {
              await tgAnswerCallback(cb.id, '⏰ Undo window expired.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
              if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, LOVABLE_API_KEY, TELEGRAM_API_KEY);
            } else if (tappingUserId && tappingUserId !== entry.user_id) {
              await tgAnswerCallback(cb.id, 'Only the owner can undo this.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
            } else {
              const res = await runUndo(supabase, entry, supabaseUrl, serviceKey);
              await tgAnswerCallback(cb.id, res.ok ? '↩️ Undone' : '⚠️', LOVABLE_API_KEY, TELEGRAM_API_KEY);
              if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, LOVABLE_API_KEY, TELEGRAM_API_KEY);
              await sendMessage(cbChatId, res.message, LOVABLE_API_KEY, TELEGRAM_API_KEY);
            }
          } else if (payload.kind === 'task') {
            await handleTaskCallback(supabase, cb, payload, tappingUserId, LOVABLE_API_KEY, TELEGRAM_API_KEY, supabaseUrl, serviceKey);
          } else if (payload.kind === 'shop') {
            await handleShopCallback(supabase, cb, payload, tappingUserId, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (payload.kind === 'event') {
            await handleEventCallback(supabase, cb, payload, tappingUserId, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (payload.kind === 'contract') {
            await handleContractCallback(supabase, cb, payload, tappingUserId, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (payload.kind === 'plan') {
            await handlePlanCallback(supabase, cb, payload, tappingUserId, LOVABLE_API_KEY, TELEGRAM_API_KEY, supabaseUrl, serviceKey);
          } else if (payload.kind === 'dismiss') {
            await tgAnswerCallback(cb.id, '', LOVABLE_API_KEY, TELEGRAM_API_KEY);
            if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else {
            await tgAnswerCallback(cb.id, '', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
        } catch (e) {
          console.error('callback handler error', e);
          await tgAnswerCallback(cb.id, '⚠️ Something went wrong.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }

        await supabase
          .from('telegram_bot_state')
          .update({ update_offset: u.update_id + 1, updated_at: new Date().toISOString() })
          .eq('id', 1);
        currentOffset = u.update_id + 1;
        continue;
      }

      const msg = u.message;
      if (!msg) continue;

      // Per-update try/finally: once we've pulled an update from Telegram we
      // MUST advance the stored offset before this iteration ends, otherwise
      // an AI/router crash mid-batch replays the same message on the next
      // poll and the bot double-acts (extra tasks created, duplicate replies).
      try {

      const chatId = msg.chat.id;
      const chatType = msg.chat.type as string;

      // ---------- VOICE / AUDIO → transcribe via Gemini, then treat as text ----------
      let textFromVoice: string | null = null;
      if (!msg.text && (msg.voice || msg.audio)) {
        const v = msg.voice || msg.audio;
        const mime = v.mime_type || 'audio/ogg';
        try {
          await tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } catch { /* ignore */ }
        textFromVoice = await transcribeTelegramVoice(v.file_id, mime, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        if (!textFromVoice) {
          await sendMessage(chatId, "🎙️ I couldn't understand that voice message. Try again or type it.", LOVABLE_API_KEY, TELEGRAM_API_KEY);
          await supabase.from('telegram_bot_state').update({ update_offset: u.update_id + 1, updated_at: new Date().toISOString() }).eq('id', 1);
          currentOffset = u.update_id + 1;
          continue;
        }
        // Inject transcript so the rest of the pipeline treats it as a text message
        msg.text = textFromVoice;
      }

      // ---------- PHOTO / DOCUMENT → download + forward to chat() as a multimodal turn ----------
      // The user sent a picture (receipt / business card / bill / prescription / whiteboard /
      // calendar screenshot) or a file. We download it, encode as a base64 data URL, and hand
      // it off to the normal chat pipeline via the existing imageUrl field so the AI extracts
      // structured content and runs the appropriate tools (subject to the user's confirmation
      // settings). Photo intake works in BOTH private chats and linked family/assistant groups —
      // for groups we bypass the text-only router and call Dori directly with the image.
      let photoDataUrl: string | null = null;
      let photoCaption: string | null = null;
      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        // photo is an array of PhotoSize; pick the highest-resolution option.
        // Sorting by pixel area avoids mixing units if file_size is missing.
        const biggest = [...msg.photo].sort(
          (a: any, b: any) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)),
        )[0];
        photoDataUrl = await downloadTelegramFile(biggest.file_id, 'image/jpeg', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        photoCaption = msg.caption || null;
      } else if (msg.document && typeof msg.document.mime_type === 'string' && msg.document.mime_type.startsWith('image/')) {
        photoDataUrl = await downloadTelegramFile(msg.document.file_id, msg.document.mime_type, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        photoCaption = msg.caption || null;
      }
      if (photoDataUrl) {
        // Fabricate the text so the rest of the pipeline treats it as a normal turn.
        msg.text = photoCaption && photoCaption.trim()
          ? photoCaption.trim()
          : 'Please look at this picture and take the appropriate action — if it is a calendar screenshot, add the events to my calendar; otherwise add contact / task / expense / reminder / note as makes sense.';
      }

      if (!msg.text && !photoDataUrl) continue;

      // Track if original message was voice — used later to decide voice vs text reply
      const wasVoiceMessage = !!textFromVoice;


      const rawText: string = String(msg.text ?? '').trim();
      if (!rawText) continue;

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
        const code = parts[1]?.trim();
        if (code) {
          const { data: link } = await supabase.from('telegram_links').select('*').eq('link_code', code).maybeSingle();
          const isExpired = link?.link_code_expires_at && new Date(link.link_code_expires_at) <= new Date();
          if (link && !isExpired) {
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
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkfamily <code> — generate a code in Settings → Telegram → Family Group.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: glink } = await supabase.from('telegram_group_links').select('*').eq('link_code', code).maybeSingle();
        const isExpired = glink?.link_code_expires_at && new Date(glink.link_code_expires_at) <= new Date();
        if (!glink || isExpired) {
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

      // ---------- /linkworkspace <code> (group only — bind this chat to a workspace) ----------
      if (text.startsWith('/linkworkspace') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkworkspace <invite-code>. Generate a code in the app at Settings → Workspaces.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: invite } = await supabase.from('workspace_invite_codes').select('workspace_id, revoked_at, expires_at').eq('code', code).maybeSingle();
        if (!invite || invite.revoked_at || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired workspace code.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        // Upsert the link. chat_id is UNIQUE so re-linking just rebinds.
        await supabase.from('workspace_telegram_links').upsert({
          workspace_id: invite.workspace_id,
          chat_id: chatId,
          title: msg.chat.title ?? 'Workspace Group',
          is_active: true,
          linked_at: new Date().toISOString(),
        }, { onConflict: 'chat_id' });
        // Also map the linker so the chat function can resolve the sender.
        if (fromId) {
          // Find the user_id the Telegram user maps to (if previously linked personally).
          const { data: userMap } = await supabase.from('telegram_user_map')
            .select('user_id').eq('telegram_user_id', fromId).maybeSingle();
          if (userMap?.user_id) {
            // Ensure they're a member (honor invite role if not).
            const { data: existing } = await supabase.from('workspace_members')
              .select('user_id').eq('workspace_id', invite.workspace_id).eq('user_id', userMap.user_id).maybeSingle();
            if (!existing) {
              await supabase.from('workspace_members').insert({
                workspace_id: invite.workspace_id,
                user_id: userMap.user_id,
                role: 'member',
                invited_at: new Date().toISOString(),
                joined_at: new Date().toISOString(),
              });
            }
          }
        }
        const { data: ws } = await supabase.from('workspaces').select('name').eq('id', invite.workspace_id).maybeSingle();
        await sendMessage(
          chatId,
          `✅ <b>Workspace linked!</b>\n\nThis group is now bound to <b>${ws?.name || 'the workspace'}</b>. Everything we add here will live inside that space.\n\nTeammates can send <code>/linkme &lt;their-code&gt;</code> so I know who's who.`,
          LOVABLE_API_KEY, TELEGRAM_API_KEY,
        );
        continue;
      }

      // ---------- /linkme <personal-code> (group only — partner self-identifies) ----------
      if (text.startsWith('/linkme') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Generate a personal link code in Settings → Telegram, then send: /linkme <code>', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: link } = await supabase.from('telegram_links').select('user_id, link_code_expires_at').eq('link_code', code).maybeSingle();
        const isExpired = link?.link_code_expires_at && new Date(link.link_code_expires_at) <= new Date();
        if (!link || isExpired) {
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
        // A group can be linked to a workspace (team) and/or a family space.
        // Workspace link takes precedence since it's explicit startup context.
        const [{ data: wsLink }, { data: glink }] = await Promise.all([
          supabase.from('workspace_telegram_links').select('workspace_id').eq('chat_id', chatId).eq('is_active', true).maybeSingle(),
          supabase.from('telegram_group_links').select('owner_user_id').eq('chat_id', chatId).eq('is_active', true).maybeSingle(),
        ]);
        // Wake-word matchers — broad to handle voice transcription variants
        // (Dori / Dory / Dorie / Doree / Dora / Dorai / Darai / DarAI / Tory / Lori etc.)
        const BOT_MENTION = /@\w*(darai|dori|dory|dora|tory|lori)\w*_?bot\b/i;
        const ADDRESSES_DORI = /^(hey\s+|hi\s+|hello\s+|ok\s+|okay\s+|yo\s+)?(dori|dory|dorie|doree|dora|dorai|darai|dar[\s-]?ai|tory|lori)\b[\s,.:;!?]?/i;
        const STRIP_MENTION = /@\w*(darai|dori|dory|dora|tory|lori)\w*_?bot\b/gi;
        const STRIP_ADDRESS = /^(hey\s+|hi\s+|hello\s+|ok\s+|okay\s+|yo\s+)?(dori|dory|dorie|doree|dora|dorai|darai|dar[\s-]?ai|tory|lori)\b[\s,.:;!?]*/i;

        if (!glink && !wsLink) {
          const hasMention = BOT_MENTION.test(rawText);
          const addressesDori = ADDRESSES_DORI.test(rawText.trim());
          if (rawText.startsWith('/') || hasMention || addressesDori) {
            await sendMessage(chatId, '🔒 This group isn\'t linked yet. Either /linkfamily for a family space or /linkworkspace for a startup team — grab a code in the app.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
          continue;
        }

        // Decide if Dori should respond. Stay silent on family chit-chat.
        const repliedToIsBot = msg.reply_to_message?.from?.is_bot === true;
        const hasMention = BOT_MENTION.test(rawText);
        const addressesDori = ADDRESSES_DORI.test(rawText.trim());
        const actionKeywords = /\b(buy|need|get|pick up|grab|remind|reminder|task|todo|to-do|schedule|meeting|appointment|event|tomorrow|today|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|kaufen|brauchen|besorgen|erinner|termin|morgen|heute)\b/i;
        const looksActionable = actionKeywords.test(rawText);
        const isCommand = rawText.startsWith('/');
        // Voice/audio messages → always respond (user clearly meant to interact)
        const isVoice = !!(msg.voice || msg.audio);

        // Photos/images posted in linked groups should ALWAYS be processed —
        // family/assistant typically share receipts, calendar screenshots,
        // school notices, prescriptions, etc. without explicitly addressing Dori.
        const isPhoto = !!photoDataUrl;
        const shouldRespond = hasMention || addressesDori || repliedToIsBot || looksActionable || isCommand || isVoice || isPhoto;

        if (!shouldRespond) {
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }

        // Strip mention/address prefix before sending to router
        const cleanText = rawText
          .replace(STRIP_MENTION, '')
          .replace(STRIP_ADDRESS, '')
          .trim() || text;

        tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});

        // ── PHOTO in group → bypass text-only router and call Dori directly with imageUrl.
        // Resolve the sender's app user_id (via telegram_user_map) so the action is
        // attributed correctly; fall back to the group owner if the sender hasn't
        // personally linked their Telegram account yet.
        if (photoDataUrl) {
          let actingUserId: string | null = null;
          if (fromId) {
            const { data: userMap } = await supabase
              .from('telegram_user_map')
              .select('user_id')
              .eq('telegram_user_id', fromId)
              .maybeSingle();
            actingUserId = userMap?.user_id ?? null;
          }
          if (!actingUserId) actingUserId = glink?.owner_user_id ?? null;
          if (!actingUserId) {
            await sendMessage(chatId, "📸 I can read photos here, but this group isn't linked to a personal account yet. Run /linkfamily or have a member link via Settings → Telegram.", LOVABLE_API_KEY, TELEGRAM_API_KEY);
            await supabase.from('telegram_messages').upsert({
              update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
            }, { onConflict: 'update_id' });
            processed++;
            continue;
          }
          await sendMessage(chatId, '🔍 Reading the picture…', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          const dori = await callDori(
            actingUserId,
            cleanText,
            chatId,
            supabaseUrl,
            serviceKey,
            photoDataUrl,
            undefined,
            wsLink?.workspace_id || null,
          );
          const replyText = dori.reply || '✅ Got it.';
          await sendMessage(chatId, replyText, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }

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
              workspace_id: wsLink?.workspace_id || null,
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
        .select('user_id, is_active, active_workspace_id')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (!link || !link.is_active) {
        await sendMessage(chatId, '🔒 This chat isn\'t linked yet. Open Dori → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // /workspace — scope the next commands to a workspace the user belongs
      // to. "/workspace Acme" looks up a member-visible workspace by name
      // (case-insensitive contains), stores it on telegram_links, and the
      // subsequent callDori calls pass it into the chat function. "/workspace
      // off" (or "/workspace personal") clears it.
      {
        const wsMatch = text.trim().match(/^\/workspace(?:\s+(.+))?$/i);
        if (wsMatch) {
          const arg = (wsMatch[1] || '').trim();
          if (!arg || arg.toLowerCase() === 'list' || arg === '?') {
            // Show current + available.
            const [{ data: current }, { data: memberRows }] = await Promise.all([
              supabase.from('telegram_links').select('active_workspace_id').eq('user_id', link.user_id).maybeSingle(),
              supabase.from('workspace_members').select('workspace_id').eq('user_id', link.user_id),
            ]);
            const wsIds = (memberRows || []).map((m: any) => m.workspace_id);
            const { data: wsList } = wsIds.length
              ? await supabase.from('workspaces').select('id, name, icon').in('id', wsIds).eq('archived', false)
              : { data: [] } as any;
            const activeId = (current as any)?.active_workspace_id as string | null;
            const lines = ['<b>🧑‍🤝‍🧑 Workspaces</b>'];
            lines.push(`Current scope: ${activeId ? `<b>${(wsList as any[])?.find((w) => w.id === activeId)?.name || activeId.slice(0, 8)}</b>` : '<b>Personal</b>'}`);
            if ((wsList as any[])?.length) {
              lines.push('\nSwitch with <code>/workspace &lt;name&gt;</code>:');
              (wsList as any[]).forEach((w: any) => {
                lines.push(`• ${w.icon || '📁'} ${w.name}`);
              });
            } else {
              lines.push('\nYou\'re not in any workspaces yet. Create or join one in the app.');
            }
            lines.push('\nUse <code>/workspace off</code> to return to Personal.');
            await sendDoriReply({
              chatId, text: lines.join('\n'), preferVoice: wasVoiceMessage,
              lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
            });
          } else if (['off', 'personal', 'none', 'clear'].includes(arg.toLowerCase())) {
            await supabase.from('telegram_links').update({ active_workspace_id: null }).eq('user_id', link.user_id);
            await sendDoriReply({
              chatId, text: '✅ Cleared — next commands run in your Personal space.',
              preferVoice: wasVoiceMessage,
              lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
            });
          } else {
            // Resolve name → id against workspaces the user is actually a member of.
            const { data: memberRows } = await supabase.from('workspace_members')
              .select('workspace_id').eq('user_id', link.user_id);
            const wsIds = (memberRows || []).map((m: any) => m.workspace_id);
            let match: any = null;
            if (wsIds.length) {
              const { data: wsList } = await supabase.from('workspaces')
                .select('id, name, icon').in('id', wsIds).eq('archived', false);
              const needle = arg.toLowerCase();
              match = (wsList || []).find((w: any) => (w.name || '').toLowerCase() === needle)
                || (wsList || []).find((w: any) => (w.name || '').toLowerCase().includes(needle));
            }
            if (!match) {
              await sendDoriReply({
                chatId, text: `🤔 I don't see a workspace named "${arg}" you're a member of. Try <code>/workspace list</code>.`,
                preferVoice: wasVoiceMessage,
                lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
              });
            } else {
              await supabase.from('telegram_links')
                .update({ active_workspace_id: match.id }).eq('user_id', link.user_id);
              await sendDoriReply({
                chatId, text: `✅ Switched to <b>${match.icon || '📁'} ${match.name}</b>. New tasks / events / notes I create here will live in that workspace. <code>/workspace off</code> to go back to Personal.`,
                preferVoice: wasVoiceMessage,
                lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
              });
            }
          }
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      // /focus — silence Dori's proactive sends for a bounded window.
      // /focus on 2h | /focus 30m | /focus off
      {
        const m = text.trim().match(/^\/focus(?:\s+(on|off|end)?)?(?:\s+(\d+)\s*(m(?:in)?|mins|minutes|h(?:r)?|hrs|hours)?)?$/i);
        if (m) {
          const stateArg = (m[1] || '').toLowerCase();
          const n = m[2] ? Number(m[2]) : null;
          const unit = (m[3] || '').toLowerCase();
          let reply = '';
          if (stateArg === 'off' || stateArg === 'end') {
            await supabase.from('proactive_settings')
              .upsert({ user_id: link.user_id, focus_mode_until: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            reply = '🔔 Focus mode off — I\'ll pipe up again as needed.';
          } else {
            const mins = n
              ? (unit.startsWith('h') ? n * 60 : n)
              : 60;  // default: 1 hour
            const until = new Date(Date.now() + mins * 60 * 1000).toISOString();
            await supabase.from('proactive_settings')
              .upsert({ user_id: link.user_id, focus_mode_until: until, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            // Edge runtime is UTC — format the resume time in the user's
            // configured timezone or the reply says "16:00" for a Berlin
            // 18:00, which is more confusing than helpful.
            const { data: p } = await supabase.from('profiles').select('timezone').eq('user_id', link.user_id).maybeSingle();
            const tz = p?.timezone || undefined;
            const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(until));
            reply = `🔇 Focus mode on for ${mins} min. I'll hold all nudges until ${timeStr}. /focus off to cancel.`;
          }
          await sendDoriReply({
            chatId, text: reply, preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      // /me — instant personal digest, no AI round-trip.
      if (text.trim().toLowerCase() === '/me') {
        try {
          // Pull the caller's tz so "today" and time strings match their clock.
          const { data: p } = await supabase.from('profiles').select('timezone').eq('user_id', link.user_id).maybeSingle();
          const tz = p?.timezone || undefined;
          const ctx = await buildDoriContext(supabase, link.user_id, null, { timezone: tz });
          const ymdIn = (iso: string | Date) =>
            new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
          const todayYmd = ymdIn(new Date());
          const parts: string[] = ['<b>🌤 Your day</b>'];
          if (ctx.overdueCount > 0) parts.push(`\n⚠️ <b>${ctx.overdueCount} overdue</b> — tackle first.`);
          if (ctx.todayEvents.length > 0) {
            parts.push('\n<b>Today</b>');
            ctx.todayEvents.forEach((e) => {
              const t = new Date(e.start_time).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
              parts.push(`• ${t} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
            });
          }
          const dueToday = ctx.openTasks.filter((t) => t.due_date && ymdIn(t.due_date) === todayYmd);
          if (dueToday.length > 0) {
            parts.push('\n<b>Due today</b>');
            dueToday.slice(0, 8).forEach((t) => {
              const pr = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⚪️' : '🟡';
              parts.push(`${pr} ${t.title}`);
            });
          }
          if (ctx.tomorrowEvents.length > 0) {
            parts.push(`\n<b>Tomorrow</b> — ${ctx.tomorrowEvents.length} event${ctx.tomorrowEvents.length === 1 ? '' : 's'}.`);
          }
          if (ctx.openTasks.length === 0 && ctx.todayEvents.length === 0 && ctx.tomorrowEvents.length === 0) {
            parts.push('\nNothing on your plate. Enjoy. ☕');
          }
          await sendDoriReply({
            chatId, text: parts.join('\n'), preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
        } catch (e) {
          console.error('/me failed', e);
          await sendMessage(chatId, '⚠️ Could not build your digest. Try again shortly.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      // /undo shortcut: reverses the most recent still-undoable mutation.
      if (text.trim().toLowerCase() === '/undo' || /^(undo|undo that|revert|revert that|rückgängig)\b/i.test(text.trim())) {
        const entry = await fetchLatestUndoableForUser(supabase, link.user_id);
        if (!entry) {
          await sendDoriReply({
            chatId, text: "⏰ Nothing to undo — the 5-minute window has passed or you haven't done anything yet.",
            preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
        } else {
          const res = await runUndo(supabase, entry, supabaseUrl, serviceKey);
          await sendDoriReply({
            chatId, text: res.message, preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
        }
        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      // If the user has a pending confirmation and just replied "yes"/"no",
      // resolve it without another AI round.
      const confirm = classifyConfirmationText(text);
      if (confirm) {
        const pending = await fetchLatestPendingForChat(supabase, link.user_id, 'tg_private', String(chatId));
        if (pending) {
          const outcome = confirm === 'yes'
            ? await approveAndExecutePending(supabase, pending, supabaseUrl, serviceKey)
            : await rejectPending(supabase, pending.id, pending.reason);
          await sendDoriReply({
            chatId, text: outcome, preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});

      // Instant placeholder so the user sees acknowledgment in ~100ms instead
      // of waiting 5-15s for the full AI round to finish. Streaming path will
      // mutate this message in-place as deltas arrive.
      let placeholderMessageId: number | null = null;
      try {
        const phResp = await tg('sendMessage', {
          chat_id: chatId,
          text: photoDataUrl ? '🔍 Reading your photo…' : '🤔 Thinking…',
        }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        placeholderMessageId = phResp?.result?.message_id ?? null;
      } catch (e) {
        console.warn('placeholder send failed', e);
      }

      // Throttled live-edit callback. Telegram rate-limits editMessageText
      // to ~1/sec/message, so we coalesce deltas within a 1s window and
      // only edit when the text has meaningfully changed.
      let lastEditAt = 0;
      let lastEditedLen = 0;
      let pendingEdit: ReturnType<typeof setTimeout> | null = null;
      let latestText = '';
      const flushEdit = async () => {
        pendingEdit = null;
        if (!placeholderMessageId) return;
        if (!latestText || latestText.length === lastEditedLen) return;
        lastEditAt = Date.now();
        lastEditedLen = latestText.length;
        try {
          await tgEditMessageText(chatId, placeholderMessageId, latestText.slice(0, 4000) + ' …', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } catch (e) { console.warn('streaming edit failed', e); }
      };
      const streamCbs = placeholderMessageId && !photoDataUrl
        ? {
            onText: (text: string) => {
              latestText = text;
              const now = Date.now();
              const since = now - lastEditAt;
              if (since >= 1000) {
                // Enough time has passed — fire now.
                flushEdit();
              } else if (!pendingEdit) {
                // Schedule a trailing edit so the user sees the latest text
                // even when deltas arrive in a tight burst.
                pendingEdit = setTimeout(flushEdit, 1000 - since);
              }
            },
          }
        : undefined;

      // Respect the user's /workspace selection for this chat (default: Personal).
      // Re-verify membership at read-time so a stale id from a workspace the
      // user left can't leak data — if they're no longer a member, fall back
      // to Personal and silently clear the stored id.
      let activeWsForChat: string | null = (link as any).active_workspace_id || null;
      if (activeWsForChat) {
        const { data: mem } = await supabase.from('workspace_members')
          .select('user_id').eq('workspace_id', activeWsForChat).eq('user_id', link.user_id).maybeSingle();
        if (!mem) {
          await supabase.from('telegram_links').update({ active_workspace_id: null }).eq('user_id', link.user_id);
          activeWsForChat = null;
        }
      }

      const dori = await callDori(link.user_id, text, chatId, supabaseUrl, serviceKey, photoDataUrl, streamCbs, activeWsForChat);
      if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = null; }

      // Voice reply if user prefers OR if they sent a voice message. Locale
      // is loaded alongside so the TTS voice matches the user's language.
      let preferVoice = wasVoiceMessage;
      let userLocale: string | undefined;
      try {
        const supabaseForPref = createClient(supabaseUrl, serviceKey);
        const [{ data: ps }, { data: prof }] = await Promise.all([
          supabaseForPref.from('proactive_settings').select('prefer_voice_replies').eq('user_id', link.user_id).maybeSingle(),
          supabaseForPref.from('profiles').select('locale').eq('user_id', link.user_id).maybeSingle(),
        ]);
        if (ps?.prefer_voice_replies) preferVoice = true;
        userLocale = prof?.locale || undefined;
      } catch (_) { /* ignore */ }

      const queued = dori.toolResults.filter((t) => t.queued && t.actionId);
      const executed = dori.toolResults.filter((t) => !t.queued);

      const bodyParts: string[] = [];
      if (dori.reply) bodyParts.push(dori.reply);
      if (executed.length > 0) bodyParts.push(executed.map((t) => t.message).join('\n'));
      const replyText = bodyParts.join('\n\n').trim();

      // If any executed tool was reversible, grab the most recent undo id so
      // we can offer the user a one-tap ↩️ Undo button on the outgoing reply.
      const undoableIds = executed.map((t) => t.undoId).filter(Boolean) as string[];
      const latestUndoId = undoableIds.length > 0 ? undoableIds[undoableIds.length - 1] : null;

      // Figure out the final outgoing text for the "main" reply.
      const outgoingText = replyText || (queued.length === 0 ? "I processed that but didn't have anything to add." : null);

      if (placeholderMessageId && outgoingText && !preferVoice) {
        // Update the placeholder in place → the user sees the same message
        // transform from "🤔 Thinking…" into the real answer. Feels instant.
        await tgEditMessageText(chatId, placeholderMessageId, outgoingText.slice(0, 4000), LOVABLE_API_KEY, TELEGRAM_API_KEY);
        if (latestUndoId) {
          await tgEditReplyMarkup(chatId, placeholderMessageId, buildUndoKeyboard(latestUndoId), LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
      } else {
        // Voice path, or we failed to place a placeholder — delete the stale
        // placeholder if any, then send via the normal (potentially-voice) path.
        if (placeholderMessageId) {
          try { await tg('deleteMessage', { chat_id: chatId, message_id: placeholderMessageId }, LOVABLE_API_KEY, TELEGRAM_API_KEY); }
          catch { /* ignore */ }
        }
        if (outgoingText) {
          await sendDoriReply({
            chatId, text: outgoingText, preferVoice, locale: userLocale,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
          if (latestUndoId) {
            await tgSendWithKeyboard(
              chatId,
              '↩️ Tap to undo the last action.',
              buildUndoKeyboard(latestUndoId),
              LOVABLE_API_KEY,
              TELEGRAM_API_KEY,
            );
          }
        }
      }

      for (const q of queued) {
        const prompt = `🤔 <b>Please confirm</b>\n${q.summary || q.message}\n\nReply <b>yes</b> or tap a button below.`;
        await tgSendWithKeyboard(
          chatId,
          prompt,
          buildConfirmKeyboard(q.actionId!),
          LOVABLE_API_KEY,
          TELEGRAM_API_KEY,
        );
      }

      await supabase.from('telegram_messages').upsert({
        update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
      }, { onConflict: 'update_id' });
      processed++;
      } finally {
        // Even if the try-block above threw, advance the offset past this
        // update so we don't re-deliver it. We tolerate dropping a reply
        // far more than we tolerate duplicating actions.
        const nextOffset = u.update_id + 1;
        if (nextOffset > currentOffset) {
          currentOffset = nextOffset;
          try {
            await supabase
              .from('telegram_bot_state')
              .update({ update_offset: nextOffset, updated_at: new Date().toISOString() })
              .eq('id', 1);
          } catch (e) { console.error('offset persist failed', e); }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
