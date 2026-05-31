import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { ContentIdea, IdeaStatus } from '@/lib/content';

const db = supabase as unknown as { from: (table: string) => any };

const WINDOW_DAYS = 30;

export function useContentIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchIdeas = useCallback(async () => {
    if (!user?.id) return;
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().split('T')[0];
    try {
      const { data, error } = await db
        .from('content_ideas')
        .select('*')
        .eq('user_id', user.id)
        .gte('generated_on', since)
        .order('generated_on', { ascending: false })
        .order('rank', { ascending: true })
        .limit(400);
      if (error) {
        console.error('Error fetching content ideas:', error);
      } else {
        setIdeas((data || []) as ContentIdea[]);
      }
    } catch (err) {
      console.error('Failed to fetch content ideas:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  // The most recent day for which we have a batch, and that day's ideas.
  const latestDay = useMemo(() => ideas[0]?.generated_on ?? null, [ideas]);
  const latestBatch = useMemo(
    () => (latestDay ? ideas.filter((i) => i.generated_on === latestDay) : []),
    [ideas, latestDay],
  );
  const liked = useMemo(
    () => ideas.filter((i) => i.status === 'liked' || i.status === 'scheduled'),
    [ideas],
  );
  const scheduled = useMemo(() => ideas.filter((i) => i.status === 'scheduled'), [ideas]);

  const generateNow = useCallback(async (overrides?: { count?: number; trending_ratio?: number }) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('content-ideas', {
        body: overrides ?? {},
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await fetchIdeas();
      const count = (data as any)?.count ?? 0;
      toast.success(`Generated ${count} fresh ${count === 1 ? 'idea' : 'ideas'}`);
      return true;
    } catch (err) {
      console.error('Failed to generate ideas:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate ideas');
      return false;
    } finally {
      setGenerating(false);
    }
  }, [fetchIdeas]);

  const setStatus = useCallback(async (id: string, status: IdeaStatus) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      const { error } = await db
        .from('content_ideas')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update idea:', err);
      toast.error('Failed to update idea');
      fetchIdeas();
    }
  }, [fetchIdeas]);

  // Drop a real calendar event so the idea shows up in the main Calendar (and
  // syncs to Google/Apple like any other event), then mark the idea scheduled.
  const scheduleIdea = useCallback(async (idea: ContentIdea, whenISO: string, durationMin = 30) => {
    if (!user?.id) return false;
    try {
      const start = new Date(whenISO);
      if (Number.isNaN(start.getTime())) throw new Error('Invalid date/time');
      const end = new Date(start.getTime() + durationMin * 60_000);
      const description = [idea.summary, idea.source_url ? `Source: ${idea.source_url}` : '']
        .filter(Boolean)
        .join('\n\n');

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: `🎬 ${idea.headline}`.slice(0, 200),
          description,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          // events.category is constrained to ('business','personal'); content
          // events are business. created_via marks them as Content Studio events.
          category: 'business',
          created_via: 'content-studio',
        })
        .select('id')
        .single();
      if (evErr) throw evErr;

      const { error: upErr } = await db
        .from('content_ideas')
        .update({
          status: 'scheduled',
          scheduled_for: start.toISOString(),
          scheduled_event_id: ev?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idea.id);
      if (upErr) throw upErr;

      await fetchIdeas();
      toast.success('Added to your calendar');
      return true;
    } catch (err) {
      console.error('Failed to schedule idea:', err);
      toast.error('Failed to add to calendar');
      return false;
    }
  }, [user?.id, fetchIdeas]);

  const unschedule = useCallback(async (idea: ContentIdea) => {
    try {
      if (idea.scheduled_event_id) {
        await supabase.from('events').delete().eq('id', idea.scheduled_event_id);
      }
      const { error } = await db
        .from('content_ideas')
        .update({
          status: 'liked',
          scheduled_for: null,
          scheduled_event_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idea.id);
      if (error) throw error;
      await fetchIdeas();
      toast.success('Removed from calendar');
      return true;
    } catch (err) {
      console.error('Failed to unschedule idea:', err);
      toast.error('Failed to update calendar');
      return false;
    }
  }, [fetchIdeas]);

  return {
    ideas,
    latestBatch,
    latestDay,
    liked,
    scheduled,
    loading,
    generating,
    generateNow,
    setStatus,
    scheduleIdea,
    unschedule,
    refetch: fetchIdeas,
  };
}
