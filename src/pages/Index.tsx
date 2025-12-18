import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDatabase } from '@/hooks/useDatabase';
import { useSettings } from '@/hooks/useSettings';
import { useAIChat } from '@/hooks/useAIChat';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useSharedItemsRealtime } from '@/hooks/useSharedItemsRealtime';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useSpaceSharedData } from '@/hooks/useSpaceSharedData';
import { useTags } from '@/hooks/useTags';
import { useProjects } from '@/hooks/useProjects';
import { useSharedProjects } from '@/hooks/useSharedProjects';
import { useWeeklyReview } from '@/hooks/useWeeklyReview';
import { useContacts } from '@/hooks/useContacts';
import { useContactReminders } from '@/hooks/useContactReminders';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useContracts } from '@/hooks/useContracts';
import { useContractReminders } from '@/hooks/useContractReminders';
import { StandardMode } from '@/components/layout/StandardMode';
import { GhostMode } from '@/components/ghost/GhostMode';
import { ProfileSettingsDialog } from '@/components/settings/ProfileSettingsDialog';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { ShareProjectDialog } from '@/components/projects/ShareProjectDialog';
import { MorningBriefing } from '@/components/notifications/MorningBriefing';
import { WeeklyReviewDialog } from '@/components/review/WeeklyReviewDialog';
import { CallProvider } from '@/components/calling/CallProvider';
import { CalendarEvent, ChatMessage, AppMode, Task } from '@/types/flux';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';

