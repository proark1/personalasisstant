// Cross-turn conversation state.
//
// One row per (user_id, channel, channel_ref). Holds the current open intent
// + a blob the next turn can read to resolve "do it", "the meeting", etc.
// Auto-expires after 1h so a stale "awaiting confirm" doesn't leak
// into tomorrow's first turn.

export type Channel = "web" | "tg_private" | "tg_family" | "tg_workspace" | "voice";

export interface RecentEntity {
  kind:
    | "task"
    | "event"
    | "contact"
    | "note"
    | "contract"
    | "project"
    | "family_member"
    | "business"
    | "property";
  id: string;
  label?: string;
  ref_at: string; // ISO when last referenced
}

export interface ConversationState {
  user_id: string;
  channel: Channel;
  channel_ref?: string | null;
  workspace_id?: string | null;
  open_intent: string | null;
  pending_payload: Record<string, unknown>;
  recent_entities: RecentEntity[];
  active_specialist: string | null;
  expires_at: string;
}

// Minimal Supabase client surface needed by this module.
type ConvStateClient = { from(table: string): any };

export async function loadConversationState(
  supabase: ConvStateClient,
  userId: string,
  channel: Channel,
  opts?: { channelRef?: string | null; workspaceId?: string | null },
): Promise<ConversationState | null> {
  try {
    const channelRef = opts?.channelRef ?? "";
    let q = supabase
      .from("dori_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", channel)
      .eq("channel_ref", channelRef);
    if (opts?.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
    const { data, error } = await q.maybeSingle();
    if (error) {
      console.warn("[loadConversationState] failed", error.message);
      return null;
    }
    if (!data) return null;
    // Auto-expire: anything older than expires_at is treated as gone.
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Best-effort clear so we don't keep reading dead state.
      await supabase
        .from("dori_conversation_state")
        .update({ open_intent: null, pending_payload: {} })
        .eq("user_id", userId)
        .eq("channel", channel)
        .eq("channel_ref", channelRef);
      return { ...data, open_intent: null, pending_payload: {} } as ConversationState;
    }
    return data as ConversationState;
  } catch (e) {
    console.warn("[loadConversationState] threw", (e as Error).message);
    return null;
  }
}

export interface SaveStateArgs {
  userId: string;
  channel: Channel;
  channelRef?: string | null;
  workspaceId?: string | null;
  openIntent?: string | null;
  pendingPayload?: Record<string, unknown>;
  recentEntities?: RecentEntity[];
  activeSpecialist?: string | null;
  ttlMinutes?: number;
}

export async function saveConversationState(
  supabase: ConvStateClient,
  args: SaveStateArgs,
): Promise<void> {
  try {
    const ttl = args.ttlMinutes ?? 60;
    const row: Record<string, unknown> = {
      user_id: args.userId,
      channel: args.channel,
      channel_ref: args.channelRef ?? "",
      workspace_id: args.workspaceId ?? null,
      open_intent: args.openIntent ?? null,
      pending_payload: args.pendingPayload ?? {},
      recent_entities: args.recentEntities ?? [],
      active_specialist: args.activeSpecialist ?? null,
      expires_at: new Date(Date.now() + ttl * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("dori_conversation_state")
      .upsert(row, { onConflict: "user_id,channel,channel_ref" });
    if (error) console.warn("[saveConversationState] failed", error.message);
  } catch (e) {
    console.warn("[saveConversationState] threw", (e as Error).message);
  }
}

// Compact prompt block describing what the assistant promised the
// user last turn. Only emitted when there IS open state — silent
// otherwise so we don't waste tokens.
export function formatStateForPrompt(s: ConversationState | null): string {
  if (!s) return "";
  const parts: string[] = [];
  if (s.open_intent) {
    parts.push(`## CONVERSATION STATE (carry-over from previous turn)`);
    parts.push(`Open intent: \`${s.open_intent}\``);
    if (s.pending_payload && Object.keys(s.pending_payload).length > 0) {
      // Never truncate JSON mid-string — that produces invalid JSON
      // and confuses the model about what action it's confirming. If
      // the payload would balloon the prompt, drop it and let the
      // model fall back to recent_entities + open_intent. The cap is
      // generous (4 KB) so realistic plans always pass through.
      const json = JSON.stringify(s.pending_payload);
      if (json.length <= 4000) {
        parts.push(`Pending payload: ${json}`);
      } else {
        parts.push(
          `Pending payload: <oversized: ${json.length} bytes — keys: ${Object.keys(s.pending_payload).join(", ")}>`,
        );
      }
    }
    parts.push(
      `If the user's next message is an affirmative ("yes", "do it", "go", "ok"), execute the pending action. ` +
        `If they say "skip N" or "drop the email step", apply the edit then execute. ` +
        `If they change topic, drop this state silently.`,
    );
  }
  if (s.recent_entities && s.recent_entities.length > 0) {
    parts.push(`### Recently referenced entities`);
    for (const e of s.recent_entities.slice(0, 8)) {
      parts.push(`- ${e.kind}#${e.id.slice(0, 8)}${e.label ? ` "${e.label}"` : ""}`);
    }
    parts.push(
      `When the user uses a pronoun ("him", "it", "that one"), prefer the most-recent matching entity above ` +
        `before asking for clarification.`,
    );
  }
  return parts.length > 0 ? "\n\n" + parts.join("\n") : "";
}

export async function clearConversationState(
  supabase: ConvStateClient,
  userId: string,
  channel: Channel,
  opts?: { channelRef?: string | null },
): Promise<void> {
  try {
    await supabase
      .from("dori_conversation_state")
      .update({ open_intent: null, pending_payload: {} })
      .eq("user_id", userId)
      .eq("channel", channel)
      .eq("channel_ref", opts?.channelRef ?? "");
  } catch (e) {
    console.warn("[clearConversationState] failed", (e as Error).message);
  }
}
