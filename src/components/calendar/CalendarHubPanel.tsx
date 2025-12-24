import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { TodayFocusView } from '../focus/TodayFocusView';
import { TaskList } from '../tasks/TaskList';
import { CalendarPanel } from './CalendarPanel';
import { SidebarFilter } from '../layout/Sidebar';
import { Zap, CheckSquare, Calendar } from 'lucide-react';

interface CalendarHubPanelProps {
  userId: string;
  tasks: Task[];
  events: CalendarEvent[];
  filter: SidebarFilter;
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
  onShareTask?: (id: string, title: string) => void;
  onShareEvent?: (id: string, title: string) => void;
}

type HubView = 'focus' | 'tasks' | 'calendar';

export function CalendarHubPanel({
  userId,
  tasks,
  events,
  filter,
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
  onShareTask,
  onShareEvent,
}: CalendarHubPanelProps) {
  const [activeView, setActiveView] = useState<HubView>('focus');

  const views = [
    { id: 'focus' as HubView, icon: Zap, label: 'Focus' },
    { id: 'tasks' as HubView, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as HubView, icon: Calendar, label: 'Calendar' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* View Switcher */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
          {views.map((view) => (
            <Button
              key={view.id}
              variant={activeView === view.id ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "flex-1 gap-1.5",
                activeView === view.id && "bg-background shadow-sm"
              )}
              onClick={() => setActiveView(view.id)}
            >
              <view.icon className="w-4 h-4" />
              <span className="text-xs">{view.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className={cn("h-full", activeView === 'focus' ? 'block' : 'hidden')}>
          <TodayFocusView
            tasks={tasks}
            events={events}
            onToggleComplete={onToggleTaskComplete}
            onClose={() => setActiveView('tasks')}
          />
        </div>
        <div className={cn("h-full", activeView === 'tasks' ? 'block' : 'hidden')}>
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
        <div className={cn("h-full", activeView === 'calendar' ? 'block' : 'hidden')}>
          <CalendarPanel
            events={events}
            tasks={tasks}
            onAddEvent={onAddEvent}
            onUpdateEvent={onUpdateEvent}
            onDeleteEvent={onDeleteEvent}
            onImportEvents={onImportEvents}
            onShareEvent={onShareEvent}
            onShareTask={onShareTask}
            onToggleTaskComplete={onToggleTaskComplete}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        </div>
      </div>
    </div>
  );
}
