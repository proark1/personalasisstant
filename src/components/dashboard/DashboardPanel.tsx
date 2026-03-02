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
import { DailyBriefingCard } from './DailyBriefingCard';
import { QuickActionsBar } from './QuickActionsBar';
import { WeatherCard } from './WeatherCard';
import { ContractAlertsCard } from './ContractAlertsCard';
import { ContactRemindersCard } from './ContactRemindersCard';
import { StaggerContainer, StaggerItem } from '@/components/ui/page-transition';
import { Task, TaskCategory, CalendarEvent } from '@/types/flux';
import { isSameDay, subDays, startOfDay, endOfDay, isToday } from 'date-fns';

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
  onNavigate?: (panel: string) => void;
}

export function DashboardPanel({ userId, onNavigate }: DashboardPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contractAlerts, setContractAlerts] = useState<any[]>([]);
  const [overdueContacts, setOverdueContacts] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { todayScore } = useLifeScore();

  useEffect(() => {
    if (!userId) return;

    const fetchAll = async () => {
      const now = new Date();

      // Fetch tasks, events, contracts, contacts in parallel
      const [tasksRes, eventsRes, contractsRes, contactsRes, emailsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', userId),
        supabase.from('events').select('*').eq('user_id', userId)
          .gte('start_time', startOfDay(now).toISOString())
          .lte('start_time', endOfDay(now).toISOString()),
        supabase.from('contracts').select('*').eq('user_id', userId)
          .eq('is_active', true).not('renewal_date', 'is', null),
        supabase.from('user_contacts').select('id, name, last_contacted_at')
          .eq('user_id', userId)
          .lt('last_contacted_at', subDays(now, 30).toISOString())
          .order('last_contacted_at', { ascending: true })
          .limit(3),
        supabase.from('user_emails').select('id, from_name, from_email, subject, priority_score, is_read, user_archived, category')
          .eq('user_id', userId)
          .eq('is_read', false)
          .eq('user_archived', false)
          .order('priority_score')
          .limit(20),
      ]);

      if (tasksRes.data) {
        setTasks(tasksRes.data.map((t: DbTask) => ({
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

      if (eventsRes.data) {
        setEvents(eventsRes.data.map((e: any) => ({
          id: e.id,
          title: e.title,
          startTime: new Date(e.start_time),
          endTime: new Date(e.end_time),
          description: e.description || undefined,
          category: e.category || undefined,
        })));
      }

      if (contractsRes.data) {
        setContractAlerts(contractsRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          renewalDate: c.renewal_date ? new Date(c.renewal_date) : null,
          cancellationNoticeDays: c.cancellation_notice_days || 30,
          autoRenews: c.auto_renews ?? true,
        })));
      }

      if (contactsRes.data) {
        setOverdueContacts(contactsRes.data);
      }

      if (emailsRes.data) {
        setEmails(emailsRes.data);
      }

      setLoading(false);
    };

    fetchAll();
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
        <StaggerItem className="col-span-full">
          <CheckinPrompt />
        </StaggerItem>

        <StaggerItem className="col-span-full">
          <DashboardHero userName={profile?.display_name} tasks={tasks} />
        </StaggerItem>

        <StaggerItem className="col-span-full">
          <DailyBriefingCard />
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <FocusCard tasks={tasks} onCompleteTask={handleCompleteTask} />
        </StaggerItem>

        <StaggerItem className="md:col-span-1 space-y-3 md:space-y-4">
          <WeatherCard />
          <StatPills
            streak={stats.streak}
            completedToday={stats.completedToday}
            completedThisWeek={stats.completedThisWeek}
            lifeScore={todayScore?.overallScore}
          />
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <TodayTimeline tasks={tasks} events={events} onNavigate={onNavigate} />
        </StaggerItem>

        <StaggerItem className="md:col-span-1">
          <SmartInsightCard tasks={tasks} emails={emails} contracts={contractAlerts} contacts={overdueContacts} events={events} />
        </StaggerItem>

        {contractAlerts.length > 0 && (
          <StaggerItem className="md:col-span-2">
            <ContractAlertsCard contracts={contractAlerts} onNavigate={onNavigate} />
          </StaggerItem>
        )}

        {overdueContacts.length > 0 && (
          <StaggerItem className="md:col-span-1">
            <ContactRemindersCard contacts={overdueContacts} onNavigate={onNavigate} />
          </StaggerItem>
        )}

        <StaggerItem className={contractAlerts.length === 0 && overdueContacts.length === 0 ? "md:col-span-1" : "col-span-full"}>
          <QuickActionsBar />
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
