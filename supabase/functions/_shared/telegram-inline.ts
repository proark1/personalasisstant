// Inline-keyboard helpers for the Telegram assistant.
//
// Callback-data payloads have a hard 64-byte limit. We encode them as
// colon-separated strings with a short namespace prefix so the poll handler
// can dispatch without parsing JSON. Every producer+consumer uses the helpers
// in this file so renames / scheme changes are local to one place.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

// ── Callback-data scheme ───────────────────────────────────────────────────
//
//   dori_confirm:<actionId>                    confirm a queued mutation
//   dori_reject:<actionId>                     reject a queued mutation
//   dori_undo:<undoId>                         undo a recent mutation
//   dori_task:<op>:<taskId>                    op ∈ complete|snooze1h|snooze1d|delete
//   dori_event:<op>:<eventId>                  op ∈ details|cancel
//   dori_shop:<op>:<itemId>                    op ∈ check|uncheck|remove
//   dori_contract:<op>:<contractId>            op ∈ snooze7|handled|details
//   dori_page:<ns>:<cursor>:<chat>:<owner>     paginate a list reply
//   dori_dismiss                               no-op, just clear the keyboard
//
// `cursor` is a namespaced encoder specific to each list so we never embed
// PII in callback_data.

export type CallbackData =
  | { kind: 'confirm'; actionId: string }
  | { kind: 'reject'; actionId: string }
  | { kind: 'undo'; undoId: string }
  | { kind: 'task'; op: 'complete' | 'snooze1h' | 'snooze1d' | 'delete'; taskId: string }
  | { kind: 'event'; op: 'details' | 'cancel'; eventId: string }
  | { kind: 'shop'; op: 'check' | 'uncheck' | 'remove'; itemId: string }
  | { kind: 'contract'; op: 'snooze7' | 'handled' | 'details'; contractId: string }
  | { kind: 'page'; ns: string; cursor: string }
  | { kind: 'plan'; op: 'run_next' | 'skip' | 'abort'; planId: string }
  | { kind: 'dismiss' }
  | { kind: 'unknown'; raw: string };

export function encodeCallback(data: CallbackData): string {
  switch (data.kind) {
    case 'confirm':  return `dori_confirm:${data.actionId}`;
    case 'reject':   return `dori_reject:${data.actionId}`;
    case 'undo':     return `dori_undo:${data.undoId}`;
    case 'task':     return `dori_task:${data.op}:${data.taskId}`;
    case 'event':    return `dori_event:${data.op}:${data.eventId}`;
    case 'shop':     return `dori_shop:${data.op}:${data.itemId}`;
    case 'contract': return `dori_contract:${data.op}:${data.contractId}`;
    case 'page':     return `dori_page:${data.ns}:${data.cursor}`;
    case 'plan':     return `dori_plan:${data.op}:${data.planId}`;
    case 'dismiss':  return 'dori_dismiss';
    default:         return 'dori_dismiss';
  }
}

export function decodeCallback(raw: string): CallbackData {
  if (!raw) return { kind: 'unknown', raw };
  const [head, ...rest] = raw.split(':');
  switch (head) {
    case 'dori_confirm':  return { kind: 'confirm', actionId: rest.join(':') };
    case 'dori_reject':   return { kind: 'reject', actionId: rest.join(':') };
    case 'dori_undo':     return { kind: 'undo', undoId: rest.join(':') };
    case 'dori_task': {
      const [op, ...id] = rest;
      return { kind: 'task', op: op as any, taskId: id.join(':') };
    }
    case 'dori_event': {
      const [op, ...id] = rest;
      return { kind: 'event', op: op as any, eventId: id.join(':') };
    }
    case 'dori_shop': {
      const [op, ...id] = rest;
      return { kind: 'shop', op: op as any, itemId: id.join(':') };
    }
    case 'dori_contract': {
      const [op, ...id] = rest;
      return { kind: 'contract', op: op as any, contractId: id.join(':') };
    }
    case 'dori_page': {
      const [ns, ...cur] = rest;
      return { kind: 'page', ns, cursor: cur.join(':') };
    }
    case 'dori_plan': {
      const [op, ...id] = rest;
      return { kind: 'plan', op: op as any, planId: id.join(':') };
    }
    case 'dori_dismiss':  return { kind: 'dismiss' };
    default:              return { kind: 'unknown', raw };
  }
}

// ── Keyboard builders ──────────────────────────────────────────────────────

type Button = { text: string; callback_data: string };
type Keyboard = { inline_keyboard: Button[][] };

