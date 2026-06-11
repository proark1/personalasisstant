// Polls Telegram getUpdates and routes incoming messages.
// 1:1 chats → Dori chat; group chats linked via /linkfamily → telegram-router.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

// Minimal shape of a Telegram callback_query object
interface TgCallback {
  id: string;
  data?: string;
  message?: {
    message_id?: number;
    chat?: { id?: number; type?: string };
  };
  from?: { id?: number };
}
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { defaultBriefingVoiceLimit, sendDoriReply, sendVoiceMessage } from '../_shared/telegram-voice.ts';
import { generateNews, type NewsItem } from '../_shared/briefingNews.ts';
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
  buildAssistantCockpitKeyboard,
  buildAssistantCockpitMessage,
  buildSteeringCommandMessage,
  buildSteeringPrompt,
  dispatchTelegramControlCommand,
  type TelegramControlCommand,
  type TelegramSteeringCommand,
} from '../_shared/telegram-control.ts';
import {
  buildBestNextActionMessage,
  buildMemorySnapshotMessage,
  escapeTelegramHtml,
  formatTelegramDate,
  userDayYmd,
} from '../_shared/telegram-quick.ts';
import { strictAppOrigin } from '../_shared/cors.ts';
import {
  fetchLatestUndoableForUser,
  fetchUndoable,
  runUndo,
} from '../_shared/dori-undo.ts';

const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function tg(method: string, body: Record<string, unknown>, tgKey: string) {
  const r = await fetch(`https://api.telegram.org/bot${tgKey}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function sendMessage(chatId: number, text: string, tgKey: string) {
  try {
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' }, tgKey);
  } catch (e) {
    console.error('sendMessage failed:', e);
  }
}

async function markTelegramProcessed(
  supabase: SupabaseClient,
  updateId: number,
  chatId: number,
  text: string,
  rawUpdate: unknown,
): Promise<void> {
  await supabase.from('telegram_messages').upsert({
    update_id: updateId,
    chat_id: chatId,
    text,
    raw_update: rawUpdate,
    processed: true,
  }, { onConflict: 'update_id' });
}

async function loadUserTimezone(supabase: SupabaseClient, userId: string): Promise<string | undefined> {
  const { data } = await supabase.from('profiles').select('timezone').eq('user_id', userId).maybeSingle();
  return data?.timezone || undefined;
}

async function resolveActiveWorkspaceForChat(
  supabase: SupabaseClient,
  userId: string,
  activeWorkspaceId?: string | null,
): Promise<string | null> {
  if (!activeWorkspaceId) return null;
  const { data: membership } = await supabase.from('workspace_members')
    .select('user_id')
    .eq('workspace_id', activeWorkspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membership) return activeWorkspaceId;

  // Clear stale workspace scope so command shortcuts and the main AI path
  // can't leak or act inside a workspace the user has left.
  await supabase.from('telegram_links').update({ active_workspace_id: null }).eq('user_id', userId);
  return null;
}

async function sendApprovalInbox(
  supabase: SupabaseClient,
  chatId: number,
  userId: string,
  tgKey: string,
  preferVoice: boolean,
): Promise<void> {
  const tz = await loadUserTimezone(supabase, userId);
  const nowIso = new Date().toISOString();
  const { data: pending, error } = await supabase
    .from('auto_actions_log')
    .select('id, action_type, entity_type, reason, source, created_at, expires_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('/approvals failed', error);
    await sendMessage(chatId, '⚠️ Could not load your approval inbox. Try again shortly.', tgKey);
    return;
  }

  const rows = (pending ?? []) as Array<{
    id: string;
    action_type?: string | null;
    reason?: string | null;
    source?: string | null;
    expires_at?: string | null;
  }>;

  if (rows.length === 0) {
    await sendDoriReply({
      chatId,
      text: '✅ <b>Approval inbox is clear.</b>\nNo pending actions need your OK right now.',
      preferVoice,
      telegramKey: tgKey,
    });
    return;
  }

  await sendDoriReply({
    chatId,
    text: `📥 <b>Approval inbox</b>\n${rows.length} pending action${rows.length === 1 ? '' : 's'} need your OK. Tap a button on each card:`,
    preferVoice,
    telegramKey: tgKey,
  });

  for (const row of rows) {
    const title = row.reason || row.action_type || 'Pending action';
    const expires = row.expires_at ? `\n⏳ Expires ${escapeTelegramHtml(formatTelegramDate(row.expires_at, tz))}` : '';
    const source = row.source ? `\nSource: <code>${escapeTelegramHtml(row.source)}</code>` : '';
    await tgSendWithKeyboard(
      chatId,
      `🤔 <b>${escapeTelegramHtml(title)}</b>${source}${expires}`,
      buildConfirmKeyboard(row.id),
      tgKey,
    );
  }
}

async function sendBestNextAction(
  supabase: SupabaseClient,
  chatId: number,
  userId: string,
  tgKey: string,
  preferVoice: boolean,
  workspaceId: string | null,
): Promise<void> {
  const tz = await loadUserTimezone(supabase, userId);
  const nowIso = new Date().toISOString();
  const { count: pendingCount } = await supabase
    .from('auto_actions_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  const ctx = await buildDoriContext(supabase, userId, workspaceId, { timezone: tz });
  const now = new Date();
  const nextEvent = ctx.todayEvents
    .filter((e) => new Date(e.start_time).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
  const todayYmd = userDayYmd(now, tz);
  const overdue = ctx.openTasks
    .filter((t) => t.due_date && userDayYmd(new Date(t.due_date), tz) < todayYmd)
    .sort((a, b) => {
      const priorityScore = (p: string) => p === 'high' ? 0 : p === 'medium' ? 1 : 2;
      return priorityScore(a.priority) - priorityScore(b.priority);
    })[0];
  const dueToday = ctx.openTasks.find((t) => t.due_date && userDayYmd(new Date(t.due_date), tz) === todayYmd);

  const text = buildBestNextActionMessage({
    pendingCount: pendingCount ?? 0,
    workspaceId,
    nextEvent,
    overdue,
    dueToday,
    now,
    timezone: tz,
  });

  await sendDoriReply({ chatId, text, preferVoice, telegramKey: tgKey });
}

async function sendMemorySnapshot(
  supabase: SupabaseClient,
  chatId: number,
  userId: string,
  tgKey: string,
  preferVoice: boolean,
  workspaceId: string | null,
): Promise<void> {
  let memoryQuery = supabase
    .from('ai_memory')
    .select('memory_type, category, key, value, confidence, source, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  memoryQuery = workspaceId
    ? memoryQuery.eq('workspace_id', workspaceId)
    : memoryQuery.is('workspace_id', null);

  const [{ data: memories }, { data: prefs }] = await Promise.all([
    memoryQuery.limit(8),
    supabase
      .from('dori_learned_preferences')
      .select('key, value, confidence, times_seen, last_seen_at')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .limit(8),
  ]);

  const memoryRows = (memories ?? []) as Array<{
    memory_type?: string | null;
    category?: string | null;
    key?: string | null;
    value?: string | null;
  }>;
  const prefRows = (prefs ?? []) as Array<{
    key?: string | null;
    value?: string | null;
    confidence?: number | null;
    times_seen?: number | null;
  }>;

  const text = buildMemorySnapshotMessage({ workspaceId, memoryRows, prefRows });
  await sendDoriReply({ chatId, text, preferVoice, telegramKey: tgKey });
}


async function sendAssistantCockpit(chatId: number, tgKey: string): Promise<void> {
  await tgSendWithKeyboard(chatId, buildAssistantCockpitMessage(), buildAssistantCockpitKeyboard(), tgKey);
}

async function sendSteeringCommand(
  chatId: number,
  tgKey: string,
  command: TelegramSteeringCommand,
): Promise<void> {
  await tgSendWithKeyboard(chatId, buildSteeringCommandMessage(command), buildAssistantCockpitKeyboard(), tgKey);
}

async function runSteeringCommand(
  chatId: number,
  userId: string,
  tgKey: string,
  command: TelegramSteeringCommand,
  args: string,
  preferVoice: boolean,
  workspaceId: string | null,
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  if (!args.trim()) {
    await sendSteeringCommand(chatId, tgKey, command);
    return;
  }

  await tg('sendChatAction', { chat_id: chatId, action: 'typing' }, tgKey).catch(() => {});
  const dori = await callDori(userId, buildSteeringPrompt(command, args), chatId, supabaseUrl, serviceKey, null, undefined, workspaceId);
  const queued = dori.toolResults.filter((t) => t.queued && t.actionId);
  const executed = dori.toolResults.filter((t) => !t.queued);
  const bodyParts: string[] = [];
  if (dori.reply) bodyParts.push(dori.reply);
  if (executed.length > 0) bodyParts.push(executed.map((t) => t.message).join('\n'));
  const replyText = bodyParts.join('\n\n').trim() || `I prepared the /${command} request.`;

  await sendDoriReply({ chatId, text: replyText, preferVoice, telegramKey: tgKey });

  for (const action of queued) {
    await tgSendWithKeyboard(
      chatId,
      `🤔 <b>Approve Dori action?</b>
${escapeTelegramHtml(action.summary || action.message || 'Queued action')}`,
      buildConfirmKeyboard(action.actionId as string),
      tgKey,
    );
  }
}

async function recordTelegramControlMetric(
  supabase: SupabaseClient,
  userId: string,
  chatId: number,
  command: TelegramControlCommand,
  source: 'slash' | 'callback',
  workspaceId?: string | null,
): Promise<void> {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_category: 'telegram',
      event_type: 'telegram_control_command',
      page_path: 'telegram',
      event_data: {
        command,
        source,
        chat_id: chatId,
        workspace_id: workspaceId ?? null,
      },
    });
  } catch (e) {
    console.warn('telegram control metric failed', e);
  }
}

const PRIVATE_HELP_TEXT = `<b>🤖 Dori in Telegram</b>

Talk naturally, send voice notes, forward messages, or upload photos/screenshots.

<b>Core commands</b>
/cockpit — open the button-based command center
/me — today at a glance
/now — best next move (<code>/next</code>, <code>/whatnow</code>)
/approvals — approve or cancel pending actions (<code>/pending</code>)
/memory — what I remember + how to forget (<code>/memories</code>)
/workspace list — switch personal/work context
/focus on 2h — pause proactive nudges
/undo — reverse the last undoable action

<b>Steering modes</b>
/brief — command-center briefing prompt
/plan — plan a day, project, or outcome
/delegate — hand Dori a job with approval rules
/review — review pending decisions and recent work
/settings — steer preferences, workspace, focus, voice, and memory

Try: <code>plan my day</code>, <code>summarize unread emails</code>, <code>move dentist to Friday</code>, <code>remember I prefer meetings after 10</code>.`;

// Download a Telegram file by id and return the raw bytes. Used by the
// document-intake path which extracts text rather than passing the file
// straight to a multimodal model.
async function downloadTelegramFileBytes(
  fileId: string,
  tgKey: string,
): Promise<Uint8Array | null> {
  try {
    const fileRes = await tg('getFile', { file_id: fileId }, tgKey);
    const filePath = fileRes?.result?.file_path;
    if (!filePath) return null;
    const dl = await fetch(`https://api.telegram.org/file/bot${tgKey}/${filePath}`);
    if (!dl.ok) {
      console.error('file download failed', dl.status);
      return null;
    }
    return new Uint8Array(await dl.arrayBuffer());
  } catch (e) {
    console.error('downloadTelegramFileBytes error', e);
    return null;
  }
}

