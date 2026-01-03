import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task, Project } from '@/types/flux';
import { TodayFocusPanel } from '../focus/TodayFocusPanel';
import { TaskList } from '../tasks/TaskList';
import { MonthCalendarView } from './MonthCalendarView';
import { PullToRefresh } from '../shared/PullToRefresh';
import { SidebarFilter } from '../layout/Sidebar';
import { Zap, CheckSquare, Calendar } from 'lucide-react';
import { QuickAddButton } from '../tasks/QuickAddButton';
interface CalendarHubPanelProps {
  userId: string;
  onRefresh?: () => Promise<void>;
  tasks: Task[];
  events: CalendarEvent[];
  filter: SidebarFilter;
  projects?: Project[];
  onFilterChange?: (filter: SidebarFilter) => void;
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
  projects = [],
  onFilterChange,
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
  onRefresh,
}: CalendarHubPanelProps) {
  const [activeView, setActiveView] = useState<HubView>('focus');

  const views = [
    { id: 'focus' as HubView, icon: Zap, label: 'Focus' },
    { id: 'tasks' as HubView, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as HubView, icon: Calendar, label: 'Calendar' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* View Switcher with Quick Add */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1 bg-muted/50 p-1 rounded-lg">
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
          <QuickAddButton onAddTask={onAddTask} projects={projects} />
        </div>
      </div>

      {/* Content with Pull-to-Refresh */}
      <PullToRefresh 
        onRefresh={onRefresh || (async () => {})} 
        className="flex-1 overflow-hidden"
      >
        <div className="h-full">
          <div className={cn("h-full", activeView === 'focus' ? 'block' : 'hidden')}>
            <TodayFocusPanel
              tasks={tasks}
              events={events}
              onToggleComplete={onToggleTaskComplete}
            />
          </div>
          <div className={cn("h-full", activeView === 'tasks' ? 'block' : 'hidden')}>
            <TaskList
              tasks={tasks}
              filter={filter}
              onFilterChange={onFilterChange}
              onToggleComplete={onToggleTaskComplete}
              onDeleteTask={onDeleteTask}
              onDeleteTasks={onDeleteTasks}
              onAddTask={onAddTask}
              onUpdateTask={onUpdateTask}
              onReorderTasks={onReorderTasks}
              onShareTask={onShareTask}
              compactMode={true}
            />
          </div>
          <div className={cn("h-full", activeView === 'calendar' ? 'block' : 'hidden')}>
            <MonthCalendarView
              events={events}
              tasks={tasks}
              onToggleTaskComplete={onToggleTaskComplete}
              onUpdateTask={onUpdateTask}
              onAddTask={onAddTask}
            />
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
}
