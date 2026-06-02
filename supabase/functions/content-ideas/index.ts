// content-ideas — generate (or regenerate) the day's batch of content ideas
// for the calling user. Powers the "Generate today's ideas" button.
//
// Body (all optional): { count?, trending_ratio? } — overrides the creator
// profile's defaults for this run only.
//
// Auth: end-user JWT. Falls back to a profile derived from the user's general
// `profiles` row if they haven't set up a creator profile yet, so the button
// still does something useful on first use.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveUserId, adminClient } from "../_shared/auth.ts";
import { assertWithinQuota } from "../_shared/ai-quota.ts";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateContentIdeas, type CreatorProfileLike } from "../_shared/contentIdeas.ts";
import { recentHeadlines, persistDailyBatch } from "../_shared/contentPersist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userId = auth.userId;
    const admin = adminClient();

    if (!Deno.env.get("GEMINI_API_KEY")) return json({ error: "GEMINI_API_KEY not configured" }, 503);

    const body = await req.json().catch(() => ({}));

    // Load the creator profile; fall back to the general profile so a brand-new
    // user still gets relevant ideas before they fill in the creator form.
    const { data: profile } = await admin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: baseProfile } = await admin
      .from("profiles")
      .select("bio, interests, businesses, location_city, location_country")
      .eq("user_id", userId)
      .maybeSingle();

    const profileLike: CreatorProfileLike = profile
      ? {
          persona: profile.persona,
          tone: profile.tone,
          topics: profile.topics,
          audience: profile.audience,
          business_context: profile.business_context,
          platforms: profile.platforms,
          primary_language: profile.primary_language,
        }
      : {
          persona: baseProfile?.bio ?? "",
          topics: [...(baseProfile?.interests ?? []), ...(baseProfile?.businesses ?? [])],
          business_context: (baseProfile?.businesses ?? []).join(", "),
        };

    const count = Number.isFinite(body?.count) ? Number(body.count) : (profile?.ideas_per_day ?? 10);
    const ratio = Number.isFinite(body?.trending_ratio)
      ? Number(body.trending_ratio)
      : (profile?.trending_ratio ?? 0.5);
    const ideaSource = ["mixed", "trending", "knowledge"].includes(body?.idea_source)
      ? body.idea_source
      : (profile?.idea_source ?? "mixed");
    // Language: the client passes its current app language; fall back to the
    // saved content language, then English.
    const language = typeof body?.language === "string" && body.language
      ? body.language
      : (profile?.primary_language ?? "en");
    const location = {
      city: baseProfile?.location_city ?? null,
      country: baseProfile?.location_country ?? null,
    };

    try {
      await assertWithinQuota(admin, userId);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return json({ error: (e as Error).message, code }, code === "quota_exceeded" ? 429 : 503);
    }

    const avoid = await recentHeadlines(admin, userId, 7);
    const ideas = await generateContentIdeas(profileLike, location, {
      count,
      trendingRatio: ratio,
      ideaSource,
      language,
      avoidHeadlines: avoid,
    });

    const today = new Date().toISOString().split("T")[0];
    const inserted = await persistDailyBatch(admin, userId, ideas, today);

    if (profile) {
      // Non-fatal: the ideas are already saved and returned below, so a failure
      // here must not turn a successful generation into a 500. Worst case the
      // daily cron regenerates once more today.
      const { error: stampErr } = await admin
        .from("creator_profiles")
        .update({ last_generated_on: today, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (stampErr) console.warn("[content-ideas] failed to stamp last_generated_on:", stampErr.message);
    }

    return json({ ok: true, generated_on: today, count: inserted.length, ideas: inserted });
  } catch (err) {
    console.error("[content-ideas] failed", (err as Error).message);
    return json({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
