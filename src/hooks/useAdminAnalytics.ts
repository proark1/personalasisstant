import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_category: string;
  event_data: Record<string, unknown>;
  page_path: string | null;
  session_id: string | null;
  created_at: string;
}

interface AIUsage {
  id: string;
  user_id: string;
  function_name: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  response_status: string;
  created_at: string;
}

interface UserStats {
  user_id: string;
  display_name: string | null;
  email: string | null;
  total_events: number;
  total_ai_tokens: number;
  last_active: string;
}

interface OverviewStats {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  totalEvents: number;
  totalAITokens: number;
  totalAICost: number;
  topEvents: { event_type: string; count: number }[];
  topCategories: { event_category: string; count: number }[];
  eventsOverTime: { date: string; count: number }[];
  aiUsageOverTime: { date: string; tokens: number; cost: number }[];
}

export function useAdminAnalytics() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [aiUsage, setAIUsage] = useState<AIUsage[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  });

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .single();

      setIsAdmin(!!data && !error);
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  // Fetch overview statistics
  const fetchOverview = useCallback(async () => {
    if (!isAdmin) return;

    const startDate = dateRange.start.toISOString();
    const endDate = dateRange.end.toISOString();

    // Fetch events in date range
    const { data: eventsData } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    // Fetch AI usage in date range
    const { data: aiData } = await supabase
      .from('ai_usage')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    // Fetch all profiles for user count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (eventsData) {
      setEvents(eventsData as AnalyticsEvent[]);

      // Calculate stats
      const uniqueUsersToday = new Set(
        eventsData
          .filter(e => new Date(e.created_at).toDateString() === new Date().toDateString())
          .map(e => e.user_id)
      );

      const uniqueUsersWeek = new Set(
        eventsData
          .filter(e => {
            const eventDate = new Date(e.created_at);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return eventDate >= weekAgo;
          })
          .map(e => e.user_id)
      );

      // Top events
      const eventCounts: Record<string, number> = {};
      const categoryCounts: Record<string, number> = {};
      eventsData.forEach(e => {
        eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
        categoryCounts[e.event_category] = (categoryCounts[e.event_category] || 0) + 1;
      });

      const topEvents = Object.entries(eventCounts)
        .map(([event_type, count]) => ({ event_type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topCategories = Object.entries(categoryCounts)
        .map(([event_category, count]) => ({ event_category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Events over time
      const eventsByDate: Record<string, number> = {};
      eventsData.forEach(e => {
        const date = new Date(e.created_at).toISOString().split('T')[0];
        eventsByDate[date] = (eventsByDate[date] || 0) + 1;
      });

      const eventsOverTime = Object.entries(eventsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // AI usage stats
      let totalAITokens = 0;
      let totalAICost = 0;
      const aiByDate: Record<string, { tokens: number; cost: number }> = {};

      if (aiData) {
        setAIUsage(aiData as AIUsage[]);
        aiData.forEach(a => {
          totalAITokens += a.total_tokens || 0;
          totalAICost += Number(a.cost_estimate) || 0;
          const date = new Date(a.created_at).toISOString().split('T')[0];
          if (!aiByDate[date]) aiByDate[date] = { tokens: 0, cost: 0 };
          aiByDate[date].tokens += a.total_tokens || 0;
          aiByDate[date].cost += Number(a.cost_estimate) || 0;
        });
      }

      const aiUsageOverTime = Object.entries(aiByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setOverview({
        totalUsers: totalUsers || 0,
        activeUsersToday: uniqueUsersToday.size,
        activeUsersWeek: uniqueUsersWeek.size,
        totalEvents: eventsData.length,
        totalAITokens,
        totalAICost,
        topEvents,
        topCategories,
        eventsOverTime,
        aiUsageOverTime,
      });
    }
  }, [isAdmin, dateRange]);

  // Fetch per-user statistics
  const fetchUserStats = useCallback(async () => {
    if (!isAdmin) return;

    const startDate = dateRange.start.toISOString();
    const endDate = dateRange.end.toISOString();

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, email');

    if (!profiles) return;

    // Get event counts per user
    const { data: eventsData } = await supabase
      .from('analytics_events')
      .select('user_id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get AI usage per user
    const { data: aiData } = await supabase
      .from('ai_usage')
      .select('user_id, total_tokens')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const userEventCounts: Record<string, { count: number; lastActive: string }> = {};
    const userAITokens: Record<string, number> = {};

    eventsData?.forEach(e => {
      if (!userEventCounts[e.user_id]) {
        userEventCounts[e.user_id] = { count: 0, lastActive: e.created_at };
      }
      userEventCounts[e.user_id].count++;
      if (e.created_at > userEventCounts[e.user_id].lastActive) {
        userEventCounts[e.user_id].lastActive = e.created_at;
      }
    });

    aiData?.forEach(a => {
      userAITokens[a.user_id] = (userAITokens[a.user_id] || 0) + (a.total_tokens || 0);
    });

    const stats: UserStats[] = profiles.map(p => ({
      user_id: p.user_id,
      display_name: p.display_name,
      email: p.email,
      total_events: userEventCounts[p.user_id]?.count || 0,
      total_ai_tokens: userAITokens[p.user_id] || 0,
      last_active: userEventCounts[p.user_id]?.lastActive || '',
    }));

    setUserStats(stats.sort((a, b) => b.total_events - a.total_events));
  }, [isAdmin, dateRange]);

  // Fetch user-specific events
  const fetchUserEvents = useCallback(async (userId: string) => {
    if (!isAdmin) return [];

    const { data } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    return (data || []) as AnalyticsEvent[];
  }, [isAdmin, dateRange]);

  // Fetch user-specific AI usage
  const fetchUserAIUsage = useCallback(async (userId: string) => {
    if (!isAdmin) return [];

    const { data } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    return (data || []) as AIUsage[];
  }, [isAdmin, dateRange]);

  // Initial fetch
  useEffect(() => {
    if (isAdmin) {
      fetchOverview();
      fetchUserStats();
    }
  }, [isAdmin, fetchOverview, fetchUserStats]);

  return {
    isAdmin,
    loading,
    overview,
    userStats,
    events,
    aiUsage,
    dateRange,
    setDateRange,
    fetchOverview,
    fetchUserStats,
    fetchUserEvents,
    fetchUserAIUsage,
  };
}
