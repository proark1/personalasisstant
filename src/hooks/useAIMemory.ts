import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { moduleBus } from '@/lib/moduleEventBus';
import { useAuth } from './useAuth';

export interface AIMemory {
  id: string;
  memoryType: 'preference' | 'goal' | 'fact' | 'pattern' | 'milestone';
  category: string | null;
  key: string;
  value: string;
  context: string | null;
  confidence: number;
  source: 'chat' | 'behavior' | 'explicit' | 'inferred';
  lastReferencedAt: string | null;
  referenceCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAIMemory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMemories = useCallback(async (category?: string) => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('ai_memory')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('reference_count', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      setMemories((data || []).map(m => ({
        id: m.id,
        memoryType: m.memory_type as AIMemory['memoryType'],
        category: m.category,
        key: m.key,
        value: m.value,
        context: m.context,
        confidence: m.confidence,
        source: m.source as AIMemory['source'],
        lastReferencedAt: m.last_referenced_at,
        referenceCount: m.reference_count,
        isActive: m.is_active,
        expiresAt: m.expires_at,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })));
    } catch (err) {
      console.error('Error fetching AI memories:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const addMemory = useCallback(async (memory: {
    memoryType: AIMemory['memoryType'];
    category?: string;
    key: string;
    value: string;
    context?: string;
    source?: AIMemory['source'];
    expiresAt?: string;
  }) => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_memory')
        .upsert({
          user_id: user.id,
          memory_type: memory.memoryType,
          category: memory.category,
          key: memory.key,
          value: memory.value,
          context: memory.context,
          source: memory.source || 'explicit',
          expires_at: memory.expiresAt,
        }, {
          onConflict: 'user_id,key',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMemories();
      moduleBus.emit('ai:memory-updated', { memoryId: data?.id, key: memory.key }, 'useAIMemory');
      return data;
    } catch (err) {
      console.error('Error adding memory:', err);
      throw err;
    }
  }, [user?.id, fetchMemories]);

  const updateMemory = useCallback(async (memoryId: string, updates: Partial<{
    value: string;
    confidence: number;
    isActive: boolean;
  }>) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('ai_memory')
        .update({
          value: updates.value,
          confidence: updates.confidence,
          is_active: updates.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchMemories();
      moduleBus.emit('ai:memory-updated', { memoryId }, 'useAIMemory');
    } catch (err) {
      console.error('Error updating memory:', err);
    }
  }, [user?.id, fetchMemories]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('ai_memory')
        .update({ is_active: false })
        .eq('id', memoryId)
        .eq('user_id', user.id);

      if (error) throw error;

      setMemories(prev => prev.filter(m => m.id !== memoryId));
      moduleBus.emit('ai:memory-updated', { memoryId, deleted: true }, 'useAIMemory');
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  }, [user?.id]);

  const recordReference = useCallback(async (memoryId: string) => {
    if (!user?.id) return;
    
    try {
      const memory = memories.find(m => m.id === memoryId);
      if (!memory) return;

      await supabase
        .from('ai_memory')
        .update({
          reference_count: memory.referenceCount + 1,
          last_referenced_at: new Date().toISOString(),
        })
        .eq('id', memoryId)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error recording reference:', err);
    }
  }, [user?.id, memories]);

  const getMemoriesForContext = useCallback(() => {
    // Return formatted memories for AI context
    return memories.map(m => ({
      type: m.memoryType,
      key: m.key,
      value: m.value,
      category: m.category,
    }));
  }, [memories]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  return {
    memories,
    loading,
    fetchMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    recordReference,
    getMemoriesForContext,
  };
}
