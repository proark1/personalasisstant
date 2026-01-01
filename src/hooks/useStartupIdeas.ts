import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StartupIdea {
  id: string;
  user_id: string;
  workspace_id?: string;
  name: string;
  description?: string;
  problem_statement?: string;
  target_audience?: string;
  unique_value_proposition?: string;
  key_features: string[];
  business_model?: string;
  competitive_advantage?: string;
  status: 'brainstorming' | 'researching' | 'validating' | 'building' | 'launched' | 'archived';
  notes?: string;
  tags: string[];
  ai_insights: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type StartupIdeaInput = Omit<StartupIdea, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useStartupIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<StartupIdea[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all ideas
  const fetchIdeas = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('startup_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setIdeas((data || []) as StartupIdea[]);
    } catch (error) {
      console.error('Error fetching startup ideas:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Create new idea
  const createIdea = useCallback(async (input: Partial<StartupIdeaInput>): Promise<StartupIdea | null> => {
    if (!user?.id || !input.name) return null;

    try {
      const { data, error } = await supabase
        .from('startup_ideas')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description,
          problem_statement: input.problem_statement,
          target_audience: input.target_audience,
          unique_value_proposition: input.unique_value_proposition,
          key_features: input.key_features || [],
          business_model: input.business_model,
          competitive_advantage: input.competitive_advantage,
          status: input.status || 'brainstorming',
          notes: input.notes,
          tags: input.tags || [],
          ai_insights: input.ai_insights || {},
          workspace_id: input.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;
      
      const idea = data as StartupIdea;
      setIdeas(prev => [idea, ...prev]);
      toast.success('Startup idea created');
      return idea;
    } catch (error) {
      console.error('Error creating startup idea:', error);
      toast.error('Failed to create startup idea');
      return null;
    }
  }, [user?.id]);

  // Update idea
  const updateIdea = useCallback(async (id: string, updates: Partial<StartupIdeaInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('startup_ideas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setIdeas(prev => prev.map(idea => 
        idea.id === id ? { ...idea, ...updates, updated_at: new Date().toISOString() } : idea
      ));
      return true;
    } catch (error) {
      console.error('Error updating startup idea:', error);
      toast.error('Failed to update startup idea');
      return false;
    }
  }, []);

  // Delete idea
  const deleteIdea = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('startup_ideas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setIdeas(prev => prev.filter(idea => idea.id !== id));
      toast.success('Startup idea deleted');
      return true;
    } catch (error) {
      console.error('Error deleting startup idea:', error);
      toast.error('Failed to delete startup idea');
      return false;
    }
  }, []);

  // Add AI insights to an idea
  const addAIInsights = useCallback(async (id: string, insights: Record<string, any>): Promise<boolean> => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return false;

    const mergedInsights = { ...idea.ai_insights, ...insights };
    return updateIdea(id, { ai_insights: mergedInsights });
  }, [ideas, updateIdea]);

  // Get ideas by status
  const getIdeasByStatus = useCallback((status: StartupIdea['status']) => {
    return ideas.filter(idea => idea.status === status);
  }, [ideas]);

  // Get ideas for a workspace
  const getIdeasForWorkspace = useCallback((workspaceId: string) => {
    return ideas.filter(idea => idea.workspace_id === workspaceId);
  }, [ideas]);

  useEffect(() => {
    if (user?.id) {
      fetchIdeas();
    }
  }, [user?.id, fetchIdeas]);

  return {
    ideas,
    loading,
    fetchIdeas,
    createIdea,
    updateIdea,
    deleteIdea,
    addAIInsights,
    getIdeasByStatus,
    getIdeasForWorkspace,
  };
}
