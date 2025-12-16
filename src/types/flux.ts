export type TaskCategory = 'business' | 'personal';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ThemeMode = 'dark' | 'light';
export type ColorScheme = 'cyan' | 'purple' | 'green' | 'orange' | 'pink';
export type AssistantPersonality = 'balanced' | 'strict' | 'supportive' | 'creative';

export interface PersonalityConfig {
  id: AssistantPersonality;
  name: string;
  description: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  systemPromptAddition: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, etc. for weekly
  endDate?: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  createdAt: Date;
  dueDate?: Date;
  recurrenceRule?: string; // RRULE format
  recurrenceEnd?: Date;
  parentId?: string; // For subtasks
  sortOrder?: number; // For drag-and-drop ordering
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  recurrenceRule?: string; // RRULE format
  recurrenceEnd?: Date;
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
  assistantPersonality: AssistantPersonality;
  notifications: {
    taskReminders: boolean;
    calendarAlerts: boolean;
    reminderMinutesBefore: number;
  };
}

export const personalityConfigs: PersonalityConfig[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Friendly and helpful, adapts to your needs',
    voice: 'alloy',
    systemPromptAddition: 'Be friendly, balanced, and adaptable. Match the user\'s energy and provide helpful guidance.',
  },
  {
    id: 'strict',
    name: 'Strict Coach',
    description: 'Direct and focused, keeps you accountable',
    voice: 'onyx',
    systemPromptAddition: 'Be direct, no-nonsense, and focused on productivity. Push the user to take action immediately. Use short, commanding sentences. Hold them accountable. No excuses.',
  },
  {
    id: 'supportive',
    name: 'Supportive',
    description: 'Understanding and encouraging, celebrates wins',
    voice: 'nova',
    systemPromptAddition: 'Be warm, encouraging, and empathetic. Celebrate every small win. Understand when things are hard. Offer gentle encouragement and break tasks into manageable steps.',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Imaginative and playful, makes work fun',
    voice: 'fable',
    systemPromptAddition: 'Be playful, creative, and imaginative. Use metaphors and storytelling. Make productivity feel like an adventure. Inject humor and fun into interactions.',
  },
];

export const defaultSettings: UserSettings = {
  theme: 'dark',
  colorScheme: 'cyan',
  defaultTaskCategory: 'personal',
  defaultTaskPriority: 'medium',
  assistantPersonality: 'balanced',
  notifications: {
    taskReminders: true,
    calendarAlerts: true,
    reminderMinutesBefore: 15,
  },
};