// Download a Telegram file by id and return a base64 data URL suitable for
// the chat function's multimodal imageUrl field.
async function downloadTelegramFile(
  fileId: string,
  mime: string,
  tgKey: string,
): Promise<string | null> {
  const bytes = await downloadTelegramFileBytes(fileId, tgKey);
  if (!bytes) return null;
  // std/encoding/base64 uses a native fast path, avoids the call-stack
  // risk of String.fromCharCode.apply(...) on large Uint8Arrays, and doesn't
  // allocate an intermediate Array.
  const b64 = encodeBase64(bytes);
  return `data:${mime || 'application/octet-stream'};base64,${b64}`;
}

// Minimal PDF text extraction. This is *not* a full parser — it pulls the
// strings inside `(...)` literals from text-showing operators (Tj / TJ),
// which covers the majority of natively-typed PDFs (contracts, statements,
// reports). Scanned/image-only PDFs return empty and the user is told to
// paste text. Good enough for a chat summariser; for production accuracy
// we'd ship a real parser.
function extractPdfText(bytes: Uint8Array): string {
  const raw = new TextDecoder('latin1').decode(bytes);
  const out: string[] = [];
  // Match all "(...)" string literals, handling escaped parens. The (?:...)
  // alternation pulls everything between balanced parens lazily.
  const re = /\(((?:\\\)|\\\(|[^()])*)\)\s*(?:Tj|TJ)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const s = m[1]
      .replace(/\\\(/g, '(').replace(/\\\)/g, ')')
      .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
      .replace(/\\\\/g, '\\');
    if (s.trim().length > 0) out.push(s);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// Download a Telegram file (voice/audio) and transcribe via Gemini.
// Returns the transcript text, or null on failure.
async function transcribeTelegramVoice(
  fileId: string,
  mime: string,
  geminiKey: string,
  tgKey: string,
): Promise<string | null> {
  try {
    // 1) Resolve file_path
    const fileRes = await tg('getFile', { file_id: fileId }, tgKey);
    const filePath = fileRes?.result?.file_path;
    if (!filePath) return null;

    // 2) Download file bytes via Telegram Bot API
    const dl = await fetch(`https://api.telegram.org/file/bot${tgKey}/${filePath}`);
    if (!dl.ok) {
      console.error('voice download failed', dl.status);
      return null;
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());

    // 3) Base64 encode via std/encoding/base64 (native, no chunking needed).
    const base64Audio = encodeBase64(bytes);

    // 4) Transcribe via Gemini (audio inline as data URL)
    const audioMime = mime || 'audio/ogg';
    const aiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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
  supabase: SupabaseClient,
  args: {
    cb: TgCallback;
    userId: string;
    op: string;
    entity: string;
    entityId: string | null;
    label: string;
    snapshot: Record<string, unknown>;
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
  supabase: SupabaseClient,
  cb: TgCallback,
  payload: { op: 'complete' | 'snooze1h' | 'snooze1d' | 'delete'; taskId: string },
  tappingUserId: string | undefined,
  telegramKey: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const { data: task } = await supabase.from('tasks')
    .select('*').eq('id', payload.taskId).maybeSingle();
  if (!task) {
    await tgAnswerCallback(cb.id, 'Task not found.', telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== task.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this task.', telegramKey);
    return;
  }

  // Snapshot for undo (only for reversible ops).
  const snapshotBefore = { completed: task.completed, completed_at: task.completed_at, due_date: task.due_date };

  let outcome = '';
  let undoSnap: Record<string, unknown> | null = null;
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

  await tgAnswerCallback(cb.id, outcome.slice(0, 180), telegramKey);
  if (cb.message?.message_id) {
    await tgEditMessageText(cb.message.chat.id, cb.message.message_id, outcome, telegramKey);
    if (undoId) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), telegramKey);
    } else {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    }
  }
  // Silence unused-param warning on supabaseUrl/serviceKey — kept for API uniformity.
  void supabaseUrl; void serviceKey;
}

async function handleShopCallback(
  supabase: SupabaseClient,
  cb: TgCallback,
  payload: { op: 'check' | 'uncheck' | 'remove'; itemId: string },
  tappingUserId: string | undefined,
  telegramKey: string,
) {
  const { data: item } = await supabase.from('shopping_list_items')
    .select('*').eq('id', payload.itemId).maybeSingle();
  if (!item) {
    await tgAnswerCallback(cb.id, 'Item not found.', telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== item.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this item.', telegramKey);
    return;
  }

  let outcome = '';
  let undoSnap: Record<string, unknown> | null = null;
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

  await tgAnswerCallback(cb.id, outcome.slice(0, 180), telegramKey);
  if (cb.message?.message_id) {
    await tgEditMessageText(cb.message.chat.id, cb.message.message_id, outcome, telegramKey);
    if (undoId) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), telegramKey);
    } else {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    }
  }
}

