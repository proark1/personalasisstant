// Embedding backfill / incremental index.
//
// Walks notes, episodic_memories, completed tasks, past events, and
// ai_memory rows for every user, embeds anything not yet in
// dori_semantic_memories, and writes the rows.
//
// Designed to run as a nightly cron AND be safe to call ad-hoc:
//   - upsert with (user_id, source, source_ref) so re-running is a
//     no-op.
//   - per-batch limit so a single user with 50k notes doesn't time
//     out the function.
//   - partial-failure tolerant — one bad row never aborts the run.
//
// Bodies passed in:
//   { user_id?: string, sources?: string[], max_per_user?: number }
//
// Service-role auth required.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { rememberSemantic } from "../_shared/dori-semantic-memory.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const ALL_SOURCES = ["note", "episodic", "task_completed", "event_past", "memory"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const body = await req.json().catch(() => ({}));
  const sources: string[] = (
    body.sources && body.sources.length ? body.sources : ALL_SOURCES
  ) as string[];
  const maxPerUser: number = body.max_per_user ?? 50;
  // Page size for the user-id sweep. 500 keeps each fetch under the
  // 1000-row PostgREST default and bounds memory at ~tens of KB even
  // with millions of users.
  const userPageSize: number = body.user_page_size ?? 500;
  // Hard ceiling on users processed per invocation, so a multi-million
  // user backfill doesn't hit the edge function timeout. Caller should
  // pass `cursor_offset` to resume on the next invocation.
  const maxUsers: number = body.max_users ?? 5000;
  const cursorOffset: number = body.cursor_offset ?? 0;

  let totalIndexed = 0;
  let usersProcessed = 0;
  const perUserStats: Record<string, Record<string, number>> = {};

  if (body.user_id) {
    const stats = await processUser(supabase, body.user_id, sources, maxPerUser);
    perUserStats[body.user_id] = stats.perSource;
    totalIndexed += stats.indexed;
    usersProcessed = 1;
  } else {
    let offset = cursorOffset;
    while (usersProcessed < maxUsers) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id")
        .order("user_id")
        .range(offset, offset + userPageSize - 1);
      if (error) {
        console.error("[embed-memories-backfill] page fetch failed", error.message);
        break;
      }
      const page = (data ?? []) as Array<{ user_id: string }>;
      if (page.length === 0) break;

      for (const { user_id } of page) {
        if (usersProcessed >= maxUsers) break;
        const stats = await processUser(supabase, user_id, sources, maxPerUser);
        perUserStats[user_id] = stats.perSource;
        totalIndexed += stats.indexed;
        usersProcessed++;
      }
      if (page.length < userPageSize) break; // last page
      offset += userPageSize;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      totalIndexed,
      users: usersProcessed,
      // Caller can resume from here on the next invocation if maxUsers cut us short.
      nextCursorOffset: cursorOffset + usersProcessed,
      truncated: usersProcessed >= maxUsers,
      perUserStats,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

async function processUser(
  supabase: SupabaseClient,
  userId: string,
  sources: string[],
  maxPerUser: number,
): Promise<{ indexed: number; perSource: Record<string, number> }> {
  const perSource: Record<string, number> = {};
  let indexed = 0;
  for (const source of sources) {
    try {
      const n = await indexSource(supabase, userId, source, maxPerUser);
      perSource[source] = n;
      indexed += n;
    } catch (e) {
      console.error(`[embed-memories-backfill] ${userId} ${source} failed`, (e as Error).message);
      perSource[source] = -1;
    }
  }
  return { indexed, perSource };
}

async function indexSource(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  maxPerUser: number,
): Promise<number> {
  // Fetch the candidate rows for this source. We pull existing source_refs
  // for this user+source first, then skip any candidate whose ref is
  // already present. Cheaper than left-joining at scale.
  const { data: existing } = await supabase
    .from("dori_semantic_memories")
    .select("source_ref")
    .eq("user_id", userId)
    .eq("source", source);
  const seen = new Set(
    (existing ?? []).map((r: { source_ref?: string }) => r.source_ref).filter(Boolean),
  );

  const candidates = await fetchCandidates(supabase, userId, source, maxPerUser);
  if (!candidates.length) return 0;

  let count = 0;
  for (const c of candidates) {
    if (seen.has(c.sourceRef)) continue;
    const ok = await rememberSemantic(supabase, {
      userId,
      workspaceId: c.workspaceId ?? null,
      source: source as
        | "note"
        | "episodic"
        | "task_completed"
        | "event_past"
        | "chat_turn"
        | "memory"
        | "contact"
        | "manual",
      sourceRef: c.sourceRef,
      content: c.content,
      metadata: c.metadata ?? {},
      importance: c.importance ?? 0.5,
    });
    if (ok) count++;
  }
  return count;
}

interface Candidate {
  sourceRef: string;
  content: string;
  workspaceId?: string | null;
  metadata?: Record<string, unknown>;
  importance?: number;
}

async function fetchCandidates(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  limit: number,
): Promise<Candidate[]> {
  switch (source) {
    case "note": {
      const { data } = await supabase
        .from("notes")
        .select("id, title, content, tags, workspace_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map(
        (n: {
          id: string;
          title?: string;
          content?: string;
          tags?: string[];
          workspace_id?: string;
        }) => ({
          sourceRef: `note:${n.id}`,
          content: [n.title, n.content].filter(Boolean).join("\n\n").slice(0, 4000),
          workspaceId: n.workspace_id ?? null,
          metadata: { tags: n.tags ?? [], title: n.title },
          importance: 0.5,
        }),
      );
    }
    case "episodic": {
      const { data } = await supabase
        .from("episodic_memories")
        .select("id, title, summary, occurred_on, location, tags, importance, source_ref")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .limit(limit);
      return (data ?? []).map(
        (e: {
          id: string;
          title?: string;
          summary?: string;
          location?: string;
          occurred_on?: string;
          tags?: string[];
          source_ref?: string;
          importance?: number;
        }) => ({
          sourceRef: `episodic:${e.id}`,
          content: [e.title, e.summary, e.location ? `at ${e.location}` : ""]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 4000),
          metadata: { occurred_on: e.occurred_on, tags: e.tags ?? [], origin_ref: e.source_ref },
          importance: typeof e.importance === "number" ? Math.min(1, e.importance / 5) : 0.6,
        }),
      );
    }
    case "task_completed": {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, category, priority, completed_at, workspace_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      return (data ?? [])
        .filter(
          (t: {
            id: string;
            title?: string;
            category?: string;
            priority?: string;
            completed_at?: string;
            workspace_id?: string;
          }) => t.title && t.title.length > 4,
        )
        .map(
          (t: {
            id: string;
            title?: string;
            category?: string;
            priority?: string;
            completed_at?: string;
            workspace_id?: string;
          }) => ({
            sourceRef: `task:${t.id}`,
            content: `Completed task: "${t.title}" (${t.category ?? "uncategorised"}, ${t.priority ?? "normal"} priority)`,
            workspaceId: t.workspace_id ?? null,
            metadata: { completed_at: t.completed_at, category: t.category },
            importance: t.priority === "high" ? 0.6 : 0.3,
          }),
        );
    }
    case "event_past": {
      const horizon = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("events")
        .select("id, title, start_time, location, attendees, workspace_id")
        .eq("user_id", userId)
        .gte("start_time", horizon)
        .lte("end_time", now)
        .order("start_time", { ascending: false })
        .limit(limit);
      return (data ?? [])
        .filter(
          (e: {
            id: string;
            title?: string;
            start_time?: string;
            location?: string;
            attendees?: string[];
            workspace_id?: string;
          }) => e.title,
        )
        .map(
          (e: {
            id: string;
            title?: string;
            start_time?: string;
            location?: string;
            attendees?: string[];
            workspace_id?: string;
          }) => ({
            sourceRef: `event:${e.id}`,
            content: `Past event: "${e.title}"${e.location ? ` at ${e.location}` : ""}${e.attendees?.length ? ` with ${e.attendees.slice(0, 4).join(", ")}` : ""}`,
            workspaceId: e.workspace_id ?? null,
            metadata: { start_time: e.start_time },
            importance: 0.4,
          }),
        );
    }
    case "memory": {
      const { data } = await supabase
        .from("ai_memory")
        .select("id, key, value, memory_type, category, workspace_id, updated_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map(
        (m: {
          id: string;
          key: string;
          value: string;
          memory_type?: string;
          category?: string;
          workspace_id?: string;
        }) => ({
          sourceRef: `memory:${m.id}`,
          content: `[${m.memory_type}${m.category ? ` · ${m.category}` : ""}] ${m.key}: ${m.value}`,
          workspaceId: m.workspace_id ?? null,
          metadata: { key: m.key, memory_type: m.memory_type },
          importance: 0.7,
        }),
      );
    }
    default:
      return [];
  }
}