const Index = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { settings, updateSettings, updateNotifications } = useSettings();
  const { streamChat, isStreaming } = useAIChat();
  
  const {
    tasks,
    events,
    loading: dbLoading,
    addTask,
    updateTask,
    deleteTask,
    deleteTasks,
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
  } = useDatabase(user?.id);

  // Shared items state
  const [sharedTasks, setSharedTasks] = useState<Task[]>([]);
  const [sharedEvents, setSharedEvents] = useState<CalendarEvent[]>([]);

  // Fetch shared items
  const loadSharedItems = useCallback(async () => {
    const { sharedTasks: tasks, sharedEvents: events } = await fetchSharedWithMe();
    setSharedTasks(tasks);
    setSharedEvents(events);
  }, [fetchSharedWithMe]);

  useEffect(() => {
    if (user?.id) {
      loadSharedItems();
    }
  }, [user?.id, loadSharedItems]);

  // Real-time notifications for shares
  useSharedItemsRealtime({ userId: user?.id, onNewShare: loadSharedItems });
  
  // Real-time notifications from database (for space sharing)
  useRealtimeNotifications(user?.id);
  
  // Space shared data (from space members)
  const { 
    sharedTasks: spaceSharedTasks, 
    sharedEvents: spaceSharedEvents 
  } = useSpaceSharedData(user?.id);
  
  // Combine all shared items
  const allSharedTasks = useMemo(() => [
    ...sharedTasks,
    ...spaceSharedTasks,
  ], [sharedTasks, spaceSharedTasks]);
  
  const allSharedEvents = useMemo(() => [
    ...sharedEvents,
    ...spaceSharedEvents,
  ], [sharedEvents, spaceSharedEvents]);

  // Task notifications with ADHD mode support
  useTaskNotifications({
    tasks,
    defaultReminderMinutes: settings.notifications.reminderMinutesBefore,
    enabled: settings.notifications.taskReminders,
    adhdMode: settings.notifications.adhdMode,
  });

  // Tags system
  const tagsHook = useTags(user?.id);

  // Projects system
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    getProjectProgress,
  } = useProjects(user?.id);

  // Shared projects
  const {
    sharedProjects,
    projectMembers,
    shareProject,
    getProjectMembers,
    removeProjectMember,
  } = useSharedProjects(user?.id);

  // Weekly review
  const {
    currentReview,
    createOrUpdateReview,
    getWeeklyStats,
  } = useWeeklyReview(user?.id);

  // Contacts for task assignment
  const { contacts, markContacted } = useContacts(user?.id);

  // Contracts management
  const { contracts } = useContracts(user?.id);

  // Contract reminders - creates tasks for contracts ending within 3 months
  useContractReminders({
    contracts,
    tasks,
    onAddTask: addTask,
    onShowToast: (title, description) => toast({ title, description }),
    enabled: settings.notifications.contractReminders,
  });

  // Contact reminders - creates tasks when contacts are due for follow-up
  useContactReminders({
    contacts,
    tasks,
    onAddTask: addTask,
    onShowToast: (title, description) => toast({ title, description }),
    enabled: settings.notifications.contactReminders,
  });

  // Activity feed
  const { activities, loading: activityLoading, logActivity } = useActivityFeed(user?.id);

  // Global search
  const { 
    results: searchResults, 
    recentSearches, 
    loading: searchLoading, 
    search, 
    clearResults, 
    clearRecentSearches 
  } = useGlobalSearch(user?.id);

  // Calculate productivity streak
  const productivityStreak = useMemo(() => {
    const completedTaskDates = tasks
      .filter(t => t.completed && t.dueDate)
      .map(t => startOfDay(t.dueDate!).getTime());
    
    const uniqueDates = [...new Set(completedTaskDates)].sort((a, b) => b - a);
    if (uniqueDates.length === 0) return 0;
    
    let streak = 0;
    const today = startOfDay(new Date()).getTime();
    
    for (let i = 0; i <= 30; i++) {
      const checkDate = subDays(new Date(), i).getTime();
      if (uniqueDates.includes(startOfDay(new Date(checkDate)).getTime())) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    
    return streak;
  }, [tasks]);

  const [showMorningDigest, setShowMorningDigest] = useState(true);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [mode, setMode] = useState<AppMode>('standard');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [shareDialog, setShareDialog] = useState<{
    type: 'task' | 'event';
    id: string;
    title: string;
  } | null>(null);
  const [shareProjectDialog, setShareProjectDialog] = useState<{
    projectId: string;
    projectName: string;
  } | null>(null);

  // Weekly stats for review dialog
  const weeklyStats = useMemo(() => getWeeklyStats(tasks), [getWeeklyStats, tasks]);

  const sendLockRef = useRef(false);

  // Handle escape key to exit ghost mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'ghost') {
        setMode('standard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  // Refetch data when returning from ghost mode to sync any changes made there
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === 'ghost' && mode === 'standard') {
      console.log('[Index] Returning from ghost mode, refetching data...');
      refetch();
    }
    prevModeRef.current = mode;
  }, [mode, refetch]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Math.random().toString(36).substring(2, 15),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  // Handle AI chat with real streaming
  const handleSendMessage = useCallback(async (content: string) => {
    const userText = content.trim();
    if (!userText) return;

    // Prevent accidental multi-submit (e.g. key-repeat / double click)
    if (sendLockRef.current) return;
    sendLockRef.current = true;

    addMessage({ role: 'user', content: userText });
    setIsProcessing(true);

    let assistantContent = '';
    
    // Rate limit task/event creation per message to prevent runaway loops
    const MAX_TASKS_PER_MESSAGE = 10;
    const MAX_EVENTS_PER_MESSAGE = 10;
    let tasksCreatedThisMessage = 0;
    let eventsCreatedThisMessage = 0;
    // Track titles to prevent duplicate tasks/events in same message
    const createdTaskTitles = new Set<string>();
    const createdEventTitles = new Set<string>();

    // Keep prompts small and avoid runaway token usage
    const conversationMessages = (() => {
      const recent = messages
        .slice(-20)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const deduped: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const m of recent) {
        const last = deduped[deduped.length - 1];
        if (last && last.role === m.role && last.content === m.content) continue;
        deduped.push(m);
      }

      const last = deduped[deduped.length - 1];
      if (!last || last.role !== 'user' || last.content !== userText) {
        deduped.push({ role: 'user', content: userText });
      }

      return deduped;
    })();

    try {
      await streamChat({
        messages: conversationMessages,
        tasks,
        events,
        onDelta: (delta) => {
          assistantContent += delta;
        },
        onToolCall: async (toolCall) => {
          if (toolCall.tool === 'manage_task' && toolCall.task) {
            if (toolCall.action === 'add') {
              // Rate limit: prevent creating too many tasks in one message
              if (tasksCreatedThisMessage >= MAX_TASKS_PER_MESSAGE) {
                console.warn('Task creation rate limit reached for this message');
                return;
              }

              const taskTitleRaw = toolCall.task.title || 'New Task';
              const taskTitle = taskTitleRaw.toLowerCase().trim();

              // Dedupe: skip if we already created/updated a task with this title in this message
              if (createdTaskTitles.has(taskTitle)) {
                console.warn('Duplicate task title skipped:', taskTitle);
                return;
              }
              createdTaskTitles.add(taskTitle);
              tasksCreatedThisMessage++;

              const dueDate = toolCall.task.dueDate;
              const recurrenceRule = toolCall.task.recurrenceRule;
              const recurrenceEnd = toolCall.task.recurrenceEnd;

              // If a task with same title already exists but is missing scheduling fields,
              // update it instead of creating a duplicate.
              const existing = tasks.find(
                (t) => t.title.toLowerCase().trim() === taskTitle
              );

              if (
                existing &&
                (dueDate || recurrenceRule || recurrenceEnd) &&
                !existing.dueDate &&
                !existing.recurrenceRule
              ) {
                await updateTask(existing.id, {
                  dueDate: dueDate ?? existing.dueDate,
                  recurrenceRule: recurrenceRule ?? existing.recurrenceRule,
                  recurrenceEnd: recurrenceEnd ?? existing.recurrenceEnd,
                });
                toast({
                  title: 'Task Updated',
                  description: `${existing.title} scheduled`,
                });
                return;
              }

              const newTask = await addTask({
                title: taskTitleRaw,
                category: toolCall.task.category || settings.defaultTaskCategory,
                priority: toolCall.task.priority || settings.defaultTaskPriority,
                completed: false,
                dueDate,
                recurrenceRule,
                recurrenceEnd,
              });

              if (newTask) {
                toast({
                  title: 'Task Added',
                  description: newTask.title,
                });
              }
            } else if (toolCall.action === 'complete' && toolCall.task.id) {
              await toggleTaskComplete(toolCall.task.id);
              toast({
                title: 'Task Completed',
              });
            } else if (toolCall.action === 'delete' && toolCall.task.id) {
              await deleteTask(toolCall.task.id);
              toast({
                title: 'Task Deleted',
              });
            }
          } else if (toolCall.tool === 'schedule_event' && toolCall.event) {
            // Rate limit: prevent creating too many events in one message
            if (eventsCreatedThisMessage >= MAX_EVENTS_PER_MESSAGE) {
              console.warn('Event creation rate limit reached for this message');
              return;
            }
            // Dedupe: skip if we already created an event with this title in this message
            const eventTitle = (toolCall.event.title || 'New Event').toLowerCase().trim();
            if (createdEventTitles.has(eventTitle)) {
              console.warn('Duplicate event title skipped:', eventTitle);
              return;
            }
            createdEventTitles.add(eventTitle);
            eventsCreatedThisMessage++;

            const newEvent = await addEvent({
              title: toolCall.event.title || 'New Event',
              startTime: toolCall.event.startTime || new Date(),
              endTime: toolCall.event.endTime || new Date(Date.now() + 60 * 60 * 1000),
              location: toolCall.event.location,
              attendees: toolCall.event.attendees,
              recurrenceRule: toolCall.event.recurrenceRule,
              recurrenceEnd: toolCall.event.recurrenceEnd,
            });
            if (newEvent) {
              toast({
                title: 'Event Scheduled',
                description: newEvent.title,
              });
            }
          }
        },
        onDone: () => {
          setIsProcessing(false);
        },
      });

      // Clean up response and add message
      const cleanContent = assistantContent
        .replace(/<tool>[\s\S]*?<\/task>/g, '')
        .replace(/<tool>[\s\S]*?<\/event>/g, '')
        .trim();

      if (cleanContent) {
        addMessage({ role: 'assistant', content: cleanContent });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
      toast({
        variant: 'destructive',
        title: 'Chat Error',
        description: errorMessage,
      });
      addMessage({
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
      });
      setIsProcessing(false);
    } finally {
      sendLockRef.current = false;
    }
  }, [addMessage, addTask, addEvent, deleteTask, toggleTaskComplete, updateTask, events, messages, settings, streamChat, tasks, toast]);

  const handleGhostCommand = useCallback((command: string) => {
    handleSendMessage(command);
  }, [handleSendMessage]);

  const handleImportEvents = useCallback(async (importedEvents: CalendarEvent[]) => {
    for (const event of importedEvents) {
      await addEvent({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        attendees: event.attendees,
      });
    }
  }, [addEvent]);

  const handleAddTask = useCallback(async (task: Parameters<typeof addTask>[0]) => {
    const result = await addTask(task);
    return result as any;
  }, [addTask]);

  const handleAddEvent = useCallback(async (event: Parameters<typeof addEvent>[0]) => {
    // Add the event
    const result = await addEvent(event);
    
    // Also create a corresponding task for better sync
    if (result) {
      await addTask({
        title: event.title,
        category: settings.defaultTaskCategory,
        priority: 'medium',
        completed: false,
        dueDate: event.startTime,
        recurrenceRule: event.recurrenceRule,
        recurrenceEnd: event.recurrenceEnd,
      });
    }
    
    return result as any;
  }, [addEvent, addTask, settings.defaultTaskCategory]);

  const handleDeleteTasks = useCallback(async (ids: string[]) => {
    const result = await deleteTasks(ids);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    } else {
      toast({
        title: 'Tasks Deleted',
        description: `${ids.length} task${ids.length > 1 ? 's' : ''} removed`,
      });
    }
    return result;
  }, [deleteTasks, toast]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (dbLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading your data...</div>
      </div>
    );
  }

  return (
    <CallProvider userId={user?.id || ''}>
      {/* Morning Briefing */}
      {showMorningDigest && (
        <MorningBriefing
          tasks={tasks}
          events={events}
          contacts={contacts}
          contracts={contracts}
          projects={projects}
          streak={productivityStreak}
          onDismiss={() => setShowMorningDigest(false)}
          onMarkContactContacted={markContacted}
        />
      )}

      {mode === 'standard' ? (
        <StandardMode
          tasks={tasks}
          events={events}
          sharedTasks={allSharedTasks}
          sharedEvents={allSharedEvents}
          messages={messages}
          isProcessing={isProcessing || isStreaming}
          projects={projects}
          contacts={contacts}
          activities={activities}
          activityLoading={activityLoading}
          searchResults={searchResults}
          recentSearches={recentSearches}
          searchLoading={searchLoading}
          onSearch={search}
          onClearSearchResults={clearResults}
          onClearRecentSearches={clearRecentSearches}
          onLogActivity={logActivity}
          onAddTask={handleAddTask}
          onToggleTaskComplete={toggleTaskComplete}
          onDeleteTask={deleteTask}
          onDeleteTasks={handleDeleteTasks}
          onUpdateTask={updateTask}
          onReorderTasks={reorderTasks}
          onAddEvent={handleAddEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onImportEvents={handleImportEvents}
          onSendMessage={handleSendMessage}
          onVoiceMode={() => setMode('ghost')}
          onOpenSettings={() => setShowProfileSettings(true)}
          onEditProfile={() => setShowProfileSettings(true)}
          onShareTask={(id, title) => setShareDialog({ type: 'task', id, title })}
          onShareEvent={(id, title) => setShareDialog({ type: 'event', id, title })}
          onSignOut={handleSignOut}
          onOpenWeeklyReview={() => setShowWeeklyReview(true)}
          onAddProject={addProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
          getProjectProgress={getProjectProgress}
          onShareProject={(projectId, projectName) => {
            setShareProjectDialog({ projectId, projectName });
            getProjectMembers(projectId);
          }}
          onShareProjectWithEmail={(projectId, email) => shareProject(projectId, email)}
        />
      ) : (
        <GhostMode 
          onClose={() => setMode('standard')}
          onCommand={handleGhostCommand}
        />
      )}

      <ProfileSettingsDialog
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onUpdateNotifications={updateNotifications}
      />

      {shareDialog && (
        <ShareDialog
          itemType={shareDialog.type}
          itemId={shareDialog.id}
          itemTitle={shareDialog.title}
          onShare={(email, permission) => shareItem(shareDialog.type, shareDialog.id, email, permission)}
          onGetSharedWith={() => getSharedWith(shareDialog.type, shareDialog.id)}
          onRemoveShare={removeShare}
          onGetRecentContacts={getRecentContacts}
          onClose={() => setShareDialog(null)}
        />
      )}

      {shareProjectDialog && (
        <ShareProjectDialog
          open={!!shareProjectDialog}
          onOpenChange={(open) => !open && setShareProjectDialog(null)}
          projectName={shareProjectDialog.projectName}
          members={(projectMembers[shareProjectDialog.projectId] || []).map(m => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            userEmail: m.userEmail,
            userDisplayName: m.userDisplayName,
          }))}
          onShare={(email, role) => shareProject(shareProjectDialog.projectId, email, role)}
          onRemoveMember={removeProjectMember}
          isOwner={true}
        />
      )}

      <WeeklyReviewDialog
        open={showWeeklyReview}
        onOpenChange={setShowWeeklyReview}
        currentReview={currentReview}
        tasks={tasks}
        onSaveReview={createOrUpdateReview}
        weeklyStats={weeklyStats}
      />
    </CallProvider>
  );
};

export default Index;
