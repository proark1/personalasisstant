import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIInsight {
  id: string;
  title: string;
  content: string;
  insight_type: string;
  is_actionable: boolean;
  action_taken: boolean;
  is_read: boolean;
  data: Record<string, unknown>;
  expires_at?: string;
  created_at: string;
}

export interface WeeklyStats {
  tasksCompleted: number;
  tasksCreated: number;
  focusMinutes: number;
  habitsCompleted: number;
  averageMood: string;
  averageEnergy: string;
  productiveHours: string[];
  completionRate: number;
}

export function useWeeklyInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInsights((data || []) as AIInsight[]);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchWeeklyStats = useCallback(async () => {
    if (!user) return;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    try {
      // Fetch tasks completed this week
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('id, completed, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('updated_at', weekAgoStr);

      // Fetch tasks created this week
      const { data: createdTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', weekAgoStr);

      // Fetch focus sessions
      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .gte('started_at', weekAgoStr);

      // Fetch habit logs
      const { data: habitLogs } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .gte('log_date', weekAgo.toISOString().split('T')[0]);

      // Fetch daily check-ins for mood/energy
      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('mood, energy_level')
        .eq('user_id', user.id)
        .gte('checkin_date', weekAgo.toISOString().split('T')[0]);

      const tasksCompleted = completedTasks?.length || 0;
      const tasksCreated = createdTasks?.length || 0;
      const focusMinutes = focusSessions?.reduce((sum, s) => sum + s.duration_minutes, 0) || 0;
      const habitsCompleted = habitLogs?.length || 0;
      
      // Calculate average mood and energy
      const moods = checkins?.map(c => c.mood).filter(Boolean) || [];
      const energies = checkins?.map(c => c.energy_level).filter(Boolean) || [];
      
      const averageMood = moods.length > 0 
        ? moods.sort((a, b) => moods.filter(m => m === b).length - moods.filter(m => m === a).length)[0] 
        : 'Unknown';
      
      const averageEnergy = energies.length > 0
        ? energies.sort((a, b) => energies.filter(e => e === b).length - energies.filter(e => e === a).length)[0]
        : 'Unknown';

      const completionRate = tasksCreated > 0
        ? Math.round((tasksCompleted / tasksCreated) * 100)
        : 0;

      // Derive the user's most productive hours from when tasks were actually
      // completed this week (updated_at is set when a task is marked done),
      // instead of a hardcoded placeholder. Falls back to [] when there's no
      // data so downstream insights don't reason about fabricated hours.
      const hourCounts = new Map<number, number>();
      for (const t of completedTasks || []) {
        if (!t.updated_at) continue;
        const hour = new Date(t.updated_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
      const productiveHours = [...hourCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour)
        .sort((a, b) => a - b)
        .map(hour => `${hour}:00`);

      setWeeklyStats({
        tasksCompleted,
        tasksCreated,
        focusMinutes,
        habitsCompleted,
        averageMood,
        averageEnergy,
        productiveHours,
        completionRate,
      });
    } catch (error) {
      console.error('Failed to fetch weekly stats:', error);
    }
  }, [user]);

  const generateInsights = useCallback(async () => {
    if (!user || !weeklyStats) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          type: 'weekly_insights',
          stats: weeklyStats,
          userId: user.id,
        },
      });

      if (error) throw error;

      if (data?.insights) {
        // Save insights to database
        for (const insight of data.insights) {
          await supabase.from('ai_insights').insert({
            user_id: user.id,
            title: insight.title,
            content: insight.content,
            insight_type: 'weekly',
            is_actionable: insight.is_actionable || false,
            data: insight.data || {},
          });
        }
        
        await fetchInsights();
        toast.success('Generated new insights!');
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
      toast.error('Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  }, [user, weeklyStats, fetchInsights]);

  const markInsightRead = useCallback(async (insightId: string) => {
    try {
      await supabase
        .from('ai_insights')
        .update({ is_read: true })
        .eq('id', insightId);

      setInsights(prev => prev.map(i => 
        i.id === insightId ? { ...i, is_read: true } : i
      ));
    } catch (error) {
      console.error('Failed to mark insight as read:', error);
    }
  }, []);

  const markActionTaken = useCallback(async (insightId: string) => {
    try {
      await supabase
        .from('ai_insights')
        .update({ action_taken: true })
        .eq('id', insightId);

      setInsights(prev => prev.map(i => 
        i.id === insightId ? { ...i, action_taken: true } : i
      ));
      
      toast.success('Great job taking action!');
    } catch (error) {
      console.error('Failed to mark action as taken:', error);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    fetchWeeklyStats();
  }, [fetchInsights, fetchWeeklyStats]);

  return {
    insights,
    weeklyStats,
    isLoading,
    isGenerating,
    fetchInsights,
    generateInsights,
    markInsightRead,
    markActionTaken,
    unreadCount: insights.filter(i => !i.is_read).length,
  };
}
