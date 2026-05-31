import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ContentScript, ScriptFormat } from '@/lib/content';

const db = supabase as unknown as { from: (table: string) => any };

export function useContentScripts(ideaId: string | null) {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchScripts = useCallback(async () => {
    if (!ideaId) {
      setScripts([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await db
        .from('content_scripts')
        .select('*')
        .eq('idea_id', ideaId)
        .order('format', { ascending: true });
      if (error) throw error;
      setScripts((data || []) as ContentScript[]);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const generate = useCallback(async (formats: ScriptFormat[] = ['short', 'long']) => {
    if (!ideaId) return false;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-script', {
        body: { idea_id: ideaId, formats },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const next = ((data as any)?.scripts || []) as ContentScript[];
      if (next.length) setScripts(next);
      else await fetchScripts();
      toast.success('Scripts ready');
      return true;
    } catch (err) {
      console.error('Failed to generate scripts:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate scripts');
      return false;
    } finally {
      setGenerating(false);
    }
  }, [ideaId, fetchScripts]);

  // Inline edits to a generated script (the user tweaks the text before
  // recording). Optimistic, with revert on failure.
  const updateScript = useCallback(async (id: string, updates: Partial<ContentScript>) => {
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    try {
      const { error } = await db
        .from('content_scripts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save script edit:', err);
      toast.error('Failed to save edit');
      fetchScripts();
    }
  }, [fetchScripts]);

  return { scripts, loading, generating, generate, updateScript, refetch: fetchScripts };
}
