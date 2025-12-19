import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface FamilyEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: string;
  related_member_id: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  is_all_day: boolean;
  recurrence_rule: string | null;
  reminder_before: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FamilyEventInsert = Omit<FamilyEvent, 'id' | 'created_at' | 'updated_at'>;
export type FamilyEventUpdate = Partial<FamilyEventInsert>;

export function useFamilyEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('family_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error fetching family events:', error);
      toast.error('Failed to load family events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const addEvent = async (event: Omit<FamilyEventInsert, 'user_id'>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('family_events')
        .insert({
          ...event,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setEvents(prev => [...prev, data].sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
      toast.success('Family event added');
      return data;
    } catch (error: any) {
      console.error('Error adding family event:', error);
      toast.error('Failed to add event');
      return null;
    }
  };

  const updateEvent = async (id: string, updates: FamilyEventUpdate) => {
    try {
      const { data, error } = await supabase
        .from('family_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setEvents(prev => prev.map(e => e.id === id ? data : e));
      toast.success('Event updated');
      return data;
    } catch (error: any) {
      console.error('Error updating family event:', error);
      toast.error('Failed to update event');
      return null;
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('family_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEvents(prev => prev.filter(e => e.id !== id));
      toast.success('Event deleted');
      return true;
    } catch (error: any) {
      console.error('Error deleting family event:', error);
      toast.error('Failed to delete event');
      return false;
    }
  };

  // Filter helpers
  const getUpcomingEvents = (days: number = 7) => {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate >= now && eventDate <= endDate;
    });
  };

  const getEventsByType = (type: string) => events.filter(e => e.event_type === type);
  
  const getEventsByMember = (memberId: string) => events.filter(e => e.related_member_id === memberId);

  const getTodayEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return events.filter(e => {
      const eventDate = new Date(e.start_time);
      return eventDate >= today && eventDate < tomorrow;
    });
  };

  return {
    events,
    isLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,
    getEventsByType,
    getEventsByMember,
    getTodayEvents,
    refetch: fetchEvents,
  };
}
