import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type BriefingChannel = 'telegram' | 'telegram_voice' | 'push';

export interface Briefing {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  topics: string[];
  deliver_at: string;        // "HH:MM:SS" or "HH:MM"
  days_of_week: number[];    // 0=Sunday .. 6=Saturday
  channels: BriefingChannel[];
  max_items: number;
  last_sent_on: string | null;
  created_at?: string;
  updated_at?: string;
}

export type NewBriefing = Pick<
  Briefing,
  'name' | 'topics' | 'deliver_at' | 'days_of_week' | 'channels' | 'max_items' | 'enabled'
>;

export const DEFAULT_NEW_BRIEFING: NewBriefing = {
  name: 'Morning Briefing',
  topics: [],
  deliver_at: '08:00',
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  channels: ['telegram', 'push'],
  max_items: 5,
  enabled: true,
};

// `briefings` is a newly added table not yet in the generated Supabase types,
// so we access it through an untyped client handle.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
  functions: typeof supabase.functions;
};

export function useBriefings() {
  const { user } = useAuth();
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBriefings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await db
        .from('briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching briefings:', error);
      } else {
        setBriefings((data || []) as Briefing[]);
      }
    } catch (err) {
      console.error('Failed to fetch briefings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchBriefings(); }, [fetchBriefings]);

  const createBriefing = useCallback(async (input: NewBriefing = DEFAULT_NEW_BRIEFING) => {
    if (!user?.id) return null;
    try {
      const { data, error } = await db
        .from('briefings')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setBriefings((prev) => [...prev, data as Briefing]);
      toast.success('Briefing created');
      return data as Briefing;
    } catch (err) {
      console.error('Failed to create briefing:', err);
      toast.error('Failed to create briefing');
      return null;
    }
  }, [user?.id]);

  const updateBriefing = useCallback(async (id: string, updates: Partial<Briefing>) => {
    // Optimistic update.
    setBriefings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    try {
      const { error } = await db
        .from('briefings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update briefing:', err);
      toast.error('Failed to save briefing');
      fetchBriefings(); // revert to server state
    }
  }, [fetchBriefings]);

  const deleteBriefing = useCallback(async (id: string) => {
    const prev = briefings;
    setBriefings((p) => p.filter((b) => b.id !== id));
    try {
      const { error } = await db.from('briefings').delete().eq('id', id);
      if (error) throw error;
      toast.success('Briefing deleted');
    } catch (err) {
      console.error('Failed to delete briefing:', err);
      toast.error('Failed to delete briefing');
      setBriefings(prev); // revert
    }
  }, [briefings]);

  const sendNow = useCallback(async (id: string) => {
    try {
      const { error } = await db.functions.invoke(`briefing-dispatch-cron?briefing_id=${id}`, {
        body: {},
      });
      if (error) throw error;
      toast.success('Briefing sent — check your channels');
    } catch (err) {
      console.error('Failed to send briefing:', err);
      toast.error(await describeEdgeError(err, 'Failed to send briefing'));
    }
  }, []);

  return {
    briefings,
    loading,
    createBriefing,
    updateBriefing,
    deleteBriefing,
    sendNow,
    refetch: fetchBriefings,
  };
}
