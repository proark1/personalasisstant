import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Wrapper for custom RPC calls not present in the generated Supabase types
async function customRpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
  return (supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc(fn, args);
}

export type KgEntityKind =
  | 'person'
  | 'project'
  | 'place'
  | 'organization'
  | 'topic'
  | 'product'
  | 'event';

export interface KgEntity {
  id: string;
  kind: KgEntityKind;
  name: string;
  description: string | null;
  importance: number;
  mentionCount: number;
  lastMentionedAt: string | null;
  externalRefs: Record<string, unknown>;
}

export interface KgNeighbor {
  entityId: string;
  name: string;
  kind: KgEntityKind;
  sharedMentions: number;
  lastCoMention: string | null;
}

export interface KgMention {
  id: string;
  entityId: string;
  sourceKind: string;
  sourceId: string;
  salience: number;
  excerpt: string | null;
  createdAt: string;
}

interface UseKnowledgeGraphOptions {
  limit?: number;
  kinds?: KgEntityKind[];
}

// One hook for the whole graph: list entities, fetch neighborhood,
// pull mentions for a single entity, and trigger forget actions.
// Everything is user-scoped — auth is enforced by RLS, the hook just
// gates rendering on `user?.id`.
export function useKnowledgeGraph(opts: UseKnowledgeGraphOptions = {}) {
  const { user } = useAuth();
  const [entities, setEntities] = useState<KgEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await customRpc('kg_top_entities', {
        p_user_id: user.id,
        p_limit: opts.limit ?? 50,
        p_kinds: opts.kinds && opts.kinds.length ? opts.kinds : null,
      });
      if (rpcErr) throw rpcErr;
      const rows: KgEntity[] = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        id: r.id as string,
        kind: r.kind as KgEntityKind,
        name: r.name as string,
        description: (r.description ?? null) as string | null,
        importance: Number(r.importance ?? 0.5),
        mentionCount: Number(r.mention_count ?? 0),
        lastMentionedAt: (r.last_mentioned_at ?? null) as string | null,
        externalRefs: (r.external_refs ?? {}) as Record<string, unknown>,
      }));
      setEntities(rows);
    } catch (e) {
      console.warn('[useKnowledgeGraph] fetch failed', (e as Error).message);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, opts.limit, JSON.stringify(opts.kinds)]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNeighbors = useCallback(async (entityId: string, limit = 12): Promise<KgNeighbor[]> => {
    if (!user?.id) return [];
    try {
      const { data, error: rpcErr } = await customRpc('kg_neighborhood', {
        p_user_id: user.id,
        p_entity_id: entityId,
        p_limit: limit,
      });
      if (rpcErr) throw rpcErr;
      return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        entityId: r.entity_id as string,
        name: r.name as string,
        kind: r.kind as KgEntityKind,
        sharedMentions: Number(r.shared_mentions ?? 0),
        lastCoMention: (r.last_co_mention ?? null) as string | null,
      }));
    } catch (e) {
      console.warn('[useKnowledgeGraph] neighbors failed', (e as Error).message);
      return [];
    }
  }, [user?.id]);

  const fetchMentions = useCallback(async (entityId: string, limit = 30): Promise<KgMention[]> => {
    if (!user?.id) return [];
    try {
      type KgMentionRow = { id: string; entity_id: string; source_kind: string; source_id: string; salience: number; excerpt: string | null; created_at: string };
      const { data, error: dbErr } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { order: (c: string, o: Record<string, unknown>) => { limit: (n: number) => Promise<{ data: KgMentionRow[] | null; error: unknown }> } } } } } }).from('kg_mentions')
        .select('id, entity_id, source_kind, source_id, salience, excerpt, created_at')
        .eq('user_id', user.id)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (dbErr) throw dbErr;
      return (data ?? []).map((r) => ({
        id: r.id,
        entityId: r.entity_id,
        sourceKind: r.source_kind,
        sourceId: r.source_id,
        salience: Number(r.salience ?? 0.5),
        excerpt: r.excerpt ?? null,
        createdAt: r.created_at,
      }));
    } catch (e) {
      console.warn('[useKnowledgeGraph] mentions failed', (e as Error).message);
      return [];
    }
  }, [user?.id]);

  // Forget the entity AND every memory row that mentions it. This is
  // the "right to forget" hammer — irreversible, surfaces a confirmation
  // in the UI before calling it.
  const forgetEntityDeep = useCallback(async (entityId: string, reason?: string) => {
    if (!user?.id) return null;
    try {
      const { data, error: invErr } = await supabase.functions.invoke('memory-forget', {
        body: { entity_id: entityId, deep: true, reason },
      });
      if (invErr) throw invErr;
      // Optimistic local removal so the UI feels instant.
      setEntities((prev) => prev.filter((e) => e.id !== entityId));
      return data;
    } catch (e) {
      console.warn('[useKnowledgeGraph] deep forget failed', (e as Error).message);
      return null;
    }
  }, [user?.id]);

  // Soft-delete just the entity row (its mentions go too via cascade)
  // but leave the memory rows themselves alone. Useful when the user
  // wants to break a wrong link, not erase the underlying note.
  const forgetEntityShallow = useCallback(async (entityId: string, reason?: string) => {
    if (!user?.id) return null;
    try {
      const { data, error: invErr } = await supabase.functions.invoke('memory-forget', {
        body: { target_kind: 'kg_entity', target_id: entityId, reason },
      });
      if (invErr) throw invErr;
      setEntities((prev) => prev.filter((e) => e.id !== entityId));
      return data;
    } catch (e) {
      console.warn('[useKnowledgeGraph] shallow forget failed', (e as Error).message);
      return null;
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  return {
    entities,
    loading,
    error,
    refresh: fetchEntities,
    fetchNeighbors,
    fetchMentions,
    forgetEntityDeep,
    forgetEntityShallow,
  };
}
