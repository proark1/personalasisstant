import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDatabase } from '@/hooks/useDatabase';
import { useSettings } from '@/hooks/useSettings';
import { useAIChat } from '@/hooks/useAIChat';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { StandardMode } from '@/components/layout/StandardMode';
import { GhostMode } from '@/components/ghost/GhostMode';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { EditProfileDialog } from '@/components/settings/EditProfileDialog';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { CalendarEvent, ChatMessage, AppMode } from '@/types/flux';
import { useToast } from '@/hooks/use-toast';

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
    shareItem,
    getSharedWith,
    removeShare,
  } = useDatabase(user?.id);

  // Task notifications
  useTaskNotifications({
    tasks,
    reminderMinutesBefore: settings.notifications.reminderMinutesBefore,
    enabled: settings.notifications.taskReminders,
  });

  const [mode, setMode] = useState<AppMode>('standard');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [shareDialog, setShareDialog] = useState<{
    type: 'task' | 'event';
    id: string;
    title: string;
  } | null>(null);

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
              // Dedupe: skip if we already created a task with this title in this message
              const taskTitle = (toolCall.task.title || 'New Task').toLowerCase().trim();
              if (createdTaskTitles.has(taskTitle)) {
                console.warn('Duplicate task title skipped:', taskTitle);
                return;
              }
              createdTaskTitles.add(taskTitle);
              tasksCreatedThisMessage++;
              
              const newTask = await addTask({
                title: toolCall.task.title || 'New Task',
                category: toolCall.task.category || settings.defaultTaskCategory,
                priority: toolCall.task.priority || settings.defaultTaskPriority,
                completed: false,
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
  }, [addMessage, addTask, addEvent, deleteTask, toggleTaskComplete, events, messages, settings, streamChat, tasks, toast]);

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
    const result = await addEvent(event);
    return result as any;
  }, [addEvent]);

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
    <>
      {mode === 'standard' ? (
        <StandardMode
          tasks={tasks}
          events={events}
          messages={messages}
          isProcessing={isProcessing || isStreaming}
          onAddTask={handleAddTask}
          onToggleTaskComplete={toggleTaskComplete}
          onDeleteTask={deleteTask}
          onDeleteTasks={handleDeleteTasks}
          onUpdateTask={updateTask}
          onReorderTasks={reorderTasks}
          onAddEvent={handleAddEvent}
          onImportEvents={handleImportEvents}
          onSendMessage={handleSendMessage}
          onGhostMode={() => setMode('ghost')}
          onOpenSettings={() => setShowSettings(true)}
          onEditProfile={() => setShowEditProfile(true)}
          onShareTask={(id, title) => setShareDialog({ type: 'task', id, title })}
          onShareEvent={(id, title) => setShareDialog({ type: 'event', id, title })}
          onSignOut={handleSignOut}
        />
      ) : (
        <GhostMode 
          onClose={() => setMode('standard')}
          onCommand={handleGhostCommand}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onUpdateNotifications={updateNotifications}
          onClose={() => setShowSettings(false)}
        />
      )}

      <EditProfileDialog
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      {shareDialog && (
        <ShareDialog
          itemType={shareDialog.type}
          itemId={shareDialog.id}
          itemTitle={shareDialog.title}
          onShare={(email, permission) => shareItem(shareDialog.type, shareDialog.id, email, permission)}
          onGetSharedWith={() => getSharedWith(shareDialog.type, shareDialog.id)}
          onRemoveShare={removeShare}
          onClose={() => setShareDialog(null)}
        />
      )}
    </>
  );
};

export default Index;
