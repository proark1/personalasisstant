import { useState, useCallback, useEffect } from 'react';
import { Task, CalendarEvent } from '@/types/flux';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface TaskSuggestion {
  taskId: string | null;
  title: string;
  reason: string;
  estimatedMinutes: number;
  startTip: string;
  energy: 'low' | 'medium' | 'high';
}

export interface SmartSuggestion {
  recommendation: TaskSuggestion;
  alternatives: TaskSuggestion[];
  encouragement: string;
}

export function useSmartTaskSuggestions(tasks: Task[], events: CalendarEvent[]) {
  const { user } = useAuth();
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchSuggestion = useCallback(async () => {
    if (!user || loading) return;

    // Don't fetch if we fetched recently (within 5 minutes)
    if (lastFetched && Date.now() - lastFetched.getTime() < 5 * 60 * 1000 && suggestion) {
      return;
    }

    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) {
      setSuggestion(null);
      return;
    }

    setLoading(true);
    
    // Build a local fallback from highest-priority overdue task
    const buildLocalFallback = (): SmartSuggestion | null => {
      const overdue = incompleteTasks
        .filter(t => t.dueDate && t.dueDate < new Date())
        .sort((a, b) => {
          const prio = { high: 0, medium: 1, low: 2 };
          return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
        });
      const pick = overdue[0] || incompleteTasks[0];
      if (!pick) return null;
      return {
        recommendation: {
          taskId: pick.id,
          title: pick.title,
          reason: overdue.length > 0 ? 'This is your top overdue task' : 'Your highest priority task',
          estimatedMinutes: 15,
          startTip: 'Just start with 2 minutes!',
          energy: 'medium',
        },
        alternatives: [],
        encouragement: "You've got this!",
      };
    };
    
    try {
      // Fetch today's checkin for context
      const today = new Date().toISOString().split('T')[0];
      
      // Race between AI call and 5s timeout
      const aiPromise = (async () => {
        const { data: checkinData } = await supabase
          .from('daily_checkins')
          .select('mood, energy_level, sleep_hours, main_focus')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .maybeSingle();

        return supabase.functions.invoke('ai-assistant', {
          body: {
            type: 'what_now',
            tasks: incompleteTasks.slice(0, 15).map(t => ({
              id: t.id, title: t.title, category: t.category,
              priority: t.priority, dueDate: t.dueDate, completed: t.completed,
            })),
            events: events.slice(0, 10).map(e => ({
              id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime,
            })),
            checkin: checkinData,
          },
        });
      })();
      
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 5000)
      );
      
      const result = await Promise.race([aiPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        console.warn('Smart suggestion timed out, using local fallback');
        const fallback = buildLocalFallback();
        if (fallback) { setSuggestion(fallback); setLastFetched(new Date()); }
        return;
      }
      
      const response = result;

      if (response.error) {
        console.error('Smart suggestion error:', response.error);
        const fallback = buildLocalFallback();
        if (fallback) { setSuggestion(fallback); setLastFetched(new Date()); }
        return;
      }

      const data = response.data;
      if (data?.recommendation) {
        setSuggestion({
          recommendation: {
            taskId: data.recommendation.taskId,
            title: data.recommendation.title,
            reason: data.recommendation.reason,
            estimatedMinutes: data.recommendation.estimatedMinutes || 15,
            startTip: data.recommendation.startTip || 'Just start with 2 minutes!',
            energy: data.recommendation.energy || 'medium',
          },
          alternatives: (data.alternatives || []).map((alt: any) => ({
            taskId: alt.taskId,
            title: alt.title,
            reason: alt.reason,
            estimatedMinutes: alt.estimatedMinutes || 15,
            startTip: alt.startTip || '',
            energy: alt.energy || 'medium',
          })),
          encouragement: data.encouragement || 'You\'ve got this!',
        });
        setLastFetched(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch smart suggestion:', error);
    } finally {
      setLoading(false);
    }
  }, [user, tasks, events, loading, lastFetched, suggestion]);

  // Auto-fetch on mount and when tasks change significantly
  useEffect(() => {
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length > 0 && !suggestion && !loading) {
      fetchSuggestion();
    }
  }, [tasks.length]);

  const refresh = useCallback(() => {
    setLastFetched(null);
    setSuggestion(null);
    fetchSuggestion();
  }, [fetchSuggestion]);

  return {
    suggestion,
    loading,
    refresh,
    fetchSuggestion,
  };
}
