import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfDay, differenceInDays, subDays, format } from 'date-fns';
import { useAppNotifications } from './useAppNotifications';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  frequency: 'daily' | 'weekly' | 'custom';
  targetCount: number;
  daysOfWeek: number[];
  reminderTime: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  logDate: Date;
  completedCount: number;
  notes: string | null;
  createdAt: Date;
}

export function useHabits(userId: string | undefined) {
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { notifyHabitCompleted } = useAppNotifications();

  const fetchHabits = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      
      // Fetch habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (habitsError) throw habitsError;

      // Fetch logs for last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('log_date', thirtyDaysAgo);

      if (logsError) throw logsError;

      setHabits((habitsData || []).map(h => ({
        id: h.id,
        userId: h.user_id,
        name: h.name,
        description: h.description,
        icon: h.icon,
        color: h.color,
        frequency: h.frequency as 'daily' | 'weekly' | 'custom',
        targetCount: h.target_count,
        daysOfWeek: h.days_of_week || [],
        reminderTime: h.reminder_time,
        isActive: h.is_active,
        createdAt: new Date(h.created_at),
        updatedAt: new Date(h.updated_at),
      })));

      setLogs((logsData || []).map(l => ({
        id: l.id,
        habitId: l.habit_id,
        userId: l.user_id,
        logDate: new Date(l.log_date),
        completedCount: l.completed_count,
        notes: l.notes,
        createdAt: new Date(l.created_at),
      })));
    } catch (error) {
      console.error('[habits] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createHabit = useCallback(async (habit: Omit<Habit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: userId,
          name: habit.name,
          description: habit.description,
          icon: habit.icon,
          color: habit.color,
          frequency: habit.frequency,
          target_count: habit.targetCount,
          days_of_week: habit.daysOfWeek,
          reminder_time: habit.reminderTime,
          is_active: habit.isActive,
        })
        .select()
        .single();

      if (error) throw error;

      const newHabit: Habit = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        frequency: data.frequency as 'daily' | 'weekly' | 'custom',
        targetCount: data.target_count,
        daysOfWeek: data.days_of_week || [],
        reminderTime: data.reminder_time,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setHabits(prev => [...prev, newHabit]);
      toast({ title: 'Habit Created', description: `"${habit.name}" has been added.` });
      return newHabit;
    } catch (error) {
      console.error('[habits] Create error:', error);
      toast({ title: 'Error', description: 'Could not create habit.', variant: 'destructive' });
      return null;
    }
  }, [userId, toast]);

  // Calculate streak for a habit - moved before logHabit to avoid circular dependency
  const getStreak = useCallback((habitId: string) => {
    const habitLogs = logs
      .filter(l => l.habitId === habitId)
      .sort((a, b) => b.logDate.getTime() - a.logDate.getTime());

    if (habitLogs.length === 0) return 0;

    let streak = 0;
    let currentDate = startOfDay(new Date());

    for (const log of habitLogs) {
      const logDate = startOfDay(log.logDate);
      const diff = differenceInDays(currentDate, logDate);

      if (diff === 0 || diff === 1) {
        streak++;
        currentDate = logDate;
      } else {
        break;
      }
    }

    return streak;
  }, [logs]);

  const logHabit = useCallback(async (habitId: string, date: Date = new Date(), count: number = 1) => {
    if (!userId) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const habit = habits.find(h => h.id === habitId);

    try {
      // Check if log exists
      const existingLog = logs.find(l => 
        l.habitId === habitId && 
        format(l.logDate, 'yyyy-MM-dd') === dateStr
      );

      let newCompletedCount = count;

      if (existingLog) {
        // Update existing log
        newCompletedCount = existingLog.completedCount + count;
        const { error } = await supabase
          .from('habit_logs')
          .update({ completed_count: newCompletedCount })
          .eq('id', existingLog.id);

        if (error) throw error;

        setLogs(prev => prev.map(l => 
          l.id === existingLog.id 
            ? { ...l, completedCount: newCompletedCount }
            : l
        ));
      } else {
        // Create new log
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            habit_id: habitId,
            user_id: userId,
            log_date: dateStr,
            completed_count: count,
          })
          .select()
          .single();

        if (error) throw error;

        setLogs(prev => [...prev, {
          id: data.id,
          habitId: data.habit_id,
          userId: data.user_id,
          logDate: new Date(data.log_date),
          completedCount: data.completed_count,
          notes: data.notes,
          createdAt: new Date(data.created_at),
        }]);
      }

      // Check if habit target is reached - notify completion
      if (habit && newCompletedCount >= habit.targetCount) {
        const streak = getStreak(habitId);
        notifyHabitCompleted(habit.name, habitId, streak + 1);
      }

      toast({ title: 'Habit Logged!', description: 'Keep up the great work!' });
    } catch (error) {
      console.error('[habits] Log error:', error);
      toast({ title: 'Error', description: 'Could not log habit.', variant: 'destructive' });
    }
  }, [userId, logs, habits, toast, getStreak, notifyHabitCompleted]);

  const deleteHabit = useCallback(async (habitId: string) => {
    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_active: false })
        .eq('id', habitId);

      if (error) throw error;

      setHabits(prev => prev.filter(h => h.id !== habitId));
      toast({ title: 'Habit Removed', description: 'The habit has been deactivated.' });
    } catch (error) {
      console.error('[habits] Delete error:', error);
      toast({ title: 'Error', description: 'Could not remove habit.', variant: 'destructive' });
    }
  }, [toast]);

  // Get today's habits with completion status
  const todayHabits = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const dayOfWeek = new Date().getDay();

    return habits
      .filter(h => {
        if (h.frequency === 'daily') return true;
        if (h.frequency === 'custom') return h.daysOfWeek.includes(dayOfWeek);
        return true;
      })
      .map(habit => {
        const todayLog = logs.find(l => 
          l.habitId === habit.id && 
          format(l.logDate, 'yyyy-MM-dd') === today
        );
        
        return {
          ...habit,
          completedCount: todayLog?.completedCount || 0,
          isCompleted: (todayLog?.completedCount || 0) >= habit.targetCount,
          streak: getStreak(habit.id),
        };
      });
  }, [habits, logs, getStreak]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  return {
    habits,
    logs,
    loading,
    todayHabits,
    refetch: fetchHabits,
    createHabit,
    logHabit,
    deleteHabit,
    getStreak,
  };
}
