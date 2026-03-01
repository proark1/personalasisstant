import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useLifeScore } from '@/hooks/useLifeScore';
import { CheckinPrompt } from '@/components/checkin/CheckinPrompt';
import { DashboardHero } from './DashboardHero';
import { FocusCard } from './FocusCard';
import { StatPills } from './StatPills';
import { TodayTimeline } from './TodayTimeline';
import { SmartInsightCard } from './SmartInsightCard';
import { QuickActionsBar } from './QuickActionsBar';
import { StaggerContainer, StaggerItem } from '@/components/ui/page-transition';
import { Task, TaskCategory } from '@/types/flux';
import { isSameDay, subDays, startOfDay, isToday } from 'date-fns';

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  completed: boolean;
  created_at: string;
  due_date: string | null;
  user_id: string;
}

interface DashboardPanelProps {
  userId: string;
}

export function DashboardPanel({ userId }: DashboardPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { todayScore } = useLifeScore();

  useEffect(() => {
    if (!userId) return;

    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (data) {
        setTasks(data.map((t: DbTask) => ({
          id: t.id,
          title: t.title,
          description: t.description || undefined,
          category: t.category as TaskCategory,
          priority: t.priority as 'high' | 'medium' | 'low',
          completed: t.completed,
          createdAt: new Date(t.created_at),
          dueDate: t.due_date ? new Date(t.due_date) : undefined,
        })));
      }
      setLoading(false);
    };

    fetchTasks();
  }, [userId]);

  const stats = useMemo(() => {
    const now = new Date();
    
    const completedToday = tasks.filter(t => 
      t.completed && t.createdAt && isToday(t.createdAt)
    ).length;

    const completedThisWeek = tasks.filter(t => {
      if (!t.completed || !t.createdAt) return false;
      const daysDiff = Math.floor((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff < 7;
    }).length;

    // Streak
    let streak = 0;
    let checkDate = startOfDay(now);
    for (let i = 0; i < 365; i++) {
      const dayTasks = tasks.filter(t => 
        t.completed && t.createdAt && isSameDay(t.createdAt, checkDate)
      );
      if (dayTasks.length > 0) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    return { completedToday, completedThisWeek, streak };
  }, [tasks]);

  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', taskId);

    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-primary">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Check-in prompt (only shows if needed) */}
        <StaggerItem className="col-span-full">
          <CheckinPrompt />
        </StaggerItem>

        {/* Hero greeting */}
        <StaggerItem className="col-span-full">
          <DashboardHero
            userName={profile?.display_name}
            tasks={tasks}
          />
        </StaggerItem>

        {/* Focus card - most important next action */}
        <StaggerItem className="md:col-span-2">
          <FocusCard
            tasks={tasks}
            onCompleteTask={handleCompleteTask}
          />
        </StaggerItem>

        {/* Right column: stat pills + smart insight */}
        <StaggerItem className="md:col-span-1 space-y-3 md:space-y-4">
          <StatPills
            streak={stats.streak}
            completedToday={stats.completedToday}
            completedThisWeek={stats.completedThisWeek}
            lifeScore={todayScore?.overallScore}
          />
          <SmartInsightCard tasks={tasks} />
        </StaggerItem>

        {/* Today's timeline */}
        <StaggerItem className="md:col-span-2">
          <TodayTimeline tasks={tasks} />
        </StaggerItem>

        {/* Quick actions */}
        <StaggerItem className="md:col-span-1">
          <QuickActionsBar />
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
