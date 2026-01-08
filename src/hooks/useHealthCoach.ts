import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TrendData {
  metric: string;
  trend: 'improving' | 'declining' | 'stable';
  thisWeekAvg: number;
  lastWeekAvg: number;
  percentChange: number;
}

export interface Correlation {
  finding: string;
  confidence: 'high' | 'medium';
  suggestion: string;
}

export interface SleepAnalysis {
  avgDuration: number;
  avgDurationLastWeek: number;
  durationTrend: 'improving' | 'declining' | 'stable';
  sleepDebt: number;
  avgRemMinutes: number;
  avgDeepMinutes: number;
  avgCoreMinutes: number;
  remPercentage: number;
  deepPercentage: number;
  avgAwakeMinutes: number;
  avgEfficiency: number;
  consistencyScore: number;
  optimalBedtime: string | null;
  insights: string[];
  recommendations: string[];
}

export interface HealthCoachResponse {
  advice: string;
  trends: TrendData[];
  correlations: Correlation[];
  weeklyScore: number;
  highlights: string[];
  improvements: string[];
  sleepAnalysis?: SleepAnalysis;
}

export function useHealthCoach() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HealthCoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const fetchHealthData = useCallback(async () => {
    if (!user?.id) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch health metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('health_metrics')
      .select('metric_type, value, recorded_at, unit')
      .eq('user_id', user.id)
      .gte('recorded_at', thirtyDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });

    if (metricsError) {
      console.error('Error fetching health metrics:', metricsError);
    }

    // Fetch daily check-ins
    const { data: checkins, error: checkinsError } = await supabase
      .from('daily_checkins')
      .select('checkin_date, sleep_hours, mood, energy_level, stress_level, exercise_minutes, water_glasses')
      .eq('user_id', user.id)
      .gte('checkin_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('checkin_date', { ascending: false });

    if (checkinsError) {
      console.error('Error fetching check-ins:', checkinsError);
    }

    return {
      metrics: metrics || [],
      checkins: checkins || [],
    };
  }, [user?.id]);

  const getCoaching = useCallback(async (userQuestion?: string) => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const healthData = await fetchHealthData();
      if (!healthData) {
        throw new Error('Unable to fetch health data');
      }

      const { data, error: fnError } = await supabase.functions.invoke('health-coach', {
        body: {
          metrics: healthData.metrics,
          checkins: healthData.checkins,
          userQuestion,
          timeOfDay: getTimeOfDay(),
          goals: {
            steps: 8000,
            sleep: 7.5,
            water: 8,
          },
        },
      });

      if (fnError) throw fnError;

      setResponse(data);
      return data;
    } catch (err) {
      console.error('Health coach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get health coaching');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchHealthData]);

  const askQuestion = useCallback(async (question: string) => {
    return getCoaching(question);
  }, [getCoaching]);

  return {
    loading,
    response,
    error,
    getCoaching,
    askQuestion,
  };
}
