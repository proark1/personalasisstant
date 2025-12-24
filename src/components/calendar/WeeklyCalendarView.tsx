import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isToday, 
  isSameDay,
  addWeeks,
  subWeeks,
  isPast
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';

interface WeeklyCalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onToggleTaskComplete?: (id: string) => void;
  onItemClick?: (item: { id: string; type: 'event' | 'task' }) => void;
}

export function WeeklyCalendarView({
  events,
  tasks,
  onToggleTaskComplete,
  onItemClick,
}: WeeklyCalendarViewProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/20 text-destructive border-destructive/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium"
            onClick={goToToday}
          >
            {format(weekStart, 'MMM d', { locale: dateLocale })} - {format(weekEnd, 'MMM d, yyyy', { locale: dateLocale })}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateWeek('next')}
          >
            <ChevronRight className="w-4 h-4" />
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

      {/* Week Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-background z-10">
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "py-2 text-center border-r last:border-r-0 border-border",
                isToday(day) && "bg-primary/5"
              )}
            >
              <div className="text-[10px] text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: dateLocale })}
              </div>
              <div className={cn(
                "text-sm font-medium mt-0.5",
                isToday(day) && "text-primary"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 min-h-[300px]">
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate.get(dateKey) || [];
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-r last:border-r-0 border-b border-border p-1 min-h-[120px]",
                  isCurrentDay && "bg-primary/5"
                )}
              >
                <div className="space-y-1">
                  {/* Events */}
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onItemClick?.({ id: event.id, type: 'event' })}
                      className="px-1.5 py-1 text-[10px] bg-primary/20 text-primary rounded truncate cursor-pointer hover:bg-primary/30 transition-colors"
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="text-[9px] opacity-75">
                        {format(new Date(event.startTime), 'HH:mm')}
                      </div>
                    </div>
                  ))}

                  {/* Tasks */}
                  {dayTasks.map((task) => {
                    const isOverdue = task.dueDate && !task.completed && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
                    
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "px-1.5 py-1 text-[10px] rounded border cursor-pointer transition-colors",
                          task.completed 
                            ? "bg-muted/50 text-muted-foreground line-through opacity-60"
                            : priorityColors[task.priority] || priorityColors.low,
                          isOverdue && "border-destructive"
                        )}
                        onClick={() => onItemClick?.({ id: task.id, type: 'task' })}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTaskComplete?.(task.id);
                            }}
                            className="shrink-0"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Circle className="w-3 h-3" />
                            )}
                          </button>
                          <span className="truncate font-medium">{task.title}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state for today */}
                  {isCurrentDay && dayTasks.length === 0 && dayEvents.length === 0 && (
                    <div className="text-[9px] text-muted-foreground/50 text-center pt-2">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
