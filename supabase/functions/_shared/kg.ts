// Knowledge graph helper.
//
// Two responsibilities:
//   1. extractEntities() — runs an LLM tool-call to pull people /
//      projects / places / organizations / topics out of a memory row.
//   2. linkExtraction() — upserts the entities + their mentions in
//      one batch, so the call site is a single helper invocation.
//
// Failure mode: identical to rememberSemantic() — every helper returns
// safely on error. Entity extraction is opportunistic; a missed
// extraction must never block the underlying memory write.

const EXTRACTION_MODEL = 'gemini-2.5-flash';

export type EntityKind =
  | 'person'
  | 'project'
  | 'place'
  | 'organization'
  | 'topic'
  | 'product'
  | 'event';

export type MentionSourceKind =
  | 'semantic'
  | 'episodic'
  | 'ai_memory'
  | 'task'
  | 'event'
  | 'note'
  | 'contact'
  | 'chat';

export interface ExtractedEntity {
  kind: EntityKind;
  name: string;
  aliases?: string[];
  description?: string;
  salience?: number; // 0..1, how central this entity is to the source
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  model: string | null;
}

const KIND_VALUES: EntityKind[] = [
  'person', 'project', 'place', 'organization', 'topic', 'product', 'event',
];

const EXTRACTION_SYSTEM = [
  'You are an information-extraction worker for a personal-assistant',
  'memory layer. Given a short note / chat turn / event row, identify',
  'the named entities that this user would later want to retrieve by.',
  '',
  'Rules:',
  '- Only extract concrete, named entities. Skip generic words ("work",',
  '  "the meeting", "tomorrow"). If the entity has no proper name, drop it.',
  '- Use the canonical form ("John Doe", "Acme Inc", "Project Atlas",',
  '  "Berlin"). Put nicknames or short forms in `aliases`.',
  '- `kind` MUST be one of: person, project, place, organization, topic,',
  '  product, event.',
  '- `salience` is 0..1 — 1.0 means the entity is the primary subject,',
  '  0.2 means it was mentioned in passing.',
  '- Output AT MOST 8 entities. Quality over quantity.',
  '- If the text contains no named entities, return an empty list.',
].join('\n');

// Tool schema for the gateway. Forced via tool_choice so the model
// can't hallucinate a free-form answer.
const EXTRACTION_TOOL = {
  type: 'function',
  function: {
    name: 'record_entities',
    description: 'Record extracted named entities with their kind and salience.',
    parameters: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: KIND_VALUES },
              name: { type: 'string', description: 'Canonical display name.' },
              aliases: {
                type: 'array',
                items: { type: 'string' },
                description: 'Other forms the user might call this entity.',
              },
              description: {
                type: 'string',
                description: 'One-line note about the entity if non-obvious.',
              },
              salience: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
            },
            required: ['kind', 'name'],
          },
        },
      },
      required: ['entities'],
    },
  },
};

export async function extractEntities(text: string): Promise<ExtractionResult> {
  // Slice first so the whitespace regex never scans more than ~8 KB,
  // even if the caller hands us a multi-megabyte buffer. Final slice
  // to 4000 trims again after the regex collapses runs of whitespace.
  const cleaned = (text || '').slice(0, 8000).replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (cleaned.length < 12) return { entities: [], model: null };

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    // No provider configured — silently no-op. We don't fall back to
    // direct Gemini for tool-calls; the calling layer already handles
    // the "no extraction" case gracefully.
    return { entities: [], model: null };
  }

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM },
          { role: 'user', content: `Extract entities from:\n"""\n${cleaned}\n"""` },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'function', function: { name: 'record_entities' } },
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.warn('[kg.extractEntities] gateway failed', res.status);
      return { entities: [], model: null };
    }
    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === 'string' ? JSON.parse(args) : args;
    const raw = Array.isArray(parsed?.entities) ? parsed.entities : [];
    const entities: ExtractedEntity[] = [];
    for (const e of raw) {
      if (!e || typeof e !== 'object') continue;
      const kind = String(e.kind || '').toLowerCase() as EntityKind;
      const name = String(e.name || '').trim();
      if (!name || !KIND_VALUES.includes(kind)) continue;
      const aliases: string[] = Array.isArray(e.aliases)
        ? e.aliases.map((a: unknown) => String(a).trim()).filter(Boolean).slice(0, 6)
        : [];
      entities.push({
        kind,
        name: name.slice(0, 200),
        aliases,
        description: typeof e.description === 'string' ? e.description.slice(0, 400) : undefined,
        salience: typeof e.salience === 'number' ? clamp01(e.salience) : 0.5,
      });
    }
    return { entities, model: EXTRACTION_MODEL };
  } catch (err) {
    console.warn('[kg.extractEntities] failed', (err as Error).message);
    return { entities: [], model: null };
  }
}

export interface LinkExtractionArgs {
  userId: string;
  workspaceId?: string | null;
  sourceKind: MentionSourceKind;
  sourceId: string;
  excerpt?: string | null;
  entities: ExtractedEntity[];
}

export interface LinkExtractionResult {
  linked: number;
  entityIds: string[];
}

