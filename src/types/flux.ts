export type TaskCategory = 'business' | 'personal';
export type TaskPriority = 'high' | 'medium' | 'low';

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
