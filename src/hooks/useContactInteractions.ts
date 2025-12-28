import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InteractionType = 'call' | 'email' | 'meeting' | 'message' | 'contact';

export interface ContactInteraction {
  id: string;
  userId: string;
  contactId: string;
  interactionType: InteractionType;
  interactionDate: Date;
  notes?: string;
  durationMinutes?: number;
  createdAt: Date;
}

export function useContactInteractions(userId: string | undefined) {
  const [loading, setLoading] = useState(false);

  const addInteraction = useCallback(async (
    contactId: string,
    type: InteractionType,
    notes?: string,
    durationMinutes?: number
  ): Promise<ContactInteraction | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('contact_interactions')
      .insert({
        user_id: userId,
        contact_id: contactId,
        interaction_type: type,
        notes: notes || null,
        duration_minutes: durationMinutes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding interaction:', error);
      return null;
    }

    // Update interaction count on contact (simple increment)
    try {
      const { data: contact } = await supabase
        .from('user_contacts')
        .select('interaction_count')
        .eq('id', contactId)
        .single();
      
      await supabase
        .from('user_contacts')
        .update({ interaction_count: ((contact?.interaction_count as number) || 0) + 1 })
        .eq('id', contactId);
    } catch (e) {
      console.log('Could not update interaction count');
    }

    return {
      id: data.id,
      userId: data.user_id,
      contactId: data.contact_id,
      interactionType: data.interaction_type as InteractionType,
      interactionDate: new Date(data.interaction_date),
      notes: data.notes || undefined,
      durationMinutes: data.duration_minutes || undefined,
      createdAt: new Date(data.created_at),
    };
  }, [userId]);

  const getInteractions = useCallback(async (contactId: string): Promise<ContactInteraction[]> => {
    if (!userId) return [];

    setLoading(true);
    const { data, error } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('interaction_date', { ascending: false })
      .limit(50);

    setLoading(false);

    if (error) {
      console.error('Error fetching interactions:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      contactId: row.contact_id,
      interactionType: row.interaction_type as InteractionType,
      interactionDate: new Date(row.interaction_date),
      notes: row.notes || undefined,
      durationMinutes: row.duration_minutes || undefined,
      createdAt: new Date(row.created_at),
    }));
  }, [userId]);

  const getRecentContacts = useCallback(async (limit: number = 10): Promise<string[]> => {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('contact_interactions')
      .select('contact_id')
      .eq('user_id', userId)
      .order('interaction_date', { ascending: false })
      .limit(limit * 2); // Get more to dedupe

    if (error) {
      console.error('Error fetching recent contacts:', error);
      return [];
    }

    // Dedupe and limit
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of data || []) {
      if (!seen.has(row.contact_id)) {
        seen.add(row.contact_id);
        result.push(row.contact_id);
        if (result.length >= limit) break;
      }
    }
    return result;
  }, [userId]);

  return {
    loading,
    addInteraction,
    getInteractions,
    getRecentContacts,
  };
}
