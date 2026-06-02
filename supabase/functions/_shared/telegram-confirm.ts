// Shared helpers for the Dori action-confirmation flow over Telegram.
//
// When the chat function queues a mutating action (add/edit/delete) that the
// user wants to acknowledge, the Telegram surface (router for groups, poll
// for private chats) asks "do this?" with an inline keyboard. Users can also
// reply with plain text ("yes"/"no"/"ja"/"nein"/…) and we resolve that against
// the most recently queued pending action for that chat.


export interface PendingAction {
  id: string;
  action_type: string;
  entity_type: string | null;
  reason: string;
  action_data: Record<string, unknown>;
  status: string;
  source: string;
  source_ref: string | null;
  user_id: string;
  created_at: string;
}

export async function tgSendWithKeyboard(
  chatId: number,
  text: string,
  keyboard: Record<string, unknown>,
  telegramKey: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${telegramKey}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: keyboard,
      }),
    });
  } catch (e) {
    console.error('tgSendWithKeyboard failed', e);
  }
}

export function buildConfirmKeyboard(actionId: string) {
  return {
    inline_keyboard: [[
      { text: '✅ Yes, do it', callback_data: `dori_confirm:${actionId}` },
      { text: '❌ Cancel', callback_data: `dori_reject:${actionId}` },
    ]],
  };
}

export async function tgAnswerCallback(
  callbackQueryId: string,
  text: string,
  telegramKey: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${telegramKey}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text.slice(0, 200) }),
    });
  } catch (e) {
    console.error('answerCallbackQuery failed', e);
  }
}

export async function tgEditMessageText(
  chatId: number,
  messageId: number,
  text: string,
  telegramKey: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${telegramKey}/editMessageText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text.slice(0, 4000),
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('editMessageText failed', e);
  }
}

// Yes / no detection tolerant of German, casual phrasing, emoji, voice quirks.
// Emoji get their own patterns because `\b` is a word-boundary anchor and emoji
// are non-word characters — a word-boundary regex won't match bare emoji.
const YES_PATTERNS = [
  /^(?:\s*)(?:y|ya|ye|yes|yep|yeah|yup|jes|jess|jeah|yess|ja|jaa|jaja|jo|jep|joa|sure|ok|okay|kk|confirm|confirmed|do it|go|go ahead|please do|approve|approved|klar|passt|mach|mach das|mach es|bestätigen|bestätige|bestätigt)\b/i,
  /^(?:\s*)(?:✅|👍|👌)/,
];
const NO_PATTERNS = [
  // Single-word / short rejection phrases. "cancel that", "scrap it",
  // "nevermind", "forget it" all resolve to the same intent as the
  // ❌ Cancel button on the inline keyboard. Limit length to keep
  // ambiguous longer messages routed to the AI instead.
  /^(?:\s*)(?:n|no|nope|nah|cancel|cancel that|scrap (?:it|that)|nevermind|never mind|forget it|forget that|abort|drop it|kill it|stop|reject|skip|don't|do not|nicht|nein|abbrechen|stopp|ablehnen|lass|lass stecken|vergiss(?: es)?|hau weg)\b/i,
  /^(?:\s*)(?:❌|👎)/,
];

export function classifyConfirmationText(text: string): 'yes' | 'no' | null {
  const t = text.trim();
  if (!t) return null;
  // Reject ambiguous longer messages that clearly aren't a bare yes/no.
  if (t.split(/\s+/).length > 6) return null;
  if (YES_PATTERNS.some((r) => r.test(t))) return 'yes';
  if (NO_PATTERNS.some((r) => r.test(t))) return 'no';
  return null;
}

// Minimal Supabase client surface needed by this module.
type TgConfirmClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

// Fetch the most recent *still-actionable* pending action queued from this
// Telegram surface. Actions whose expires_at has passed are filtered out so
// stale prompts never quietly execute.
export async function fetchLatestPendingForChat(
  supabase: TgConfirmClient,
  userId: string,
  source: string,
  sourceRef: string,
): Promise<PendingAction | null> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('auto_actions_log')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('source', source)
    .eq('source_ref', sourceRef)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PendingAction | null) || null;
}

export function isActionableNow(action: (PendingAction & { expires_at?: string | null }) | null | undefined): boolean {
  if (!action) return false;
  if (action.status !== 'pending') return false;
  const exp = action.expires_at;
  if (!exp) return true;
  return new Date(exp).getTime() > Date.now();
}

// Best-effort sweep: mark anything whose expires_at has passed as 'expired'.
// Called from the Telegram poll loop on each tick; cheap and idempotent.
export async function sweepExpiredPending(supabase: TgConfirmClient): Promise<void> {
  try {
    await supabase
      .from('auto_actions_log')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());
  } catch (e) {
    console.error('sweepExpiredPending failed', e);
  }
}

// Approve a pending action by re-running the captured tool XML through the
// chat function with the approval gate disabled. Returns a human-readable result.
export async function approveAndExecutePending(
  supabase: TgConfirmClient,
  action: PendingAction,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string> {
  const toolXml = action.action_data?.tool_xml as string | undefined;
  if (!toolXml) {
    await supabase.from('auto_actions_log')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', action.id);
    return `✅ Approved: ${action.reason}`;
  }
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': action.user_id,
      },
      body: JSON.stringify({
        messages: [],
        executeServerSide: true,
        skipApprovalGate: true,
        preformedToolText: toolXml,
      }),
    });
    const data = await resp.json();
    const results = (data?.toolResults || []) as { ok: boolean; message: string }[];
    const outcome = results.map((r) => r.message).join('\n') || `✅ Done: ${action.reason}`;

    await supabase.from('auto_actions_log')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        action_data: { ...(action.action_data || {}), execution_result: results },
      })
      .eq('id', action.id);
    return outcome;
  } catch (e) {
    console.error('approveAndExecutePending failed', e);
    return `⚠️ Couldn't run ${action.reason}: ${(e as Error).message}`;
  }
}

export async function rejectPending(
  supabase: TgConfirmClient,
  actionId: string,
  reason: string,
): Promise<string> {
  await supabase.from('auto_actions_log')
    .update({ status: 'rejected', rejected_at: new Date().toISOString() })
    .eq('id', actionId);
  return `🚫 Cancelled: ${reason}`;
}
