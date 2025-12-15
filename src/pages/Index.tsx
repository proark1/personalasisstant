import { useState, useCallback, useEffect } from 'react';
import { useFluxState } from '@/hooks/useFluxState';
import { StandardMode } from '@/components/layout/StandardMode';
import { GhostMode } from '@/components/ghost/GhostMode';
import { Task, CalendarEvent } from '@/types/flux';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { toast } = useToast();
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

  // Simulate AI response for chat
  const handleSendMessage = useCallback(async (content: string) => {
    addMessage({ role: 'user', content });
    setIsProcessing(true);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate contextual response
    let response = '';
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('add') && lowerContent.includes('task')) {
      const taskTitle = content.replace(/add (a )?task( to)?/i, '').trim() || 'New Task';
      addTask({
        title: taskTitle,
        category: lowerContent.includes('business') ? 'business' : 'personal',
        priority: lowerContent.includes('high') ? 'high' : lowerContent.includes('low') ? 'low' : 'medium',
        completed: false,
      });
      response = `I've added "${taskTitle}" to your task list. Is there anything else you'd like me to help with?`;
      toast({
        title: "Task Added",
        description: taskTitle,
      });
    } else if (lowerContent.includes('schedule') || lowerContent.includes('meeting')) {
      const title = 'New Meeting';
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      
      addEvent({
        title,
        startTime,
        endTime,
      });
      response = `I've scheduled "${title}" for ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to add any details or attendees?`;
      toast({
        title: "Event Scheduled",
        description: title,
      });
    } else if (lowerContent.includes('agenda') || lowerContent.includes('today')) {
      const todayEvents = events.filter(e => {
        const today = new Date();
        return e.startTime.toDateString() === today.toDateString();
      });
      
      if (todayEvents.length === 0) {
        response = "Your schedule is clear today. Would you like me to help you plan something?";
      } else {
        response = `Today you have ${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''}: ${todayEvents.map(e => e.title).join(', ')}. Need me to add anything else?`;
      }
    } else {
      response = "I can help you manage tasks, schedule events, and stay organized. Try asking me to 'add a task' or 'schedule a meeting', or ask 'what's on my agenda today?'";
    }

    addMessage({ 
      role: 'assistant', 
      content: response,
    });
    setIsProcessing(false);
  }, [addMessage, addTask, addEvent, events, setIsProcessing, toast]);

  const handleGhostCommand = useCallback((command: string) => {
    // Process voice commands
    handleSendMessage(command);
  }, [handleSendMessage]);

  return (
    <>
      {mode === 'standard' ? (
        <StandardMode
          tasks={tasks}
          events={events}
          messages={messages}
          isProcessing={isProcessing}
          onAddTask={addTask}
          onToggleTaskComplete={toggleTaskComplete}
          onDeleteTask={deleteTask}
          onAddEvent={addEvent}
          onSendMessage={handleSendMessage}
          onGhostMode={() => setMode('ghost')}
        />
      ) : (
        <GhostMode 
          onClose={() => setMode('standard')}
          onCommand={handleGhostCommand}
        />
      )}
    </>
  );
};

export default Index;
