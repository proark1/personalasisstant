import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { fetchWithRetry } from '@/lib/fetchWithTimeout';
import { moduleBus } from '@/lib/moduleEventBus';
import { moduleHealth } from '@/lib/moduleHealth';
import { subscribeToTable } from '@/lib/realtimeCoordinator';
import { Task, CalendarEvent, TaskCategory, TaskPriority, TaskStatus } from '@/types/flux';

interface DbTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
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

const EMPTY_TASKS: Task[] = [];
const EMPTY_EVENTS: CalendarEvent[] = [];

export function useDatabase(userId: string | undefined) {
  const queryClient = useQueryClient();

  // Convert DB task to app Task
  const dbTaskToTask = (dbTask: DbTask): Task => ({
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || undefined,
    category: dbTask.category as TaskCategory,
    priority: dbTask.priority as TaskPriority,
    status: (dbTask.status as TaskStatus) || 'backlog',
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

  // Shared queries: tasks, trashed tasks, and events each live under their own
  // key so every consumer dedupes onto one cached entry and the cacheCoordinator
  // ['tasks']/['events'] invalidations take effect.
  const tasksQuery = useQuery({
    queryKey: ['tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId!)
        .eq('trashed', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) { moduleHealth.reportError('tasks', error); throw error; }
      moduleHealth.reportSuccess('tasks');
      return (data ?? []).map(dbTaskToTask);
    },
  });

  const trashedQuery = useQuery({
    queryKey: ['trashed-tasks', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId!)
        .eq('trashed', true)
        .order('trashed_at', { ascending: false });
      if (error) { moduleHealth.reportError('tasks', error); throw error; }
      return (data ?? []).map(dbTaskToTask);
    },
  });

  const eventsQuery = useQuery({
    queryKey: ['events', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId!)
        .order('start_time', { ascending: true });
      if (error) { moduleHealth.reportError('events', error); throw error; }
      moduleHealth.reportSuccess('events');
      return (data ?? []).map(dbEventToEvent);
    },
  });

  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const trashedTasks = trashedQuery.data ?? EMPTY_TASKS;
  const events = eventsQuery.data ?? EMPTY_EVENTS;
  const loading = tasksQuery.isLoading || eventsQuery.isLoading;

  const setTasksCache = useCallback(
    (updater: (prev: Task[]) => Task[]) =>
      queryClient.setQueryData<Task[]>(['tasks', userId], (prev) => updater(prev ?? [])),
    [queryClient, userId],
  );
  const setTrashedCache = useCallback(
    (updater: (prev: Task[]) => Task[]) =>
      queryClient.setQueryData<Task[]>(['trashed-tasks', userId], (prev) => updater(prev ?? [])),
    [queryClient, userId],
  );
  const setEventsCache = useCallback(
    (updater: (prev: CalendarEvent[]) => CalendarEvent[]) =>
      queryClient.setQueryData<CalendarEvent[]>(['events', userId], (prev) => updater(prev ?? [])),
    [queryClient, userId],
  );

  // Subscribe to realtime changes via the shared coordinator. Row changes
  // invalidate the affected query (which refetches) instead of refetching all.
  useEffect(() => {
    if (!userId) return;
    const offTasks = subscribeToTable('tasks', userId, () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['trashed-tasks', userId] });
    });
    const offEvents = subscribeToTable('events', userId, () => {
      queryClient.invalidateQueries({ queryKey: ['events', userId] });
    });
    return () => {
      offTasks();
      offEvents();
    };
  }, [userId, queryClient]);

  const refetch = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['tasks', userId] }),
      queryClient.refetchQueries({ queryKey: ['trashed-tasks', userId] }),
      queryClient.refetchQueries({ queryKey: ['events', userId] }),
    ]);
  }, [queryClient, userId]);

  // Task operations
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> => {
    if (!userId) throw new Error('Not authenticated');

    const insertData = {
      user_id: userId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: task.status || 'backlog',
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
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Task create failed');

    const newTask = dbTaskToTask(data as unknown as DbTask);
    setTasksCache(prev => [newTask, ...prev]);
    moduleBus.emit('task:created', { taskId: newTask.id, projectId: newTask.projectId }, 'useDatabase');
    return newTask;
  }, [userId, setTasksCache]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const safeJson = (value: unknown) => {
      if (value === undefined) return undefined;
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return value;
      }
    };

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
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
    if (updates.checklist !== undefined) dbUpdates.checklist = safeJson(updates.checklist);
    if (updates.attachments !== undefined) dbUpdates.attachments = safeJson(updates.attachments);
    if (updates.comments !== undefined) dbUpdates.comments = safeJson(updates.comments);

    const runUpdate = async () => {
      const result = await supabase
        .from('tasks')
        .update(dbUpdates as TablesUpdate<'tasks'>)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return result;
    };

    // Use fetchWithRetry with exponential backoff for network resilience
    const { data, error } = await fetchWithRetry(runUpdate, {
      maxRetries: 3,
      timeoutMs: 15000,
      onRetry: (attempt) => {
        console.log(`[updateTask] Retry attempt ${attempt} for task ${id}`);
      },
    });

    if (error) throw error;
    if (!data) throw new Error('Task update not permitted or task not found');

    setTasksCache(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    if (updates.completed === true) {
      moduleBus.emit('task:completed', { taskId: id }, 'useDatabase');
    } else {
      moduleBus.emit('task:updated', { taskId: id, fields: Object.keys(updates) }, 'useDatabase');
    }
  }, [setTasksCache]);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTasksCache(prev => prev.filter(t => t.id !== id));
      setTrashedCache(prev => prev.filter(t => t.id !== id));
      moduleBus.emit('task:deleted', { taskId: id }, 'useDatabase');
    }
  }, [setTasksCache, setTrashedCache]);

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
        setTasksCache(prev => prev.filter(t => t.id !== id));
        setTrashedCache(prev => [trashedTask, ...prev]);
        moduleBus.emit('task:trashed', { taskId: id }, 'useDatabase');
      }
    }
    return { error };
  }, [tasks, setTasksCache, setTrashedCache]);

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
        setTrashedCache(prev => prev.filter(t => t.id !== id));
        setTasksCache(prev => [restoredTask, ...prev]);
      }
    }
    return { error };
  }, [trashedTasks, setTasksCache, setTrashedCache]);

  // Permanently delete a trashed task
  const permanentlyDeleteTask = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTrashedCache(prev => prev.filter(t => t.id !== id));
    }
    return { error };
  }, [setTrashedCache]);

  // Empty entire trash
  const emptyTrash = useCallback(async () => {
    const trashedIds = trashedTasks.map(t => t.id);
    if (trashedIds.length === 0) return { error: null };

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', trashedIds);

    if (!error) {
      setTrashedCache(() => []);
    }
    return { error };
  }, [trashedTasks, setTrashedCache]);

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
      setTasksCache(prev => prev.filter(t => !ids.includes(t.id)));
      return { error: null };
    }
    return { error: 'Failed to delete some tasks' };
  }, [setTasksCache]);

  const toggleTaskComplete = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  }, [tasks, updateTask]);

  const reorderTasks = useCallback(async (taskOrders: { id: string; sortOrder: number }[]) => {
    // Update local state immediately for optimistic UI
    setTasksCache(prev => {
      const newTasks = [...prev];
      taskOrders.forEach(({ id, sortOrder }) => {
        const task = newTasks.find(t => t.id === id);
        if (task) task.sortOrder = sortOrder;
      });
      return newTasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });

    // Update in database — fire the per-row updates in parallel instead of
    // awaiting them one sequential round-trip at a time.
    await Promise.all(
      taskOrders.map(({ id, sortOrder }) =>
        supabase.from('tasks').update({ sort_order: sortOrder }).eq('id', id),
      ),
    );
  }, [setTasksCache]);

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
      setEventsCache(prev => [...prev, newEvent].sort((a, b) =>
        a.startTime.getTime() - b.startTime.getTime()
      ));
      moduleBus.emit('event:created', { eventId: newEvent.id }, 'useDatabase');
      return newEvent;
    }
    return null;
  }, [userId, setEventsCache]);

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
      .update(dbUpdates as TablesUpdate<'events'>)
      .eq('id', id);

    if (!error) {
      setEventsCache(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      moduleBus.emit('event:updated', { eventId: id, fields: Object.keys(updates) }, 'useDatabase');
    }
  }, [setEventsCache]);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (!error) {
      setEventsCache(prev => prev.filter(e => e.id !== id));
      moduleBus.emit('event:deleted', { eventId: id }, 'useDatabase');
    }
  }, [setEventsCache]);

  // Sharing operations
  const shareItem = useCallback(async (
    itemType: 'task' | 'event' | 'contract' | 'contact',
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

  const getSharedWith = useCallback(async (itemType: 'task' | 'event' | 'contract' | 'contact', itemId: string) => {
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
    refetch,
  };
}
