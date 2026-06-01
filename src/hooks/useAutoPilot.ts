import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AutoAction {
  id: string;
  actionType: string;
  entityType: string | null;
  entityId: string | null;
  actionData: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export function useAutoPilot() {
  const { user } = useAuth();
  const [actions, setActions] = useState<AutoAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchPendingActions = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('auto_actions_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActions((data || []).map(a => ({
        id: a.id,
        actionType: a.action_type,
        entityType: a.entity_type,
        entityId: a.entity_id,
        actionData: a.action_data as Record<string, unknown>,
        reason: a.reason,
        status: a.status as AutoAction['status'],
        approvedAt: a.approved_at,
        rejectedAt: a.rejected_at,
        createdAt: a.created_at,
      })));
    } catch (err) {
      console.error('Error fetching auto actions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const runAutoPilot = useCallback(async (autoApply = false) => {
    if (!user?.id) return;
    
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-pilot', {
        body: { userId: user.id, autoApply }
      });

      if (error) throw error;
      
      await fetchPendingActions();
      
      if (data?.actionsCount > 0) {
        toast.success(`Found ${data.actionsCount} suggested action(s)`);
      } else {
        toast.info('No actions needed right now');
      }
      
      return data;
    } catch (err) {
      console.error('Error running auto-pilot:', err);
      toast.error(await describeEdgeError(err, 'Failed to run auto-pilot'));
      throw err;
    } finally {
      setRunning(false);
    }
  }, [user?.id, fetchPendingActions]);

  const approveAction = useCallback(async (actionId: string) => {
    if (!user?.id) return;
    
    const action = actions.find(a => a.id === actionId);
    if (!action) return;

    try {
      // Update the action status
      const { error: updateError } = await supabase
        .from('auto_actions_log')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Execute the action based on type
      if (action.actionType === 'reschedule_task' && action.entityId) {
        const suggestedDate = action.actionData.suggestedDueDate as string;
        await supabase
          .from('tasks')
          .update({ due_date: suggestedDate })
          .eq('id', action.entityId);
        toast.success('Task rescheduled');
      } else if (action.actionType === 'create_followup') {
        const taskData = action.actionData;
        await supabase.from('tasks').insert({
          user_id: user.id,
          title: taskData.suggestedTaskTitle as string,
          category: taskData.suggestedCategory as string || 'business',
          priority: 'medium',
          completed: false,
          trashed: false,
        });
        toast.success('Follow-up task created');
      }
      
      setActions(prev => prev.filter(a => a.id !== actionId));
    } catch (err) {
      console.error('Error approving action:', err);
      toast.error(await describeEdgeError(err, 'Failed to approve action'));
    }
  }, [user?.id, actions]);

  const rejectAction = useCallback(async (actionId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('auto_actions_log')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString()
        })
        .eq('id', actionId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setActions(prev => prev.filter(a => a.id !== actionId));
      toast.info('Action dismissed');
    } catch (err) {
      console.error('Error rejecting action:', err);
    }
  }, [user?.id]);

  const approveAll = useCallback(async () => {
    for (const action of actions) {
      await approveAction(action.id);
    }
  }, [actions, approveAction]);

  useEffect(() => {
    fetchPendingActions();
  }, [fetchPendingActions]);

  return {
    actions,
    loading,
    running,
    fetchPendingActions,
    runAutoPilot,
    approveAction,
    rejectAction,
    approveAll,
  };
}
