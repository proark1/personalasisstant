export interface TelegramToolGroundingCandidate {
  tool: string;
  action: string;
  data: Record<string, unknown>;
  summary?: string | null;
}

export interface TelegramToolGroundingResult {
  grounded: boolean;
  reason: string;
  matchedTokens: string[];
  evidenceTokens: string[];
}

const TELEGRAM_SOURCES = new Set(["tg_private", "tg_family", "tg_workspace", "voice"]);

const STOPWORDS = new Set([
  "add",
  "added",
  "adding",
  "auf",
  "aufgabe",
  "calendar",
  "create",
  "delete",
  "den",
  "der",
  "die",
  "do",
  "due",
  "ein",
  "eine",
  "einen",
  "einer",
  "event",
  "for",
  "hinzufugen",
  "ich",
  "in",
  "kalender",
  "machen",
  "mit",
  "move",
  "moved",
  "moving",
  "reminder",
  "save",
  "schedule",
  "set",
  "task",
  "termin",
  "the",
  "to",
  "und",
  "update",
]);

const EVIDENCE_KEYS = new Set([
  "assignee",
  "body",
  "category",
  "content",
  "location",
  "message",
  "name",
  "query",
  "subject",
  "title",
  "to",
]);

export function isTelegramActionSource(source?: string | null): boolean {
  return TELEGRAM_SOURCES.has(String(source || ""));
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(value: unknown): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((token) => token.length >= 3 || /^\d{2,}$/.test(token))
    .filter((token) => !STOPWORDS.has(token));
}

function collectEvidenceText(value: unknown, keyHint?: string): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return keyHint && EVIDENCE_KEYS.has(keyHint) ? [String(value)] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectEvidenceText(item, keyHint));
  }
  if (typeof value !== "object") return [];
  const out: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out.push(...collectEvidenceText(nested, key));
  }
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hasReferentialMutationIntent(normalizedLatest: string): boolean {
  return /\b(add|assign|buy|cancel|create|delete|erinner|erinnere|kaufen|log|loeschen|losch|loschen|mach|move|remind|remove|save|schedule|send|sende|set|stell|trag|update|verschieb)\b/.test(
    normalizedLatest,
  );
}

export function evaluateTelegramToolGrounding(
  candidate: TelegramToolGroundingCandidate,
  latestUserText: string,
): TelegramToolGroundingResult {
  const latestTokens = new Set(tokenise(latestUserText));
  const latestNormalized = normalizeText(latestUserText);
  const evidenceTexts = collectEvidenceText(candidate.data);
  const evidenceTokens = unique([
    ...evidenceTexts.flatMap(tokenise),
    ...tokenise(candidate.summary || ""),
  ]);

  if (!latestNormalized) {
    return {
      grounded: true,
      reason: "missing_latest_text",
      matchedTokens: [],
      evidenceTokens,
    };
  }

  if (evidenceTokens.length === 0) {
    return {
      grounded: true,
      reason: "no_specific_evidence",
      matchedTokens: [],
      evidenceTokens,
    };
  }

  const matchedTokens = evidenceTokens.filter((token) => latestTokens.has(token));
  if (matchedTokens.length > 0) {
    return {
      grounded: true,
      reason: "token_overlap",
      matchedTokens,
      evidenceTokens,
    };
  }

  if (hasReferentialMutationIntent(latestNormalized)) {
    return {
      grounded: true,
      reason: "referential_mutation_intent",
      matchedTokens: [],
      evidenceTokens,
    };
  }

  for (const text of evidenceTexts) {
    const phrase = normalizeText(text);
    if (phrase.length >= 8 && latestNormalized.includes(phrase)) {
      return {
        grounded: true,
        reason: "phrase_overlap",
        matchedTokens: tokenise(text),
        evidenceTokens,
      };
    }
  }

  return {
    grounded: false,
    reason: `no_overlap_for_${candidate.tool}`,
    matchedTokens: [],
    evidenceTokens,
  };
}
