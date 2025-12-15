import { useState, useCallback } from 'react';
import { Task, CalendarEvent, ChatMessage, AppMode, TaskCategory, TaskPriority } from '@/types/flux';

const generateId = () => Math.random().toString(36).substring(2, 15);

// Sample data
const initialTasks: Task[] = [
  {
    id: generateId(),
    title: 'Review Q4 budget proposal',
    description: 'Analyze the quarterly budget and prepare feedback',
    category: 'business',
    priority: 'high',
    completed: false,
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: generateId(),
    title: 'Schedule dentist appointment',
    category: 'personal',
    priority: 'medium',
    completed: false,
    createdAt: new Date(),
  },
  {
    id: generateId(),
    title: 'Prepare client presentation',
    description: 'Create slides for the product demo',
    category: 'business',
    priority: 'high',
    completed: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: generateId(),
    title: 'Buy groceries',
    category: 'personal',
    priority: 'low',
    completed: false,
    createdAt: new Date(),
  },
];

const initialEvents: CalendarEvent[] = [
  {
    id: generateId(),
    title: 'Team Standup',
    startTime: new Date(new Date().setHours(9, 0, 0, 0)),
    endTime: new Date(new Date().setHours(9, 30, 0, 0)),
    location: 'Zoom',
  },
  {
    id: generateId(),
    title: 'Product Review',
    description: 'Review new feature implementations',
    startTime: new Date(new Date().setHours(14, 0, 0, 0)),
    endTime: new Date(new Date().setHours(15, 0, 0, 0)),
    attendees: ['John', 'Sarah', 'Mike'],
  },
  {
    id: generateId(),
    title: 'Lunch with Alex',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    location: 'Downtown Cafe',
  },
];

export function useFluxState() {
  const [mode, setMode] = useState<AppMode>('standard');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: generateId(),
      createdAt: new Date(),
    };
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  const toggleTaskComplete = useCallback((id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: generateId(),
    };
    setEvents(prev => [...prev, newEvent].sort((a, b) => 
      a.startTime.getTime() - b.startTime.getTime()
    ));
    return newEvent;
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(event => 
      event.id === id ? { ...event, ...updates } : event
    ));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  }, []);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    mode,
    setMode,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    messages,
    addMessage,
    clearMessages,
    isListening,
    setIsListening,
    isProcessing,
    setIsProcessing,
  };
}
