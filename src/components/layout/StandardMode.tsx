import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatPanel } from '../chat/ChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { TaskCategory, Task, CalendarEvent, ChatMessage } from '@/types/flux';

interface StandardModeProps {
  tasks: Task[];
  events: CalendarEvent[];
  messages: ChatMessage[];
  isProcessing: boolean;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onToggleTaskComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTasks?: (ids: string[]) => Promise<{ error: string | null }> | void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onReorderTasks?: (taskOrders: { id: string; sortOrder: number }[]) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSendMessage: (content: string) => void;
  onGhostMode: () => void;
  onOpenSettings: () => void;
  onEditProfile?: () => void;
  onShareTask?: (id: string, title: string) => void;
  onShareEvent?: (id: string, title: string) => void;
  onSignOut?: () => void;
}

export function StandardMode({
  tasks,
  events,
  messages,
  isProcessing,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onDeleteTasks,
  onUpdateTask,
  onReorderTasks,
  onAddEvent,
  onImportEvents,
  onSendMessage,
  onGhostMode,
  onOpenSettings,
  onEditProfile,
  onShareTask,
  onShareEvent,
  onSignOut,
}: StandardModeProps) {
  const [filter, setFilter] = useState<TaskCategory | 'all'>('all');

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar 
        activeFilter={filter} 
        onFilterChange={setFilter}
        onGhostMode={onGhostMode}
        onOpenSettings={onOpenSettings}
        onEditProfile={onEditProfile}
        onSignOut={onSignOut}
      />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-[400px] border-r border-border flex flex-col glass-panel-solid m-2 mr-1 rounded-xl overflow-hidden">
          <ChatPanel 
            messages={messages}
            onSendMessage={onSendMessage}
            isProcessing={isProcessing}
          />
        </div>

        {/* Right Side - Tasks & Calendar */}
        <div className="flex-1 flex flex-col p-2 pl-1 gap-2">
          {/* Tasks */}
          <div className="flex-1 glass-panel-solid rounded-xl overflow-hidden">
            <TaskList
              tasks={tasks}
              filter={filter}
              onToggleComplete={onToggleTaskComplete}
              onDeleteTask={onDeleteTask}
              onDeleteTasks={onDeleteTasks}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onReorderTasks={onReorderTasks}
              onShareTask={onShareTask}
            />
          </div>

          {/* Calendar */}
          <div className="h-80 glass-panel-solid rounded-xl overflow-hidden">
            <CalendarPanel
              events={events}
              onAddEvent={onAddEvent}
              onImportEvents={onImportEvents}
              onShareEvent={onShareEvent}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