async function handleEventCallback(
  supabase: SupabaseClient,
  cb: TgCallback,
  payload: { op: 'details' | 'cancel'; eventId: string },
  tappingUserId: string | undefined,
  telegramKey: string,
) {
  const { data: ev } = await supabase.from('events')
    .select('*').eq('id', payload.eventId).maybeSingle();
  if (!ev) {
    await tgAnswerCallback(cb.id, 'Event not found.', telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== ev.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this event.', telegramKey);
    return;
  }

  if (payload.op === 'details') {
    const details = [
      `<b>${ev.title}</b>`,
      `🕐 ${new Date(ev.start_time).toLocaleString()} — ${new Date(ev.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      ev.location ? `📍 ${ev.location}` : '',
      ev.description ? `\n${ev.description}` : '',
    ].filter(Boolean).join('\n');
    await tgAnswerCallback(cb.id, '', telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, details, telegramKey);
    }
  } else if (payload.op === 'cancel') {
    await supabase.from('events').delete().eq('id', ev.id);
    const undoId = await recordCallbackUndo(supabase, {
      cb, userId: ev.user_id, op: 'delete', entity: 'event', entityId: ev.id,
      label: `cancelled event "${ev.title}"`,
      snapshot: { kind: 'reinsert', table: 'events', row: ev },
    });
    await tgAnswerCallback(cb.id, '❌ Cancelled', telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, `❌ Cancelled event: ${ev.title}`, telegramKey);
      if (undoId) {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), telegramKey);
      } else {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
      }
    }
  }
}

async function handleContractCallback(
  supabase: SupabaseClient,
  cb: TgCallback,
  payload: { op: 'snooze7' | 'handled' | 'details'; contractId: string },
  tappingUserId: string | undefined,
  telegramKey: string,
) {
  const { data: c } = await supabase.from('contracts')
    .select('*').eq('id', payload.contractId).maybeSingle();
  if (!c) {
    await tgAnswerCallback(cb.id, 'Contract not found.', telegramKey);
    if (cb.message?.message_id) await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    return;
  }
  if (tappingUserId && tappingUserId !== c.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can touch this contract.', telegramKey);
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
    await tgAnswerCallback(cb.id, '', telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, details, telegramKey);
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
    await tgAnswerCallback(cb.id, payload.op === 'handled' ? '✅ Marked handled' : '⏰ Snoozed 7 days', telegramKey);
    if (cb.message?.message_id) {
      await tgEditMessageText(cb.message.chat.id, cb.message.message_id, text, telegramKey);
      if (undoId) {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, buildUndoKeyboard(undoId), telegramKey);
      } else {
        await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
      }
    }
  }
}

// Plan inline-keyboard handler. Mirrors the per-step controls the
// AssistantHubSheet exposes in the web app: Run next / Skip / Abort.
// Delegates to dori-plan-execute for the heavy lifting; we just
// ack the callback and edit the message to reflect the new state.
async function handlePlanCallback(
  supabase: SupabaseClient,
  cb: TgCallback,
  payload: { op: 'run_next' | 'skip' | 'abort'; planId: string },
  tappingUserId: string | undefined,
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
    await tgAnswerCallback(cb.id, 'Plan not found.', telegramKey);
    if (cb.message?.message_id) {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    }
    return;
  }
  if (tappingUserId && tappingUserId !== plan.user_id) {
    await tgAnswerCallback(cb.id, 'Only the owner can drive this plan.', telegramKey);
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

  await tgAnswerCallback(cb.id, updateOk ? '' : 'Failed', telegramKey);
  if (cb.message?.message_id) {
    const header = `📋 <b>${escape(plan.title)}</b>`;
    await tgEditMessageText(
      cb.message.chat.id,
      cb.message.message_id,
      `${header}\n\n${resultText}`,
      telegramKey,
    );
    // Re-attach the keyboard unless we hit a terminal state.
    if (action === 'abort') {
      await tgEditReplyMarkup(cb.message.chat.id, cb.message.message_id, null, telegramKey);
    } else {
      try {
        const { buildPlanRowKeyboard } = await import('../_shared/telegram-inline.ts');
        await tgEditReplyMarkup(
          cb.message.chat.id,
          cb.message.message_id,
          buildPlanRowKeyboard(plan.id),
          telegramKey,
        );
      } catch { /* ignore */ }
    }
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wantsNewsVoice(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return lower === '/news voice'
    || /\b(news|headlines)\b.*\b(voice|audio|speak|spoken)\b/i.test(text)
    || /\b(voice|audio|speak|spoken)\b.*\b(news|headlines)\b/i.test(text);
}

function buildNewsTelegramMessage(name: string, items: NewsItem[]): string {
  const lines: string[] = [`<b>🗞 ${escape(name)}</b>`];
  if (!items.length) {
    lines.push('\nNo notable updates on your topics right now.');
    return lines.join('\n');
  }
  for (const item of items) {
    lines.push(`\n• <b><a href="${item.url}">${escape(item.headline)}</a></b>`);
    if (item.summary) lines.push(`  ${escape(item.summary)}`);
  }
  return lines.join('\n');
}

function buildNewsVoiceScript(name: string, items: NewsItem[]): string {
  if (!items.length) return `${name}. No notable updates on your topics right now.`;
  const top = items.slice(0, 5);
  const lines = [`${name}. Here are your top ${top.length} news update${top.length === 1 ? '' : 's'} today.`];
  top.forEach((item, idx) => {
    const summary = (item.summary || '').replace(/\s+/g, ' ').trim();
    lines.push(`Story ${idx + 1}: ${item.headline}. ${summary}`.trim());
  });
  lines.push('I am sending the links in text as well.');
  return lines.join(' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Public: verify_jwt = false in config.toml. This endpoint is hit two ways —
  // by Telegram's webhook (POSTing a single Update) or by a scheduler doing
  // getUpdates polling. Telegram webhook calls carry no JWT, so the JWT gate
  // must stay off; instead, webhook deliveries are authenticated by an optional
  // shared secret (TELEGRAM_WEBHOOK_SECRET, see below). Supabase's built-in
  // function rate limits + timeouts bound worst-case abuse, and expensive paths
  // (voice transcription) only fire on real Telegram inputs.
  const startTime = Date.now();
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Webhook vs polling ──────────────────────────────────────────────────
  // Telegram delivers updates two ways: it can POST each update to a webhook
  // URL (instant, no scheduler), or we pull them with getUpdates (polling).
  // A webhook delivery POSTs a single Update object; the cron/poll caller
  // sends `{}`. We detect the mode from the body and, in webhook mode, run the
  // exact same per-update pipeline below for that one update. When a webhook is
  // registered Telegram disables getUpdates, so the poll path is simply never
  // taken — the two never run at once.
  let webhookUpdate: Record<string, unknown> | null = null;
  try {
    const body = await req.json();
    if (body && (body.update_id !== undefined || body.message || body.callback_query)) {
      webhookUpdate = body;
    }
  } catch { /* no/invalid JSON body → polling mode */ }
  const isWebhook = webhookUpdate !== null;

  // Optional shared-secret check for webhook deliveries. When
  // TELEGRAM_WEBHOOK_SECRET is set (and registered via setWebhook's
  // secret_token), Telegram echoes it back in this header on every call. We
  // reject mismatches so a leaked function URL can't be used to spoof updates.
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  if (isWebhook && webhookSecret) {
    const got = req.headers.get('x-telegram-bot-api-secret-token');
    if (got !== webhookSecret) {
      console.warn('[telegram-poll] webhook secret mismatch — rejecting');
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { data: state } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  let currentOffset = state?.update_offset ?? 0;
  let processed = 0;
  console.log(`[telegram-poll] tick: offset=${currentOffset}`);

  // The per-update pipeline (AI round-trip, tools, voice/photo) can take many
  // seconds. We wrap the loop so a webhook delivery can ACK Telegram instantly
  // and finish the work in the background — see the dispatch logic below.
  const runLoop = async (): Promise<void> => {
  while (isWebhook || Date.now() - startTime < MAX_RUNTIME_MS - MIN_REMAINING_MS) {
    let updates: Record<string, unknown>[];
    if (isWebhook) {
      // Single pushed update — process it once, then break out below.
      updates = [webhookUpdate as Record<string, unknown>];
    } else {
      const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime);
      const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
      if (timeout < 1) break;

      let data: Record<string, unknown>;
      try {
        data = await tg(
          'getUpdates',
          { offset: currentOffset, timeout, allowed_updates: ['message', 'callback_query'] },
          TELEGRAM_API_KEY,
        );
        // (voice/audio arrive inside 'message' updates — no extra allowed_updates needed)
      } catch (e) {
        console.error('getUpdates failed:', e);
        break;
      }

      updates = data.result ?? [];
      if (updates.length === 0) continue;
    }

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
            await tgAnswerCallback(cb.id, '', TELEGRAM_API_KEY);
          } else if (payload.kind === 'quick_command') {
            await tgAnswerCallback(cb.id, `/${payload.command}`, TELEGRAM_API_KEY);
            let commandUserId = tappingUserId;
            if (!commandUserId) {
              const { data: linked } = await supabase.from('telegram_links')
                .select('user_id, active_workspace_id')
                .eq('chat_id', cbChatId)
                .eq('is_active', true)
                .maybeSingle();
              commandUserId = linked?.user_id as string | undefined;
            }
            if (!commandUserId) {
              await sendMessage(cbChatId, '🔒 Link this chat to Dori first, then reopen the cockpit.', TELEGRAM_API_KEY);
            } else {
              const { data: linked } = await supabase.from('telegram_links')
                .select('active_workspace_id')
                .eq('chat_id', cbChatId)
                .eq('is_active', true)
                .maybeSingle();
              const activeWs = await resolveActiveWorkspaceForChat(
                supabase,
                commandUserId,
                (linked as Record<string, unknown> | null)?.active_workspace_id as string | null,
              );
              await dispatchTelegramControlCommand({
                text: `/${payload.command}`,
                chatId: cbChatId,
                userId: commandUserId,
                workspaceId: activeWs,
                source: 'callback',
                handlers: {
                  sendHelp: () => tgSendWithKeyboard(cbChatId, PRIVATE_HELP_TEXT, buildAssistantCockpitKeyboard(), TELEGRAM_API_KEY),
                  sendCockpit: () => sendAssistantCockpit(cbChatId, TELEGRAM_API_KEY),
                  sendApprovals: () => sendApprovalInbox(supabase, cbChatId, commandUserId, TELEGRAM_API_KEY, false),
                  sendNow: async () => {
                    try {
                      await sendBestNextAction(supabase, cbChatId, commandUserId, TELEGRAM_API_KEY, false, activeWs);
                    } catch (e) {
                      console.error('cockpit /now failed', e);
                      await sendMessage(cbChatId, '⚠️ Could not pick a next action. Try /me or ask “plan my day”.', TELEGRAM_API_KEY);
                    }
                  },
                  sendMemory: async () => {
                    try {
                      await sendMemorySnapshot(supabase, cbChatId, commandUserId, TELEGRAM_API_KEY, false, activeWs);
                    } catch (e) {
                      console.error('cockpit /memory failed', e);
                      await sendMessage(cbChatId, '⚠️ Could not load memory right now. Try again shortly.', TELEGRAM_API_KEY);
                    }
                  },
                  sendSteering: (command, args) => runSteeringCommand(cbChatId, commandUserId, TELEGRAM_API_KEY, command, args, false, activeWs, supabaseUrl, serviceKey),
                  recordMetric: (command) => recordTelegramControlMetric(supabase, commandUserId, cbChatId, command, 'callback', activeWs),
                },
              });
            }
          } else if (payload.kind === 'confirm' || payload.kind === 'reject') {
            const actionId = payload.kind === 'confirm' ? payload.actionId : payload.actionId;
            const { data: action } = await supabase.from('auto_actions_log')
              .select('*').eq('id', actionId).maybeSingle();
            if (!action) {
              await tgAnswerCallback(cb.id, 'That action is no longer available.', TELEGRAM_API_KEY);
            } else if (!isActionableNow(action as Record<string, unknown>)) {
              await tgAnswerCallback(cb.id, `This expired.`, TELEGRAM_API_KEY);
              if (cbMessageId) {
                await tgEditMessageText(cbChatId, cbMessageId,
                  `⏰ This confirmation expired — ask me again if you still want to "${action.reason}".`,
                  TELEGRAM_API_KEY);
              }
            } else if (tappingUserId && tappingUserId !== action.user_id) {
              await tgAnswerCallback(cb.id, 'Only the person who asked Dori can confirm this.', TELEGRAM_API_KEY);
            } else {
              const outcome = payload.kind === 'confirm'
                ? await approveAndExecutePending(supabase, action, supabaseUrl, serviceKey)
                : await rejectPending(supabase, action.id, action.reason);
              await tgAnswerCallback(cb.id, payload.kind === 'confirm' ? '✅ Done' : '❌ Cancelled', TELEGRAM_API_KEY);
              if (cbMessageId) {
                await tgEditMessageText(cbChatId, cbMessageId, outcome, TELEGRAM_API_KEY);
              }
              try { await supabase.from('telegram_assistant_replies').insert({ chat_id: cbChatId, reply: outcome }); } catch { /* ignore */ }
            }
          } else if (payload.kind === 'undo') {
            const entry = await fetchUndoable(supabase, payload.undoId);
            if (!entry) {
              await tgAnswerCallback(cb.id, '⏰ Undo window expired.', TELEGRAM_API_KEY);
              if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, TELEGRAM_API_KEY);
            } else if (tappingUserId && tappingUserId !== entry.user_id) {
              await tgAnswerCallback(cb.id, 'Only the owner can undo this.', TELEGRAM_API_KEY);
            } else {
              const res = await runUndo(supabase, entry, supabaseUrl, serviceKey);
              await tgAnswerCallback(cb.id, res.ok ? '↩️ Undone' : '⚠️', TELEGRAM_API_KEY);
              if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, TELEGRAM_API_KEY);
              await sendMessage(cbChatId, res.message, TELEGRAM_API_KEY);
            }
          } else if (payload.kind === 'task') {
            await handleTaskCallback(supabase, cb, payload, tappingUserId, TELEGRAM_API_KEY, supabaseUrl, serviceKey);
          } else if (payload.kind === 'shop') {
            await handleShopCallback(supabase, cb, payload, tappingUserId, TELEGRAM_API_KEY);
          } else if (payload.kind === 'event') {
            await handleEventCallback(supabase, cb, payload, tappingUserId, TELEGRAM_API_KEY);
          } else if (payload.kind === 'contract') {
            await handleContractCallback(supabase, cb, payload, tappingUserId, TELEGRAM_API_KEY);
          } else if (payload.kind === 'plan') {
            await handlePlanCallback(supabase, cb, payload, tappingUserId, TELEGRAM_API_KEY, supabaseUrl, serviceKey);
          } else if (payload.kind === 'dismiss') {
            await tgAnswerCallback(cb.id, '', TELEGRAM_API_KEY);
            if (cbMessageId) await tgEditReplyMarkup(cbChatId, cbMessageId, null, TELEGRAM_API_KEY);
          } else {
            await tgAnswerCallback(cb.id, '', TELEGRAM_API_KEY);
          }
        } catch (e) {
          console.error('callback handler error', e);
          await tgAnswerCallback(cb.id, '⚠️ Something went wrong.', TELEGRAM_API_KEY);
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
          await tg('sendChatAction', { chat_id: chatId, action: 'typing' }, TELEGRAM_API_KEY);
        } catch { /* ignore */ }
        textFromVoice = await transcribeTelegramVoice(v.file_id, mime, GEMINI_API_KEY, TELEGRAM_API_KEY);
        if (!textFromVoice) {
          await sendMessage(chatId, "🎙️ I couldn't understand that voice message. Try again or type it.", TELEGRAM_API_KEY);
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
          (a: { width?: number; height?: number }, b: { width?: number; height?: number }) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)),
        )[0];
        photoDataUrl = await downloadTelegramFile(biggest.file_id, 'image/jpeg', TELEGRAM_API_KEY);
        photoCaption = msg.caption || null;
      } else if (msg.document && typeof msg.document.mime_type === 'string' && msg.document.mime_type.startsWith('image/')) {
        photoDataUrl = await downloadTelegramFile(msg.document.file_id, msg.document.mime_type, TELEGRAM_API_KEY);
        photoCaption = msg.caption || null;
      }
      // ---------- PDF / TEXT DOCUMENT → cache extracted text so summarise_document can read it ----------
      // The image branch above already covers picture documents. This branch
      // handles real documents (contracts, statements, slides, plain text).
      // We grab the bytes, do a cheap text extraction (text/* directly, PDF
      // via a regex on stream-text objects), and upsert one row per user in
      // telegram_documents. The summarise_document tool reads that row.
      let docNote: string | null = null;
      if (
        !photoDataUrl
        && msg.document
        && typeof msg.document.mime_type === 'string'
        && !msg.document.mime_type.startsWith('image/')
      ) {
        const mime = msg.document.mime_type;
        const isText = mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml';
        const isPdf = mime === 'application/pdf';
        if (isText || isPdf) {
          try {
            const bytes = await downloadTelegramFileBytes(msg.document.file_id, TELEGRAM_API_KEY);
            let extracted = '';
            if (bytes && isText) {
              extracted = new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, 30_000);
            } else if (bytes && isPdf) {
              extracted = extractPdfText(bytes).slice(0, 30_000);
            }
            // Resolve the owning app user. This branch runs before the 1:1
            // `link` lookup further down, so we can't use that variable here
            // (it's in the temporal dead zone). Resolve independently: the
            // linked personal chat first, then the sender's user mapping
            // (covers group members who've linked their account).
            let docUserId: string | null = null;
            {
              const { data: docLink } = await supabase.from('telegram_links')
                .select('user_id').eq('chat_id', chatId).eq('is_active', true).maybeSingle();
              docUserId = (docLink?.user_id as string | undefined) ?? null;
              if (!docUserId && msg.from?.id) {
                const { data: mapped } = await supabase.from('telegram_user_map')
                  .select('user_id').eq('telegram_user_id', msg.from.id).maybeSingle();
                docUserId = (mapped?.user_id as string | undefined) ?? null;
              }
            }
            if (extracted.trim().length > 0 && docUserId) {
              await supabase.from('telegram_documents').upsert({
                user_id: docUserId,
                filename: msg.document.file_name || 'document',
                mime_type: mime,
                size_bytes: msg.document.file_size || null,
                extracted_text: extracted,
              }, { onConflict: 'user_id' });
              docNote = `A user uploaded "${msg.document.file_name || 'a document'}" (${mime}, ${extracted.length} chars of extracted text). Briefly say you've received it (1 line) and ask whether they want a summary, a contract review, or to extract action items. If their caption already names an intent, route to the summarise_document tool with that intent.`;
              msg.text = (msg.caption?.trim() && msg.caption.trim()) || docNote;
            }
          } catch (e) {
            console.warn('document intake failed', (e as Error).message);
          }
        }
      }
      // What the user *visibly* sent — the caption if any, otherwise a short
      // placeholder. Used for storage in `telegram_messages` and for follow-up
      // conversation history so a later "what was it?" sees a sensible prior
      // turn instead of the long auto-generated AI prompt below.
      let photoUserText: string | null = null;
      if (photoDataUrl) {
        const trimmedCaption = photoCaption?.trim();
        photoUserText = trimmedCaption || '[Photo]';
        // Fabricate the AI-facing text so the rest of the pipeline treats it
        // as a normal turn. Describe-first / propose-actions framing keeps the
        // bot from silently auto-acting on a picture the user only wanted
        // identified.
        msg.text = trimmedCaption
          || 'A user shared this picture in chat. First, briefly tell us what it is (1–2 sentences). Then, if it looks like a calendar / receipt / business card / to-do / prescription / bill, propose the matching action (add events, log expense, save contact, create tasks, save note) and queue it for confirmation. If nothing actionable, just describe what you see.';
      }

      if (!msg.text && !photoDataUrl && !docNote) continue;

      // Track if original message was voice — used later to decide voice vs text reply
      const wasVoiceMessage = !!textFromVoice;

      // ---------- FORWARDED MESSAGES → annotate source so the AI knows it's third-party content ----------
      // Telegram exposes forward provenance via either the new `forward_origin`
      // object (Bot API 7.0+) or the legacy `forward_from` / `forward_from_chat`
      // / `forward_sender_name` fields. Without this annotation the AI sees a
      // bare quote and can mistake it for the user's own thought, then auto-
      // create tasks/events from someone else's words.
      const fwdOrigin = (msg as Record<string, unknown>).forward_origin;
      let forwardLabel: string | null = null;
      if (fwdOrigin && typeof fwdOrigin === 'object') {
        const fwd = fwdOrigin as Record<string, unknown>;
        switch (fwd.type) {
          case 'user': {
            const su = fwd.sender_user as Record<string, unknown> | undefined;
            forwardLabel = su?.first_name
              ? `${su.first_name}${su.last_name ? ' ' + su.last_name : ''}`
              : su?.username
                ? `@${su.username}`
                : 'a contact';
            break;
          }
          case 'hidden_user':
            forwardLabel = (fwd.sender_user_name as string | undefined) || 'a hidden user';
            break;
          case 'chat': {
            const sc = fwd.sender_chat as Record<string, unknown> | undefined;
            forwardLabel = (sc?.title as string | undefined) || 'a chat';
            break;
          }
          case 'channel': {
            const ch = fwd.chat as Record<string, unknown> | undefined;
            forwardLabel = `the channel "${(ch?.title as string | undefined) || 'unknown'}"`;
            break;
          }
        }
      } else if ((msg as Record<string, unknown>).forward_from && typeof (msg as Record<string, unknown>).forward_from === 'object') {
        forwardLabel = ((msg as Record<string, unknown>).forward_from as Record<string, unknown>)?.first_name as string | null;
      } else if ((msg as Record<string, unknown>).forward_from_chat && typeof (msg as Record<string, unknown>).forward_from_chat === 'object') {
        forwardLabel = ((msg as Record<string, unknown>).forward_from_chat as Record<string, unknown>)?.title as string | null;
      } else if ((msg as Record<string, unknown>).forward_sender_name) {
        forwardLabel = (msg as Record<string, unknown>).forward_sender_name as string | null;
      }
      if (forwardLabel && msg.text) {
        // Prepend a tagged header so the AI treats the body as third-party.
        // Kept short to limit token bloat; "[forwarded from X]" is enough
        // for the model to switch into "should I save this?" framing.
        msg.text = `[forwarded from ${forwardLabel}]\n${msg.text}`;
      }

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
            await sendMessage(chatId, `✅ <b>Linked successfully!</b>\n\nHi ${fromFirstName ?? 'there'}, I'm Dori — your personal assistant. Send /help for the Telegram command center.`, TELEGRAM_API_KEY);
          } else {
            await sendMessage(chatId, '❌ This link code is invalid or expired.', TELEGRAM_API_KEY);
          }
        } else {
          await sendMessage(chatId, '👋 Welcome! Open the Dori app → Settings → Telegram to connect.', TELEGRAM_API_KEY);
        }
        continue;
      }

      // ---------- /linkfamily <code> (group only) ----------
      if (text.startsWith('/linkfamily') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkfamily <code> — generate a code in Settings → Telegram → Family Group.', TELEGRAM_API_KEY);
          continue;
        }
        const { data: glink } = await supabase.from('telegram_group_links').select('*').eq('link_code', code).maybeSingle();
        const isExpired = glink?.link_code_expires_at && new Date(glink.link_code_expires_at) <= new Date();
        if (!glink || isExpired) {
          await sendMessage(chatId, '❌ Invalid or expired family link code.', TELEGRAM_API_KEY);
          continue;
        }
        // Release any stale link that already holds this chat_id. chat_id is
        // UNIQUE, so a leftover row from a prior or cross-owner attempt would
        // make the update below fail silently — leaving the group unlinked even
        // though we'd post "Family group linked!" and every later message would
        // route to telegram-router and come back "not linked".
        await supabase.from('telegram_group_links')
          .update({ chat_id: null, is_active: false })
          .eq('chat_id', chatId)
          .neq('id', glink.id);
        const { error: linkErr } = await supabase.from('telegram_group_links').update({
          chat_id: chatId,
          title: msg.chat.title ?? 'Family Group',
          is_active: true,
          linked_at: new Date().toISOString(),
          link_code: null,
          link_code_expires_at: null,
        }).eq('id', glink.id);
        if (linkErr) {
          console.error('[telegram-poll] /linkfamily bind failed', linkErr);
          await sendMessage(chatId, '⚠️ Could not link this group. Regenerate a code in Settings → Telegram → Family Group and try /linkfamily again.', TELEGRAM_API_KEY);
          continue;
        }
        // Map the user who ran /linkfamily as the owner-side telegram identity
        if (fromId) {
          await supabase.from('telegram_user_map').upsert({
            telegram_user_id: fromId,
            user_id: glink.owner_user_id,
            telegram_username: fromUsername,
            telegram_first_name: fromFirstName,
          }, { onConflict: 'telegram_user_id' });
        }
        await sendMessage(chatId, `✅ <b>Family group linked!</b>\n\nWrite naturally — I'll save tasks, shopping items, and events for your shared space.\n\nYour partner should send <code>/linkme &lt;their-code&gt;</code> here so I know who's who.\nType /help for more commands.`, TELEGRAM_API_KEY);
        continue;
      }

      // ---------- /linkworkspace <code> (group only — bind this chat to a workspace) ----------
      if (text.startsWith('/linkworkspace') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkworkspace <invite-code>. Generate a code in the app at Settings → Workspaces.', TELEGRAM_API_KEY);
          continue;
        }
        const { data: invite } = await supabase.from('workspace_invite_codes').select('workspace_id, revoked_at, expires_at').eq('code', code).maybeSingle();
        if (!invite || invite.revoked_at || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired workspace code.', TELEGRAM_API_KEY);
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
          TELEGRAM_API_KEY,
        );
        continue;
      }

      // ---------- /linkme <personal-code> (group only — partner self-identifies) ----------
      if (text.startsWith('/linkme') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();
        if (!code) {
          await sendMessage(chatId, '⚠️ Generate a personal link code in Settings → Telegram, then send: /linkme <code>', TELEGRAM_API_KEY);
          continue;
        }
        const { data: link } = await supabase.from('telegram_links').select('user_id, link_code_expires_at').eq('link_code', code).maybeSingle();
        const isExpired = link?.link_code_expires_at && new Date(link.link_code_expires_at) <= new Date();
        if (!link || isExpired) {
          await sendMessage(chatId, '❌ Invalid or expired code.', TELEGRAM_API_KEY);
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
        await sendMessage(chatId, `✅ ${fromFirstName ?? 'You'} are now linked. Items you add will be tagged to you.`, TELEGRAM_API_KEY);
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
            await sendMessage(chatId, '🔒 This group isn\'t linked yet. Either /linkfamily for a family space or /linkworkspace for a startup team — grab a code in the app.', TELEGRAM_API_KEY);
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

        tg('sendChatAction', { chat_id: chatId, action: 'typing' }, TELEGRAM_API_KEY).catch(() => {});

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
            await sendMessage(chatId, "📸 I can read photos here, but this group isn't linked to a personal account yet. Run /linkfamily or have a member link via Settings → Telegram.", TELEGRAM_API_KEY);
            await supabase.from('telegram_messages').upsert({
              update_id: u.update_id, chat_id: chatId, text: photoUserText ?? text, raw_update: u, processed: true,
            }, { onConflict: 'update_id' });
            processed++;
            continue;
          }
          // Placeholder we'll edit in-place once analysis is back, so a single
          // message visibly transforms from "Reading…" into the answer.
          let placeholderMessageId: number | null = null;
          try {
            const phResp = await tg('sendMessage', {
              chat_id: chatId,
              text: '🔍 Reading the picture…',
            }, TELEGRAM_API_KEY);
            placeholderMessageId = phResp?.result?.message_id ?? null;
          } catch (e) {
            console.warn('group photo placeholder send failed', e);
          }

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

          // Mirror the private-chat photo flow: combine the AI's prose with
          // executed tool messages, surface queued confirmations as separate
          // tappable prompts, and offer Undo for the latest reversible action.
          const queued = dori.toolResults.filter((t) => t.queued && t.actionId);
          const executed = dori.toolResults.filter((t) => !t.queued);
          const bodyParts: string[] = [];
          if (dori.reply) bodyParts.push(dori.reply);
          if (executed.length > 0) bodyParts.push(executed.map((t) => t.message).join('\n'));
          const replyText = bodyParts.join('\n\n').trim();
          const undoableIds = executed.map((t) => t.undoId).filter(Boolean) as string[];
          const latestUndoId = undoableIds.length > 0 ? undoableIds[undoableIds.length - 1] : null;

          // If the AI returned nothing AND queued nothing, say so explicitly
          // instead of the old "✅ Got it." — that wording was indistinguishable
          // from another group member's reaction and made it look like the bot
          // had silently dropped the photo.
          const outgoingText = replyText || (queued.length === 0
            ? "📸 I looked at the picture but couldn't find anything actionable. Tell me what you'd like me to do with it."
            : null);

          if (placeholderMessageId && outgoingText) {
            try {
              await tgEditMessageText(chatId, placeholderMessageId, outgoingText.slice(0, 4000), TELEGRAM_API_KEY);
              if (latestUndoId) {
                await tgEditReplyMarkup(chatId, placeholderMessageId, buildUndoKeyboard(latestUndoId), TELEGRAM_API_KEY);
              }
            } catch (e) {
              console.warn('group photo placeholder edit failed, falling back to send', e);
              await sendMessage(chatId, outgoingText, TELEGRAM_API_KEY);
              if (latestUndoId) {
                await tgSendWithKeyboard(chatId, '↩️ Tap to undo the last action.', buildUndoKeyboard(latestUndoId), TELEGRAM_API_KEY);
              }
            }
          } else if (outgoingText) {
            await sendMessage(chatId, outgoingText, TELEGRAM_API_KEY);
            if (latestUndoId) {
              await tgSendWithKeyboard(chatId, '↩️ Tap to undo the last action.', buildUndoKeyboard(latestUndoId), TELEGRAM_API_KEY);
            }
          } else if (placeholderMessageId) {
            // No text reply, only queued confirmations — drop the stale "Reading…".
            try { await tg('deleteMessage', { chat_id: chatId, message_id: placeholderMessageId }, TELEGRAM_API_KEY); }
            catch { /* ignore */ }
          }

          for (const q of queued) {
            const prompt = `🤔 <b>Please confirm</b>\n${q.summary || q.message}\n\nReply <b>yes</b> or tap a button below.`;
            await tgSendWithKeyboard(
              chatId,
              prompt,
              buildConfirmKeyboard(q.actionId!),
              TELEGRAM_API_KEY,
            );
            try {
              await supabase.from('telegram_assistant_replies').insert({ chat_id: chatId, reply: prompt });
            } catch { /* ignore */ }
          }

          // Persist the bot's analysis so a follow-up text turn ("ok what is
          // it?") routed through telegram-router sees the prior assistant
          // reply in conversation history instead of re-asking for the image.
          if (outgoingText) {
            try {
              await supabase.from('telegram_assistant_replies').insert({ chat_id: chatId, reply: outgoingText });
            } catch (e) { console.error('Failed to persist photo reply', e); }
          }

          // Save the user-visible text (caption or "[Photo]") rather than the
          // long auto-generated AI prompt — keeps conversation history sensible
          // for any later text follow-ups in this group.
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text: photoUserText ?? text, raw_update: u, processed: true,
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
          await sendMessage(chatId, '⚠️ Router unavailable, try again shortly.', TELEGRAM_API_KEY);
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
        await sendMessage(chatId, '🔒 This chat isn\'t linked yet. Open Dori → Settings → Telegram to connect.', TELEGRAM_API_KEY);
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
            const wsIds = (memberRows || []).map((m: { workspace_id: string }) => m.workspace_id);
            const { data: wsList } = wsIds.length
              ? await supabase.from('workspaces').select('id, name, icon').in('id', wsIds).eq('archived', false)
              : { data: [] as Record<string, unknown>[] };
            const activeId = (current as Record<string, unknown> | null)?.active_workspace_id as string | null;
            const wsListArr = (wsList as Array<{ id: string; name: string; icon?: string }> | null) ?? [];
            const lines = ['<b>🧑‍🤝‍🧑 Workspaces</b>'];
            lines.push(`Current scope: ${activeId ? `<b>${wsListArr.find((w) => w.id === activeId)?.name || activeId.slice(0, 8)}</b>` : '<b>Personal</b>'}`);
            if (wsListArr.length) {
              lines.push('\nSwitch with <code>/workspace &lt;name&gt;</code>:');
              wsListArr.forEach((w) => {
                lines.push(`• ${w.icon || '📁'} ${w.name}`);
              });
            } else {
              lines.push('\nYou\'re not in any workspaces yet. Create or join one in the app.');
            }
            lines.push('\nUse <code>/workspace off</code> to return to Personal.');
            await sendDoriReply({
              chatId, text: lines.join('\n'), preferVoice: wasVoiceMessage,
              telegramKey: TELEGRAM_API_KEY,
            });
          } else if (['off', 'personal', 'none', 'clear'].includes(arg.toLowerCase())) {
            await supabase.from('telegram_links').update({ active_workspace_id: null }).eq('user_id', link.user_id);
            await sendDoriReply({
              chatId, text: '✅ Cleared — next commands run in your Personal space.',
              preferVoice: wasVoiceMessage,
              telegramKey: TELEGRAM_API_KEY,
            });
          } else {
            // Resolve name → id against workspaces the user is actually a member of.
            const { data: memberRows } = await supabase.from('workspace_members')
              .select('workspace_id').eq('user_id', link.user_id);
            const wsIds = (memberRows || []).map((m: { workspace_id: string }) => m.workspace_id);
            let match: { id: string; name: string; icon?: string } | undefined = undefined;
            if (wsIds.length) {
              const { data: wsList } = await supabase.from('workspaces')
                .select('id, name, icon').in('id', wsIds).eq('archived', false);
              const needle = arg.toLowerCase();
              const ws = wsList as Array<{ id: string; name: string; icon?: string }> | null ?? [];
              match = ws.find((w) => (w.name || '').toLowerCase() === needle)
                || ws.find((w) => (w.name || '').toLowerCase().includes(needle));
            }
            if (!match) {
              await sendDoriReply({
                chatId, text: `🤔 I don't see a workspace named "${arg}" you're a member of. Try <code>/workspace list</code>.`,
                preferVoice: wasVoiceMessage,
                telegramKey: TELEGRAM_API_KEY,
              });
            } else {
              await supabase.from('telegram_links')
                .update({ active_workspace_id: match.id }).eq('user_id', link.user_id);
              await sendDoriReply({
                chatId, text: `✅ Switched to <b>${match.icon || '📁'} ${match.name}</b>. New tasks / events / notes I create here will live in that workspace. <code>/workspace off</code> to go back to Personal.`,
                preferVoice: wasVoiceMessage,
                telegramKey: TELEGRAM_API_KEY,
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
            telegramKey: TELEGRAM_API_KEY,
          });
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      const privateVoiceMatch = text.toLowerCase().match(/^\/voice\s+(on|off)$/);
      if (privateVoiceMatch) {
        const enabled = privateVoiceMatch[1] === 'on';
        const { error } = await supabase.from('proactive_settings')
          .upsert({ user_id: link.user_id, prefer_voice_replies: enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        await sendMessage(chatId, error
          ? `⚠️ Could not update voice replies: ${escape(error.message)}`
          : `✅ Voice replies ${enabled ? 'enabled' : 'disabled'}.`, TELEGRAM_API_KEY);
        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      const activeWsForChat = await resolveActiveWorkspaceForChat(
        supabase,
        link.user_id,
        (link as Record<string, unknown>).active_workspace_id as string | null,
      );

      if (wantsNewsVoice(text)) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('location_city, location_country, locale')
          .eq('user_id', link.user_id)
          .maybeSingle();
        const title = "Today's news summary";
        const items = await generateNews([], {
          city: prof?.location_city ?? null,
          country: prof?.location_country ?? null,
        }, 5);
        const textMessage = buildNewsTelegramMessage(title, items);
        await sendVoiceMessage({
          chatId,
          script: buildNewsVoiceScript(title, items),
          fallbackText: textMessage,
          caption: "🗞 Today's news voice summary",
          locale: prof?.locale,
          telegramKey: TELEGRAM_API_KEY,
          maxChars: defaultBriefingVoiceLimit(),
          sendFallbackText: false,
        });
        await sendMessage(chatId, textMessage, TELEGRAM_API_KEY);
        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      // Compact Telegram control surface: keep common steering actions fast
      // and deterministic instead of spending an AI round on command parsing.
      const handledControlCommand = await dispatchTelegramControlCommand({
        text,
        updateId: u.update_id,
        chatId,
        userId: link.user_id,
        rawUpdate: u,
        workspaceId: activeWsForChat,
        source: 'slash',
        handlers: {
          sendHelp: () => tgSendWithKeyboard(chatId, PRIVATE_HELP_TEXT, buildAssistantCockpitKeyboard(), TELEGRAM_API_KEY),
          sendCockpit: () => sendAssistantCockpit(chatId, TELEGRAM_API_KEY),
          sendApprovals: () => sendApprovalInbox(supabase, chatId, link.user_id, TELEGRAM_API_KEY, wasVoiceMessage),
          sendNow: async () => {
            try {
              await sendBestNextAction(supabase, chatId, link.user_id, TELEGRAM_API_KEY, wasVoiceMessage, activeWsForChat);
            } catch (e) {
              console.error('/now failed', e);
              await sendMessage(chatId, '⚠️ Could not pick a next action. Try /me or ask “plan my day”.', TELEGRAM_API_KEY);
            }
          },
          sendMemory: async () => {
            try {
              await sendMemorySnapshot(supabase, chatId, link.user_id, TELEGRAM_API_KEY, wasVoiceMessage, activeWsForChat);
            } catch (e) {
              console.error('/memory failed', e);
              await sendMessage(chatId, '⚠️ Could not load memory right now. Try again shortly.', TELEGRAM_API_KEY);
            }
          },
          sendSteering: (command, args) => runSteeringCommand(chatId, link.user_id, TELEGRAM_API_KEY, command, args, wasVoiceMessage, activeWsForChat, supabaseUrl, serviceKey),
          recordMetric: (command) => recordTelegramControlMetric(supabase, link.user_id, chatId, command, 'slash', activeWsForChat),
          markProcessed: () => markTelegramProcessed(supabase, u.update_id, chatId, text, u),
        },
      });
      if (handledControlCommand) {
        processed++;
        continue;
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
            telegramKey: TELEGRAM_API_KEY,
          });
        } catch (e) {
          console.error('/me failed', e);
          await sendMessage(chatId, '⚠️ Could not build your digest. Try again shortly.', TELEGRAM_API_KEY);
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
            telegramKey: TELEGRAM_API_KEY,
          });
        } else {
          const res = await runUndo(supabase, entry, supabaseUrl, serviceKey);
          await sendDoriReply({
            chatId, text: res.message, preferVoice: wasVoiceMessage,
            telegramKey: TELEGRAM_API_KEY,
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
            telegramKey: TELEGRAM_API_KEY,
          });
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      tg('sendChatAction', { chat_id: chatId, action: 'typing' }, TELEGRAM_API_KEY).catch(() => {});

      // Instant placeholder so the user sees acknowledgment in ~100ms instead
      // of waiting 5-15s for the full AI round to finish. Streaming path will
      // mutate this message in-place as deltas arrive.
      let placeholderMessageId: number | null = null;
      try {
        const phResp = await tg('sendMessage', {
          chat_id: chatId,
          text: photoDataUrl ? '🔍 Reading your photo…' : '🤔 Thinking…',
        }, TELEGRAM_API_KEY);
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
          await tgEditMessageText(chatId, placeholderMessageId, latestText.slice(0, 4000) + ' …', TELEGRAM_API_KEY);
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
      } catch { /* ignore */ }

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
        await tgEditMessageText(chatId, placeholderMessageId, outgoingText.slice(0, 4000), TELEGRAM_API_KEY);
        if (latestUndoId) {
          await tgEditReplyMarkup(chatId, placeholderMessageId, buildUndoKeyboard(latestUndoId), TELEGRAM_API_KEY);
        }
      } else {
        // Voice path, or we failed to place a placeholder — delete the stale
        // placeholder if any, then send via the normal (potentially-voice) path.
        if (placeholderMessageId) {
          try { await tg('deleteMessage', { chat_id: chatId, message_id: placeholderMessageId }, TELEGRAM_API_KEY); }
          catch { /* ignore */ }
        }
        if (outgoingText) {
          await sendDoriReply({
            chatId, text: outgoingText, preferVoice, locale: userLocale,
            telegramKey: TELEGRAM_API_KEY,
          });
          if (latestUndoId) {
            await tgSendWithKeyboard(
              chatId,
              '↩️ Tap to undo the last action.',
              buildUndoKeyboard(latestUndoId),
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
          TELEGRAM_API_KEY,
        );
      }

      await supabase.from('telegram_messages').upsert({
        update_id: u.update_id, chat_id: chatId, text: photoUserText ?? text, raw_update: u, processed: true,
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

    // Webhook delivery is a single update — never loop for more.
    if (isWebhook) break;
  }
  };

  if (isWebhook) {
    // ACK Telegram immediately, then finish processing in the background.
    // A webhook call must return quickly: the AI round-trip routinely takes
    // longer than the worker's response budget, and making Telegram wait for
    // it returns 500 (→ Telegram retries, the queue backs up, and the worker
    // is killed mid-flight). Returning 200 now and handing the work to
    // EdgeRuntime.waitUntil keeps the isolate alive long enough to send the
    // reply. The user still sees the "🤔 Thinking…" placeholder right away and
    // the answer once it's ready.
    const work = runLoop().catch((e) => console.error('[telegram-poll] webhook processing error', e));
    const er = (globalThis as Record<string, unknown>).EdgeRuntime;
    if (er && typeof er.waitUntil === 'function') {
      er.waitUntil(work);
    } else {
      // Local / non-edge-runtime contexts: just await it.
      await work;
    }
    return new Response(JSON.stringify({ ok: true, mode: 'webhook' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await runLoop();
  return new Response(JSON.stringify({ ok: true, mode: 'poll', processed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
