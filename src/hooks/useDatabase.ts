import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, CalendarEvent, TaskCategory, TaskPriority } from '@/types/flux';

interface DbTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DbEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  attendees: string[] | null;
  created_at: string;
  updated_at: string;
}

interface SharedItem {
  id: string;
  item_type: 'task' | 'event';
  item_id: string;
  owner_id: string;
  shared_with_id: string;
  permission: 'view' | 'edit';
}

export function useDatabase(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert DB task to app Task
  const dbTaskToTask = (dbTask: DbTask): Task => ({
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || undefined,
    category: dbTask.category as TaskCategory,
    priority: dbTask.priority as TaskPriority,
    completed: dbTask.completed,
    createdAt: new Date(dbTask.created_at),
    dueDate: dbTask.due_date ? new Date(dbTask.due_date) : undefined,
  });

  // Convert DB event to app CalendarEvent
  const dbEventToEvent = (dbEvent: DbEvent): CalendarEvent => ({
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description || undefined,
    startTime: new Date(dbEvent.start_time),
    endTime: new Date(dbEvent.end_time),
    location: dbEvent.location || undefined,
    attendees: dbEvent.attendees || undefined,
  });

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (tasksData) {
      setTasks(tasksData.map(dbTaskToTask));
    }

    // Fetch events
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });
    
    if (eventsData) {
      setEvents(eventsData.map(dbEventToEvent));
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Task operations
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        completed: task.completed,
        due_date: task.dueDate?.toISOString(),
      })
      .select()
      .single();

    if (data && !error) {
      const newTask = dbTaskToTask(data);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    }
    return null;
  }, [userId]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate?.toISOString();

    const { error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, []);

  const toggleTaskComplete = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  }, [tasks, updateTask]);

  // Event operations
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        title: event.title,
        description: event.description,
        start_time: event.startTime.toISOString(),
        end_time: event.endTime.toISOString(),
        location: event.location,
        attendees: event.attendees,
      })
      .select()
      .single();

    if (data && !error) {
      const newEvent = dbEventToEvent(data);
      setEvents(prev => [...prev, newEvent].sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      ));
      return newEvent;
    }
    return null;
  }, [userId]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime.toISOString();
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime.toISOString();
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.attendees !== undefined) dbUpdates.attendees = updates.attendees;

    const { error } = await supabase
      .from('events')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id));
    }
  }, []);

  // Sharing operations
  const shareItem = useCallback(async (
    itemType: 'task' | 'event',
    itemId: string,
    shareWithEmail: string,
    permission: 'view' | 'edit' = 'view'
  ) => {
    if (!userId) return { error: 'Not authenticated' };

    // Find user by email
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', shareWithEmail)
      .single();

    if (!profiles) {
      return { error: 'User not found' };
    }

    const { error } = await supabase
      .from('shared_items')
      .insert({
        item_type: itemType,
        item_id: itemId,
        owner_id: userId,
        shared_with_id: profiles.user_id,
        permission,
      });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, [userId]);

  const getSharedWith = useCallback(async (itemType: 'task' | 'event', itemId: string) => {
    const { data } = await supabase
      .from('shared_items')
      .select(`
        *,
        shared_with:profiles!shared_items_shared_with_id_fkey(email, display_name)
      `)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    return data || [];
  }, []);

  const removeShare = useCallback(async (shareId: string) => {
    const { error } = await supabase
      .from('shared_items')
      .delete()
      .eq('id', shareId);

    return { error };
  }, []);

  return {
    tasks,
    events,
    loading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    addEvent,
    updateEvent,
    deleteEvent,
    shareItem,
    getSharedWith,
    removeShare,
    refetch: fetchData,
  };
}
