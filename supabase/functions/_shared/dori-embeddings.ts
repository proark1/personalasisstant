// Embedding helper.
//
// One entry point so every edge function uses the same provider, model,
// and dimension. Mixing dims would corrupt the IVFFlat index — so the
// dimension is locked to 768 and asserted at runtime.
//
// Uses Gemini's text-embedding-004 via the native generativelanguage API.
// Returns L2-normalised vectors so cosine == dot product downstream.

const EMBED_DIM = 768;
const EMBED_MODEL = "text-embedding-004";

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dim: number;
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const cleaned = (text || "").replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!cleaned) {
    throw new Error("embedText: empty input");
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    throw new Error("embedText: GEMINI_API_KEY is not configured");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: cleaned }] },
        taskType: "RETRIEVAL_DOCUMENT",
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`embedText: Gemini embedding failed [${res.status}]: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const vec = data?.embedding?.values as number[] | undefined;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIM) {
    throw new Error(
      `embedText: unexpected vector shape (len=${Array.isArray(vec) ? vec.length : "n/a"})`,
    );
  }
  return { vector: l2Normalise(vec), model: EMBED_MODEL, dim: EMBED_DIM };
}

// pgvector accepts both array and stringified-vector literals, but
// the JS client serialises arrays as arrays, which the bigint-friendly
// JSON path can mangle. The string literal form is unambiguous.
export function toPgVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

function l2Normalise(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const norm = Math.sqrt(sumSq) || 1;
  return v.map((x) => x / norm);
}

export const EMBEDDING_DIM = EMBED_DIM;
