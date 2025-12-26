import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface FollowUpItem {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  follow_up_type: string;
  check_at: string;
  message_template: string | null;
  context: Record<string, any>;
  status: 'pending' | 'sent' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function useFollowUpQueue() {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowUps = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'sent'])
        .order('check_at', { ascending: true });

      if (error) throw error;
      setFollowUps((data || []) as FollowUpItem[]);
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('follow_up_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_queue',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchFollowUps()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchFollowUps]);

  const completeFollowUp = async (id: string, response?: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('follow_up_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          context: response ? { response } : undefined,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Follow-up completed');
      fetchFollowUps();
    } catch (err) {
      console.error('Error completing follow-up:', err);
      toast.error('Failed to complete follow-up');
    }
  };

  const dismissFollowUp = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('follow_up_queue')
        .update({ status: 'dismissed' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Follow-up dismissed');
      fetchFollowUps();
    } catch (err) {
      console.error('Error dismissing follow-up:', err);
      toast.error('Failed to dismiss follow-up');
    }
  };

  const snoozeFollowUp = async (id: string, hours: number = 2) => {
    if (!user?.id) return;

    try {
      const newCheckAt = new Date();
      newCheckAt.setHours(newCheckAt.getHours() + hours);

      const { error } = await supabase
        .from('follow_up_queue')
        .update({ check_at: newCheckAt.toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Snoozed for ${hours} hours`);
      fetchFollowUps();
    } catch (err) {
      console.error('Error snoozing follow-up:', err);
      toast.error('Failed to snooze follow-up');
    }
  };

  const createFollowUp = async (
    entityType: string,
    entityId: string,
    followUpType: string,
    checkAt: Date,
    messageTemplate?: string,
    context?: Record<string, any>
  ) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('follow_up_queue')
        .insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          follow_up_type: followUpType,
          check_at: checkAt.toISOString(),
          message_template: messageTemplate,
          context: context || {},
        });

      if (error) throw error;
      fetchFollowUps();
    } catch (err) {
      console.error('Error creating follow-up:', err);
    }
  };

  // Get pending follow-ups that are due
  const dueFollowUps = followUps.filter(f => 
    f.status === 'pending' && new Date(f.check_at) <= new Date()
  );

  return {
    followUps,
    dueFollowUps,
    loading,
    completeFollowUp,
    dismissFollowUp,
    snoozeFollowUp,
    createFollowUp,
    refetch: fetchFollowUps,
  };
}
