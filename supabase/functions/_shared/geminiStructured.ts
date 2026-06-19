// Shared structured-output helper — Gemini NATIVE generateContent + responseSchema.
//
// Use this instead of the OpenAI-compatibility endpoint with forced
// function-calling (`/openai/chat/completions` + tool_choice). That path fails
// in our self-hosted deployment — it broke `content-script` in production,
// while the native `generateContent` endpoint (used by content-ideas) works.
//
// Pass the same JSON schema you used for the tool's `parameters` as `schema`;
// the returned object has the same shape the tool-call arguments did, so callers
// can keep their downstream parsing unchanged.
//
// Note: Google Search grounding cannot be combined with responseSchema. This
// helper is for the structured-extraction case (no grounding). For grounded
// generation, ask for JSON in the prompt and parse it (see contentIdeas.ts).

const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export interface StructuredOptions {
  system: string;
  /** Convenience: a single text user part. Ignored if `parts` is provided. */
  user?: string;
  /** Explicit user-message parts (e.g. for images: [{ inlineData }, { text }]). */
  parts?: unknown[];
  /** Gemini responseSchema (OpenAPI subset) — reuse your old tool `parameters`. */
  schema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
}

/**
 * Generate a structured JSON object matching `schema`. Throws a descriptive
 * Error on gateway failure, a non-STOP finish (SAFETY/MAX_TOKENS/…), or
 * unparseable output.
 */
export async function generateStructured(opts: StructuredOptions): Promise<unknown> {
  const apiKey = opts.apiKey ?? Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const userParts = opts.parts ?? [{ text: opts.user ?? "" }];

  const resp = await fetch(ENDPOINT(opts.model ?? DEFAULT_MODEL), {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: userParts }],
      systemInstruction: { parts: [{ text: opts.system }] },
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
  });

  if (!resp.ok) {
    // Read the body once, then try to pull Gemini's structured
    // { error: { message } } out of it (any JSON is also valid text).
    const raw = await resp.text().catch(() => "");
    let detail = raw;
    try {
      const errJson = JSON.parse(raw);
      detail = errJson?.error?.message || raw;
    } catch {
      /* not JSON — use the raw text */
    }
    throw new Error(`AI gateway ${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`AI generation stopped: ${candidate.finishReason}`);
  }
  const text = (candidate?.content?.parts ?? [])
    .map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : ""))
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
    const m = cleaned.match(/[{[][\s\S]*[\]}]/); // object or array

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
