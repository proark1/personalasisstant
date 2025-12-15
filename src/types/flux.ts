export type TaskCategory = 'business' | 'personal';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ThemeMode = 'dark' | 'light';
export type ColorScheme = 'cyan' | 'purple' | 'green' | 'orange' | 'pink';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  createdAt: Date;
  dueDate?: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export type AppMode = 'standard' | 'ghost';

export interface FluxState {
  mode: AppMode;
  tasks: Task[];
  events: CalendarEvent[];
  messages: ChatMessage[];
  isListening: boolean;
  isProcessing: boolean;
}

export interface UserSettings {
  theme: ThemeMode;
  colorScheme: ColorScheme;
  defaultTaskCategory: TaskCategory;
  defaultTaskPriority: TaskPriority;
  notifications: {
    taskReminders: boolean;
    calendarAlerts: boolean;
    reminderMinutesBefore: number;
  };
}

export const defaultSettings: UserSettings = {
  theme: 'dark',
  colorScheme: 'cyan',
  defaultTaskCategory: 'personal',
  defaultTaskPriority: 'medium',
  notifications: {
    taskReminders: true,
    calendarAlerts: true,
    reminderMinutesBefore: 15,
  },
};