// Upserts each extracted entity, then links it to the source row via
// kg_link_mention. Best-effort: a single failure doesn't abort the
// batch.
// Minimal Supabase client surface needed by this module.
type KgClient = { from(table: string): Record<string, (...args: unknown[]) => unknown>; rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };

export async function linkExtraction(
  supabase: KgClient,
  args: LinkExtractionArgs,
): Promise<LinkExtractionResult> {
  if (!args.entities?.length) return { linked: 0, entityIds: [] };
  const ids: string[] = [];
  let linked = 0;
  for (const e of args.entities) {
    try {
      const { data: entityId, error: upErr } = await supabase.rpc('kg_upsert_entity', {
        p_user_id: args.userId,
        p_kind: e.kind,
        p_name: e.name,
        p_aliases: e.aliases ?? [],
        p_external_refs: {},
        p_workspace_id: args.workspaceId ?? null,
        p_importance: clamp01(e.salience ?? 0.5),
        p_description: e.description ?? null,
      });
      if (upErr || !entityId) {
        console.warn('[kg.linkExtraction] upsert failed', upErr?.message);
        continue;
      }
      ids.push(entityId);
      const { error: linkErr } = await supabase.rpc('kg_link_mention', {
        p_user_id: args.userId,
        p_entity_id: entityId,
        p_source_kind: args.sourceKind,
        p_source_id: args.sourceId,
        p_salience: clamp01(e.salience ?? 0.5),
        p_excerpt: args.excerpt ?? null,
      });
      if (linkErr) {
        console.warn('[kg.linkExtraction] link failed', linkErr.message);
        continue;
      }
      linked += 1;
    } catch (err) {
      console.warn('[kg.linkExtraction] iter failed', (err as Error).message);
    }
  }
  return { linked, entityIds: ids };
}

export interface RecordProvenanceArgs {
  userId: string;
  targetKind: 'semantic' | 'episodic' | 'ai_memory' | 'kg_entity';
  targetId: string;
  sourceKind: string;
  sourceId: string;
  transformation: 'extracted' | 'summarized' | 'aggregated' | 'inferred' | 'manual' | 'imported';
  model?: string | null;
  confidence?: number;
  notes?: string | null;
}

export async function recordProvenance(
  supabase: KgClient,
  args: RecordProvenanceArgs,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('memory_provenance').insert({
      user_id: args.userId,
      target_kind: args.targetKind,
      target_id: args.targetId,
      source_kind: args.sourceKind,
      source_id: args.sourceId,
      transformation: args.transformation,
      model: args.model ?? null,
      confidence: clamp01(args.confidence ?? 0.7),
      notes: args.notes ?? null,
    });
    if (error) {
      console.warn('[kg.recordProvenance] failed', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[kg.recordProvenance] threw', (err as Error).message);
    return false;
  }
}

// Combined helper: extract + link + provenance, all in one call. Used
// by rememberSemantic so that every semantic write automatically
// builds out the knowledge graph.
export interface AutoKgArgs {
  userId: string;
  workspaceId?: string | null;
  sourceKind: MentionSourceKind;
  sourceId: string;
  text: string;
  // Optional: also writes a memory_provenance row from this raw input
  // to a derived target. Useful when the source row was itself derived
  // (e.g. semantic row built from a chat turn).
  rawProvenance?: {
    sourceKind: string;
    sourceId: string;
    transformation: 'extracted' | 'summarized' | 'aggregated' | 'inferred' | 'manual' | 'imported';
  };
}

export async function autoKgIngest(
  supabase: KgClient,
  args: AutoKgArgs,
): Promise<{ entitiesLinked: number; model: string | null }> {
  try {
    const { entities, model } = await extractEntities(args.text);
    const { linked } = await linkExtraction(supabase, {
      userId: args.userId,
      workspaceId: args.workspaceId ?? null,
      sourceKind: args.sourceKind,
      sourceId: args.sourceId,
      excerpt: args.text.slice(0, 600),
      entities,
    });
    if (args.rawProvenance) {
      // Pretend the semantic row is the "target" of the chat turn (the
      // raw input); kind here is best-effort and only meaningful for
      // semantic targets — ai_memory / episodic callers can pass their
      // own mapping via a follow-up recordProvenance() call.
      // Skip if targetId is not a UUID (e.g. chat:uuid).
      if (/^[0-9a-f-]{36}$/i.test(args.sourceId)) {
        await recordProvenance(supabase, {
          userId: args.userId,
          targetKind: args.sourceKind === 'episodic' ? 'episodic'
            : args.sourceKind === 'ai_memory' ? 'ai_memory'
            : 'semantic',
          targetId: args.sourceId,
          sourceKind: args.rawProvenance.sourceKind,
          sourceId: args.rawProvenance.sourceId,
          transformation: args.rawProvenance.transformation,
          model,
          confidence: 0.7,
        });
      }
    }
    return { entitiesLinked: linked, model };
  } catch (err) {
    console.warn('[kg.autoKgIngest] failed', (err as Error).message);
    return { entitiesLinked: 0, model: null };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
