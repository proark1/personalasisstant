import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  category: 'morning' | 'afternoon' | 'evening' | 'contextual' | 'priority';
  action: () => void;
  priority: number;
  description?: string;
}

interface ContextData {
  currentHour: number;
  dayOfWeek: number;
  hasCheckedInToday: boolean;
  pendingTaskCount: number;
  overdueContactCount: number;
  upcomingEventCount: number;
  habitsLoggedToday: number;
  totalHabits: number;
  prayersLoggedToday: number;
  priorityEmailCount: number;
  urgentContractName: string | null;
  urgentContractDays: number;
  meetingContactName: string | null;
}

export function useContextualActions(onNavigate?: (panel: string) => void) {
  const { user } = useAuth();
  const [contextData, setContextData] = useState<ContextData>({
    currentHour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    hasCheckedInToday: false,
    pendingTaskCount: 0,
    overdueContactCount: 0,
    upcomingEventCount: 0,
    habitsLoggedToday: 0,
    totalHabits: 0,
    prayersLoggedToday: 0,
    priorityEmailCount: 0,
    urgentContractName: null,
    urgentContractDays: 0,
    meetingContactName: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchContextData = useCallback(async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const sevenDaysFromNow = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const [checkinsResult, tasksResult, contactsResult, eventsResult, habitsResult, habitLogsResult, emailsResult, contractsResult] = await Promise.all([
        supabase.from('daily_checkins').select('id').eq('user_id', user.id).eq('checkin_date', today).limit(1),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', false),
        supabase.from('user_contacts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).lt('last_contacted_at', format(addDays(new Date(), -30), 'yyyy-MM-dd')),
        supabase.from('events').select('id, title', { count: 'exact' }).eq('user_id', user.id).gte('start_time', today).lt('start_time', tomorrow),
        supabase.from('habits').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('habit_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('log_date', today),
        supabase.from('user_emails').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false).eq('user_archived', false).lte('priority_score', 2),
        supabase.from('contracts').select('name, renewal_date').eq('user_id', user.id).eq('is_active', true).not('renewal_date', 'is', null).lte('renewal_date', sevenDaysFromNow).gte('renewal_date', today).order('renewal_date').limit(1),
      ]);

      // Find meeting-contact match
      let meetingContactName: string | null = null;
      if (eventsResult.data && eventsResult.data.length > 0) {
        const contactsForMatch = await supabase.from('user_contacts').select('name').eq('user_id', user.id).limit(50);
        if (contactsForMatch.data) {
          for (const event of eventsResult.data) {
            const match = contactsForMatch.data.find((c: { name?: string }) => event.title?.toLowerCase().includes(c.name?.toLowerCase()));
            if (match) { meetingContactName = match.name; break; }
          }
        }
      }

      const urgentContract = contractsResult.data?.[0];
      const urgentContractDays = urgentContract?.renewal_date 
        ? Math.max(0, Math.floor((new Date(urgentContract.renewal_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      setContextData({
        currentHour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        hasCheckedInToday: (checkinsResult.data?.length || 0) > 0,
        pendingTaskCount: tasksResult.count || 0,
        overdueContactCount: contactsResult.count || 0,
        upcomingEventCount: eventsResult.count || 0,
        habitsLoggedToday: habitLogsResult.count || 0,
        totalHabits: habitsResult.count || 0,
        prayersLoggedToday: 0,
        priorityEmailCount: emailsResult.count || 0,
        urgentContractName: urgentContract?.name || null,
        urgentContractDays,
        meetingContactName,
      });
    } catch (error) {
      console.error('Error fetching context data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const actions = useMemo((): QuickAction[] => {
    const { currentHour, hasCheckedInToday, pendingTaskCount, overdueContactCount, habitsLoggedToday, totalHabits, upcomingEventCount, priorityEmailCount, urgentContractName, urgentContractDays, meetingContactName } = contextData;
    const navigate = onNavigate || (() => {});
    const allActions: QuickAction[] = [];

    // Morning actions (5am - 12pm)
    if (currentHour >= 5 && currentHour < 12) {
      if (!hasCheckedInToday) {
        allActions.push({
          id: 'morning-checkin',
          label: 'Morning Check-in',
          icon: 'Sun',
          category: 'morning',
          action: () => navigate('dashboard'),
          priority: 100,
          description: 'Start your day with intention',
        });
      }

      allActions.push({
        id: 'plan-day',
        label: 'Plan Today',
        icon: 'Calendar',
        category: 'morning',
        action: () => navigate('calendar'),
        priority: 90,
        description: `${upcomingEventCount} events today`,
      });

      if (pendingTaskCount > 0) {
        allActions.push({
          id: 'review-tasks',
          label: 'Review Tasks',
          icon: 'ListTodo',
          category: 'morning',
          action: () => navigate('tasks'),
          priority: 85,
          description: `${pendingTaskCount} pending`,
        });
      }
    }

    // Afternoon actions (12pm - 5pm)
    if (currentHour >= 12 && currentHour < 17) {
      allActions.push({
        id: 'focus-session',
        label: 'Start Focus',
        icon: 'Timer',
        category: 'afternoon',
        action: () => navigate('focus'),
        priority: 95,
        description: 'Deep work time',
      });

      if (pendingTaskCount > 3) {
        allActions.push({
          id: 'tackle-tasks',
          label: 'Tackle Tasks',
          icon: 'Zap',
          category: 'afternoon',
          action: () => navigate('tasks'),
          priority: 88,
          description: `${pendingTaskCount} waiting`,
        });
      }
    }

    // Evening actions (5pm - 10pm)
    if (currentHour >= 17 && currentHour < 22) {
      if (habitsLoggedToday < totalHabits) {
        allActions.push({
          id: 'log-habits',
          label: 'Log Habits',
          icon: 'Check',
          category: 'evening',
          action: () => navigate('habits'),
          priority: 95,
          description: `${totalHabits - habitsLoggedToday} remaining`,
        });
      }

      allActions.push({
        id: 'plan-tomorrow',
        label: 'Plan Tomorrow',
        icon: 'CalendarPlus',
        category: 'evening',
        action: () => navigate('calendar'),
        priority: 85,
        description: 'Prepare for success',
      });

      allActions.push({
        id: 'weekly-review',
        label: 'Weekly Review',
        icon: 'BarChart',
        category: 'evening',
        action: () => navigate('insights'),
        priority: 70,
        description: 'Reflect on progress',
      });
    }

    // Contextual actions (always available based on data)
    if (overdueContactCount > 0) {
      allActions.push({
        id: 'reach-out',
        label: 'Reach Out',
        icon: 'Users',
        category: 'contextual',
        action: () => navigate('contacts'),
        priority: 80,
        description: `${overdueContactCount} contacts to catch up with`,
      });
    }

    if (pendingTaskCount > 5) {
      allActions.push({
        id: 'quick-wins',
        label: 'Quick Wins',
        icon: 'Trophy',
        category: 'priority',
        action: () => navigate('tasks'),
        priority: 92,
        description: 'Knock out small tasks',
      });
    }

    // Cross-module: Priority emails
    if (priorityEmailCount > 0) {
      allActions.push({
        id: 'priority-emails',
        label: 'Emails',
        icon: 'Mail',
        category: 'priority',
        action: () => navigate('email'),
        priority: 93,
        description: `${priorityEmailCount} need${priorityEmailCount === 1 ? 's' : ''} attention`,
      });
    }

    // Cross-module: Contract renewal
    if (urgentContractName) {
      allActions.push({
        id: 'contract-review',
        label: 'Contract',
        icon: 'FileText',
        category: 'priority',
        action: () => navigate('contracts'),
        priority: 91,
        description: `${urgentContractName} renews in ${urgentContractDays}d`,
      });
    }

    // Cross-module: Meeting prep with contact
    if (meetingContactName) {
      allActions.push({
        id: 'meeting-prep',
        label: `Prep: ${meetingContactName}`,
        icon: 'Users',
        category: 'priority',
        action: () => navigate('contacts'),
        priority: 89,
        description: 'Prepare for meeting',
      });
    }

    // Always available quick actions
    allActions.push({
      id: 'brain-dump',
      label: 'Brain Dump',
      icon: 'Brain',
      category: 'contextual',
      action: () => navigate('capture'),
      priority: 60,
      description: 'Capture thoughts quickly',
    });

    allActions.push({
      id: 'ask-dori',
      label: 'Ask Dori',
      icon: 'Sparkles',
      category: 'contextual',
      action: () => navigate('assistant'),
      priority: 55,
      description: 'Get AI assistance',
    });

    // Sort by priority and take top actions
    return allActions.sort((a, b) => b.priority - a.priority);
  }, [contextData, onNavigate]);

  const getTopActions = useCallback((count: number = 5) => {
    return actions.slice(0, count);
  }, [actions]);

  const getActionsByCategory = useCallback((category: QuickAction['category']) => {
    return actions.filter(a => a.category === category);
  }, [actions]);

  useEffect(() => {
    fetchContextData();

    // Refresh context every 5 minutes
    const interval = setInterval(() => {
      setContextData(prev => ({
        ...prev,
        currentHour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      }));
      fetchContextData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchContextData]);

  return {
    actions,
    contextData,
    loading,
    getTopActions,
    getActionsByCategory,
    refresh: fetchContextData,
  };
}
