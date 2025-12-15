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
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSendMessage: (content: string) => void;
  onGhostMode: () => void;
  onOpenSettings: () => void;
}

export function StandardMode({
  tasks,
  events,
  messages,
  isProcessing,
  onAddTask,
  onToggleTaskComplete,
  onDeleteTask,
  onAddEvent,
  onImportEvents,
  onSendMessage,
  onGhostMode,
  onOpenSettings,
}: StandardModeProps) {
  const [filter, setFilter] = useState<TaskCategory | 'all'>('all');

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar 
        activeFilter={filter} 
        onFilterChange={setFilter}
        onGhostMode={onGhostMode}
        onOpenSettings={onOpenSettings}
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
              onAddTask={onAddTask}
            />
          </div>

          {/* Calendar */}
          <div className="h-80 glass-panel-solid rounded-xl overflow-hidden">
            <CalendarPanel
              events={events}
              onAddEvent={onAddEvent}
              onImportEvents={onImportEvents}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
