import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileLayout } from './MobileLayout';
import { ChatPanel } from '../chat/ChatPanel';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { CalendarView } from '../calendar/CalendarView';
import { TaskCategory, Task, CalendarEvent, ChatMessage } from '@/types/flux';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { List, Grid3X3 } from 'lucide-react';

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
  onUpdateEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (id: string) => void;
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
  onUpdateEvent,
  onDeleteEvent,
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
  const [calendarMode, setCalendarMode] = useState<'agenda' | 'grid'>('agenda');
  const isMobile = useIsMobile();

  // Use mobile layout on small screens
  if (isMobile) {
    return (
      <MobileLayout
        tasks={tasks}
        events={events}
        messages={messages}
        isProcessing={isProcessing}
        onAddTask={onAddTask}
        onToggleTaskComplete={onToggleTaskComplete}
        onDeleteTask={onDeleteTask}
        onDeleteTasks={onDeleteTasks}
        onUpdateTask={onUpdateTask}
        onReorderTasks={onReorderTasks}
        onAddEvent={onAddEvent}
        onUpdateEvent={onUpdateEvent}
        onDeleteEvent={onDeleteEvent}
        onImportEvents={onImportEvents}
        onSendMessage={onSendMessage}
        onGhostMode={onGhostMode}
        onOpenSettings={onOpenSettings}
        onEditProfile={onEditProfile}
        onShareTask={onShareTask}
        onShareEvent={onShareEvent}
        onSignOut={onSignOut}
      />
    );
  }

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
            <div className="h-10 px-4 flex items-center justify-end border-b border-border gap-1">
              <Button
                variant={calendarMode === 'agenda' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setCalendarMode('agenda')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={calendarMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setCalendarMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              {calendarMode === 'agenda' ? (
                <CalendarPanel
                  events={events}
                  tasks={tasks}
                  onAddEvent={onAddEvent}
                  onUpdateEvent={onUpdateEvent}
                  onDeleteEvent={onDeleteEvent}
                  onImportEvents={onImportEvents}
                  onShareEvent={onShareEvent}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                />
              ) : (
                <CalendarView
                  events={events}
                  tasks={tasks}
                  onToggleTaskComplete={onToggleTaskComplete}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