export function buildTaskRowKeyboard(taskId: string): Keyboard {
  return {
    inline_keyboard: [[
      { text: '✅ Done', callback_data: encodeCallback({ kind: 'task', op: 'complete', taskId }) },
      { text: '⏰ +1h',  callback_data: encodeCallback({ kind: 'task', op: 'snooze1h', taskId }) },
      { text: '📅 +1d',  callback_data: encodeCallback({ kind: 'task', op: 'snooze1d', taskId }) },
      { text: '🗑',      callback_data: encodeCallback({ kind: 'task', op: 'delete', taskId }) },
    ]],
  };
}

export function buildEventRowKeyboard(eventId: string): Keyboard {
  return {
    inline_keyboard: [[
      { text: '📝 Details', callback_data: encodeCallback({ kind: 'event', op: 'details', eventId }) },
      { text: '❌ Cancel',  callback_data: encodeCallback({ kind: 'event', op: 'cancel', eventId }) },
    ]],
  };
}

export function buildShoppingRowKeyboard(itemId: string, isChecked: boolean): Keyboard {
  return {
    inline_keyboard: [[
      isChecked
        ? { text: '↩️ Uncheck', callback_data: encodeCallback({ kind: 'shop', op: 'uncheck', itemId }) }
        : { text: '☑️ Got it',  callback_data: encodeCallback({ kind: 'shop', op: 'check', itemId }) },
      { text: '🗑 Remove',      callback_data: encodeCallback({ kind: 'shop', op: 'remove', itemId }) },
    ]],
  };
}

export function buildContractRowKeyboard(contractId: string): Keyboard {
  return {
    inline_keyboard: [[
      { text: '✅ Handled',    callback_data: encodeCallback({ kind: 'contract', op: 'handled', contractId }) },
      { text: '⏰ Snooze 7d',  callback_data: encodeCallback({ kind: 'contract', op: 'snooze7', contractId }) },
      { text: '📝 Details',    callback_data: encodeCallback({ kind: 'contract', op: 'details', contractId }) },
    ]],
  };
}

// Plan-step actions: gives the user run-next / skip / abort inline
// on each "Plans" message, so multi-step flows can be approved
// from Telegram without round-tripping to the web app.
export function buildPlanRowKeyboard(planId: string): Keyboard {
  return {
    inline_keyboard: [[
      { text: '▶️ Run next', callback_data: encodeCallback({ kind: 'plan', op: 'run_next', planId }) },
      { text: '⏭ Skip',     callback_data: encodeCallback({ kind: 'plan', op: 'skip', planId }) },
      { text: '⛔ Abort',    callback_data: encodeCallback({ kind: 'plan', op: 'abort', planId }) },
    ]],
  };
}

// Pagination footer: prev/next + dismiss.
export function buildPagerKeyboard(
  ns: string,
  prevCursor: string | null,
  nextCursor: string | null,
): Keyboard {
  const row: Button[] = [];
  if (prevCursor) row.push({ text: '◀️ Prev', callback_data: encodeCallback({ kind: 'page', ns, cursor: prevCursor }) });
  row.push({ text: '✖️ Close', callback_data: encodeCallback({ kind: 'dismiss' }) });
  if (nextCursor) row.push({ text: 'Next ▶️', callback_data: encodeCallback({ kind: 'page', ns, cursor: nextCursor }) });
  return { inline_keyboard: [row] };
}

export function buildUndoKeyboard(undoId: string): Keyboard {
  return {
    inline_keyboard: [[
      { text: '↩️ Undo', callback_data: encodeCallback({ kind: 'undo', undoId }) },
    ]],
  };
}

// ── Network helpers (used by router + poll to emit rich messages) ──────────

export async function tgApi(
  method: string,
  body: Record<string, unknown>,
  lovableKey: string,
  telegramKey: string,
): Promise<Response> {
  return fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function tgEditReplyMarkup(
  chatId: number,
  messageId: number,
  keyboard: Keyboard | null,
  lovableKey: string,
  telegramKey: string,
): Promise<void> {
  try {
    await tgApi(
      'editMessageReplyMarkup',
      { chat_id: chatId, message_id: messageId, reply_markup: keyboard || { inline_keyboard: [] } },
      lovableKey,
      telegramKey,
    );
  } catch (e) {
    console.error('editMessageReplyMarkup failed', e);
  }
}

// ── Text chunking ──────────────────────────────────────────────────────────
// Splits a long HTML-safe block into <= maxChars chunks, breaking on newlines
// when possible so we never cut an HTML tag in half.
export function chunkForTelegram(text: string, maxChars = 3800): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars);
    const lastNL = slice.lastIndexOf('\n');
    const cut = lastNL > maxChars * 0.6 ? lastNL : maxChars;
    out.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).replace(/^\n+/, '');
  }
  if (remaining) out.push(remaining);
  return out;
}
