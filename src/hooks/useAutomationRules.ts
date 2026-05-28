import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type TriggerType = 
  | 'task_completed'
  | 'habit_logged'
  | 'focus_session_ended'
  | 'prayer_logged'
  | 'checkin_completed'
  | 'goal_progress';

export type ActionType = 
  | 'add_xp'
  | 'create_reminder'
  | 'show_notification'
  | 'log_activity';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  conditionType: string | null;
  conditionConfig: Record<string, unknown>;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

interface CreateRuleInput {
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig?: Record<string, unknown>;
  conditionType?: string;
  conditionConfig?: Record<string, unknown>;
  actionType: ActionType;
  actionConfig?: Record<string, unknown>;
}

export function useAutomationRules() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setRules(data.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          triggerType: rule.trigger_type as TriggerType,
          triggerConfig: (rule.trigger_config as Record<string, unknown>) || {},
          conditionType: rule.condition_type,
          conditionConfig: (rule.condition_config as Record<string, unknown>) || {},
          actionType: rule.action_type as ActionType,
          actionConfig: (rule.action_config as Record<string, unknown>) || {},
          isActive: rule.is_active ?? true,
          executionCount: rule.execution_count ?? 0,
          lastExecutedAt: rule.last_executed_at,
          createdAt: rule.created_at,
        })));
      }
    } catch (error) {
      console.error('Error fetching automation rules:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createRule = useCallback(async (input: CreateRuleInput) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert([{
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          trigger_type: input.triggerType,
          trigger_config: (input.triggerConfig || {}) as Record<string, never>,
          condition_type: input.conditionType || null,
          condition_config: (input.conditionConfig || {}) as Record<string, never>,
          action_type: input.actionType,
          action_config: (input.actionConfig || {}) as Record<string, never>,
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newRule: AutomationRule = {
          id: data.id,
          name: data.name,
          description: data.description,
          triggerType: data.trigger_type as TriggerType,
          triggerConfig: (data.trigger_config as Record<string, unknown>) || {},
          conditionType: data.condition_type,
          conditionConfig: (data.condition_config as Record<string, unknown>) || {},
          actionType: data.action_type as ActionType,
          actionConfig: (data.action_config as Record<string, unknown>) || {},
          isActive: data.is_active ?? true,
          executionCount: data.execution_count ?? 0,
          lastExecutedAt: data.last_executed_at,
          createdAt: data.created_at,
        };

        setRules(prev => [newRule, ...prev]);
        toast.success('Automation rule created!');
        return newRule;
      }
    } catch (error) {
      console.error('Error creating automation rule:', error);
      toast.error('Failed to create automation rule');
      throw error;
    }
  }, [user]);

  const updateRule = useCallback(async (ruleId: string, updates: Partial<CreateRuleInput & { isActive: boolean }>) => {
    if (!user) return;

    try {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.triggerType !== undefined) updateData.trigger_type = updates.triggerType;
      if (updates.triggerConfig !== undefined) updateData.trigger_config = updates.triggerConfig;
      if (updates.conditionType !== undefined) updateData.condition_type = updates.conditionType;
      if (updates.conditionConfig !== undefined) updateData.condition_config = updates.conditionConfig;
      if (updates.actionType !== undefined) updateData.action_type = updates.actionType;
      if (updates.actionConfig !== undefined) updateData.action_config = updates.actionConfig;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { error } = await supabase
        .from('automation_rules')
        .update(updateData)
        .eq('id', ruleId)
        .eq('user_id', user.id);

      if (error) throw error;

      setRules(prev => prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, ...updates }
          : rule
      ));

      toast.success('Automation rule updated!');
    } catch (error) {
      console.error('Error updating automation rule:', error);
      toast.error('Failed to update automation rule');
      throw error;
    }
  }, [user]);

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', user.id);

      if (error) throw error;

      setRules(prev => prev.filter(rule => rule.id !== ruleId));
      toast.success('Automation rule deleted!');
    } catch (error) {
      console.error('Error deleting automation rule:', error);
      toast.error('Failed to delete automation rule');
      throw error;
    }
  }, [user]);

  const toggleRule = useCallback(async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      await updateRule(ruleId, { isActive: !rule.isActive });
    }
  }, [rules, updateRule]);

  const executeRule = useCallback(async (rule: AutomationRule) => {
    if (!user || !rule.isActive) return;

    try {
      // Execute the action based on type
      switch (rule.actionType) {
        case 'add_xp': {
          const xpAmount = (rule.actionConfig.amount as number) || 10;
          // Add XP through gamification hook (would need to be integrated)
          toast.success(`+${xpAmount} XP!`, { description: rule.name });
          break;
        }
        case 'show_notification': {
          const message = (rule.actionConfig.message as string) || 'Automation triggered!';
          toast.info(message);
          break;
        }
        case 'create_reminder':
          // Would create a reminder/notification
          toast.info('Reminder created!');
          break;
        case 'log_activity':
          // Would log to activity feed
          break;
      }

      // Update execution count
      await supabase
        .from('automation_rules')
        .update({
          execution_count: rule.executionCount + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq('id', rule.id);

      setRules(prev => prev.map(r => 
        r.id === rule.id 
          ? { ...r, executionCount: r.executionCount + 1, lastExecutedAt: new Date().toISOString() }
          : r
      ));
    } catch (error) {
      console.error('Error executing automation rule:', error);
    }
  }, [user]);

  const checkTrigger = useCallback((triggerType: TriggerType, context?: Record<string, unknown>) => {
    const matchingRules = rules.filter(rule => 
      rule.isActive && rule.triggerType === triggerType
    );

    matchingRules.forEach(rule => {
      // Check conditions if any
      if (rule.conditionType) {
        // Implement condition checking logic here
        // For now, we'll execute all matching rules
      }
      executeRule(rule);
    });
  }, [rules, executeRule]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    checkTrigger,
    fetchRules,
  };
}
