import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDatabase } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { useAIChat } from '@/hooks/useAIChat';
import { useAssistantConversations } from '@/hooks/useAssistantConversations';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useEventNotifications } from '@/hooks/useEventNotifications';
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
import { useHealthTracking } from '@/hooks/useHealthTracking';
import { useAppleHealth } from '@/hooks/useAppleHealth';
import { useFamilyEvents } from '@/hooks/useFamilyEvents';
import { useNotes } from '@/hooks/useNotes';
import { useWakeWordDetection } from '@/hooks/useWakeWordDetection';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useShoppingLists } from '@/hooks/useShoppingLists';
import { useHabits } from '@/hooks/useHabits';
import { useEmails } from '@/hooks/useEmails';
import { buildSmartPayload } from '@/lib/smartPayloadBuilder';
import { useAIMemory } from '@/hooks/useAIMemory';
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
import { differenceInCalendarDays, startOfDay, subDays, isAfter, isBefore, addDays } from 'date-fns';
import { Contract as SmartContract } from '@/hooks/useSmartContext';

const Index = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { settings, updateSettings, updateNotifications } = useSettings();
  const { streamChat, isStreaming } = useAIChat();
  const { memories, getMemoriesForContext } = useAIMemory();
  const { fetchMessages: fetchConversationMessages, fetchConversations, conversations } = useAssistantConversations();
  const previousContextLoadedRef = useRef(false);
  const [previousConversationMessages, setPreviousConversationMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Load last conversation's recent messages for cross-session context
  useEffect(() => {
    if (!user?.id || previousContextLoadedRef.current) return;
    previousContextLoadedRef.current = true;
    
    (async () => {
      await fetchConversations();
    })();
  }, [user?.id, fetchConversations]);

  // When conversations load, fetch last 10 messages from most recent
  useEffect(() => {
    if (conversations.length === 0) return;
    
    const mostRecent = conversations[0];
    if (!mostRecent) return;

    (async () => {
      const msgs = await fetchConversationMessages(mostRecent.id);
      const last10 = msgs.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setPreviousConversationMessages(last10);
    })();
  }, [conversations, fetchConversationMessages]);
  
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

  // Event/Meeting notifications
  useEventNotifications({
    events,
    defaultReminderMinutes: settings.notifications.reminderMinutesBefore,
    enabled: settings.notifications.calendarAlerts,
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
  const { contacts, markContacted, addContact, updateContact, deleteContact } = useContacts(user?.id);

  // Contracts management
  const { contracts, addContract, updateContract, deleteContract } = useContracts(user?.id);

  // Health tracking for AI assistant
  const { 
    medications, 
    appointments, 
    vaccinations,
    healthMetrics,
    getActiveMedications,
    getUpcomingAppointments,
    getRecentMetrics,
  } = useHealthTracking();

  // Apple Health data for AI assistant
  const {
    todaySummary: appleHealthToday,
    weeklyData: appleHealthWeekly,
    isConnected: appleHealthConnected,
  } = useAppleHealth();

  // Family events for AI assistant
  const { events: familyEvents, getUpcomingEvents: getUpcomingFamilyEvents } = useFamilyEvents();

  // Notes for voice assistant
  const { createNote, deleteNote, searchNotes, notes } = useNotes(user?.id);

  // User profile for AI context
  const { profile: userProfile } = useUserProfile();

  // Family members for AI context
  const { members: familyMembers } = useFamilyMembers();

  // Shopping lists for AI context
  const { lists: shoppingLists } = useShoppingLists();

  // Habits for AI context
  const { todayHabits, createHabit, logHabit, deleteHabit } = useHabits(user?.id);

  // Emails for AI context
  const { allEmails, unreadCount: unreadEmailCount } = useEmails();

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

  const [showMorningDigest, setShowMorningDigest] = useState(false);
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

  // Wake word detection - "Hey Dori" opens voice mode
  const { isListening: isWakeWordListening } = useWakeWordDetection({
    enabled: mode === 'standard', // Only listen when not already in voice mode
    onWakeWordDetected: useCallback(() => {
      console.log('[WakeWord] "Hey Dori" detected, opening voice mode');
      setMode('ghost');
    }, []),
  });

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
    const conversationMessages = await (async () => {
      // Prepend previous conversation context for cross-session memory
      const prevContext: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (previousConversationMessages.length > 0 && messages.length === 0) {
        // Only inject previous context at the start of a new session
        prevContext.push({ role: 'user', content: '[Previous conversation context — use for continuity]' });
        prevContext.push(...previousConversationMessages);
        prevContext.push({ role: 'assistant', content: '[End of previous context — new conversation starts below]' });
      }

      let recent = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      
      // Summarize older messages if history is long
      if (recent.length > 12) {
        try {
          const { summarizeConversation } = useChatAI(); // Assuming we can use this, or simple truncate
          // Simple truncate for now to avoid async hook issues inside this block
          recent = [{ role: 'system', content: '[Older messages omitted for brevity]' }, ...recent.slice(-10)];
        } catch (e) {
          recent = recent.slice(-12);
        }
      }

      const deduped: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const m of [...prevContext, ...recent]) {
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
      // Build health data for AI context
      const recentMetrics = getRecentMetrics(30);
      const healthData = {
        medications: getActiveMedications().map(m => ({
          name: m.name,
          dosage: m.dosage || undefined,
          frequency: m.frequency || undefined,
          isActive: m.is_active,
          refillDate: m.refill_date || undefined,
        })),
        appointments: getUpcomingAppointments().map(a => ({
          title: a.title,
          date: a.appointment_date,
          provider: a.provider_name || undefined,
          type: a.appointment_type || undefined,
          isCompleted: a.is_completed,
        })),
        vaccinations: vaccinations.slice(0, 10).map(v => ({
          name: v.vaccine_name,
          date: v.date_administered,
          nextDose: v.next_dose_date || undefined,
        })),
        metrics: recentMetrics.slice(0, 50).map(m => ({
          type: m.metric_type,
          value: m.value,
          unit: m.unit,
          date: m.recorded_at,
          source: m.source,
        })),
        // Apple Health daily summary with detailed sleep data
        dailySummary: appleHealthToday ? {
          date: appleHealthToday.date,
          steps: appleHealthToday.steps,
          calories: appleHealthToday.calories,
          activeMinutes: appleHealthToday.activeMinutes,
          sleepHours: appleHealthToday.sleepHours,
          heartRateAvg: appleHealthToday.heartRateAvg,
          weight: appleHealthToday.weight,
          waterIntake: appleHealthToday.waterIntake,
          restingHeartRate: appleHealthToday.restingHeartRate,
          hrv: appleHealthToday.hrv,
          bloodOxygen: appleHealthToday.bloodOxygen,
          distance: appleHealthToday.distance,
          flightsClimbed: appleHealthToday.flightsClimbed,
          mindfulnessMinutes: appleHealthToday.mindfulnessMinutes,
          // Detailed sleep data
          sleepStartTime: appleHealthToday.sleepStartTime,
          sleepEndTime: appleHealthToday.sleepEndTime,
          sleepRemMinutes: appleHealthToday.sleepRemMinutes,
          sleepDeepMinutes: appleHealthToday.sleepDeepMinutes,
          sleepCoreMinutes: appleHealthToday.sleepCoreMinutes,
          sleepAwakeMinutes: appleHealthToday.sleepAwakeMinutes,
          sleepEfficiency: appleHealthToday.sleepEfficiency,
          sleepInBedMinutes: appleHealthToday.sleepInBedMinutes,
        } : undefined,
        // Weekly health trends
        weeklyTrends: appleHealthWeekly?.slice(0, 7).map(d => ({
          date: d.date,
          steps: d.steps,
          sleepHours: d.sleepHours,
          calories: d.calories,
          activeMinutes: d.activeMinutes,
          heartRateAvg: d.heartRateAvg,
        })),
        appleHealthConnected,
      };

      // Get events for AI context including today, tomorrow, and next 30 days
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = addDays(now, 30);
      
      // Filter calendar events to include today and future (next 30 days)
      const upcomingCalendarEvents = events.filter(e => {
        const eventStart = new Date(e.startTime);
        return isAfter(eventStart, startOfToday) && isBefore(eventStart, thirtyDaysFromNow);
      });
      
      // Get upcoming family events (next 30 days)
      const upcomingFamilyEventsRaw = getUpcomingFamilyEvents(30);
      
      // Combine calendar events with family events for AI context
      const allUpcomingEvents: CalendarEvent[] = [
        ...upcomingCalendarEvents,
        ...upcomingFamilyEventsRaw.map(fe => ({
          id: fe.id,
          title: fe.title,
          startTime: new Date(fe.start_time),
          endTime: new Date(fe.end_time),
          description: fe.description || undefined,
          location: fe.location || undefined,
          category: fe.event_type || 'family',
        } as CalendarEvent)),
      ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      // Get overdue tasks (past due date, not completed)
      const overdueTasks = tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        return isBefore(new Date(t.dueDate), startOfToday);
      });

      // Get tasks due today (not completed)
      const todayTasks = tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        const taskDate = new Date(t.dueDate);
        return taskDate >= startOfToday && taskDate < addDays(startOfToday, 1);
      });

      // Build smart context payload based on message keywords
      const activeContracts: SmartContract[] = contracts.filter(c => c.isActive !== false).map(c => ({
        id: c.id,
        name: c.name,
        provider: c.provider || undefined,
        category: c.category,
        costAmount: c.costAmount || undefined,
        costFrequency: c.costFrequency || undefined,
        renewalDate: c.renewalDate ? c.renewalDate.toISOString().split('T')[0] : undefined,
        endDate: c.endDate ? c.endDate.toISOString().split('T')[0] : undefined,
        autoRenews: c.autoRenews || undefined,
        isActive: c.isActive || undefined,
      }));

      const habitsSummary = todayHabits.map(h => ({
        name: h.name,
        streak: h.streak,
        isCompletedToday: h.isCompleted,
        frequency: h.frequency,
      }));

      const pendingTaskCount = tasks.filter(t => !t.completed).length;
      const memoriesForContext = getMemoriesForContext();
      const smartPayload = buildSmartPayload({
        message: userText,
        userProfile: userProfile || undefined,
        contacts,
        contracts: activeContracts,
        emails: allEmails,
        notes,
        habits: habitsSummary,
        familyMembers,
        shoppingLists,
        stats: {
          totalContacts: contacts.length,
          totalContracts: activeContracts.length,
          pendingTasks: pendingTaskCount,
          upcomingEvents: allUpcomingEvents.length,
          unreadEmails: unreadEmailCount,
          activeHabits: todayHabits.length,
        },
        memories: memoriesForContext,
      });

      await streamChat({
        messages: conversationMessages,
        tasks,
        events: allUpcomingEvents,
        overdueTasks,
        todayTasks,
        healthData,
        // Smart payload context
        userProfile: smartPayload.userProfile,
        relevantContacts: smartPayload.relevantContacts
          ? contacts.filter(c => smartPayload.relevantContacts!.some(rc => rc.name === c.name)).slice(0, 10)
          : undefined,
        relevantContracts: smartPayload.relevantContracts,
        statsSummary: smartPayload.statsSummary,
        emailSummary: smartPayload.emailSummary,
        notesSummary: smartPayload.notesSummary,
        habitsSummary: smartPayload.habitsSummary,
        memories: smartPayload.memories,
        familyContext: smartPayload.familyContext ? {
          members: smartPayload.familyContext.members.map(m => ({
            id: '',
            ...m,
            school: m.school || null,
            grade: null,
            teacherName: null,
            teacherContact: null,
            kindergarten: null,
            kindergartenTeacher: null,
            activities: m.activities.map(a => ({ name: a, schedule: '', location: '' })),
            allergies: [],
            medicalNotes: null,
            livesWithUser: true,
          })),
          todayEvents: [],
          tomorrowEvents: [],
          upcomingBirthdays: [],
          shoppingLists: smartPayload.familyContext.shoppingLists,
        } : undefined,
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
          } else if (toolCall.tool === 'create_note' && toolCall.note) {
            // Create a note from voice assistant
            const noteTitle = toolCall.note.title || 'Voice Note';
            const noteContent = toolCall.note.content || '';
            const noteTags = toolCall.note.tags || [];
            
            const newNote = await createNote(noteTitle, noteContent, noteTags);
            if (newNote) {
              toast({
                title: 'Note Saved',
                description: noteTitle,
              });
            }
          } else if (toolCall.tool === 'manage_contact' && toolCall.contact) {
            const { action, contact } = toolCall;
            if (action === 'create' && contact.name) {
              const result = await addContact({
                name: contact.name,
                email: contact.email || '',
                phone: contact.phone || '',
                company: contact.company || '',
                role: contact.role || '',
                city: contact.city || '',
                country: contact.country || '',
                contactType: (contact.contactType === 'business' ? 'business' : 'personal') as 'personal' | 'business',
                notes: contact.notes || '',
              });
              if (result) toast({ title: 'Contact Added', description: contact.name });
            } else if (action === 'delete' && contact.query) {
              const match = contacts.find(c => c.name.toLowerCase().includes(contact.query!.toLowerCase()));
              if (match) {
                await deleteContact(match.id);
                toast({ title: 'Contact Deleted', description: match.name });
              }
            } else if (action === 'update' && contact.query) {
              const match = contacts.find(c => c.name.toLowerCase().includes(contact.query!.toLowerCase()));
              if (match) {
                const updates: Record<string, unknown> = {};
                if (contact.name) updates.name = contact.name;
                if (contact.email) updates.email = contact.email;
                if (contact.phone) updates.phone = contact.phone;
                if (contact.company) updates.company = contact.company;
                if (contact.role) updates.role = contact.role;
                if (contact.city) updates.city = contact.city;
                if (contact.country) updates.country = contact.country;
                if (contact.notes) updates.notes = contact.notes;
                await updateContact(match.id, updates);
                toast({ title: 'Contact Updated', description: match.name });
              }
            } else if (action === 'mark_contacted' && contact.query) {
              const match = contacts.find(c => c.name.toLowerCase().includes(contact.query!.toLowerCase()));
              if (match) {
                await markContacted(match.id);
                toast({ title: 'Contact Marked', description: `${match.name} marked as contacted` });
              }
            }
          } else if (toolCall.tool === 'manage_contract' && toolCall.contract) {
            const { action, contract } = toolCall;
            if (action === 'create' && contract.name) {
              const result = await addContract({
                name: contract.name,
                provider: contract.provider || '',
                category: (contract.category || 'other') as any,
                costAmount: contract.costAmount || null,
                costFrequency: (contract.costFrequency || 'monthly') as any,
                renewalDate: contract.renewalDate ? new Date(contract.renewalDate) : null,
                autoRenews: contract.autoRenews ?? false,
                notes: contract.notes || '',
              });
              if (result) toast({ title: 'Contract Added', description: contract.name });
            } else if (action === 'delete' && contract.query) {
              const match = contracts.find(c => c.name.toLowerCase().includes(contract.query!.toLowerCase()));
              if (match) {
                await deleteContract(match.id);
                toast({ title: 'Contract Deleted', description: match.name });
              }
            } else if (action === 'update' && contract.query) {
              const match = contracts.find(c => c.name.toLowerCase().includes(contract.query!.toLowerCase()));
              if (match) {
                const updates: Record<string, unknown> = {};
                if (contract.name) updates.name = contract.name;
                if (contract.provider) updates.provider = contract.provider;
                if (contract.category) updates.category = contract.category;
                if (contract.costAmount !== undefined) updates.costAmount = contract.costAmount;
                if (contract.costFrequency) updates.costFrequency = contract.costFrequency;
                if (contract.renewalDate) updates.renewalDate = new Date(contract.renewalDate);
                if (contract.notes) updates.notes = contract.notes;
                await updateContract(match.id, updates);
                toast({ title: 'Contract Updated', description: match.name });
              }
            }
          } else if (toolCall.tool === 'manage_project' && toolCall.project) {
            const { action, project } = toolCall;
            if (action === 'create' && project.name) {
              const result = await addProject({
                name: project.name,
                description: project.description || '',
                color: project.color || '#6366f1',
                isArchived: false,
              });
              if (result) toast({ title: 'Project Created', description: project.name });
            } else if (action === 'delete' && project.query) {
              const match = projects.find(p => p.name.toLowerCase().includes(project.query!.toLowerCase()));
              if (match) {
                await deleteProject(match.id);
                toast({ title: 'Project Deleted', description: match.name });
              }
            } else if (action === 'update' && project.query) {
              const match = projects.find(p => p.name.toLowerCase().includes(project.query!.toLowerCase()));
              if (match) {
                const updates: Record<string, unknown> = {};
                if (project.name) updates.name = project.name;
                if (project.description) updates.description = project.description;
                if (project.color) updates.color = project.color;
                await updateProject(match.id, updates);
                toast({ title: 'Project Updated', description: match.name });
              }
            }
          } else if (toolCall.tool === 'manage_habit' && toolCall.habit) {
            const { action, habit } = toolCall;
            if (action === 'create' && habit.name) {
              await createHabit({
                name: habit.name,
                description: habit.description || '',
                icon: habit.icon || '✅',
                frequency: (habit.frequency === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly' | 'custom',
                targetCount: habit.targetCount || 1,
                isActive: true,
                color: '#6366f1',
                daysOfWeek: [],
                reminderTime: null,
              });
              toast({ title: 'Habit Created', description: habit.name });
            } else if (action === 'log' && habit.query) {
              const match = todayHabits.find(h => h.name.toLowerCase().includes(habit.query!.toLowerCase()));
              if (match) {
                await logHabit(match.id);
                toast({ title: 'Habit Logged', description: match.name });
              }
            } else if (action === 'delete' && habit.query) {
              const match = todayHabits.find(h => h.name.toLowerCase().includes(habit.query!.toLowerCase()));
              if (match) {
                await deleteHabit(match.id);
                toast({ title: 'Habit Deleted', description: match.name });
              }
            }
          } else if (toolCall.tool === 'manage_note') {
            const { action, note } = toolCall;
            if (action === 'create' && note) {
              const result = await createNote(note.title || 'Note', note.content || '', note.tags || []);
              if (result) toast({ title: 'Note Saved', description: note.title });
            } else if (action === 'delete' && note?.query) {
              const match = notes.find(n => n.title.toLowerCase().includes(note.query!.toLowerCase()));
              if (match) {
                await deleteNote(match.id);
                toast({ title: 'Note Deleted', description: match.title });
              }
            }
          } else if (toolCall.tool === 'compose_email' && toolCall.email) {
            // Store email data for the compose sheet to pick up
            const emailData = toolCall.email;
            toast({ title: 'Email Draft Ready', description: `To: ${emailData.to} — "${emailData.subject}"` });
            // The compose sheet will be opened via a custom event
            window.dispatchEvent(new CustomEvent('compose-email', { detail: emailData }));
          } else if (toolCall.tool === 'set_reminder' && toolCall.reminder) {
            // Schedule a reminder notification
            const { message, triggerAt } = toolCall.reminder;
            const triggerTime = new Date(triggerAt).getTime();
            const now = Date.now();
            const delayMs = Math.max(triggerTime - now, 1000);

            // Schedule via setTimeout for in-app notification
            setTimeout(() => {
              toast({ title: '⏰ Reminder', description: message });
              // Also try browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⏰ Reminder', { body: message, icon: '/favicon.png' });
              }
            }, delayMs);

            // Also store in user_notifications for persistence
            if (user?.id) {
              supabase.from('user_notifications').insert({
                user_id: user.id,
                type: 'reminder',
                title: '⏰ Reminder',
                message,
                data: { triggerAt, scheduled: true },
                read: false,
              }).then(() => {});
            }

            toast({ title: 'Reminder Set', description: `"${message}" at ${new Date(triggerAt).toLocaleTimeString()}` });
          } else if (toolCall.tool === 'get_summary' && toolCall.summaryType === 'contract_costs') {
            // Compute financial summary from contracts
            let monthlyTotal = 0;
            let yearlyTotal = 0;
            const activeContracts2 = contracts.filter(c => c.isActive !== false);
            for (const c of activeContracts2) {
              if (!c.costAmount) continue;
              const amount = c.costAmount;
              const freq = c.costFrequency || 'monthly';
              if (freq === 'monthly') {
                monthlyTotal += amount;
                yearlyTotal += amount * 12;
              } else if (freq === 'yearly') {
                monthlyTotal += amount / 12;
                yearlyTotal += amount;
              } else if (freq === 'quarterly') {
                monthlyTotal += amount / 3;
                yearlyTotal += amount * 4;
              } else if (freq === 'one_time') {
                yearlyTotal += amount;
              } else {
                // fallback: treat as monthly
                monthlyTotal += amount;
                yearlyTotal += amount * 12;
              }
            }
            // Feed back as assistant context
            const costSummary = `📊 **Financial Summary**\n\n` +
              `**Monthly costs:** €${monthlyTotal.toFixed(2)}\n` +
              `**Yearly costs:** €${yearlyTotal.toFixed(2)}\n` +
              `**Active contracts:** ${activeContracts2.length}\n\n` +
              activeContracts2
                .filter(c => c.costAmount)
                .sort((a, b) => (b.costAmount || 0) - (a.costAmount || 0))
                .slice(0, 10)
                .map(c => `- ${c.name}${c.provider ? ` (${c.provider})` : ''}: €${c.costAmount}/${c.costFrequency || 'month'}`)
                .join('\n');
            assistantContent += '\n\n' + costSummary;
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
        .replace(/<tool>[\s\S]*?<\/note>/g, '')
        .replace(/<tool>[\s\S]*?<\/contact>/g, '')
        .replace(/<tool>[\s\S]*?<\/contract>/g, '')
        .replace(/<tool>[\s\S]*?<\/project>/g, '')
        .replace(/<tool>[\s\S]*?<\/habit>/g, '')
        .replace(/<tool>[\s\S]*?<\/email>/g, '')
        .replace(/<tool>[\s\S]*?<\/item>/g, '')
        .replace(/<tool>get_summary<\/tool>\s*<type>\w+<\/type>/g, '')
        .replace(/<tool>set_reminder<\/tool>\s*<reminder>\{[\s\S]*?\}<\/reminder>/g, '')
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
  }, [addMessage, addTask, addEvent, deleteTask, toggleTaskComplete, updateTask, events, messages, settings, streamChat, tasks, toast, contacts, contracts, allEmails, notes, todayHabits, familyMembers, shoppingLists, userProfile, unreadEmailCount, createNote, deleteNote, searchNotes, addContact, updateContact, deleteContact, markContacted, addContract, updateContract, deleteContract, addProject, updateProject, deleteProject, projects, createHabit, logHabit, deleteHabit, previousConversationMessages, user?.id]);

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
          onEditProfile={() => setShowProfileSettings(true)}
          settings={settings}
          onUpdateSettings={updateSettings}
          onUpdateNotifications={updateNotifications}
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
