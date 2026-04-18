import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AgentAction {
  id: string;
  actionType: string;
  entityType: string | null;
  reason: string;
  actionData: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  createdAt: string;
}

/**
 * Manages Dori-queued actions awaiting user approval.
 * Pulls from auto_actions_log (status='pending') with realtime updates.
 */
export function useAgentActions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('auto_actions_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setActions(data.map(a => ({
        id: a.id,
        actionType: a.action_type,
        entityType: a.entity_type,
        reason: a.reason,
        actionData: (a.action_data as Record<string, unknown>) || {},
        status: a.status as AgentAction['status'],
        createdAt: a.created_at,
      })));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`agent-actions-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auto_actions_log',
        filter: `user_id=eq.${user.id}`,
      }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  const approve = useCallback(async (actionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('dori-execute-action', {
        body: { actionId, decision: 'approve' },
      });
      if (error) throw error;
      toast.success('Action approved');
      setActions(prev => prev.filter(a => a.id !== actionId));
      return data;
    } catch (e) {
      console.error('approve action failed', e);
      toast.error('Failed to approve');
    }
  }, []);

  const reject = useCallback(async (actionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('dori-execute-action', {
        body: { actionId, decision: 'reject' },
      });
      if (error) throw error;
      toast.info('Action rejected');
      setActions(prev => prev.filter(a => a.id !== actionId));
    } catch (e) {
      console.error('reject action failed', e);
      toast.error('Failed to reject');
    }
  }, []);

  return { actions, loading, refresh, approve, reject, count: actions.length };
}
