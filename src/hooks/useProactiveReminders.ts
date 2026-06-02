import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProactiveReminder {
  id: string;
  user_id: string;
  reminder_type: string;
  trigger_entity_type?: string;
  trigger_entity_id?: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_for: string;
  delivered_at?: string;
  read_at?: string;
  action_taken: boolean;
  action_type?: string;
  snooze_until?: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useProactiveReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ProactiveReminder[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('proactive_reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .or('snooze_until.is.null,snooze_until.lt.now()')
        .order('scheduled_for', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching proactive reminders:', error);
        return;
      }

      const activeReminders = ((data || []) as ProactiveReminder[]).filter(r => r.is_active && !r.action_taken);
      setReminders(activeReminders);
      setUnreadCount(activeReminders.filter(r => !r.read_at).length);
    } catch (err) {
      console.error('Failed to fetch proactive reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('proactive-reminders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proactive_reminders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Proactive reminder update:', payload);
          fetchReminders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchReminders]);

  const markAsRead = async (reminderId: string) => {
    try {
      await supabase
        .from('proactive_reminders')
        .update({ read_at: new Date().toISOString() })
        .eq('id', reminderId);

      setReminders(prev => 
        prev.map(r => r.id === reminderId ? { ...r, read_at: new Date().toISOString() } : r)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark reminder as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('proactive_reminders')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      setReminders(prev => 
        prev.map(r => ({ ...r, read_at: r.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all reminders as read:', err);
    }
  };

  const dismissReminder = async (reminderId: string) => {
    try {
      await supabase
        .from('proactive_reminders')
        .update({ 
          is_active: false,
          action_taken: true,
          action_type: 'dismissed'
        })
        .eq('id', reminderId);

      setReminders(prev => prev.filter(r => r.id !== reminderId));
      setUnreadCount(prev => {
        const reminder = reminders.find(r => r.id === reminderId);
        return reminder && !reminder.read_at ? Math.max(0, prev - 1) : prev;
      });
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
    }
  };

  const snoozeReminder = async (reminderId: string, hours: number = 1) => {
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    try {
      await supabase
        .from('proactive_reminders')
        .update({ 
          snooze_until: snoozeUntil,
          action_type: 'snoozed'
        })
        .eq('id', reminderId);

      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err) {
      console.error('Failed to snooze reminder:', err);
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      await supabase
        .from('proactive_reminders')
        .update({ 
          is_active: false,
          action_taken: true,
          action_type: 'completed'
        })
        .eq('id', reminderId);

      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err) {
      console.error('Failed to complete reminder:', err);
    }
  };

  return {
    reminders,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    dismissReminder,
    snoozeReminder,
    completeReminder,
    refetch: fetchReminders,
  };
}
