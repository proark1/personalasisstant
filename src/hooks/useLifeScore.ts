import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, subDays } from 'date-fns';

interface LifeScore {
  id: string;
  scoreDate: string;
  overallScore: number;
  productivityScore: number;
  healthScore: number;
  relationshipsScore: number;
  spiritualScore: number;
  familyScore: number;
  focusMinutes: number;
  tasksCompleted: number;
  habitsLogged: number;
}

interface ScoreTrend {
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export function useLifeScore() {
  const { user } = useAuth();
  const [todayScore, setTodayScore] = useState<LifeScore | null>(null);
  const [weeklyScores, setWeeklyScores] = useState<LifeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const fetchScores = useCallback(async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      // Fetch today's score
      const { data: todayData } = await supabase
        .from('life_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('score_date', today)
        .single();

      if (todayData) {
        setTodayScore({
          id: todayData.id,
          scoreDate: todayData.score_date,
          overallScore: todayData.overall_score,
          productivityScore: todayData.productivity_score || 0,
          healthScore: todayData.health_score || 0,
          relationshipsScore: todayData.relationships_score || 0,
          spiritualScore: todayData.spiritual_score || 0,
          familyScore: todayData.family_score || 0,
          focusMinutes: todayData.focus_minutes || 0,
          tasksCompleted: todayData.tasks_completed || 0,
          habitsLogged: todayData.habits_logged || 0,
        });
      }

      // Fetch weekly scores
      const { data: weekData } = await supabase
        .from('life_scores')
        .select('*')
        .eq('user_id', user.id)
        .gte('score_date', weekAgo)
        .order('score_date', { ascending: true });

      if (weekData) {
        setWeeklyScores(weekData.map(d => ({
          id: d.id,
          scoreDate: d.score_date,
          overallScore: d.overall_score,
          productivityScore: d.productivity_score || 0,
          healthScore: d.health_score || 0,
          relationshipsScore: d.relationships_score || 0,
          spiritualScore: d.spiritual_score || 0,
          familyScore: d.family_score || 0,
          focusMinutes: d.focus_minutes || 0,
          tasksCompleted: d.tasks_completed || 0,
          habitsLogged: d.habits_logged || 0,
        })));
      }
    } catch (error) {
      console.error('Error fetching life scores:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const calculateScore = useCallback(async () => {
    if (!user) return;
    setCalculating(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      // Fetch today's data from various sources
      const [tasksResult, habitsResult, focusResult, checkinsResult] = await Promise.all([
        // Tasks completed today
        supabase.from('tasks').select('id').eq('user_id', user.id).eq('is_completed', true).gte('completed_at', startOfDay).lte('completed_at', endOfDay),
        // Habits logged today
        supabase.from('habit_logs').select('id').eq('user_id', user.id).eq('log_date', today),
        // Focus sessions today
        supabase.from('focus_sessions').select('duration_minutes').eq('user_id', user.id).eq('is_completed', true).gte('started_at', startOfDay),
        // Check-ins today
        supabase.from('daily_checkins').select('mood, energy_level, sleep_hours').eq('user_id', user.id).eq('checkin_date', today),
      ]);

      const tasksCompleted = tasksResult.data?.length || 0;
      const habitsLogged = habitsResult.data?.length || 0;
      const focusMinutes = focusResult.data?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
      const checkin = checkinsResult.data?.[0];

      // Calculate category scores (0-100)
      const productivityScore = Math.min(100, (tasksCompleted * 10) + (focusMinutes / 3));
      const healthScore = checkin ? Math.min(100, ((checkin.sleep_hours || 0) * 8) + 20) : 30;
      const spiritualScore = habitsLogged > 0 ? Math.min(100, habitsLogged * 25) : 30;
      const familyScore = habitsLogged > 0 ? Math.min(100, habitsLogged * 15 + 40) : 40;
      const relationshipsScore = 50; // Base score, could be enhanced with contact interactions

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        (productivityScore * 0.3) +
        (healthScore * 0.2) +
        (spiritualScore * 0.2) +
        (familyScore * 0.15) +
        (relationshipsScore * 0.15)
      );

      // Upsert today's score
      const { data, error } = await supabase
        .from('life_scores')
        .upsert({
          user_id: user.id,
          score_date: today,
          overall_score: overallScore,
          productivity_score: Math.round(productivityScore),
          health_score: Math.round(healthScore),
          relationships_score: Math.round(relationshipsScore),
          spiritual_score: Math.round(spiritualScore),
          family_score: Math.round(familyScore),
          focus_minutes: focusMinutes,
          tasks_completed: tasksCompleted,
          habits_logged: habitsLogged,
        }, { onConflict: 'user_id,score_date' })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTodayScore({
          id: data.id,
          scoreDate: data.score_date,
          overallScore: data.overall_score,
          productivityScore: data.productivity_score || 0,
          healthScore: data.health_score || 0,
          relationshipsScore: data.relationships_score || 0,
          spiritualScore: data.spiritual_score || 0,
          familyScore: data.family_score || 0,
          focusMinutes: data.focus_minutes || 0,
          tasksCompleted: data.tasks_completed || 0,
          habitsLogged: data.habits_logged || 0,
        });
      }

      await fetchScores();
    } catch (error) {
      console.error('Error calculating life score:', error);
    } finally {
      setCalculating(false);
    }
  }, [user, fetchScores]);

  const getTrend = useCallback((category: keyof Omit<LifeScore, 'id' | 'scoreDate'>): ScoreTrend => {
    if (weeklyScores.length < 2) {
      return { current: todayScore?.[category] || 0, previous: 0, change: 0, trend: 'stable' };
    }

    const current = todayScore?.[category] || weeklyScores[weeklyScores.length - 1]?.[category] || 0;
    const previous = weeklyScores[0]?.[category] || 0;
    const change = current - previous;

    return {
      current,
      previous,
      change,
      trend: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
    };
  }, [todayScore, weeklyScores]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return {
    todayScore,
    weeklyScores,
    loading,
    calculating,
    calculateScore,
    getTrend,
    fetchScores,
  };
}
