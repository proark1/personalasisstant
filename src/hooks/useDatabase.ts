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
  recurrence_rule: string | null;
  recurrence_end: string | null;
  parent_id: string | null;
  sort_order: number | null;
  reminder_before: number | null;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  main_responsible_id: string | null;
  secondary_responsible_id: string | null;
  checklist: unknown;
  attachments: unknown;
  comments: unknown;
  trashed: boolean;
  trashed_at: string | null;
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
  recurrence_rule: string | null;
  recurrence_end: string | null;
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
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
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
    recurrenceRule: dbTask.recurrence_rule || undefined,
    recurrenceEnd: dbTask.recurrence_end ? new Date(dbTask.recurrence_end) : undefined,
    parentId: dbTask.parent_id || undefined,
    sortOrder: dbTask.sort_order ?? 0,
    reminderBefore: dbTask.reminder_before ?? undefined,
    projectId: dbTask.project_id || undefined,
    mainResponsibleId: dbTask.main_responsible_id || undefined,
    secondaryResponsibleId: dbTask.secondary_responsible_id || undefined,
    checklist: (dbTask.checklist as Task['checklist']) || [],
    attachments: (dbTask.attachments as Task['attachments']) || [],
    comments: (dbTask.comments as Task['comments']) || [],
    trashed: dbTask.trashed,
    trashedAt: dbTask.trashed_at ? new Date(dbTask.trashed_at) : undefined,
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
    recurrenceRule: dbEvent.recurrence_rule || undefined,
    recurrenceEnd: dbEvent.recurrence_end ? new Date(dbEvent.recurrence_end) : undefined,
  });

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setTrashedTasks([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch active tasks (not trashed)
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('trashed', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (tasksData) {
      setTasks(tasksData.map(dbTaskToTask));
    }

    // Fetch trashed tasks
    const { data: trashedData } = await supabase
      .from('tasks')
      .select('*')
      .eq('trashed', true)
      .order('trashed_at', { ascending: false });
    
    if (trashedData) {
      setTrashedTasks(trashedData.map(dbTaskToTask));
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

  // Subscribe to realtime changes for tasks and events
  useEffect(() => {
    if (!userId) return;

    console.log('[useDatabase] Setting up realtime subscriptions for user:', userId);

    const channel = supabase
      .channel('tasks-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          console.log('[useDatabase] Tasks realtime change:', payload.eventType, payload);
          // Refetch to get updated data
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('[useDatabase] Events realtime change:', payload.eventType, payload);
          // Refetch to get updated data
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('[useDatabase] Realtime subscription status:', status);
      });

    return () => {
      console.log('[useDatabase] Cleaning up realtime subscriptions');
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  // Task operations
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> => {
    if (!userId) return null;

    const insertData = {
      user_id: userId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      completed: task.completed,
      due_date: task.dueDate?.toISOString(),
      recurrence_rule: task.recurrenceRule,
      recurrence_end: task.recurrenceEnd?.toISOString(),
      parent_id: task.parentId,
      sort_order: task.sortOrder ?? 0,
      reminder_before: task.reminderBefore,
      project_id: task.projectId,
      main_responsible_id: task.mainResponsibleId,
      secondary_responsible_id: task.secondaryResponsibleId,
      checklist: JSON.parse(JSON.stringify(task.checklist || [])),
      attachments: JSON.parse(JSON.stringify(task.attachments || [])),
      comments: JSON.parse(JSON.stringify(task.comments || [])),
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert([insertData] as any)
      .select()
      .single();

    if (data && !error) {
      const newTask = dbTaskToTask(data as unknown as DbTask);
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
    if (updates.recurrenceRule !== undefined) dbUpdates.recurrence_rule = updates.recurrenceRule;
    if (updates.recurrenceEnd !== undefined) dbUpdates.recurrence_end = updates.recurrenceEnd?.toISOString();
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.reminderBefore !== undefined) dbUpdates.reminder_before = updates.reminderBefore;
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.mainResponsibleId !== undefined) dbUpdates.main_responsible_id = updates.mainResponsibleId;
    if (updates.secondaryResponsibleId !== undefined) dbUpdates.secondary_responsible_id = updates.secondaryResponsibleId;
    if (updates.checklist !== undefined) dbUpdates.checklist = updates.checklist;
    if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;
    if (updates.comments !== undefined) dbUpdates.comments = updates.comments;

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
      setTrashedTasks(prev => prev.filter(t => t.id !== id));
    }
  }, []);

  // Move task to trash (soft delete)
  const trashTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ trashed: true, trashed_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        const trashedTask = { ...task, trashed: true, trashedAt: new Date() };
        setTasks(prev => prev.filter(t => t.id !== id));
        setTrashedTasks(prev => [trashedTask, ...prev]);
      }
    }
    return { error };
  }, [tasks]);

  // Restore task from trash
  const restoreTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ trashed: false, trashed_at: null })
      .eq('id', id);

    if (!error) {
      const task = trashedTasks.find(t => t.id === id);
      if (task) {
        const restoredTask = { ...task, trashed: false, trashedAt: undefined };
        setTrashedTasks(prev => prev.filter(t => t.id !== id));
        setTasks(prev => [restoredTask, ...prev]);
      }
    }
    return { error };
  }, [trashedTasks]);

  // Permanently delete a trashed task
  const permanentlyDeleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTrashedTasks(prev => prev.filter(t => t.id !== id));
    }
    return { error };
  }, []);

  // Empty entire trash
  const emptyTrash = useCallback(async () => {
    const trashedIds = trashedTasks.map(t => t.id);
    if (trashedIds.length === 0) return { error: null };

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', trashedIds);

    if (!error) {
      setTrashedTasks([]);
    }
    return { error };
  }, [trashedTasks]);

  const deleteTasks = useCallback(async (ids: string[]): Promise<{ error: string | null }> => {
    if (ids.length === 0) return { error: null };
    
    // Supabase has limits on IN queries, batch delete in chunks of 100
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    let hasError = false;
    for (const batch of batches) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error('Error deleting tasks batch:', error);
        hasError = true;
      }
    }

    if (!hasError) {
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      return { error: null };
    }
    return { error: 'Failed to delete some tasks' };
  }, []);

  const toggleTaskComplete = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  }, [tasks, updateTask]);

  const reorderTasks = useCallback(async (taskOrders: { id: string; sortOrder: number }[]) => {
    // Update local state immediately for optimistic UI
    setTasks(prev => {
      const newTasks = [...prev];
      taskOrders.forEach(({ id, sortOrder }) => {
        const task = newTasks.find(t => t.id === id);
        if (task) task.sortOrder = sortOrder;
      });
      return newTasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    // Update in database
    for (const { id, sortOrder } of taskOrders) {
      await supabase.from('tasks').update({ sort_order: sortOrder }).eq('id', id);
    }
  }, []);

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
        recurrence_rule: event.recurrenceRule,
        recurrence_end: event.recurrenceEnd?.toISOString(),
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
    if (updates.recurrenceRule !== undefined) dbUpdates.recurrence_rule = updates.recurrenceRule;
    if (updates.recurrenceEnd !== undefined) dbUpdates.recurrence_end = updates.recurrenceEnd?.toISOString();

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
    if (!userId) return { error: 'Not authenticated. Please log in to share items.' };

    const normalizedEmail = shareWithEmail.trim().toLowerCase();

    // Find user by email (case-insensitive)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      return { error: 'Failed to look up user. Please try again.' };
    }

    if (!profiles) {
      return { error: `No account found with email "${shareWithEmail}". Make sure the user has registered and the email is correct.` };
    }

    // Prevent sharing with yourself
    if (profiles.user_id === userId) {
      return { error: "You can't share an item with yourself." };
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
      // Check for duplicate share
      if (error.code === '23505') {
        return { error: `This ${itemType} is already shared with ${profiles.email}.` };
      }
      return { error: `Failed to share: ${error.message}` };
    }

    return { error: null };
  }, [userId]);

  const getSharedWith = useCallback(async (itemType: 'task' | 'event', itemId: string) => {
    // Fetch shared items first
    const { data: sharedItems } = await supabase
      .from('shared_items')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (!sharedItems || sharedItems.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(sharedItems.map(item => item.shared_with_id))];

    // Fetch profile info for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', userIds);

    // Map profiles to shared items
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    return sharedItems.map(item => ({
      ...item,
      shared_with: profileMap.get(item.shared_with_id) || null,
    }));
  }, []);

  const removeShare = useCallback(async (shareId: string) => {
    const { error } = await supabase
      .from('shared_items')
      .delete()
      .eq('id', shareId);

    return { error };
  }, []);

  // Get unique contacts the user has shared items with before
  const getRecentContacts = useCallback(async () => {
    if (!userId) return [];

    const { data } = await supabase
      .from('shared_items')
      .select('shared_with_id')
      .eq('owner_id', userId);

    if (!data || data.length === 0) return [];

    // Get unique user IDs
    const uniqueUserIds = [...new Set(data.map(item => item.shared_with_id))];

    // Fetch profile info for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', uniqueUserIds);

    return profiles?.map(p => ({
      userId: p.user_id,
      email: p.email || '',
      displayName: p.display_name || undefined,
    })) || [];
  }, [userId]);

  // Fetch items shared with the current user
  const fetchSharedWithMe = useCallback(async () => {
    if (!userId) return { sharedTasks: [], sharedEvents: [] };

    // Fetch shared items where current user is the recipient
    const { data: sharedItems } = await supabase
      .from('shared_items')
      .select('*')
      .eq('shared_with_id', userId);

    if (!sharedItems || sharedItems.length === 0) {
      return { sharedTasks: [], sharedEvents: [] };
    }

    // Get unique owner IDs and fetch their profiles
    const ownerIds = [...new Set(sharedItems.map(item => item.owner_id))];
    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', ownerIds);

    // Create a map of owner_id -> profile info
    const profileMap = new Map<string, { displayName?: string; email?: string }>();
    ownerProfiles?.forEach(profile => {
      profileMap.set(profile.user_id, {
        displayName: profile.display_name || undefined,
        email: profile.email || undefined,
      });
    });

    // Create a map of item_id -> owner info
    const ownerMap = new Map<string, { displayName?: string; email?: string }>();
    sharedItems.forEach(item => {
      ownerMap.set(item.item_id, profileMap.get(item.owner_id) || {});
    });

    const taskIds = sharedItems.filter(s => s.item_type === 'task').map(s => s.item_id);
    const eventIds = sharedItems.filter(s => s.item_type === 'event').map(s => s.item_id);

    let sharedTasks: Task[] = [];
    let sharedEvents: CalendarEvent[] = [];

    if (taskIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .in('id', taskIds);
      
      if (tasksData) {
        sharedTasks = tasksData.map(t => ({
          ...dbTaskToTask(t),
          sharedBy: ownerMap.get(t.id),
        }));
      }
    }

    if (eventIds.length > 0) {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds);
      
      if (eventsData) {
        sharedEvents = eventsData.map(e => ({
          ...dbEventToEvent(e),
          sharedBy: ownerMap.get(e.id),
        }));
      }
    }

    return { sharedTasks, sharedEvents };
  }, [userId]);

  return {
    tasks,
    trashedTasks,
    events,
    loading,
    addTask,
    updateTask,
    deleteTask,
    deleteTasks,
    trashTask,
    restoreTask,
    permanentlyDeleteTask,
    emptyTrash,
    toggleTaskComplete,
    reorderTasks,
    addEvent,
    updateEvent,
    deleteEvent,
    shareItem,
    getSharedWith,
    removeShare,
    getRecentContacts,
    fetchSharedWithMe,
    refetch: fetchData,
  };
}
