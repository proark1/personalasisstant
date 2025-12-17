import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { expandRecurringItems } from '@/lib/recurrenceExpander';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addWeeks,
  addMonths,
  addDays,
  subWeeks,
  subMonths
} from 'date-fns';

type ViewMode = 'week' | 'month';

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onItemClick?: (item: { type: 'event' | 'task'; id: string }) => void;
  onToggleTaskComplete?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface CalendarItem {
  id: string;
  type: 'event' | 'task';
  title: string;
  date: Date;
  endTime?: Date;
  priority?: string;
  completed?: boolean;
  isRecurrenceInstance?: boolean;
  originalTask?: Task;
}

export function CalendarView({ 
  events, 
  tasks, 
  onItemClick, 
  onToggleTaskComplete,
  onUpdateTask,
  onDeleteTask,
  isFullscreen = false,
  onToggleFullscreen,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Calculate date range based on view mode
  const { rangeStart, rangeEnd, days } = useMemo(() => {
    let start: Date, end: Date;
    
    if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      // Extend to full weeks for month view
      start = startOfWeek(start, { weekStartsOn: 1 });
      end = endOfWeek(end, { weekStartsOn: 1 });
    }

    return {
      rangeStart: start,
      rangeEnd: end,
      days: eachDayOfInterval({ start, end }),
    };
  }, [viewMode, currentDate]);

  // Expand recurring items and combine into calendar items
  const calendarItems = useMemo(() => {
    // Expand range for recurring items (look 90 days ahead)
    const expandedEnd = addDays(rangeEnd, 90);
    
    const expandedTasks = expandRecurringItems(
      tasks.filter(t => t.dueDate && !t.parentId),
      rangeStart,
      expandedEnd
    );

    const expandedEvents = expandRecurringItems(
      events,
      rangeStart,
      expandedEnd
    );

    const items: CalendarItem[] = [];

    expandedTasks.forEach(task => {
      if (task.dueDate) {
        const originalTask = tasks.find(t => t.id === task.id.split('-instance-')[0]);
        items.push({
          id: task.id,
          type: 'task',
          title: task.title,
          date: task.dueDate,
          priority: task.priority,
          completed: task.completed,
          isRecurrenceInstance: task.isRecurrenceInstance,
          originalTask: originalTask || task,
        });
      }
    });

    expandedEvents.forEach(event => {
      items.push({
        id: event.id,
        type: 'event',
        title: event.title,
        date: event.startTime,
        endTime: event.endTime,
        isRecurrenceInstance: event.isRecurrenceInstance,
      });
    });

    return items;
  }, [tasks, events, rangeStart, rangeEnd]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    
    calendarItems.forEach(item => {
      const dateKey = format(item.date, 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(item);
    });

    // Sort items within each day
    map.forEach((items) => {
      items.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    return map;
  }, [calendarItems]);

  const navigatePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.type === 'task' && item.originalTask) {
      setEditingTask(item.originalTask);
    } else if (onItemClick) {
      onItemClick({ type: item.type, id: item.id.split('-instance-')[0] });
    }
  };

  const handleSaveTask = (id: string, updates: Partial<Task>) => {
    if (onUpdateTask) {
      onUpdateTask(id, updates);
    }
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    if (onDeleteTask) {
      onDeleteTask(id);
    }
    setEditingTask(null);
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/20 text-destructive border-destructive/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  const DayCell = ({ day }: { day: Date }) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayItems = itemsByDate.get(dateKey) || [];
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isCurrentDay = isToday(day);

    return (
      <div 
        className={cn(
          "min-h-[100px] border-r border-b border-border p-1",
          !isCurrentMonth && viewMode === 'month' && "bg-muted/30",
          isCurrentDay && "bg-primary/5"
        )}
      >
        <div className={cn(
          "text-xs font-medium mb-1 flex items-center justify-center w-6 h-6 rounded-full",
          isCurrentDay && "bg-primary text-primary-foreground",
          !isCurrentMonth && viewMode === 'month' && "text-muted-foreground"
        )}>
          {format(day, 'd')}
        </div>
        <div className="space-y-0.5">
          {dayItems.slice(0, viewMode === 'week' ? 10 : 3).map((item) => (
            <button
              key={`${item.type}-${item.id}-${item.date.getTime()}`}
              onClick={() => handleItemClick(item)}
              className={cn(
                "w-full text-left text-[10px] px-1 py-0.5 rounded truncate border transition-colors",
                item.type === 'event' 
                  ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                  : priorityColors[item.priority || 'medium'],
                item.completed && "opacity-50 line-through",
                item.isRecurrenceInstance && "border-dashed"
              )}
              title={`${item.title}${item.isRecurrenceInstance ? ' (recurring)' : ''}`}
            >
              {item.type === 'event' && (
                <span className="font-medium">{format(item.date, 'HH:mm')} </span>
              )}
              {item.title}
            </button>
          ))}
          {dayItems.length > (viewMode === 'week' ? 10 : 3) && (
            <div className="text-[10px] text-muted-foreground text-center">
              +{dayItems.length - (viewMode === 'week' ? 10 : 3)} more
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">
            {viewMode === 'week' 
              ? `Week of ${format(rangeStart, 'MMM d')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center border rounded-md">
            <Button 
              variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('week')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('month')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-background z-10">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center py-2 text-xs font-medium text-muted-foreground border-r border-border last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={cn(
          "grid grid-cols-7",
          viewMode === 'month' && "min-h-[600px]"
        )}>
          {days.map((day) => (
            <DayCell key={day.toISOString()} day={day} />
          ))}
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
