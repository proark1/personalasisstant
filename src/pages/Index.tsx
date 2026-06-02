import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWorkspaceId } from '@/contexts/WorkspaceContext';
import { useDatabase } from '@/hooks/useDatabase';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { useAIChat } from '@/hooks/useAIChat';
import { useAssistantConversations } from '@/hooks/useAssistantConversations';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { useEventNotifications } from '@/hooks/useEventNotifications';
import { useSharedItemsRealtime } from '@/hooks/useSharedItemsRealtime';
import { useSpaceSharedData } from '@/hooks/useSpaceSharedData';
import { useTags } from '@/hooks/useTags';
import { useProjects } from '@/hooks/useProjects';
import { useSharedProjects } from '@/hooks/useSharedProjects';
import { useWeeklyReview } from '@/hooks/useWeeklyReview';
import { useContacts } from '@/hooks/useContacts';
import { useContactReminders } from '@/hooks/useContactReminders';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useContracts, type ContractCategory, type CostFrequency } from '@/hooks/useContracts';
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
import { cleanAssistantContent } from '@/lib/assistantContent';
import { calculateProductivityStreak } from '@/lib/productivity';
import { classifyThinkingStatus } from '@/lib/thinkingStatus';
import { buildConversationMessages } from '@/lib/conversationMessages';
import { useDoriConversation } from '@/contexts/DoriConversationContext';
import { formatContractCostSummary } from '@/lib/contractCosts';
import { useAIMemory } from '@/hooks/useAIMemory';
import { StandardMode } from '@/components/layout/StandardMode';
import { BrandedLoader } from '@/components/ui/branded-loader';
import { LazyGhostMode, PageFallback } from '@/components/lazy';
import { ProfileSettingsDialog } from '@/components/settings/ProfileSettingsDialog';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { ShareProjectDialog } from '@/components/projects/ShareProjectDialog';
import { MorningBriefing } from '@/components/notifications/MorningBriefing';
import { WeeklyReviewDialog } from '@/components/review/WeeklyReviewDialog';
import { CallProvider } from '@/components/calling/CallProvider';
import { CalendarEvent, ChatMessage, AppMode, Task } from '@/types/flux';
import type { ActionCardData } from '@/components/assistant/ActionCard';
import {
  aiInFlight,
  canCreateAiAction,
  recordAiActions,
  remainingAiActions,
} from '@/lib/aiActionGuard';
import { useToast } from '@/hooks/use-toast';
import { isAfter, isBefore, addDays } from 'date-fns';
import { Contract as SmartContract } from '@/hooks/useSmartContext';

