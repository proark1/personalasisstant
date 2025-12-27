import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StartupWorkspace {
  id: string;
  name: string;
  workspace_type: string;
  description?: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface StartupMetric {
  id: string;
  workspace_id: string;
  metric_name: string;
  metric_value: number;
  metric_date: string;
  notes?: string;
  created_at: string;
}

const DEFAULT_WORKSPACES = [
  { name: 'Gaming Startup', workspace_type: 'gaming', color: '#8b5cf6', icon: 'gamepad' },
  { name: 'AI Startup', workspace_type: 'ai', color: '#06b6d4', icon: 'brain' },
  { name: 'Growth Agency', workspace_type: 'agency', color: '#f59e0b', icon: 'trending-up' },
];

export function useStartupWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<StartupWorkspace[]>([]);
  const [metrics, setMetrics] = useState<StartupMetric[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('startup_workspaces')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // If no workspaces exist, create defaults
      if (!data || data.length === 0) {
        await createDefaultWorkspaces();
        return;
      }
      
      setWorkspaces(data as StartupWorkspace[]);
      if (!activeWorkspace && data.length > 0) {
        setActiveWorkspace(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  }, [user?.id, activeWorkspace]);

  // Create default workspaces
  const createDefaultWorkspaces = async () => {
    if (!user?.id) return;
    
    try {
      const insertData = DEFAULT_WORKSPACES.map(w => ({
        ...w,
        user_id: user.id,
        is_active: true,
      }));
      
      const { data, error } = await supabase
        .from('startup_workspaces')
        .insert(insertData)
        .select();

      if (error) throw error;
      setWorkspaces((data || []) as StartupWorkspace[]);
      if (data && data.length > 0) {
        setActiveWorkspace(data[0].id);
      }
    } catch (error) {
      console.error('Error creating default workspaces:', error);
    }
  };

  // Fetch metrics
  const fetchMetrics = useCallback(async (workspaceId?: string) => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('startup_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('metric_date', { ascending: false })
        .limit(100);
      
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMetrics((data || []) as StartupMetric[]);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [user?.id]);

  // Add workspace
  const addWorkspace = async (workspace: Omit<StartupWorkspace, 'id' | 'created_at' | 'is_active'>) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('startup_workspaces')
        .insert({ ...workspace, user_id: user.id, is_active: true })
        .select()
        .single();

      if (error) throw error;
      await fetchWorkspaces();
      toast.success('Workspace created');
      return data as StartupWorkspace;
    } catch (error) {
      console.error('Error adding workspace:', error);
      toast.error('Failed to create workspace');
      return null;
    }
  };

  // Update workspace
  const updateWorkspace = async (id: string, updates: Partial<StartupWorkspace>) => {
    try {
      const { error } = await supabase
        .from('startup_workspaces')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchWorkspaces();
      toast.success('Workspace updated');
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast.error('Failed to update workspace');
    }
  };

  // Delete (archive) workspace
  const deleteWorkspace = async (id: string) => {
    try {
      const { error } = await supabase
        .from('startup_workspaces')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchWorkspaces();
      toast.success('Workspace archived');
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error('Failed to archive workspace');
    }
  };

  // Add metric
  const addMetric = async (metric: Omit<StartupMetric, 'id' | 'created_at'>) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('startup_metrics')
        .insert({ ...metric, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      await fetchMetrics(metric.workspace_id);
      toast.success('Metric added');
      return data as StartupMetric;
    } catch (error) {
      console.error('Error adding metric:', error);
      toast.error('Failed to add metric');
      return null;
    }
  };

  // Get metrics for a workspace
  const getWorkspaceMetrics = (workspaceId: string) => {
    return metrics.filter(m => m.workspace_id === workspaceId);
  };

  // Get latest metric value
  const getLatestMetric = (workspaceId: string, metricName: string) => {
    const workspaceMetrics = metrics
      .filter(m => m.workspace_id === workspaceId && m.metric_name === metricName)
      .sort((a, b) => new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime());
    return workspaceMetrics[0];
  };

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      Promise.all([fetchWorkspaces(), fetchMetrics()]).finally(() => setLoading(false));
    }
  }, [user?.id, fetchWorkspaces, fetchMetrics]);

  return {
    workspaces,
    metrics,
    activeWorkspace,
    setActiveWorkspace,
    loading,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addMetric,
    getWorkspaceMetrics,
    getLatestMetric,
    refetch: () => Promise.all([fetchWorkspaces(), fetchMetrics()]),
  };
}
