// content-script — turn a liked content idea into ready-to-record scripts.
//
// For one idea we generate (by default) BOTH:
//   * a short-form script (TikTok / Reels / Shorts) with per-platform captions,
//     hashtags and hooks, plus a b-roll shot list, and
//   * a long-form YouTube script with title options, a thumbnail concept,
//     chapters, an SEO description and a CTA.
//
// Everything is written in the creator's voice and follows the per-platform
// best practices in _shared/platformPlaybooks.ts.
//
// Body: { idea_id: uuid, formats?: ("short"|"long")[], platforms?: string[] }
// Auth: end-user JWT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveUserId, adminClient } from "../_shared/auth.ts";
import { assertWithinQuota } from "../_shared/ai-quota.ts";
import { strictAppOrigin } from "../_shared/cors.ts";
import {
  shortPlaybook,
  longPlaybook,
  KNOWN_PLATFORMS,
  type ScriptFormat,
} from "../_shared/platformPlaybooks.ts";
import { languageName } from "../_shared/contentIdeas.ts";

// Optional "make it different" hint when the user regenerates a script.
const VARIATIONS: Record<string, string> = {
  shorter: "Make this noticeably SHORTER and tighter than a normal version — cut every spare word.",
  longer: "Make this a bit LONGER and more detailed than a normal version, without padding.",
  punchier:
    "Make this PUNCHIER and higher-energy — bolder hook, snappier lines, stronger pattern interrupts.",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Native Gemini structured-output schemas (generationConfig.responseSchema). We
// use the native generateContent endpoint — the same one content-ideas uses
// successfully — instead of the OpenAI-compatibility endpoint + function calling.
// minItems/maxItems/minimum/maximum are intentionally omitted (not universally
// honoured by responseSchema); lengths are clamped in code instead.
const SHORT_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string", description: "The exact spoken first line (0-2s)." },
    script: { type: "string", description: "The full spoken script, 20-45s when read aloud." },
    shot_list: {
      type: "string",
      description: "B-roll / shot ideas and on-screen text beats, as short lines.",
    },
    duration_seconds: { type: "integer" },
    cta: { type: "string", description: "The closing call-to-action." },
    platform_variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["tiktok", "instagram", "youtube"] },
          hook: { type: "string", description: "Platform-tuned hook if it should differ." },
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          notes: { type: "string", description: "Platform-specific tip (sound, format, etc.)." },
        },
        required: ["platform", "caption", "hashtags"],
      },
    },
  },
  required: ["hook", "script", "shot_list", "platform_variants"],
};

const LONG_SCHEMA = {
  type: "object",
  properties: {
    title_options: { type: "array", items: { type: "string" } },
    thumbnail_concept: {
      type: "string",
      description: "Thumbnail idea incl. 3-5 words of on-thumbnail text.",
    },
    hook: { type: "string", description: "The spoken 0-15s opening hook." },
    script: { type: "string", description: "The full spoken script with clear chapter markers." },
    shot_list: { type: "string", description: "Chapter outline / b-roll suggestions." },
    description: {
      type: "string",
      description: "SEO YouTube description, 2-3 sentences + a short outline.",
    },
    hashtags: { type: "array", items: { type: "string" }, description: "Tags/hashtags." },
    cta: { type: "string" },
    duration_seconds: { type: "integer" },
  },
  required: ["title_options", "thumbnail_concept", "hook", "script", "description"],
};

interface IdeaRow {
  headline?: string;
  hook?: string;
  summary?: string;
  source_url?: string;
}
interface ProfileRow {
  persona?: string;
  tone?: string[];
  audience?: string;
  business_context?: string;
  default_cta?: string;
}

