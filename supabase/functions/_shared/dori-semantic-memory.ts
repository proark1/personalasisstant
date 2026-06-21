// Semantic memory: write & retrieve.
//
// Two entry points:
//   - rememberSemantic(): upsert one row + embedding.
//   - retrieveRelevantMemories(): top-k cosine-similarity hits for the
//     user's current query, scoped to personal-or-workspace.
//
// Failure mode: ALL functions return safely on error (empty array /
// false). Semantic recall is a best-effort uplift — it must not block
// a chat turn if the embedding provider is down.

import { embedText, toPgVectorLiteral } from "./dori-embeddings.ts";
import { autoKgIngest } from "./kg.ts";

export interface SemanticHit {
  id: string;
  source: string;
  source_ref: string | null;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  created_at: string;
  similarity: number;
}

export interface RememberArgs {
  userId: string;
  workspaceId?: string | null;
  source:
    | "note"
    | "episodic"
    | "task_completed"
    | "event_past"
    | "chat_turn"
    | "memory"
    | "contact"
    | "manual";
  sourceRef?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  importance?: number;
}

// Minimal Supabase client surface needed by this module.
type SemanticClient = {
  from(table: string): Record<string, (...args: unknown[]) => unknown>;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function rememberSemantic(
  supabase: SemanticClient,
  args: RememberArgs,
): Promise<boolean> {
  const content = (args.content || "").trim();
  if (!content || content.length < 10) return false; // not worth indexing
  try {
    const { vector } = await embedText(content);
    const row: Record<string, unknown> = {
      user_id: args.userId,
      workspace_id: args.workspaceId ?? null,
      source: args.source,
      source_ref: args.sourceRef ?? null,
      content: content.slice(0, 4000),
      embedding: toPgVectorLiteral(vector),
      metadata: args.metadata ?? {},
      importance: clamp01(args.importance ?? 0.5),
    };
    // upsert on (user_id, source, source_ref) — the unique index in the
    // migration. NULL source_ref upserts collapse, so callers pass a
    // synthetic ref ("chat_turn:<uuid>") for those.
    const { data: upserted, error } = await supabase
      .from("dori_semantic_memories")
      .upsert(row, { onConflict: "user_id,source,source_ref" })
      .select("id")
      .single();
    if (error) {
      console.warn("[rememberSemantic] upsert failed", error.message);
      return false;
    }
    // Knowledge graph ingest is fire-and-forget: a failed extraction
    // never blocks the underlying memory write.
    if (upserted?.id) {
      autoKgIngest(supabase, {
        userId: args.userId,
        workspaceId: args.workspaceId ?? null,
        sourceKind: "semantic",
        sourceId: upserted.id,
        text: content,
      }).catch((e) => console.warn("[rememberSemantic] kg ingest failed", (e as Error).message));
    }
    return true;
  } catch (e) {
    console.warn("[rememberSemantic] failed", (e as Error).message);
    return false;
  }
}

export interface RetrieveArgs {
  userId: string;
  workspaceId?: string | null;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
}

export async function retrieveRelevantMemories(
  supabase: SemanticClient,
  args: RetrieveArgs,
): Promise<SemanticHit[]> {
  const q = (args.query || "").trim();
  if (q.length < 4) return [];
  try {
    const { vector } = await embedText(q);
    const { data, error } = await supabase.rpc("match_semantic_memories", {
      p_user_id: args.userId,
      p_query_embedding: toPgVectorLiteral(vector),
      p_workspace_id: args.workspaceId ?? null,
      p_match_count: args.matchCount ?? 6,
      p_min_similarity: args.minSimilarity ?? 0.65,
    });
    if (error) {
      console.warn("[retrieveRelevantMemories] rpc failed", error.message);
      return [];
    }
    return (data ?? []) as SemanticHit[];
  } catch (e) {
    console.warn("[retrieveRelevantMemories] failed", (e as Error).message);
    return [];
  }
}

// Compact, cache-friendly block ready to drop into the system prompt.
// Hits already arrive blended-ranked from match_semantic_memories; we
// re-apply the SAME score here (similarity + importance + recency decay)
// so the prompt order matches the RPC and a durable/recent milestone
// outranks a slightly-closer stale chat turn.
export function formatMemoriesForPrompt(hits: SemanticHit[]): string {
  if (hits.length === 0) return "";
  const now = Date.now();
  const score = (h: SemanticHit): number => {
    const ageDays = Math.max(0, (now - new Date(h.created_at).getTime()) / 86_400_000);
    const recency = Math.exp(-ageDays / 45);
    return h.similarity + h.importance * 0.05 + recency * 0.05;
  };
  const ranked = [...hits].sort((a, b) => score(b) - score(a));
  const lines = ranked.map((h) => {
    const sim = (h.similarity * 100).toFixed(0);
    const tag = `${h.source}${h.source_ref ? `#${h.source_ref.slice(0, 24)}` : ""}`;
    const snippet = h.content.replace(/\s+/g, " ").slice(0, 220);
    return `- [${tag} · ${sim}%] ${snippet}`;
  });
  return [
    "## SEMANTIC MEMORY (top matches for this question)",
    "Past notes / events / chats / milestones that look relevant. Reference them naturally.",
    "These are RECALL hits — they may or may not actually apply, so use judgement.",
    ...lines,
  ].join("\n");
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