const Index = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { settings, updateSettings, updateNotifications } = useSettings();
  const { streamChat, isStreaming } = useAIChat();
  const { memories: _memories, getMemoriesForContext } = useAIMemory();
  const { fetchMessages: fetchConversationMessages, fetchConversations, conversations, startConversation, addMessage: saveMessageToDB, currentConversation: _currentConversation } = useAssistantConversations();
  const previousContextLoadedRef = useRef(false);
  const [previousConversationMessages, setPreviousConversationMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);

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
  const _tagsHook = useTags(user?.id);

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
    sharedProjects: _sharedProjects,
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
    medications: _medications,
    appointments: _appointments,
    vaccinations,
    healthMetrics: _healthMetrics,
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
  const { events: _familyEvents, getUpcomingEvents: getUpcomingFamilyEvents } = useFamilyEvents();

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
  const { allEmails, unreadCount: unreadEmailCount } = useEmails({ enabled: false, autoSync: false });

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
  const productivityStreak = useMemo(() => calculateProductivityStreak(tasks), [tasks]);

  const [showMorningDigest, setShowMorningDigest] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [mode, setMode] = useState<AppMode>('standard');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | undefined>();
  const [actionCards, setActionCards] = useState<ActionCardData[]>([]);
  // Bridge Dori's conversation to surfaces outside Index (the persistent Dori
  // bar). Index stays the single owner; we publish a snapshot + register the
  // send handler. See DoriConversationContext.
  const doriConversation = useDoriConversation();
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

  // Wake word detection - "Hey Dori" opens voice mode.
  // IMPORTANT: disabled by default to avoid the microphone permission
  // prompt firing automatically on page load (which crashes mobile Safari).
  // The user can opt-in via voice mode itself; we no longer auto-listen
  // for the wake word on the dashboard.
  const { isListening: _isWakeWordListening } = useWakeWordDetection({
    enabled: false,
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

  // Undo an AI action — deletes the entity Dori just created. Triggered by
  // the "Undo" button on action cards via a `dori:undo-action` event.
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ type: string; id: string }>).detail;
      if (!detail?.type || !detail?.id) return;
      try {
        switch (detail.type) {
          case 'task': await deleteTask(detail.id); break;
          case 'event': await deleteEvent(detail.id); break;
          case 'note': await deleteNote(detail.id); break;
          case 'contact': await deleteContact(detail.id); break;
          default: return;
        }
        toast({ title: 'Undone', description: `${detail.type} removed` });
      } catch (err) {
        console.error('Undo failed:', err);
        toast({ variant: 'destructive', title: "Couldn't undo", description: 'Please remove it manually.' });
      }
    };
    window.addEventListener('dori:undo-action', handler as EventListener);
    return () => window.removeEventListener('dori:undo-action', handler as EventListener);
  }, [deleteTask, deleteEvent, deleteNote, deleteContact, toast]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Math.random().toString(36).substring(2, 15),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);

    // Persist to DB
    if (activeConversationIdRef.current) {
      saveMessageToDB(activeConversationIdRef.current, message.role as 'user' | 'assistant', message.content);
    }

    return newMessage;
  }, [saveMessageToDB]);

  // Handle AI chat with real streaming
  const handleSendMessage = useCallback(async (content: string) => {
    const userText = content.trim();
    if (!userText) return;

    // Prevent accidental multi-submit (e.g. key-repeat / double click)
    if (sendLockRef.current) return;
    sendLockRef.current = true;

    // Start a new conversation if none active
    if (!activeConversationIdRef.current) {
      const convId = await startConversation(false, userText.substring(0, 60));
      activeConversationIdRef.current = convId;
    }

    addMessage({ role: 'user', content: userText });
    setIsProcessing(true);
    setActionCards([]);

    setThinkingStatus(classifyThinkingStatus(userText));

    let assistantContent = '';
    const collectedCards: ActionCardData[] = [];
    
    // Rate limit task/event creation per message to prevent runaway loops
    const MAX_TASKS_PER_MESSAGE = 10;
    const MAX_EVENTS_PER_MESSAGE = 10;
    let tasksCreatedThisMessage = 0;
    let eventsCreatedThisMessage = 0;
    // Track titles to prevent duplicate tasks/events in same message
    const createdTaskTitles = new Set<string>();
    const createdEventTitles = new Set<string>();

    const conversationMessages = buildConversationMessages({
      userText,
      messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      previousConversationMessages,
    });

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
        metrics: recentMetrics.slice(0, 10).map(m => ({
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
          members: familyMembers.map(m => {
            const birthDate = m.birth_date ? new Date(m.birth_date) : null;
            const age = birthDate ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
            const activities = Array.isArray(m.activities) ? (m.activities as unknown[]).map((a: unknown) => ({
              name: typeof a === 'string' ? a : (a && typeof a === 'object' && 'name' in a ? String((a as Record<string, unknown>).name) : ''),
              schedule: (a && typeof a === 'object' && 'schedule' in a) ? String((a as Record<string, unknown>).schedule) : '',
              location: (a && typeof a === 'object' && 'location' in a) ? String((a as Record<string, unknown>).location) : '',
            })) : [];
            return {
              id: m.id,
              name: m.name,
              relationship: m.relationship,
              age,
              school: m.school_name || m.kindergarten_name || null,
              grade: m.school_grade || null,
              teacherName: m.teacher_name || null,
              teacherContact: m.teacher_contact || null,
              kindergarten: m.kindergarten_name || null,
              kindergartenTeacher: m.kindergarten_teacher_name || null,
              activities,
              allergies: m.allergies || [],
              medicalNotes: m.medical_notes || null,
              livesWithUser: m.lives_with_user ?? true,
            };
          }),
          todayEvents: [],
          tomorrowEvents: [],
          upcomingBirthdays: [],
          shoppingLists: smartPayload.familyContext.shoppingLists,
        } : undefined,
        workspaceId: activeWorkspaceId,
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

              // Daily quota backstop — protects against runaway loops.
              if (!canCreateAiAction(user?.id)) {
                collectedCards.push({ type: 'task', action: 'Created', title: taskTitleRaw, status: 'failed', details: `Daily limit reached (${remainingAiActions(user?.id)} left). Try again tomorrow.` });
                return;
              }

              // Cross-turn dedup: block if an identical task is already being
              // created by a concurrent message.
              if (!aiInFlight.claim('task', taskTitleRaw)) {
                console.warn('Task already in flight, skipping concurrent dup:', taskTitle);
                return;
              }

              createdTaskTitles.add(taskTitle);
              tasksCreatedThisMessage++;

              const dueDate = toolCall.task.dueDate;
              const recurrenceRule = toolCall.task.recurrenceRule;
              const recurrenceEnd = toolCall.task.recurrenceEnd;

              try {
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
                  recordAiActions(user?.id, 1);
                  toast({ title: 'Task Added', description: newTask.title });
                  collectedCards.push({ type: 'task', action: 'Created', title: newTask.title, details: dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : undefined, undo: { type: 'task', id: newTask.id } });
                }
              } catch (err) {
                // Surface the failure instead of letting it vanish — the model
                // may have already "said" it created the task.
                console.error('Task creation failed:', err);
                collectedCards.push({ type: 'task', action: 'Created', title: taskTitleRaw, status: 'failed' });
                toast({ variant: 'destructive', title: "Couldn't add task", description: taskTitleRaw });
              } finally {
                aiInFlight.release('task', taskTitleRaw);
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
            const evt = toolCall.event as Partial<CalendarEvent>;
            // Dedupe: skip if we already created an event with this title in this message
            const eventTitleRaw = evt.title || 'New Event';
            const eventTitle = eventTitleRaw.toLowerCase().trim();
            if (createdEventTitles.has(eventTitle)) {
              console.warn('Duplicate event title skipped:', eventTitle);
              return;
            }

            // Daily quota backstop.
            if (!canCreateAiAction(user?.id)) {
              collectedCards.push({ type: 'event', action: 'Scheduled', title: eventTitleRaw, status: 'failed', details: 'Daily limit reached. Try again tomorrow.' });
              return;
            }
            // Cross-turn dedup against concurrent messages.
            if (!aiInFlight.claim('event', eventTitleRaw)) {
              console.warn('Event already in flight, skipping concurrent dup:', eventTitle);
              return;
            }

            createdEventTitles.add(eventTitle);
            eventsCreatedThisMessage++;

            try {
              const newEvent = await addEvent({
                title: eventTitleRaw,
                startTime: evt.startTime instanceof Date ? evt.startTime : evt.startTime ? new Date(evt.startTime) : new Date(),
                endTime: evt.endTime instanceof Date ? evt.endTime : evt.endTime ? new Date(evt.endTime) : new Date(Date.now() + 60 * 60 * 1000),
                location: evt.location,
                attendees: evt.attendees,
                recurrenceRule: evt.recurrenceRule,
                recurrenceEnd: evt.recurrenceEnd,
              });
              if (newEvent) {
                recordAiActions(user?.id, 1);
                toast({ title: 'Event Scheduled', description: newEvent.title });
                collectedCards.push({ type: 'event', action: 'Scheduled', title: newEvent.title, undo: { type: 'event', id: newEvent.id } });
              }
            } catch (err) {
              console.error('Event creation failed:', err);
              collectedCards.push({ type: 'event', action: 'Scheduled', title: eventTitleRaw, status: 'failed' });
              toast({ variant: 'destructive', title: "Couldn't schedule event", description: eventTitleRaw });
            } finally {
              aiInFlight.release('event', eventTitleRaw);
            }
          } else if (toolCall.tool === 'create_note' && toolCall.note) {
            const noteTitle = toolCall.note.title || 'Voice Note';
            const noteContent = toolCall.note.content || '';
            const noteTags = toolCall.note.tags || [];
            
            const newNote = await createNote(noteTitle, noteContent, noteTags);
            if (newNote) {
              recordAiActions(user?.id, 1);
              toast({ title: 'Note Saved', description: noteTitle });
              collectedCards.push({ type: 'note', action: 'Saved', title: noteTitle, undo: newNote.id ? { type: 'note', id: newNote.id } : undefined });
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
              if (result) { recordAiActions(user?.id, 1); toast({ title: 'Contact Added', description: contact.name }); collectedCards.push({ type: 'contact', action: 'Added', title: contact.name, undo: (result as { id?: string })?.id ? { type: 'contact', id: (result as { id: string }).id } : undefined }); }
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
                category: (contract.category || 'other') as ContractCategory,
                costAmount: contract.costAmount || null,
                costFrequency: (contract.costFrequency || 'monthly') as CostFrequency,
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
            assistantContent += '\n\n' + formatContractCostSummary(contracts);
          }
        },
        onDone: () => {
          setIsProcessing(false);
          setThinkingStatus(undefined);
          setActionCards(collectedCards);
        },
      });

      // Clean up response and add message
      const cleanContent = cleanAssistantContent(assistantContent);

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
      setThinkingStatus(undefined);
    } finally {
      sendLockRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- large AI handler; health/apple/memory deps are stable getters, adding them would cause excessive re-renders without behavior change
  }, [addMessage, addTask, addEvent, deleteTask, toggleTaskComplete, updateTask, events, messages, settings, streamChat, tasks, toast, contacts, contracts, allEmails, notes, todayHabits, familyMembers, shoppingLists, userProfile, unreadEmailCount, createNote, deleteNote, searchNotes, addContact, updateContact, deleteContact, markContacted, addContract, updateContract, deleteContract, addProject, updateProject, deleteProject, projects, createHabit, logHabit, deleteHabit, previousConversationMessages, user?.id, startConversation]);

  // Publish live conversation state to the Dori bridge so the persistent Dori
  // bar can render the conversation inline on any screen.
  useEffect(() => {
    doriConversation.publish({ messages, isProcessing: isProcessing || isStreaming, thinkingStatus, actionCards });
  }, [doriConversation, messages, isProcessing, isStreaming, thinkingStatus, actionCards]);

  // Register the send handler so any surface can drive the full 71-tool brain.
  useEffect(() => {
    doriConversation.registerSend(handleSendMessage);
  }, [doriConversation, handleSendMessage]);

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
    return addTask(task);
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
    
    return result;
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

  // Stable handlers passed to the memoized StandardMode — fresh inline closures
  // would defeat its React.memo on every Index re-render (e.g. AI streaming).
  const handleVoiceMode = useCallback(() => setMode('ghost'), []);
  const handleEditProfile = useCallback(() => setShowProfileSettings(true), []);
  const handleOpenWeeklyReview = useCallback(() => setShowWeeklyReview(true), []);
  const handleShareTask = useCallback((id: string, title: string) => {
    setShareDialog({ type: 'task', id, title });
  }, []);
  const handleShareEvent = useCallback((id: string, title: string) => {
    setShareDialog({ type: 'event', id, title });
  }, []);
  const handleShareProject = useCallback((projectId: string, projectName: string) => {
    setShareProjectDialog({ projectId, projectName });
    getProjectMembers(projectId);
  }, [getProjectMembers]);
  const handleShareProjectWithEmail = useCallback(
    (projectId: string, email: string) => shareProject(projectId, email),
    [shareProject],
  );

  // Rebuilt-every-render object literal would also break StandardMode's memo —
  // recompute only when the underlying data changes.
  const doriStats = useMemo(() => ({
    overdueTasks: tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length,
    unreadEmails: unreadEmailCount,
    todayEvents: events.filter(e => {
      const d = new Date(e.startTime);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
    pendingTasks: tasks.filter(t => !t.completed).length,
  }), [tasks, events, unreadEmailCount]);

  if (dbLoading) {
    return <BrandedLoader message="Loading your day…" />;
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
          thinkingStatus={thinkingStatus}
          actionCards={actionCards}
          doriStats={doriStats}
          onVoiceMode={handleVoiceMode}
          onEditProfile={handleEditProfile}
          settings={settings}
          onUpdateSettings={updateSettings}
          onUpdateNotifications={updateNotifications}
          onShareTask={handleShareTask}
          onShareEvent={handleShareEvent}
          onSignOut={handleSignOut}
          onOpenWeeklyReview={handleOpenWeeklyReview}
          onAddProject={addProject}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
          getProjectProgress={getProjectProgress}
          onShareProject={handleShareProject}
          onShareProjectWithEmail={handleShareProjectWithEmail}
        />
      ) : (
        <Suspense fallback={<PageFallback />}>
          <LazyGhostMode
            onClose={() => setMode('standard')}
            onCommand={handleGhostCommand}
          />
        </Suspense>
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