function voiceBlock(idea: IdeaRow, profile: ProfileRow | null, langName: string): string {
  const tone = Array.isArray(profile?.tone) ? profile.tone.filter(Boolean).join(", ") : "";
  return [
    profile?.persona ? `Creator: ${profile.persona}` : "",
    tone ? `Voice/tone: ${tone}` : "",
    profile?.audience ? `Audience: ${profile.audience}` : "",
    profile?.business_context ? `Business: ${profile.business_context}` : "",
    profile?.default_cta ? `Preferred call-to-action: ${profile.default_cta}` : "",
    `Write the ENTIRE output — hook, script, captions, hashtags, titles, description and CTA — in ${langName}.`,
    "",
    `IDEA TITLE: ${idea.headline}`,
    idea.hook ? `OPENING ANGLE: ${idea.hook}` : "",
    idea.summary ? `WHAT TO COVER: ${idea.summary}` : "",
    idea.source_url ? `SOURCE (for facts; don't fabricate beyond it): ${idea.source_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(
  geminiKey: string,
  system: string,
  user: string,
  schema: unknown,
): Promise<Record<string, unknown>> {
  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: user }] }],
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: schema,
        // Straightforward generation task — spend the budget on the answer.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    // Gemini errors are structured JSON ({ error: { message } }); prefer that
    // over the raw body for a legible message.
    let detail = "";
    try {
      const errJson = await resp.clone().json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new Error(`AI gateway ${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  // A non-STOP finish (SAFETY, RECITATION, MAX_TOKENS, …) usually means empty or
  // truncated parts — surface why instead of a generic "Empty AI response".
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`AI generation stopped: ${candidate.finishReason}`);
  }
  const text = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error("Empty AI response");
  try {
    return JSON.parse(text);
  } catch {
    // Tolerate stray fences/prose around the JSON object.
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    throw new Error("AI returned invalid JSON");
  }
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      String(x || "")
        .replace(/^#/, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userId = auth.userId;
    const admin = adminClient();

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const ideaId = String(body?.idea_id || "");
    if (!UUID_RE.test(ideaId)) return json({ error: "invalid idea_id" }, 400);

    const formats: ScriptFormat[] =
      Array.isArray(body?.formats) && body.formats.length
        ? body.formats.filter((f: string) => f === "short" || f === "long")
        : ["short", "long"];
    if (formats.length === 0) return json({ error: "no valid formats requested" }, 400);

    const { data: idea, error: ideaErr } = await admin
      .from("content_ideas")
      .select("*")
      .eq("id", ideaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ideaErr || !idea) return json({ error: "idea not found" }, 404);

    const { data: profile } = await admin
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const targetPlatforms: string[] = (() => {
      const fromBody = Array.isArray(body?.platforms) ? body.platforms : null;
      const fromProfile = Array.isArray(profile?.platforms) ? profile.platforms : null;
      const chosen = (fromBody || fromProfile || []).filter((p: string) =>
        (KNOWN_PLATFORMS as string[]).includes(p),
      );
      return chosen.length ? chosen : [...KNOWN_PLATFORMS];
    })();

    try {
      await assertWithinQuota(admin, userId);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return json({ error: (e as Error).message, code }, code === "quota_exceeded" ? 429 : 503);
    }

    const langName = languageName(
      typeof body?.language === "string" && body.language
        ? body.language
        : profile?.primary_language,
    );
    const shortSeconds = Number.isInteger(body?.short_seconds)
      ? body.short_seconds
      : Number.isInteger(profile?.short_seconds)
        ? profile.short_seconds
        : 30;
    const longMinutes = Number.isInteger(body?.long_minutes)
      ? body.long_minutes
      : Number.isInteger(profile?.long_minutes)
        ? profile.long_minutes
        : 6;
    const variationHint = VARIATIONS[String(body?.variation || "")] || "";

    const vBlock = voiceBlock(idea, profile, langName);
    const saved: Record<string, unknown>[] = [];

    for (const format of formats) {
      let row: Record<string, unknown>;

      if (format === "short") {
        const system = `You are a world-class short-form scriptwriter. Write a vertical short-video script in the creator's authentic voice. Make it genuinely scroll-stopping, specific, and easy to record from a phone. Return ONLY a JSON object matching the schema.\n\n${shortPlaybook(targetPlatforms)}`;
        const user = `${vBlock}\n\nTarget spoken length: about ${shortSeconds} seconds.${variationHint ? ` ${variationHint}` : ""}\nTarget platforms: ${targetPlatforms.join(", ")}. Write ONE short-form script (shared spoken text) plus a tailored caption + hashtags (and a tuned hook if it should differ) for each target platform.`;
        const out = await callGemini(geminiKey, system, user, SHORT_SCHEMA);

        const variants = Array.isArray(out?.platform_variants)
          ? (out.platform_variants as Array<Record<string, unknown>>).map((v) => ({
              platform: String(v?.platform || "generic"),
              hook: String(v?.hook || "").slice(0, 280),
              caption: String(v?.caption || "").slice(0, 600),
              hashtags: asStringArray(v?.hashtags, 8),
              notes: String(v?.notes || "").slice(0, 400),
            }))
          : [];
        const first = variants[0];

        row = {
          user_id: userId,
          idea_id: ideaId,
          format: "short",
          platform: "generic",
          hook: String(out?.hook || "").slice(0, 400),
          script: String(out?.script || "").slice(0, 6000),
          shot_list: String(out?.shot_list || "").slice(0, 4000),
          caption: first ? first.caption : "",
          hashtags: first ? first.hashtags : [],
          cta: String(out?.cta || profile?.default_cta || "").slice(0, 400),
          duration_seconds: Number.isInteger(out?.duration_seconds) ? out.duration_seconds : 30,
          platform_variants: variants,
          title_options: [],
          thumbnail_concept: "",
          description: "",
          updated_at: new Date().toISOString(),
        };
      } else {
        const system = `You are a top YouTube strategist and scriptwriter. Write a long-form video script in the creator's authentic voice, optimised for watch-time and clarity. Return ONLY a JSON object matching the schema.\n\n${longPlaybook()}`;
        const user = `${vBlock}\n\nTarget length: about ${longMinutes} minutes of spoken content.${variationHint ? ` ${variationHint}` : ""}\nWrite the full long-form YouTube script now.`;
        const out = await callGemini(geminiKey, system, user, LONG_SCHEMA);

        row = {
          user_id: userId,
          idea_id: ideaId,
          format: "long",
          platform: "youtube",
          hook: String(out?.hook || "").slice(0, 600),
          script: String(out?.script || "").slice(0, 16000),
          shot_list: String(out?.shot_list || "").slice(0, 4000),
          caption: "",
          hashtags: asStringArray(out?.hashtags, 10),
          cta: String(out?.cta || profile?.default_cta || "").slice(0, 400),
          duration_seconds: Number.isInteger(out?.duration_seconds) ? out.duration_seconds : 420,
          platform_variants: [],
          title_options: asStringArray(out?.title_options, 5),
          thumbnail_concept: String(out?.thumbnail_concept || "").slice(0, 500),
          description: String(out?.description || "").slice(0, 3000),
          updated_at: new Date().toISOString(),
        };
      }

      const { data: up, error: upErr } = await admin
        .from("content_scripts")
        .upsert(row, { onConflict: "idea_id,format" })
        .select()
        .single();
      if (upErr) throw new Error(upErr.message);
      saved.push(up);
    }

    // Liking is implied by asking for scripts. Non-fatal: the scripts are
    // already saved and returned, so a failed status bump must not 500 the call.
    if (idea.status === "new") {
      const { error: likeErr } = await admin
        .from("content_ideas")
        .update({ status: "liked", updated_at: new Date().toISOString() })
        .eq("id", ideaId);
      if (likeErr) console.warn("[content-script] failed to mark idea liked:", likeErr.message);
    }

    return json({ ok: true, scripts: saved });
  } catch (err) {
    console.error("[content-script] failed", (err as Error).message);
    return json({ error: (err as Error).message || "Unknown error" }, 500);
  }
});
