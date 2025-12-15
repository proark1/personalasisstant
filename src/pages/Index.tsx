import { useState, useCallback, useEffect } from 'react';
import { useFluxState } from '@/hooks/useFluxState';
import { useSettings } from '@/hooks/useSettings';
import { useAIChat } from '@/hooks/useAIChat';
import { StandardMode } from '@/components/layout/StandardMode';
import { GhostMode } from '@/components/ghost/GhostMode';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { Task, CalendarEvent } from '@/types/flux';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { toast } = useToast();
  const { settings, updateSettings, updateNotifications } = useSettings();
  const { streamChat, isStreaming } = useAIChat();
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    mode,
    setMode,
    tasks,
    addTask,
    toggleTaskComplete,
    deleteTask,
    events,
    addEvent,
    messages,
    addMessage,
    isProcessing,
    setIsProcessing,
  } = useFluxState();

  // Handle escape key to exit ghost mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'ghost') {
        setMode('standard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, setMode]);

  // Handle AI chat with real streaming
  const handleSendMessage = useCallback(async (content: string) => {
    addMessage({ role: 'user', content });
    setIsProcessing(true);

    let assistantContent = '';
    const assistantMessageId = addMessage({ role: 'assistant', content: '' });

    try {
      await streamChat({
        messages: [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user' as const, content }],
        tasks,
        events,
        onDelta: (delta) => {
          assistantContent += delta;
          // Update the assistant message with streamed content
          // We'll update the last message in state
        },
        onToolCall: (toolCall) => {
          if (toolCall.tool === 'manage_task' && toolCall.task) {
            if (toolCall.action === 'add') {
              const newTask = addTask({
                title: toolCall.task.title || 'New Task',
                category: toolCall.task.category || settings.defaultTaskCategory,
                priority: toolCall.task.priority || settings.defaultTaskPriority,
                completed: false,
              });
              toast({
                title: 'Task Added',
                description: newTask.title,
              });
            } else if (toolCall.action === 'complete' && toolCall.task.id) {
              toggleTaskComplete(toolCall.task.id);
              toast({
                title: 'Task Completed',
                description: toolCall.task.title,
              });
            } else if (toolCall.action === 'delete' && toolCall.task.id) {
              deleteTask(toolCall.task.id);
              toast({
                title: 'Task Deleted',
                description: toolCall.task.title,
              });
            }
          } else if (toolCall.tool === 'schedule_event' && toolCall.event) {
            const newEvent = addEvent({
              title: toolCall.event.title || 'New Event',
              startTime: toolCall.event.startTime || new Date(),
              endTime: toolCall.event.endTime || new Date(Date.now() + 60 * 60 * 1000),
              location: toolCall.event.location,
              attendees: toolCall.event.attendees,
            });
            toast({
              title: 'Event Scheduled',
              description: newEvent.title,
            });
          }
        },
        onDone: () => {
          setIsProcessing(false);
        },
      });

      // Update the assistant message with final content
      // Remove tool call markup for cleaner display
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
        content: "I'm sorry, I encountered an error. Please try again." 
      });
      setIsProcessing(false);
    }
  }, [addMessage, addTask, addEvent, deleteTask, toggleTaskComplete, events, messages, settings, setIsProcessing, streamChat, tasks, toast]);

  const handleGhostCommand = useCallback((command: string) => {
    handleSendMessage(command);
  }, [handleSendMessage]);

  const handleImportEvents = useCallback((importedEvents: CalendarEvent[]) => {
    importedEvents.forEach(event => {
      addEvent({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        attendees: event.attendees,
      });
    });
  }, [addEvent]);

  return (
    <>
      {mode === 'standard' ? (
        <StandardMode
          tasks={tasks}
          events={events}
          messages={messages}
          isProcessing={isProcessing || isStreaming}
          onAddTask={addTask}
          onToggleTaskComplete={toggleTaskComplete}
          onDeleteTask={deleteTask}
          onAddEvent={addEvent}
          onImportEvents={handleImportEvents}
          onSendMessage={handleSendMessage}
          onGhostMode={() => setMode('ghost')}
          onOpenSettings={() => setShowSettings(true)}
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
    </>
  );
};

export default Index;
