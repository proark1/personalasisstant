// Build the message list sent to the streaming chat endpoint. Pure
// transformation extracted from Index.tsx's handleSendMessage closure.
//
// Behavior preserved 1:1 from the inline IIFE:
// - prepend a "previous conversation" envelope only when starting a
//   fresh session (no in-memory messages yet) and prior context exists
// - cap recent history at the last 10 messages when it grows past 12
// - drop consecutive duplicates (same role + same content)
// - ensure the final message is the current user turn

export type ChatRole = "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

interface BuildArgs {
  userText: string;
  /** In-memory messages from the current session. */
  messages: ChatTurn[];
  /** Tail of the prior session, used only for cold-start context. */
  previousConversationMessages: ChatTurn[];
}

const HISTORY_TRUNCATE_AT = 12;
const HISTORY_KEEP_LAST = 10;

export function buildConversationMessages({
  userText,
  messages,
  previousConversationMessages,
}: BuildArgs): ChatTurn[] {
  const prevContext: ChatTurn[] = [];
  if (previousConversationMessages.length > 0 && messages.length === 0) {
    prevContext.push({
      role: "user",
      content: "[Previous conversation context — use for continuity]",
    });
    prevContext.push(...previousConversationMessages);
    prevContext.push({
      role: "assistant",
      content: "[End of previous context — new conversation starts below]",
    });
  }

  let recent = messages.map((m) => ({ role: m.role, content: m.content }));
  if (recent.length > HISTORY_TRUNCATE_AT) {
    recent = recent.slice(-HISTORY_KEEP_LAST);
  }

  const deduped: ChatTurn[] = [];
  for (const m of [...prevContext, ...recent]) {
    const last = deduped[deduped.length - 1];
    if (last && last.role === m.role && last.content === m.content) continue;
    deduped.push(m);
  }

  const last = deduped[deduped.length - 1];
  if (!last || last.role !== "user" || last.content !== userText) {
    deduped.push({ role: "user", content: userText });
  }

  return deduped;
}
