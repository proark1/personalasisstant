// Shared content-idea generator.
//
// Produces a batch of content ideas for a creator using Gemini 2.5 Flash with
// Google Search grounding — the same live-web technique as briefingNews.ts, but
// framed as *content angles for a specific creator's voice and niche* instead of
// neutral headlines.
//
// Each batch is split into two kinds:
//   * "current"   — tied to a real, specific development from the last ~7 days
//                   (what's happening now), grounded to its source.
//   * "evergreen" — a timeless angle in the creator's niche (e.g. startup/
//                   business lessons) that still fits what they talk about;
//                   grounded to a real reference article/post where possible.
//
// As with briefingNews.ts, Google Search grounding can't be combined with
// structured-output mode, so we ask for a JSON array in the prompt and parse it
// from the response text, then map each idea to a real source URL using the
// grounding metadata.

export interface CreatorProfileLike {
  persona?: string | null;
  tone?: string[] | null;
  topics?: string[] | null;
  audience?: string | null;
  business_context?: string | null;
  platforms?: string[] | null;
  primary_language?: string | null;
}

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
  kind?: string;
  topic?: string;
  headline?: string;
  hook?: string;
  summary?: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

function extractText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("").trim();
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
// the chunk at the idea's position, then any chunk. Evergreen ideas may legitimately
// have no grounded source — that's allowed (null), unlike the news briefing.
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

// Rebalance the parsed ideas so the batch has, as close as possible, the desired
// number of "current" vs "evergreen" ideas, then clamp to `total` and rank them
// (current first — they're the most time-sensitive). The model usually honours
// the split, but we never trust it blindly.
function rebalance(ideas: ContentIdea[], wantCurrent: number, total: number): ContentIdea[] {
  const current = ideas.filter((i) => i.kind === "current");
  const evergreen = ideas.filter((i) => i.kind === "evergreen");
  const picked = [
    ...current.slice(0, wantCurrent),
    ...evergreen.slice(0, total - wantCurrent),
  ];
  // If one bucket was short, top up from the leftovers of the other so we still
  // return a full batch.
  if (picked.length < total) {
    const used = new Set(picked);
    for (const i of [...current.slice(wantCurrent), ...evergreen.slice(total - wantCurrent)]) {
      if (picked.length >= total) break;
      if (!used.has(i)) picked.push(i);
    }
  }
  return picked.slice(0, total).map((idea, rank) => ({ ...idea, rank }));
}

/**
 * Generate a batch of content ideas for a creator.
 *
 * @param profile        The creator's persona/topics/audience/business context.
 * @param location       Optional location for localised "current" ideas.
 * @param count          Total ideas to generate (default 10, clamped 1-20).
 * @param trendingRatio  Fraction that should be trending-now (default 0.5).
 * @param avoidHeadlines Recent headlines to avoid repeating.
 * @param apiKey         Gemini API key (defaults to GEMINI_API_KEY env var).
 */
export async function generateContentIdeas(
  profile: CreatorProfileLike,
  location?: IdeaLocation | null,
  count = 10,
  trendingRatio = 0.5,
  avoidHeadlines: string[] = [],
  apiKey: string | undefined = Deno.env.get("GEMINI_API_KEY"),
): Promise<ContentIdea[]> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const total = Math.max(1, Math.min(count || 10, 20));
  const { current: wantCurrent, evergreen: wantEvergreen } = splitIdeaCounts(total, trendingRatio);

  const topics = (profile.topics || []).map((t) => t.trim()).filter(Boolean);
  const topicsString = topics.length ? topics.join(", ") : "business, startups, entrepreneurship";
  const tone = (profile.tone || []).filter(Boolean).join(", ");
  const platforms = (profile.platforms || []).filter(Boolean).join(", ") || "YouTube, Instagram, TikTok";
  const language = profile.primary_language || "en";
  const today = new Date().toISOString().split("T")[0];
  const locationContext = buildLocationContext(location);

  const personaBlock = [
    profile.persona ? `Creator persona / story: ${profile.persona}` : "",
    tone ? `Voice/tone: ${tone}` : "",
    profile.audience ? `Target audience: ${profile.audience}` : "",
    profile.business_context ? `Their business: ${profile.business_context}` : "",
    `Topics they want to talk about: ${topicsString}`,
    `Platforms: ${platforms}`,
  ].filter(Boolean).join("\n");

  const avoidBlock = avoidHeadlines.length
    ? `\n\nAvoid repeating anything close to these recent ideas:\n- ${avoidHeadlines.slice(0, 40).join("\n- ")}`
    : "";

  const systemInstruction = `You are an elite short-form content strategist with live Google Search access. You generate scroll-stopping video ideas a specific creator can talk about on camera, perfectly matched to their persona, niche, and audience.${locationContext}

${personaBlock}

Produce exactly ${total} distinct ideas, written in language "${language}":
- ${wantCurrent} ideas of kind "current": each tied to a REAL, SPECIFIC development, story, launch, data point, or debate from roughly the last 7 days. Use Google Search to verify it is real and recent. Prefer the last 24-72 hours. Never invent events.
- ${wantEvergreen} ideas of kind "evergreen": timeless angles, frameworks, lessons, mistakes, contrarian takes, or how-tos in the creator's niche (startups/business etc.). These don't need to be new, but must still fit the creator. Where a strong real reference article/post exists, ground to it.

For EVERY idea, the "hook" must be a punchy on-camera opener the creator could literally say in the first 2 seconds. The "headline" is the idea's title/angle (max 110 chars). The "summary" is 1-2 sentences on what to actually cover.

Respond with ONLY a JSON array (no markdown fences, no commentary). Each object must have:
- "kind": "current" or "evergreen"
- "topic": which of the creator's topics it maps to
- "headline": the idea title/angle
- "hook": the spoken first-line hook
- "summary": 1-2 sentences on what to cover${avoidBlock}`;

  const userPrompt = `Today is ${today}. Generate the ${total} content ideas now (${wantCurrent} current + ${wantEvergreen} evergreen) for topics: ${topicsString}. Use Google Search to confirm every "current" idea is real and recent, then return the JSON array.`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.8, // a little creative spark for ideation
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Gemini error (content ideas):", response.status, errorData);
    throw new Error("Failed to generate content ideas");
  }

  const data = await response.json();
  const text = extractText(data);
  const raw = parseItems(text);
  if (raw.length === 0) {
    console.error("Gemini returned no parseable ideas. Raw text:", text.slice(0, 500));
    throw new Error("No content ideas returned");
  }

  const grounding: GroundingMetadata | undefined = data?.candidates?.[0]?.groundingMetadata;
  const sources = resolveSources(raw, grounding);

  const ideas: ContentIdea[] = raw.map((item, i) => {
    const kind = item.kind === "evergreen" ? "evergreen" : "current";
    return {
      kind,
      topic: (item.topic || "").trim().slice(0, 80),
      headline: (item.headline || "").trim().slice(0, 200),
      hook: (item.hook || "").trim().slice(0, 400),
      summary: (item.summary || "").trim().slice(0, 600),
      // Evergreen ideas are allowed to have no source; current ideas keep
      // whatever the grounding resolved (may be null if grounding was sparse).
      source_url: sources[i]?.url ?? null,
      source_title: sources[i]?.title ?? null,
      rank: i,
    };
  }).filter((i) => i.headline.length > 0);

  return rebalance(ideas, wantCurrent, total);
}
