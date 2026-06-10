// Shared content-idea generator.
//
// Produces a batch of content ideas for a creator using Gemini 2.5 Flash. Ideas
// come from one of two sources, chosen per-batch:
//   * "current"   — tied to a real, specific development from the last ~7 days,
//                   found with Google Search grounding and linked to its source.
//   * "evergreen" — timeless angles/frameworks/lessons drawn from the model's
//                   OWN knowledge (no search, no source required).
//
// The creator's `idea_source` decides the mix: "trending" (all current),
// "knowledge" (all evergreen), or "mixed" (split by the trending↔evergreen
// ratio). Grounding can't be combined with structured-output mode, so we ask for
// a JSON array in the prompt and parse it from the response text; grounded
// batches additionally map each idea to a real source URL via grounding metadata.

export interface CreatorProfileLike {
  persona?: string | null;
  tone?: string[] | null;
  topics?: string[] | null;
  audience?: string | null;
  business_context?: string | null;
  platforms?: string[] | null;
  primary_language?: string | null;
}

export type IdeaSource = "mixed" | "trending" | "knowledge";

export interface ContentIdea {
  kind: "current" | "evergreen";
  topic: string;
  headline: string;
  hook: string;
  summary: string;
  source_url: string | null;
  source_title: string | null;
  rank: number;
}

export interface IdeaLocation {
  city?: string | null;
  country?: string | null;
}

export interface GenerateIdeasOptions {
  count?: number;
  trendingRatio?: number;
  ideaSource?: IdeaSource;
  language?: string | null;
  avoidHeadlines?: string[];
  apiKey?: string;
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}
interface GroundingSupport {
  segment?: { text?: string };
  groundingChunkIndices?: number[];
}
interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
}

interface RawIdea {
  topic?: string;
  headline?: string;
  hook?: string;
  summary?: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
};

// Map a locale code ("de", "de-DE") to a human language name for the prompt.
export function languageName(code?: string | null): string {
  const c = (code || "en").toLowerCase().slice(0, 2);
  return LANGUAGE_NAMES[c] || code || "English";
}

// How many of `total` ideas should be "current" (trending-now) given the
// creator's trending↔evergreen ratio. Kept deliberately simple and mirrored by
// the frontend's computeIdeaSplit() in src/lib/content.ts.
export function splitIdeaCounts(total: number, trendingRatio: number): { current: number; evergreen: number } {
  const t = Math.max(1, Math.min(total, 20));
  const r = Math.max(0, Math.min(Number.isFinite(trendingRatio) ? trendingRatio : 0.5, 1));
  const current = Math.max(0, Math.min(Math.round(t * r), t));
  return { current, evergreen: t - current };
}

function buildLocationContext(location?: IdeaLocation | null): string {
  if (!location) return "";
  if (location.city && location.country) return ` They are based in ${location.city}, ${location.country}.`;
  if (location.country) return ` They are based in ${location.country}.`;
  return "";
}

function extractText(data: Record<string, unknown>): string {
  const parts = (data?.candidates as { content?: { parts?: { text?: unknown }[] } }[] | undefined)?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
}

function parseItems(text: string): RawIdea[] {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const tryParse = (s: string): RawIdea[] | null => {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as RawIdea[]) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const match = cleaned.match(/\[\s*{[\s\S]*}\s*]/);
  if (match) {
    const fromBlock = tryParse(match[0]);
    if (fromBlock) return fromBlock;
  }
  return [];
}

// Map each idea to a real source URL/title from the grounding metadata. Prefer
// the source whose cited text segment matches the idea; otherwise fall back to
// the chunk at the idea's position, then any chunk.
function resolveSources(
  items: RawIdea[],
  grounding?: GroundingMetadata,
): { url: string | null; title: string | null }[] {
  const chunks = grounding?.groundingChunks ?? [];
  const supports = grounding?.groundingSupports ?? [];
  const at = (i?: number) => (i != null && i >= 0 ? chunks[i]?.web : undefined);
  const pool = chunks.map((c) => c?.web).filter((w): w is { uri?: string; title?: string } => Boolean(w?.uri));

  return items.map((item, idx) => {
    const headline = (item.headline || "").trim().toLowerCase();
    const hay = `${headline} ${(item.summary || "").toLowerCase()}`;

    let web: { uri?: string; title?: string } | undefined;
    for (const s of supports) {
      const seg = (s?.segment?.text || "").toLowerCase().trim();
      if (seg.length >= 12 && (hay.includes(seg) || seg.includes(headline))) {
        web = at(s.groundingChunkIndices?.[0]);
        if (web?.uri) break;
      }
    }
    if (!web?.uri) web = pool[idx] ?? pool[0];
    return { url: web?.uri ?? null, title: web?.title ?? null };
  });
}

