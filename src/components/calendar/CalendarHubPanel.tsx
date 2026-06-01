import { useState, useEffect, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task, Project } from '@/types/flux';
import { TodayFocusPanel } from '../focus/TodayFocusPanel';
import { PullToRefresh } from '../shared/PullToRefresh';
import { SidebarFilter } from '../layout/Sidebar';
import { Zap, CheckSquare, Calendar, Loader2 } from 'lucide-react';
import { QuickAddButton } from '../tasks/QuickAddButton';
import { TaskViewSwitcher, TaskView } from '../tasks/TaskViewSwitcher';
import { PanelShell } from '@/components/ui/panel-shell';

// The Tasks and Calendar tabs pull in heavy trees (TaskList ~1.1k LOC plus
// @dnd-kit, MonthCalendarView + EditTaskModal, the alternate task boards).
// `focus` is the default tab, so defer the rest behind lazy() and only mount
// a tab once it's first been opened — first paint of this (already lazy)
// panel no longer drags those chunks in.
const TaskList = lazy(() => import('../tasks/TaskList').then((m) => ({ default: m.TaskList })));
const MonthCalendarView = lazy(() => import('./MonthCalendarView').then((m) => ({ default: m.MonthCalendarView })));
const PriorityBoardView = lazy(() => import('../tasks/PriorityBoardView').then((m) => ({ default: m.PriorityBoardView })));
const TimelineView = lazy(() => import('../tasks/TimelineView').then((m) => ({ default: m.TimelineView })));
const KanbanBoard = lazy(() => import('../tasks/KanbanBoard').then((m) => ({ default: m.KanbanBoard })));

function ViewFallback() {
  return (
    <div className="h-full flex items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Warm the two main tab chunks during idle time after the panel mounts. First
// paint stays lean (these aren't modulepreloaded), but by the time the user
// clicks Tasks/Calendar the chunk is usually already cached — no spinner.
function prefetchHeavyTabs() {
  void import('../tasks/TaskList');
  void import('./MonthCalendarView');
}

interface CalendarHubPanelProps {
  userId: string;
  onRefresh?: () => Promise<void>;
  tasks: Task[];
  sharedTasks?: Task[];
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
  sharedTasks = [],
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
  // Track which tabs have been opened so we mount a heavy tab's tree only
  // after its first visit, then keep it mounted (hidden) to preserve scroll
  // and inline-edit state across tab switches.
  const [mountedViews, setMountedViews] = useState<Set<HubView>>(() => new Set<HubView>(['focus']));

  const selectView = (id: HubView) => {
    setActiveView(id);
    setMountedViews((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  // Prefetch the heavy tabs once the browser is idle so switching to them
  // feels instant, without paying for them on first paint.
  useEffect(() => {
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    });
    if (typeof ric.requestIdleCallback === 'function') {
      const handle = ric.requestIdleCallback(prefetchHeavyTabs);
      return () => ric.cancelIdleCallback?.(handle);
    }
    const t = window.setTimeout(prefetchHeavyTabs, 1500);
    return () => window.clearTimeout(t);
  }, []);

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
            // KanbanBoard merges tasks + sharedTasks unconditionally, so it
            // can show shared cards alongside personal ones. When the parent
            // has already swapped `tasks` to the shared list (filter==='shared'),
            // pass [] here to avoid rendering each shared task twice.
            sharedTasks={filter === 'shared' ? [] : sharedTasks}
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
            sharedTasks={sharedTasks}
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
            onClick={() => selectView(view.id)}
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
      title=""
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
          {mountedViews.has('tasks') && (
            <div className={cn("h-full", activeView === 'tasks' ? 'block' : 'hidden')}>
              <Suspense fallback={<ViewFallback />}>{renderTaskView()}</Suspense>
            </div>
          )}
          {mountedViews.has('calendar') && (
            <div className={cn("h-full", activeView === 'calendar' ? 'block' : 'hidden')}>
              <Suspense fallback={<ViewFallback />}>
                <MonthCalendarView
                  events={events}
                  tasks={tasks}
                  onToggleTaskComplete={onToggleTaskComplete}
                  onUpdateTask={onUpdateTask}
                  onAddTask={onAddTask}
                />
              </Suspense>
            </div>
          )}
        </div>
      </PullToRefresh>
    </PanelShell>
  );
}