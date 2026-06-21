// Knowledge-graph recall at inference time.
//
// The KG is BUILT on every semantic write (autoKgIngest in kg.ts) but was
// never READ back when answering. This module closes that loop: it finds the
// entities the user's current message refers to and injects what we know
// about them — the entity's own description plus its most-connected
// neighbours — so "what's the status on Project Atlas?" or "remind me how I
// know Sarah" pulls real structured context instead of relying on fuzzy
// vector hits alone.
//
// Cheap by design: NO LLM call. We pull the user's recent entities once and
// match their names/aliases against the message in JS. Neighbour expansion
// uses the existing kg_neighborhood RPC. Fail-open: any error returns '' so a
// chat turn is never blocked.

interface CandidateEntity {
  id: string;
  kind: string;
  name: string;
  aliases: string[] | null;
  description: string | null;
  importance: number | null;
  mention_count: number | null;
}

interface NeighborRow {
  entity_id: string;
  name: string;
  kind: string;
  shared_mentions: number;
}

export interface KgRecallArgs {
  userId: string;
  workspaceId?: string | null;
  message: string;
  maxEntities?: number; // matched entities to expand (default 3)
  candidatePool?: number; // recent entities to scan (default 150)
}

// Returns a compact "ENTITIES IN PLAY" prompt block, or '' when nothing in
// the message maps to a known entity.
export async function recallEntities(supabase: any, args: KgRecallArgs): Promise<string> {
  const msg = (args.message || '').trim();
  if (msg.length < 4 || !args.userId || args.userId === 'anonymous') return '';
  try {
    // Pull the most recently-mentioned entities. Service-role client (chat
    // uses supabaseAdmin) so RLS is bypassed; we still scope by user_id.
    let q = supabase
      .from('kg_entities')
      .select('id, kind, name, aliases, description, importance, mention_count')
      .eq('user_id', args.userId)
      .is('redacted_at', null)
      .order('last_mentioned_at', { ascending: false, nullsFirst: false })
      .limit(args.candidatePool ?? 150);
    // Workspace entities are stored with workspace_id; personal ones NULL.
    // Match either so a personal chat still sees shared-workspace entities.
    if (args.workspaceId) {
      q = q.or(`workspace_id.eq.${args.workspaceId},workspace_id.is.null`);
    }
    const { data: ents, error } = await q;
    if (error || !Array.isArray(ents) || ents.length === 0) return '';

    const lower = msg.toLowerCase();
    const matched = (ents as CandidateEntity[]).filter((e) => entityMentioned(e, lower));
    if (matched.length === 0) return '';

    // Most important / most-connected first.
    matched.sort((a, b) =>
      ((b.importance ?? 0) - (a.importance ?? 0)) || ((b.mention_count ?? 0) - (a.mention_count ?? 0)),
    );
    const top = matched.slice(0, args.maxEntities ?? 3);

    const lines: string[] = [];
    for (const e of top) {
      let related: string[] = [];
      try {
        const { data: neigh } = await supabase.rpc('kg_neighborhood', {
          p_user_id: args.userId,
          p_entity_id: e.id,
          p_limit: 6,
        });
        related = Array.isArray(neigh)
          ? (neigh as NeighborRow[]).map((n) => n.name).filter(Boolean).slice(0, 6)
          : [];
      } catch { /* neighbour expansion is optional */ }
      let line = `- ${e.name} (${e.kind})`;
      if (e.description) line += ` — ${e.description}`;
      if (related.length) line += `\n    related: ${related.join(', ')}`;
      lines.push(line);
    }
    if (lines.length === 0) return '';
    return [
      '\n\n## ENTITIES IN PLAY (from your knowledge graph — people/projects/places this message refers to)',
      'These are durable connections you have learned over time. Use them naturally where relevant.',
      ...lines,
    ].join('\n');
  } catch (e) {
    console.warn('[recallEntities] failed', (e as Error).message);
    return '';
  }
}

// Whole-word match of an entity's canonical name OR any alias against the
// message. Names shorter than 3 chars are skipped to avoid matching generic
// fragments (e.g. an entity literally named "Al" inside "also").
function entityMentioned(e: CandidateEntity, lowerMsg: string): boolean {
  const forms = [e.name, ...(Array.isArray(e.aliases) ? e.aliases : [])]
    .map((s) => (s || '').toLowerCase().trim())
    .filter((s) => s.length >= 3);
  for (const form of forms) {
    const safe = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, 'i').test(lowerMsg)) return true;
  }
  return false;
}