interface BatchOpts {
  apiKey: string;
  grounded: boolean;
  kind: "current" | "evergreen";
  n: number;
  topicsString: string;
  personaBlock: string;
  locationContext: string;
  langName: string;
  avoidBlock: string;
}

// One Gemini call for a single kind. `grounded` toggles Google Search: current
// ideas need the live web; evergreen ideas come from the model's own expertise
// (no search, no source required).
async function fetchIdeaBatch(opts: BatchOpts): Promise<ContentIdea[]> {
  const { apiKey, grounded, kind, n, topicsString, personaBlock, locationContext, langName, avoidBlock } = opts;
  const today = new Date().toISOString().split("T")[0];

  const kindInstruction = grounded
    ? `Generate exactly ${n} ideas, each tied to a REAL, SPECIFIC development, story, launch, data point, or debate from roughly the last 7 days. Use Google Search to verify each is real and recent (prefer the last 24-72 hours). Never invent events.`
    : `Generate exactly ${n} evergreen ideas from your OWN expertise: timeless angles, frameworks, lessons, common mistakes, contrarian takes, myths to bust, or step-by-step how-tos in the creator's niche. They do NOT need to reference any news or article — draw on what you know. Make each specific and genuinely useful, never generic.`;

  const systemInstruction = `You are an elite short-form content strategist. You generate scroll-stopping video ideas a specific creator can talk about on camera, matched to their persona, niche, and audience.${locationContext}

${personaBlock}

${kindInstruction}

Write EVERYTHING — headline, hook, summary, topic — in ${langName}. For EVERY idea, the "hook" must be a punchy on-camera opener the creator could literally say in the first 2 seconds. The "headline" is the idea's title/angle (max 110 chars). The "summary" is a 4-5 sentence spoken mini-script the creator reads out loud on camera right after the hook — a quick TikTok-style update.

The summary MUST sound like casual everyday speech — like excitedly telling a friend what you just heard — NOT like a news anchor, press release, or essay. Short punchy sentences. Simple everyday words. Talk TO the viewer directly (in German always use informal "du"/"ihr", never "Sie"). It's fine to start sentences with "Und", "Also", "Aber". Strictly avoid stiff written-language constructions — things like "Allerdings...", "Dies zeigt, dass...", "Es bleibt spannend, wie...", "Darüber hinaus...", "furthermore", "it remains to be seen". Read it back to yourself: if it wouldn't sound natural said out loud to a friend, rewrite it. Still pack in the actual facts, numbers, or steps (no bullet points, no meta-instructions like "explain that..."), and end with a casual takeaway or a direct question to the viewers.

Respond with ONLY a JSON array (no markdown fences, no commentary). Each object must have:
- "topic": which of the creator's topics it maps to
- "headline": the idea title/angle
- "hook": the spoken first-line hook
- "summary": the 4-5 sentence casual spoken script (what the creator literally says after the hook)${avoidBlock}`;

  const userPrompt = grounded
    ? `Today is ${today}. Use Google Search to find the most important, specific, recent developments in ${topicsString}, then return ${n} content ideas as the JSON array — all written in ${langName}.`
    : `Generate ${n} evergreen content ideas for topics: ${topicsString}, drawn from your own knowledge. Return the JSON array — all written in ${langName}.`;

  const requestBody: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.85, // a little creative spark for ideation
      maxOutputTokens: 8192, // up to 20 ideas, each with a 4-5 sentence spoken script
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (grounded) requestBody.tools = [{ googleSearch: {} }];

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    console.error(`Gemini error (${kind} ideas):`, response.status, await response.text().catch(() => ""));
    throw new Error("Failed to generate content ideas");
  }

  const data = await response.json();
  const raw = parseItems(extractText(data));
  if (raw.length === 0) return [];

  const sources = grounded
    ? resolveSources(raw, data?.candidates?.[0]?.groundingMetadata)
    : raw.map(() => ({ url: null, title: null }));

  return raw
    .map((item, i) => ({
      kind,
      topic: (item.topic || "").trim().slice(0, 80),
      headline: (item.headline || "").trim().slice(0, 200),
      hook: (item.hook || "").trim().slice(0, 400),
      summary: (item.summary || "").trim().slice(0, 1200),
      source_url: sources[i]?.url ?? null,
      source_title: sources[i]?.title ?? null,
      rank: 0,
    }))
    .filter((idea) => idea.headline.length > 0);
}

