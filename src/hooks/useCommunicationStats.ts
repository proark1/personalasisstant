import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CommunicationStat {
  id: string;
  contactId: string;
  contactName?: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalCalls: number;
  totalCallDurationSeconds: number;
  avgResponseTimeSeconds?: number;
  lastInteractionAt?: Date;
}

export interface CommunicationDashboard {
  totalContacts: number;
  totalMessages: number;
  totalCalls: number;
  totalCallMinutes: number;
  avgResponseTime: number;
  mostActiveContacts: CommunicationStat[];
  neglectedContacts: CommunicationStat[];
  recentActivity: { date: string; messages: number; calls: number }[];
}

type RecentActivity = { date: string; messages: number; calls: number };

// Real last-7-days activity from direct_messages + call_sessions, bucketed by
// day. Replaces the previous Math.random() fabrication.
async function fetchRecentActivity(userId: string): Promise<RecentActivity[]> {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [msgRes, callRes] = await Promise.all([
    supabase
      .from('direct_messages')
      .select('created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .gte('created_at', sinceIso),
    supabase
      .from('call_sessions')
      .select('created_at')
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
      .gte('created_at', sinceIso),
  ]);

  const dayKey = (d: string | Date) => new Date(d).toISOString().split('T')[0];
  const msgByDay = new Map<string, number>();
  const callByDay = new Map<string, number>();
  for (const m of msgRes.data || []) msgByDay.set(dayKey(m.created_at), (msgByDay.get(dayKey(m.created_at)) || 0) + 1);
  for (const c of callRes.data || []) callByDay.set(dayKey(c.created_at), (callByDay.get(dayKey(c.created_at)) || 0) + 1);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = d.toISOString().split('T')[0];
    return { date, messages: msgByDay.get(date) || 0, calls: callByDay.get(date) || 0 };
  });
}

export function useCommunicationStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CommunicationStat[]>([]);
  const [dashboard, setDashboard] = useState<CommunicationDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch all communication stats
  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('communication_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('last_interaction_at', { ascending: false });

      if (!error && data) {
        // Get contact names
        const contactIds = data.map(s => s.contact_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', contactIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

        const mappedStats = data.map(s => ({
          id: s.id,
          contactId: s.contact_id,
          contactName: profileMap.get(s.contact_id) || 'Unknown',
          totalMessagesSent: s.total_messages_sent,
          totalMessagesReceived: s.total_messages_received,
          totalCalls: s.total_calls,
          totalCallDurationSeconds: s.total_call_duration_seconds,
          avgResponseTimeSeconds: s.avg_response_time_seconds,
          lastInteractionAt: s.last_interaction_at ? new Date(s.last_interaction_at) : undefined,
        }));

        setStats(mappedStats);
        const recentActivity = await fetchRecentActivity(user.id);
        calculateDashboard(mappedStats, recentActivity);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // intentionally excludes calculateDashboard — defined after this callback to avoid circular deps

  // Calculate dashboard metrics
  const calculateDashboard = useCallback((statsData: CommunicationStat[], recentActivity: RecentActivity[]) => {
    const totalMessages = statsData.reduce((sum, s) => sum + s.totalMessagesSent + s.totalMessagesReceived, 0);
    const totalCalls = statsData.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalCallMinutes = statsData.reduce((sum, s) => sum + s.totalCallDurationSeconds, 0) / 60;
    
    const avgTimes = statsData.filter(s => s.avgResponseTimeSeconds).map(s => s.avgResponseTimeSeconds!);
    const avgResponseTime = avgTimes.length > 0 ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : 0;

    // Most active contacts (by total interactions)
    const mostActiveContacts = [...statsData]
      .sort((a, b) => (b.totalMessagesSent + b.totalMessagesReceived + b.totalCalls) - 
                       (a.totalMessagesSent + a.totalMessagesReceived + a.totalCalls))
      .slice(0, 5);

    // Neglected contacts (no interaction in 30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const neglectedContacts = statsData
      .filter(s => !s.lastInteractionAt || s.lastInteractionAt < thirtyDaysAgo)
      .slice(0, 5);

    setDashboard({
      totalContacts: statsData.length,
      totalMessages,
      totalCalls,
      totalCallMinutes: Math.round(totalCallMinutes),
      avgResponseTime: Math.round(avgResponseTime / 60), // Convert to minutes
      mostActiveContacts,
      neglectedContacts,
      recentActivity,
    });
  }, []);

  // Update stats for a contact
  const updateStats = useCallback(async (
    contactId: string,
    update: {
      messagesSent?: number;
      messagesReceived?: number;
      calls?: number;
      callDurationSeconds?: number;
    }
  ) => {
    if (!user) return;

    // First, get current stats
    const { data: existing } = await supabase
      .from('communication_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .single();

    const newStats = {
      user_id: user.id,
      contact_id: contactId,
      total_messages_sent: (existing?.total_messages_sent || 0) + (update.messagesSent || 0),
      total_messages_received: (existing?.total_messages_received || 0) + (update.messagesReceived || 0),
      total_calls: (existing?.total_calls || 0) + (update.calls || 0),
      total_call_duration_seconds: (existing?.total_call_duration_seconds || 0) + (update.callDurationSeconds || 0),
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('communication_stats')
      .upsert(newStats, { onConflict: 'user_id,contact_id' });

    fetchStats();
  }, [user, fetchStats]);

  // Get stats for a specific contact
  const getContactStats = useCallback((contactId: string) => {
    return stats.find(s => s.contactId === contactId);
  }, [stats]);

  // Get response time breakdown
  const getResponseTimeBreakdown = useCallback(() => {
    const fast = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds < 300).length;
    const medium = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds >= 300 && s.avgResponseTimeSeconds < 3600).length;
    const slow = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds >= 3600).length;
    
    return { fast, medium, slow };
  }, [stats]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, fetchStats]);

  return {
    stats,
    dashboard,
    loading,
    fetchStats,
    updateStats,
    getContactStats,
    getResponseTimeBreakdown,
  };
}
