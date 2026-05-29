import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { expandRecurringItems } from '@/lib/recurrenceExpander';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePublicHolidays } from '@/hooks/usePublicHolidays';
import { useIslamicHolidays, IslamicHoliday } from '@/hooks/useIslamicHolidays';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  Maximize2,
  Minimize2,
  Plus,
  Flag,
  Moon
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
  subMonths,
  parseISO
} from 'date-fns';
import { toValidDate, formatSafe } from '@/lib/safeDate';

type ViewMode = 'week' | 'month';

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onItemClick?: (item: { type: 'event' | 'task'; id: string }) => void;
  onToggleTaskComplete?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onAddTask?: (task: Partial<Task>) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface CalendarItem {
  id: string;
  type: 'event' | 'task' | 'holiday' | 'islamic';
  title: string;
  date: Date;
  endTime?: Date;
  priority?: string;
  completed?: boolean;
  isRecurrenceInstance?: boolean;
  originalTask?: Task;
  sharedByOwner?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  countryCode?: string;
  countryName?: string;
  islamicHoliday?: IslamicHoliday;
}

export function CalendarView({ 
  events, 
  tasks, 
  onItemClick, 
  onToggleTaskComplete,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  isFullscreen = false,
  onToggleFullscreen,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [selectedIslamicHoliday, setSelectedIslamicHoliday] = useState<IslamicHoliday | null>(null);
  
  // Fetch public holidays
  const { holidays } = usePublicHolidays();
  
  // Fetch Islamic holidays
  const { holidays: islamicHolidays } = useIslamicHolidays();

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

    // Add public holidays
    holidays.forEach(holiday => {
      const holidayDate = parseISO(holiday.date);
      items.push({
        id: `holiday-${holiday.id}`,
        type: 'holiday',
        title: `${holiday.name} (${holiday.country_name})`,
        date: holidayDate,
        countryCode: holiday.country_code,
        countryName: holiday.country_name,
      });
    });

    // Add Islamic holidays
    islamicHolidays.forEach(holiday => {
      const holidayDate = parseISO(holiday.date);
      items.push({
        id: `islamic-${holiday.id}`,
        type: 'islamic',
        title: holiday.name,
        date: holidayDate,
        islamicHoliday: holiday,
      });
    });

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
          sharedByOwner: task.sharedByOwner,
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
        sharedByOwner: event.sharedByOwner,
      });
    });

    return items;
  }, [tasks, events, rangeStart, rangeEnd, holidays, islamicHolidays]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    
    calendarItems.forEach(item => {
      const validDate = toValidDate(item.date);
      if (!validDate) return;
      const dateKey = format(validDate, 'yyyy-MM-dd');
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
    if (item.type === 'holiday') return; // Public holidays are not clickable
    if (item.type === 'islamic' && item.islamicHoliday) {
      setSelectedIslamicHoliday(item.islamicHoliday);
      return;
    }
    if (item.type === 'task' && item.originalTask) {
      setEditingTask(item.originalTask);
    } else if (onItemClick) {
      onItemClick({ type: item.type as 'event' | 'task', id: item.id.split('-instance-')[0] });
    }
  };

  const handleSaveTask = async (id: string, updates: Partial<Task>) => {
    if (onUpdateTask) {
      await Promise.resolve(onUpdateTask(id, updates));
    }
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    if (onDeleteTask) {
      onDeleteTask(id);
    }
    setEditingTask(null);
  };

  const handleAddTaskFromCalendar = (date?: Date) => {
    setNewTaskDate(date || new Date());
    setIsAddingTask(true);
  };

  const handleSaveNewTask = (id: string, updates: Partial<Task>) => {
    if (onAddTask) {
      onAddTask({
        ...updates,
        dueDate: newTaskDate || new Date(),
      });
    }
    setIsAddingTask(false);
    setNewTaskDate(null);
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
          "min-h-[100px] border-r border-b border-border p-1 group relative",
          !isCurrentMonth && viewMode === 'month' && "bg-muted/30",
          isCurrentDay && "bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between">
          <div className={cn(
            "text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full",
            isCurrentDay && "bg-primary text-primary-foreground",
            !isCurrentMonth && viewMode === 'month' && "text-muted-foreground"
          )}>
            {format(day, 'd')}
          </div>
          {onAddTask && (
            <button
              onClick={() => handleAddTaskFromCalendar(day)}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
              title="Add task"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-0.5 mt-1">
          {dayItems.slice(0, viewMode === 'week' ? 10 : 3).map((item) => (
            <button
              key={`${item.type}-${item.id}-${item.date.getTime()}`}
              onClick={() => item.type !== 'holiday' && handleItemClick(item)}
              className={cn(
                "w-full text-left text-[10px] px-1 py-0.5 rounded truncate border transition-colors flex items-center gap-1",
                item.type === 'event' 
                  ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                  : item.type === 'holiday'
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 cursor-default"
                  : item.type === 'islamic'
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer"
                  : priorityColors[item.priority || 'medium'],
                item.completed && "opacity-50 line-through",
                item.isRecurrenceInstance && "border-dashed",
                item.sharedByOwner && "ring-1 ring-primary/50"
              )}
              title={`${item.title}${item.type === 'islamic' && item.islamicHoliday ? ` - ${item.islamicHoliday.description}` : ''}${item.isRecurrenceInstance ? ' (recurring)' : ''}${item.sharedByOwner ? ` • Shared by ${item.sharedByOwner.display_name || item.sharedByOwner.email}` : ''}`}
            >
              {item.type === 'holiday' && (
                <Flag className="w-2.5 h-2.5 shrink-0" />
              )}
              {item.type === 'islamic' && (
                <Moon className="w-2.5 h-2.5 shrink-0" />
              )}
              {item.sharedByOwner && (
                <span className="w-3 h-3 rounded-full bg-primary/30 text-[6px] flex items-center justify-center font-medium shrink-0">
                  {(item.sharedByOwner.display_name || item.sharedByOwner.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
              {item.type === 'event' && (
                <span className="font-medium">{formatSafe(item.date, 'HH:mm')} </span>
              )}
              <span className="truncate">{item.title}</span>
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
          {onAddTask && (
            <Button size="sm" onClick={() => handleAddTaskFromCalendar()} className="gap-1">
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          )}
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

      {/* Add Task Modal */}
      {isAddingTask && newTaskDate && (
        <EditTaskModal
          task={{
            id: 'new',
            title: '',
            completed: false,
            priority: 'medium',
            category: 'personal',
            createdAt: new Date(),
            dueDate: newTaskDate,
          }}
          onClose={() => {
            setIsAddingTask(false);
            setNewTaskDate(null);
          }}
          onSave={handleSaveNewTask}
          onDelete={() => {
            setIsAddingTask(false);
            setNewTaskDate(null);
          }}
        />
      )}

      {/* Islamic Holiday Details Dialog */}
      <Dialog open={!!selectedIslamicHoliday} onOpenChange={(open) => !open && setSelectedIslamicHoliday(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-amber-500" />
              Islamic Event
            </DialogTitle>
          </DialogHeader>
          
          {selectedIslamicHoliday && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{selectedIslamicHoliday.name}</p>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-arabic">
                  {selectedIslamicHoliday.local_name}
                </p>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{format(parseISO(selectedIslamicHoliday.date), 'EEEE, MMMM d, yyyy')}</span>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">{selectedIslamicHoliday.description}</p>
              </div>

              {/* Actions */}
              {selectedIslamicHoliday.actions && selectedIslamicHoliday.actions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Recommended Actions:</p>
                  <ul className="space-y-1">
                    {selectedIslamicHoliday.actions.map((action, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Special Prayer */}
              {selectedIslamicHoliday.specialPrayer && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">Special Prayer:</p>
                  <p className="text-sm">{selectedIslamicHoliday.specialPrayer}</p>
                </div>
              )}

              {/* Dua */}
              {selectedIslamicHoliday.dua && (
                <div className="space-y-2 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <p className="text-sm font-medium">Recommended Dua:</p>
                  <p className="text-lg font-arabic text-right leading-relaxed text-amber-600 dark:text-amber-400">
                    {selectedIslamicHoliday.dua.arabic}
                  </p>
                  <p className="text-sm italic text-muted-foreground">
                    {selectedIslamicHoliday.dua.transliteration}
                  </p>
                  <p className="text-sm">
                    {selectedIslamicHoliday.dua.translation}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelectedIslamicHoliday(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