/**
 * Generate a batch of content ideas for a creator.
 *
 * @param profile   The creator's persona/topics/audience/business context.
 * @param location  Optional location for localised "current" ideas.
 * @param opts      count, trendingRatio, ideaSource, language, avoidHeadlines.
 */
export async function generateContentIdeas(
  profile: CreatorProfileLike,
  location?: IdeaLocation | null,
  opts: GenerateIdeasOptions = {},
): Promise<ContentIdea[]> {
  const apiKey = opts.apiKey ?? Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const total = Math.max(1, Math.min(opts.count || 10, 20));
  const source: IdeaSource = opts.ideaSource ?? "mixed";

  let wantCurrent: number;
  let wantEvergreen: number;
  if (source === "trending") {
    wantCurrent = total;
    wantEvergreen = 0;
  } else if (source === "knowledge") {
    wantCurrent = 0;
    wantEvergreen = total;
  } else {
    ({ current: wantCurrent, evergreen: wantEvergreen } = splitIdeaCounts(total, opts.trendingRatio ?? 0.5));
  }

  const topics = (profile.topics || []).map((t) => t.trim()).filter(Boolean);
  const topicsString = topics.length ? topics.join(", ") : "business, startups, entrepreneurship";
  const tone = (profile.tone || []).filter(Boolean).join(", ");
  const platforms = (profile.platforms || []).filter(Boolean).join(", ") || "YouTube, Instagram, TikTok";
  const langName = languageName(opts.language || profile.primary_language);
  const locationContext = buildLocationContext(location);
  const personaBlock = [
    profile.persona ? `Creator persona / story: ${profile.persona}` : "",
    tone ? `Voice/tone: ${tone}` : "",
    profile.audience ? `Target audience: ${profile.audience}` : "",
    profile.business_context ? `Their business: ${profile.business_context}` : "",
    `Topics they want to talk about: ${topicsString}`,
    `Platforms: ${platforms}`,
  ].filter(Boolean).join("\n");
  const avoid = opts.avoidHeadlines ?? [];
  const avoidBlock = avoid.length
    ? `\n\nAvoid repeating anything close to these recent ideas:\n- ${avoid.slice(0, 40).join("\n- ")}`
    : "";

  const shared = { apiKey, topicsString, personaBlock, locationContext, langName, avoidBlock };
  // Run the two batches concurrently; each is independent. Catch per-batch so a
  // failure in one (e.g. grounding hiccup, rate limit) still returns the other.
  const [currentIdeas, evergreenIdeas] = await Promise.all([
    wantCurrent > 0
      ? fetchIdeaBatch({ ...shared, grounded: true, kind: "current", n: wantCurrent })
          .catch((err) => { console.error("Failed to fetch current ideas:", err); return []; })
      : Promise.resolve([]),
    wantEvergreen > 0
      ? fetchIdeaBatch({ ...shared, grounded: false, kind: "evergreen", n: wantEvergreen })
          .catch((err) => { console.error("Failed to fetch evergreen ideas:", err); return []; })
      : Promise.resolve([]),
  ]);

  const ideas = [...currentIdeas, ...evergreenIdeas];
  if (ideas.length === 0) throw new Error("No content ideas returned");
  // Re-rank sequentially (current first — they're the most time-sensitive).
  return ideas.slice(0, total).map((idea, rank) => ({ ...idea, rank }));
}
