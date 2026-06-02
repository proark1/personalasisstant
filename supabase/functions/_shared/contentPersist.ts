// Shared persistence helpers for Content Studio.
//
// Used by both `content-ideas` (user-invoked "generate now") and
// `content-ideas-cron` (the scheduled daily run) so the dedupe + insert logic
// lives in exactly one place.

import type { ContentIdea, CreatorProfileLike } from "./contentIdeas.ts";

export interface CreatorProfileRow extends CreatorProfileLike {
  id: string;
  user_id: string;
  ideas_per_day: number;
  trending_ratio: number;
  enabled: boolean;
  deliver_at: string;
  channels: string[];
  last_generated_on: string | null;
}

// Minimal Supabase admin client surface needed by this module.
type ContentAdminClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

// Headlines from the last `days` days, lowercased, so the generator can avoid
// repeating itself across daily batches.
export async function recentHeadlines(admin: ContentAdminClient, userId: string, days = 7): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  const { data } = await (admin
    .from("content_ideas")
    .select("headline")
    .eq("user_id", userId)
    .gte("generated_on", since)
    .limit(120) as Promise<{ data: { headline?: unknown }[] | null }>);
  return (data || []).map((r) => String(r.headline || "")).filter(Boolean);
}

// Replace the day's not-yet-actioned ideas with a fresh batch. Ideas the user
// already liked / dismissed / scheduled today are preserved — only 'new' ones
// for `generatedOn` are cleared before inserting.
export async function persistDailyBatch(
  admin: ContentAdminClient,
  userId: string,
  ideas: ContentIdea[],
  generatedOn: string,
): Promise<Record<string, unknown>[]> {
  const { error: deleteError } = await admin
    .from("content_ideas")
    .delete()
    .eq("user_id", userId)
    .eq("generated_on", generatedOn)
    .eq("status", "new");
  // Throw on failure: silently proceeding would insert a second batch on top of
  // the old one, leaving duplicate active ideas for the day.
  if (deleteError) throw new Error(deleteError.message);

  if (ideas.length === 0) return [];

  const rows = ideas.map((idea) => ({
    user_id: userId,
    generated_on: generatedOn,
    kind: idea.kind,
    topic: idea.topic,
    headline: idea.headline,
    hook: idea.hook,
    summary: idea.summary,
    source_url: idea.source_url,
    source_title: idea.source_title,
    rank: idea.rank,
    status: "new",
  }));

  const { data, error } = await admin.from("content_ideas").insert(rows).select();
  if (error) throw new Error(error.message);
  return data || [];
}
