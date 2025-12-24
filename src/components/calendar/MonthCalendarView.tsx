import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  format, 
  startOfMonth,
  endOfMonth,
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isToday, 
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isPast
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { EditTaskModal } from '../tasks/EditTaskModal';

interface MonthCalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onToggleTaskComplete?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onItemClick?: (item: { id: string; type: 'event' | 'task' }) => void;
}

type ViewMode = 'month' | 'week';

export function MonthCalendarView({
  events,
  tasks,
  onToggleTaskComplete,
  onUpdateTask,
  onItemClick,
}: MonthCalendarViewProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Calculate days based on view mode
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
  }, [currentDate, viewMode]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.dueDate && !task.parentId) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      const dateKey = format(new Date(event.startTime), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(prev => 
        direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
      );
    } else {
      setCurrentDate(prev => 
        direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
      );
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleItemClick = (item: { id: string; type: 'event' | 'task' }) => {
    if (item.type === 'task') {
      const task = tasks.find(t => t.id === item.id);
      if (task) {
        setEditingTask(task);
      }
    } else {
      onItemClick?.(item);
    }
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/20 text-destructive border-destructive/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const headerLabel = viewMode === 'week'
    ? `${format(days[0], 'MMM d', { locale: dateLocale })} - ${format(days[days.length - 1], 'MMM d, yyyy', { locale: dateLocale })}`
    : format(currentDate, 'MMMM yyyy', { locale: dateLocale });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate('prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium min-w-[140px]"
            onClick={goToToday}
          >
            {headerLabel}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate('next')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-muted/50 p-0.5 rounded-md">
            <Button
              variant={viewMode === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={goToToday}
          >
            {t('common.today')}
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-background z-10">
          {weekDayNames.map((day) => (
            <div
              key={day}
              className="py-2 text-center border-r last:border-r-0 border-border"
            >
              <div className="text-[10px] text-muted-foreground uppercase font-medium">
                {day}
              </div>
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={cn(
          "grid grid-cols-7",
          viewMode === 'week' ? 'min-h-[300px]' : ''
        )}>
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(dateKey) || [];
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const hasItems = dayTasks.length > 0 || dayEvents.length > 0;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-r last:border-r-0 border-b border-border p-1",
                  viewMode === 'week' ? 'min-h-[120px]' : 'min-h-[80px]',
                  isCurrentDay && "bg-primary/5",
                  !isCurrentMonth && viewMode === 'month' && "bg-muted/30"
                )}
              >
                {/* Day Number */}
                <div className={cn(
                  "text-xs font-medium mb-1 px-1",
                  isCurrentDay && "text-primary",
                  !isCurrentMonth && viewMode === 'month' && "text-muted-foreground/50"
                )}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  {/* Events */}
                  {dayEvents.slice(0, viewMode === 'week' ? 5 : 2).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleItemClick({ id: event.id, type: 'event' })}
                      className="px-1 py-0.5 text-[9px] bg-primary/20 text-primary rounded truncate cursor-pointer hover:bg-primary/30 transition-colors"
                    >
                      {event.title}
                    </div>
                  ))}

                  {/* Tasks */}
                  {dayTasks.slice(0, viewMode === 'week' ? 5 : 2).map((task) => {
                    const isOverdue = task.dueDate && !task.completed && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
                    
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "px-1 py-0.5 text-[9px] rounded border cursor-pointer transition-colors",
                          task.completed 
                            ? "bg-muted/50 text-muted-foreground line-through opacity-60"
                            : priorityColors[task.priority] || priorityColors.low,
                          isOverdue && "border-destructive"
                        )}
                        onClick={() => handleItemClick({ id: task.id, type: 'task' })}
                      >
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTaskComplete?.(task.id);
                            }}
                            className="shrink-0"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <Circle className="w-2.5 h-2.5" />
                            )}
                          </button>
                          <span className="truncate">{task.title}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* More indicator */}
                  {(dayTasks.length + dayEvents.length > (viewMode === 'week' ? 5 : 2)) && (
                    <div className="text-[8px] text-muted-foreground px-1">
                      +{(dayTasks.length + dayEvents.length) - (viewMode === 'week' ? 5 : 2)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(id, updates) => {
            onUpdateTask?.(id, updates);
            setEditingTask(null);
          }}
          onDelete={() => {
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
