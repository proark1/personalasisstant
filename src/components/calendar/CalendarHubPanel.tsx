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
import { TaskViewSwitcher, TaskView } from '../tasks/TaskViewSwitcher';
import { PriorityBoardView } from '../tasks/PriorityBoardView';
import { TimelineView } from '../tasks/TimelineView';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { PanelShell } from '@/components/ui/panel-shell';

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
  const [taskView, setTaskView] = useState<TaskView>('list');

  const views = [
    { id: 'focus' as HubView, icon: Zap, label: 'Focus' },
    { id: 'tasks' as HubView, icon: CheckSquare, label: 'Tasks' },
    { id: 'calendar' as HubView, icon: Calendar, label: 'Calendar' },
  ];

  const renderTaskView = () => {
    switch (taskView) {
      case 'kanban':
        return (
          <KanbanBoard
            tasks={tasks}
            projects={projects}
            onUpdateTask={onUpdateTask || (() => {})}
            onToggleComplete={onToggleTaskComplete}
            onDeleteTask={onDeleteTask}
          />
        );
      case 'priority':
        return (
          <PriorityBoardView
            tasks={tasks}
            onToggleComplete={onToggleTaskComplete}
            onDeleteTask={onDeleteTask}
            onUpdateTask={onUpdateTask}
          />
        );
      case 'timeline':
        return (
          <TimelineView
            tasks={tasks}
            onToggleComplete={onToggleTaskComplete}
            onDeleteTask={onDeleteTask}
            onUpdateTask={onUpdateTask}
          />
        );
      default:
        return (
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
        );
    }
  };

  const viewSwitcher = (
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
  );

  return (
    <PanelShell
      icon={Calendar}
      title="Planner"
      headerExtra={viewSwitcher}
      noPadding
    >

      {/* Task View Switcher - only shown in Tasks tab */}
      {activeView === 'tasks' && (
        <div className="px-4 py-1.5 border-b border-border shrink-0 flex justify-center">
          <TaskViewSwitcher activeView={taskView} onViewChange={setTaskView} />
        </div>
      )}

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
            {renderTaskView()}
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
    </PanelShell>
  );
}