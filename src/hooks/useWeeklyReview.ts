import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { WeeklyReview, Task } from '@/types/flux';
import { startOfWeek, format } from 'date-fns';

interface DbWeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  completed_tasks_count: number | null;
  incomplete_tasks_reviewed: string[] | null;
  intentions: string | null;
  celebrations: string | null;
  created_at: string;
  updated_at: string;
}

export function useWeeklyReview(userId: string | undefined) {
  const [currentReview, setCurrentReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);

  const dbReviewToReview = (dbReview: DbWeeklyReview): WeeklyReview => ({
    id: dbReview.id,
    weekStart: new Date(dbReview.week_start),
    completedTasksCount: dbReview.completed_tasks_count || 0,
    incompleteTasksReviewed: dbReview.incomplete_tasks_reviewed || [],
    intentions: dbReview.intentions || undefined,
    celebrations: dbReview.celebrations || undefined,
    createdAt: new Date(dbReview.created_at),
    updatedAt: new Date(dbReview.updated_at),
  });

  const getCurrentWeekStart = () => {
    return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  };

  const fetchCurrentReview = useCallback(async () => {
    if (!userId) {
      setCurrentReview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const weekStart = getCurrentWeekStart();
    
    const { data } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('week_start', weekStart)
      .maybeSingle();

    if (data) {
      setCurrentReview(dbReviewToReview(data));
    } else {
      setCurrentReview(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchCurrentReview();
  }, [fetchCurrentReview]);

  const createOrUpdateReview = useCallback(async (updates: Partial<Omit<WeeklyReview, 'id' | 'createdAt' | 'updatedAt' | 'weekStart'>>) => {
    if (!userId) return null;

    const weekStart = getCurrentWeekStart();

    const dbUpdates: Record<string, unknown> = {};
    if (updates.completedTasksCount !== undefined) dbUpdates.completed_tasks_count = updates.completedTasksCount;
    if (updates.incompleteTasksReviewed !== undefined) dbUpdates.incomplete_tasks_reviewed = updates.incompleteTasksReviewed;
    if (updates.intentions !== undefined) dbUpdates.intentions = updates.intentions;
    if (updates.celebrations !== undefined) dbUpdates.celebrations = updates.celebrations;

    if (currentReview) {
      // Update existing
      const { data, error } = await supabase
        .from('weekly_reviews')
        .update(dbUpdates as TablesUpdate<'weekly_reviews'>)
        .eq('id', currentReview.id)
        .select()
        .single();

      if (data && !error) {
        const updated = dbReviewToReview(data);
        setCurrentReview(updated);
        return updated;
      }
    } else {
      // Create new
      const { data, error } = await supabase
        .from('weekly_reviews')
        .insert({
          user_id: userId,
          week_start: weekStart,
          ...dbUpdates,
        })
        .select()
        .single();

      if (data && !error) {
        const newReview = dbReviewToReview(data);
        setCurrentReview(newReview);
        return newReview;
      }
    }
    return null;
  }, [userId, currentReview]);

  const getWeeklyStats = useCallback((tasks: Task[]) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekTasks = tasks.filter(t => {
      const createdAt = new Date(t.createdAt);
      return createdAt >= weekStart;
    });

    const completed = weekTasks.filter(t => t.completed);
    const incomplete = tasks.filter(t => !t.completed);

    return {
      totalCreated: weekTasks.length,
      completedThisWeek: completed.length,
      incompleteTotal: incomplete.length,
      byPriority: {
        high: incomplete.filter(t => t.priority === 'high').length,
        medium: incomplete.filter(t => t.priority === 'medium').length,
        low: incomplete.filter(t => t.priority === 'low').length,
      },
    };
  }, []);

  return {
    currentReview,
    loading,
    createOrUpdateReview,
    getWeeklyStats,
    refetch: fetchCurrentReview,
  };
}
