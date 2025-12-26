import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SchedulingSuggestion {
  type: 'best_time' | 'avoid_time' | 'reschedule' | 'batch';
  title: string;
  description: string;
  suggestedTime?: Date;
  confidence: number;
}

export interface ProductivityPattern {
  peakHours: number[];
  lowEnergyHours: number[];
  bestDays: number[]; // 0-6
  avgTasksPerPeakHour: number;
}

export function useSmartScheduling() {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<ProductivityPattern | null>(null);
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzePatterns = useCallback(async () => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      // Fetch completed tasks from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, updated_at, priority')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('updated_at', thirtyDaysAgo.toISOString());

      // Fetch focus sessions
      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('started_at, duration_minutes, is_completed')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .gte('started_at', thirtyDaysAgo.toISOString());

      // Fetch check-ins for energy data
      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('checkin_date, energy_level, focus_quality')
        .eq('user_id', user.id)
        .gte('checkin_date', thirtyDaysAgo.toISOString().split('T')[0]);

      // Analyze task completion by hour
      const hourCounts: Record<number, number> = {};
      tasks?.forEach(task => {
        if (task.updated_at) {
          const hour = new Date(task.updated_at).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      });

      // Find peak hours (top 3 hours with most completions)
      const sortedHours = Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([hour]) => parseInt(hour));
      
      const peakHours = sortedHours.slice(0, 3);
      const lowEnergyHours = sortedHours.slice(-3).reverse();

      // Analyze by day of week
      const dayCounts: Record<number, number> = {};
      tasks?.forEach(task => {
        if (task.updated_at) {
          const day = new Date(task.updated_at).getDay();
          dayCounts[day] = (dayCounts[day] || 0) + 1;
        }
      });

      const bestDays = Object.entries(dayCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([day]) => parseInt(day));

      // Calculate average tasks per peak hour
      const totalPeakHourTasks = peakHours.reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
      const avgTasksPerPeakHour = peakHours.length > 0 
        ? Math.round(totalPeakHourTasks / peakHours.length)
        : 0;

      const productivityPatterns: ProductivityPattern = {
        peakHours,
        lowEnergyHours,
        bestDays,
        avgTasksPerPeakHour,
      };

      setPatterns(productivityPatterns);
      return productivityPatterns;
    } catch (err) {
      console.error('Error analyzing patterns:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getSuggestionsForTask = useCallback((
    taskPriority: string,
    estimatedDuration?: number
  ): SchedulingSuggestion[] => {
    if (!patterns) return [];

    const suggestions: SchedulingSuggestion[] = [];
    const now = new Date();
    const currentHour = now.getHours();

    // Suggest peak hours for high priority tasks
    if (taskPriority === 'high' && patterns.peakHours.length > 0) {
      const nextPeakHour = patterns.peakHours.find(h => h > currentHour) || patterns.peakHours[0];
      const suggestedTime = new Date(now);
      
      if (nextPeakHour <= currentHour) {
        suggestedTime.setDate(suggestedTime.getDate() + 1);
      }
      suggestedTime.setHours(nextPeakHour, 0, 0, 0);

      suggestions.push({
        type: 'best_time',
        title: 'Schedule for Peak Productivity',
        description: `Your focus is strongest around ${nextPeakHour}:00. Schedule this high-priority task then.`,
        suggestedTime,
        confidence: 0.8,
      });
    }

    // Warn about low energy hours
    if (patterns.lowEnergyHours.includes(currentHour)) {
      const nextGoodHour = patterns.peakHours.find(h => h > currentHour);
      suggestions.push({
        type: 'avoid_time',
        title: 'Low Energy Period',
        description: `You typically have lower focus at this hour. ${nextGoodHour ? `Consider waiting until ${nextGoodHour}:00.` : 'Try a simpler task instead.'}`,
        confidence: 0.7,
      });
    }

    // Best days suggestion
    if (patterns.bestDays.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDay = now.getDay();
      
      if (!patterns.bestDays.includes(todayDay) && taskPriority === 'high') {
        const bestDayName = dayNames[patterns.bestDays[0]];
        suggestions.push({
          type: 'reschedule',
          title: `${bestDayName}s are Better`,
          description: `You complete more tasks on ${bestDayName}s. Consider scheduling complex work then.`,
          confidence: 0.6,
        });
      }
    }

    return suggestions;
  }, [patterns]);

  const generateDaySuggestions = useCallback(async () => {
    if (!user?.id) return;

    // Fetch today's events
    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time');

    const newSuggestions: SchedulingSuggestion[] = [];

    // Calendar overload detection
    if (events && events.length > 5) {
      newSuggestions.push({
        type: 'reschedule',
        title: 'Calendar Overload',
        description: `You have ${events.length} events today. Consider moving some to tomorrow for better focus.`,
        confidence: 0.85,
      });
    }

    // Gap detection for focus time
    if (events && events.length > 0) {
      const gaps: Array<{ start: Date; duration: number }> = [];
      const sortedEvents = [...events].sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      for (let i = 0; i < sortedEvents.length - 1; i++) {
        const currentEnd = new Date(sortedEvents[i].end_time);
        const nextStart = new Date(sortedEvents[i + 1].start_time);
        const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
        
        if (gapMinutes >= 60) {
          gaps.push({ start: currentEnd, duration: gapMinutes });
        }
      }

      if (gaps.length > 0) {
        const bestGap = gaps.sort((a, b) => b.duration - a.duration)[0];
        newSuggestions.push({
          type: 'best_time',
          title: 'Focus Block Available',
          description: `You have ${Math.round(bestGap.duration)} minutes free. Perfect for deep work.`,
          suggestedTime: bestGap.start,
          confidence: 0.9,
        });
      }
    }

    setSuggestions(newSuggestions);
    return newSuggestions;
  }, [user?.id]);

  // Analyze on mount
  useEffect(() => {
    analyzePatterns();
    generateDaySuggestions();
  }, [analyzePatterns, generateDaySuggestions]);

  return {
    patterns,
    suggestions,
    loading,
    analyzePatterns,
    getSuggestionsForTask,
    generateDaySuggestions,
  };
}
