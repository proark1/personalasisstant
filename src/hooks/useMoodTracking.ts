import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, subDays } from 'date-fns';

interface MoodLog {
  id: string;
  loggedAt: string;
  moodScore: number;
  energyScore: number;
  contextTags: string[];
  notes: string | null;
}

interface MoodStats {
  averageMood: number;
  averageEnergy: number;
  moodTrend: 'improving' | 'declining' | 'stable';
  energyTrend: 'improving' | 'declining' | 'stable';
  topContexts: string[];
}

export function useMoodTracking() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<MoodLog[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      // Fetch this week's logs
      const { data } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${weekAgo}T00:00:00`)
        .order('logged_at', { ascending: false });

      if (data) {
        const mappedLogs = data.map(log => ({
          id: log.id,
          loggedAt: log.logged_at,
          moodScore: log.mood_score,
          energyScore: log.energy_score,
          contextTags: log.context_tags || [],
          notes: log.notes,
        }));

        setLogs(mappedLogs);
        setTodayLogs(mappedLogs.filter(log => log.loggedAt.startsWith(today)));

        // Calculate stats
        if (mappedLogs.length > 0) {
          const avgMood = mappedLogs.reduce((sum, l) => sum + l.moodScore, 0) / mappedLogs.length;
          const avgEnergy = mappedLogs.reduce((sum, l) => sum + l.energyScore, 0) / mappedLogs.length;

          // Calculate trends (compare first half vs second half of week)
          const midpoint = Math.floor(mappedLogs.length / 2);
          const recentLogs = mappedLogs.slice(0, midpoint);
          const olderLogs = mappedLogs.slice(midpoint);

          const recentMoodAvg = recentLogs.length > 0 
            ? recentLogs.reduce((sum, l) => sum + l.moodScore, 0) / recentLogs.length 
            : avgMood;
          const olderMoodAvg = olderLogs.length > 0 
            ? olderLogs.reduce((sum, l) => sum + l.moodScore, 0) / olderLogs.length 
            : avgMood;

          const recentEnergyAvg = recentLogs.length > 0 
            ? recentLogs.reduce((sum, l) => sum + l.energyScore, 0) / recentLogs.length 
            : avgEnergy;
          const olderEnergyAvg = olderLogs.length > 0 
            ? olderLogs.reduce((sum, l) => sum + l.energyScore, 0) / olderLogs.length 
            : avgEnergy;

          // Count context tags
          const tagCounts: Record<string, number> = {};
          mappedLogs.forEach(log => {
            log.contextTags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          });

          const topContexts = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag);

          setStats({
            averageMood: Math.round(avgMood * 10) / 10,
            averageEnergy: Math.round(avgEnergy * 10) / 10,
            moodTrend: recentMoodAvg > olderMoodAvg + 0.3 ? 'improving' : 
                       recentMoodAvg < olderMoodAvg - 0.3 ? 'declining' : 'stable',
            energyTrend: recentEnergyAvg > olderEnergyAvg + 0.3 ? 'improving' : 
                         recentEnergyAvg < olderEnergyAvg - 0.3 ? 'declining' : 'stable',
            topContexts,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching mood logs:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const logMood = useCallback(async (
    moodScore: number,
    energyScore: number,
    contextTags: string[] = [],
    notes?: string
  ) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('mood_logs')
        .insert({
          user_id: user.id,
          mood_score: moodScore,
          energy_score: energyScore,
          context_tags: contextTags,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newLog: MoodLog = {
          id: data.id,
          loggedAt: data.logged_at,
          moodScore: data.mood_score,
          energyScore: data.energy_score,
          contextTags: data.context_tags || [],
          notes: data.notes,
        };

        setLogs(prev => [newLog, ...prev]);
        setTodayLogs(prev => [newLog, ...prev]);
      }

      return data;
    } catch (error) {
      console.error('Error logging mood:', error);
      throw error;
    }
  }, [user]);

  const deleteMoodLog = useCallback(async (logId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('mood_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', user.id);

      if (error) throw error;

      setLogs(prev => prev.filter(l => l.id !== logId));
      setTodayLogs(prev => prev.filter(l => l.id !== logId));
    } catch (error) {
      console.error('Error deleting mood log:', error);
      throw error;
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    todayLogs,
    stats,
    loading,
    logMood,
    deleteMoodLog,
    fetchLogs,
  };
}
