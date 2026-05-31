// Shared briefing news generator.
//
// Curates real, recent news for a set of topics using Gemini 2.5 Flash with
// Google Search grounding, returning structured items with links to the actual
// sources the model grounded on. Grounding is what keeps the briefing current:
// the model searches the live web at request time instead of recalling stale
// (or hallucinated) headlines from its training data.
//
// Used by the `morning-briefing` edge function and the scheduled
// `briefing-dispatch-cron` (which runs with the service role and therefore
// cannot carry an end-user JWT to call `morning-briefing` directly).
//
// Note: Gemini does not allow Google Search grounding to be combined with
// structured-output mode (responseMimeType / responseSchema), so we ask for a
// JSON array in the prompt and parse it from the response text.

export interface NewsItem {
  headline: string;
  summary: string;
  category: string;
  url: string;
}

export interface NewsLocation {
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Minimal shapes for the bits of the Gemini grounding response we read.
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

interface RawNewsItem {
  headline: string;
  summary: string;
  category: string;
  // The article URL the model reports using; trusted only after domain validation.
  sourceUrl?: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildLocationContext(location?: NewsLocation | null): string {
  if (!location) return "";
  if (location.city && location.country) {
    return ` The user is located in ${location.city}, ${location.country}.`;
  }
  if (location.country) {
    return ` The user is located in ${location.country}.`;
  }
  if (location.latitude != null && location.longitude != null) {
    return ` The user's coordinates are approximately ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}.`;
  }
  return "";
}

// Pull the model's text out of the candidate parts (there can be several).
function extractText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

// Parse the JSON array of items, tolerating markdown fences or surrounding prose.
function parseItems(text: string): RawNewsItem[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const tryParse = (s: string): RawNewsItem[] | null => {
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as RawNewsItem[]) : null;
    } catch {
      return null;
    }
  };
  // Direct parse first, then fall back to the first [...] block in the text.
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const match = cleaned.match(/\[\s*{[\s\S]*}\s*]/);
  if (match) {
    const fromBlock = tryParse(match[0]);
    if (fromBlock) return fromBlock;
  }
  return [];
}

// Build the set of publisher domains Gemini grounded on, taken from the
// groundingChunk titles (which are typically registrable domains such as
// "techcrunch.com"). Used to validate the model's self-reported article URLs.
function buildGroundedDomains(chunks: GroundingChunk[]): Set<string> {
  const domains = new Set<string>();
  const domainRe = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
  for (const c of chunks) {
    const title = (c?.web?.title || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (domainRe.test(title)) domains.add(title);
  }
  return domains;
}

function hostMatchesDomain(host: string, domains: Set<string>): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  for (const d of domains) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

// Accept the model's own article URL only when it's a real http(s) link whose
// domain matches one of the grounded sources. This yields a direct article link
// while guarding against hallucinated or aggregator/redirect URLs.
function validArticleUrl(raw: string | undefined, domains: Set<string>): string | undefined {
  if (!raw || domains.size === 0) return undefined;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  const host = u.hostname.toLowerCase();
  if (host.includes("vertexaisearch") || host === "google.com" || host.endsWith(".google.com")) {
    return undefined;
  }
  return hostMatchesDomain(host, domains) ? u.toString() : undefined;
}

// Resolve each item to its best source link, in priority order:
//   1. the model's own article URL, validated against the grounded domains;
//   2. the Gemini grounding citation whose cited text matches the item, then
//      the citation at the item's position;
//   3. a Google News search for the (now real) headline as a last resort.
function resolveUrls(items: RawNewsItem[], grounding?: GroundingMetadata): NewsItem[] {
  const chunks = grounding?.groundingChunks ?? [];
  const supports = grounding?.groundingSupports ?? [];
  const groundedDomains = buildGroundedDomains(chunks);
  const uriAt = (i?: number): string | undefined =>
    i != null && i >= 0 ? chunks[i]?.web?.uri : undefined;
  const pool = chunks.map((c) => c?.web?.uri).filter((u): u is string => Boolean(u));

  return items.map((item, idx) => {
    const headline = (item.headline || "").trim();

    // 1) The model's own article URL, if its domain is among the grounded sources.
    let url = validArticleUrl(item.sourceUrl, groundedDomains);

    // 2) Otherwise the grounding citation whose cited text matches this item.
    if (!url) {
      const hay = `${headline} ${item.summary || ""}`.toLowerCase();
      for (const s of supports) {
        const seg = (s?.segment?.text || "").toLowerCase().trim();
        if (seg.length >= 12 && (hay.includes(seg) || seg.includes(headline.toLowerCase()))) {
          url = uriAt(s.groundingChunkIndices?.[0]);
          if (url) break;
        }
      }
    }
    if (!url) url = pool[idx] ?? pool[0];

    // 3) Last resort: a search for the (now real) headline.
    if (!url) url = `https://news.google.com/search?q=${encodeURIComponent(headline)}&hl=en`;

    return {
      headline,
      summary: item.summary,
      category: item.category,
      url,
    };
  });
}

/**
 * Generate curated, current news items for the given topics.
 *
 * @param topics    Topics to cover. Falls back to general topics when empty.
 * @param location  Optional location context for localised news.
 * @param maxItems  Soft cap on the number of items to request (default 5).
 * @param apiKey    Gemini API key. Defaults to the GEMINI_API_KEY env var.
 */
export async function generateNews(
  topics: string[],
  location?: NewsLocation | null,
  maxItems = 5,
  apiKey: string | undefined = Deno.env.get("GEMINI_API_KEY"),
): Promise<NewsItem[]> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const topicsToSearch = (topics || [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (topicsToSearch.length === 0) {
    topicsToSearch.push("technology", "business", "productivity");
  }

  const topicsString = topicsToSearch.join(", ");
  const locationContext = buildLocationContext(location);
  const itemCount = Math.max(1, Math.min(maxItems || 5, 10));
  const today = new Date().toISOString().split("T")[0];

  const systemInstruction = `You are a news briefing curator with live Google Search access. Use Google Search to find REAL, SPECIFIC news published recently. Never invent events or recall outdated ones — only report items you can confirm from current search results.

Focus on topics: ${topicsString}.${locationContext}

REQUIREMENTS:
1. Each item must be a specific, recent, real event or announcement — include company, product, or person names.
2. Strongly prefer items from the last 24-48 hours; never include anything older than 7 days.
3. Return at most ${itemCount} items, most important first.
4. For each item, include the exact URL of the specific source article from your search results.

Respond with ONLY a JSON array (no markdown fences, no commentary). Each object must have:
- "headline": specific headline with names (max 110 chars)
- "summary": 1-2 sentences with concrete details
- "category": the topic category
- "sourceUrl": the direct link to the specific source article (the canonical article page — never a homepage, section, search, or AMP URL)`;

  const userPrompt = `What are the most important, specific, recent news events and announcements in ${topicsString} from the last 24-48 hours?${locationContext} Today's date is ${today}. Use Google Search to verify each item is current and real, then return the JSON array.`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        // Disable thinking: this is a straightforward extraction task and we
        // want the token budget spent on the JSON answer, not on reasoning.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Gemini error:", response.status, errorData);
    throw new Error("Failed to fetch news from AI");
  }

  const data = await response.json();
  const text = extractText(data);
  const items = parseItems(text);

  if (items.length === 0) {
    console.error("Gemini returned no parseable news items. Raw text:", text.slice(0, 500));
    throw new Error("No news items returned");
  }

  const grounding: GroundingMetadata | undefined = data?.candidates?.[0]?.groundingMetadata;
  return resolveUrls(items.slice(0, itemCount), grounding);
}
