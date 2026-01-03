import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarEvent, Task } from '@/types/flux';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePublicHolidays } from '@/hooks/usePublicHolidays';
import { useIslamicHolidays, IslamicHoliday } from '@/hooks/useIslamicHolidays';
import { expandRecurringItems } from '@/lib/recurrenceExpander';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  Plus,
  Flag,
  Moon
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
  isPast,
  parseISO
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { EditTaskModal } from '../tasks/EditTaskModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface MonthCalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onToggleTaskComplete?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onItemClick?: (item: { id: string; type: 'event' | 'task' }) => void;
}

type ViewMode = 'month' | 'week';

export function MonthCalendarView({
  events,
  tasks,
  onToggleTaskComplete,
  onUpdateTask,
  onAddTask,
  onItemClick,
}: MonthCalendarViewProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [selectedDateForTask, setSelectedDateForTask] = useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState<'personal' | 'business'>('personal');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedHoliday, setSelectedHoliday] = useState<{
    name: string;
    local_name: string | null;
    date: string;
    country_name: string;
    country_code: string;
  } | null>(null);
  const [selectedIslamicHoliday, setSelectedIslamicHoliday] = useState<IslamicHoliday | null>(null);
  
  // Fetch public holidays
  const { holidays } = usePublicHolidays();
  
  // Fetch Islamic holidays
  const { holidays: islamicHolidays } = useIslamicHolidays();

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

  // Expand recurring tasks/events within the visible range
  const { expandedTasks, expandedEvents } = useMemo(() => {
    if (days.length === 0) return { expandedTasks: tasks, expandedEvents: events };

    const rangeStart = days[0];
    const rangeEnd = days[days.length - 1];

    return {
      expandedTasks: expandRecurringItems(
        tasks.filter(t => t.dueDate && !t.parentId),
        rangeStart,
        rangeEnd
      ),
      expandedEvents: expandRecurringItems(events, rangeStart, rangeEnd),
    };
  }, [tasks, events, days]);

  // Group tasks by date (including recurrence instances)
  const tasksByDate = useMemo(() => {
    const map = new Map<string, (Task & { isRecurrenceInstance?: boolean })[]>();
    expandedTasks.forEach(task => {
      if (task.dueDate && !task.parentId) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [expandedTasks]);

  // Group events by date (including recurrence instances)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    expandedEvents.forEach(event => {
      const dateKey = format(new Date(event.startTime), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [expandedEvents]);

  // Group holidays by date
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, typeof holidays>();
    holidays.forEach(holiday => {
      const dateKey = holiday.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(holiday);
    });
    return map;
  }, [holidays]);

  // Group Islamic holidays by date
  const islamicHolidaysByDate = useMemo(() => {
    const map = new Map<string, IslamicHoliday[]>();
    islamicHolidays.forEach(holiday => {
      const dateKey = holiday.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(holiday);
    });
    return map;
  }, [islamicHolidays]);

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

  const handleDayClick = (day: Date) => {
    setSelectedDateForTask(day);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskCategory('personal');
    setNewTaskDescription('');
    setShowAddTaskDialog(true);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedDateForTask || !onAddTask) return;

    try {
      await Promise.resolve(
        onAddTask({
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || undefined,
          priority: newTaskPriority,
          category: newTaskCategory,
          dueDate: selectedDateForTask,
          completed: false,
          status: 'backlog',
        } as Omit<Task, 'id' | 'createdAt'>)
      );

      setShowAddTaskDialog(false);
      setSelectedDateForTask(null);
    } catch (e) {
      console.error('Failed to create task from calendar:', e);
    }
  };

  const handleItemClick = (item: { id: string; type: 'event' | 'task' }) => {
    if (item.type === 'task') {
      const baseId = item.id.split('-instance-')[0];
      const task = tasks.find(t => t.id === baseId);
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
            const dayHolidays = holidaysByDate.get(dateKey) || [];
            const dayIslamicHolidays = islamicHolidaysByDate.get(dateKey) || [];
            const isCurrentDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const totalItems = dayTasks.length + dayEvents.length + dayHolidays.length + dayIslamicHolidays.length;

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "border-r last:border-r-0 border-b border-border p-1 cursor-pointer hover:bg-muted/50 transition-colors",
                  viewMode === 'week' ? 'min-h-[120px]' : 'min-h-[80px]',
                  isCurrentDay && "bg-primary/5",
                  !isCurrentMonth && viewMode === 'month' && "bg-muted/30"
                )}
              >
                {/* Day Number */}
                <div className={cn(
                  "text-xs font-medium mb-1 px-1 flex items-center justify-between",
                  isCurrentDay && "text-primary",
                  !isCurrentMonth && viewMode === 'month' && "text-muted-foreground/50"
                )}>
                  <span>{format(day, 'd')}</span>
                  <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  {/* Public Holidays */}
                  {dayHolidays.slice(0, viewMode === 'week' ? 2 : 1).map((holiday) => (
                    <div
                      key={holiday.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHoliday({
                          name: holiday.name,
                          local_name: holiday.local_name,
                          date: holiday.date,
                          country_name: holiday.country_name,
                          country_code: holiday.country_code,
                        });
                      }}
                      className="px-1 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded truncate flex items-center gap-0.5 cursor-pointer hover:bg-emerald-500/30 transition-colors"
                      title={`${holiday.name} (${holiday.country_name})`}
                    >
                      <Flag className="w-2 h-2 shrink-0" />
                      <span className="truncate">{holiday.name}</span>
                    </div>
                  ))}

                  {/* Islamic Holidays */}
                  {dayIslamicHolidays.slice(0, viewMode === 'week' ? 2 : 1).map((holiday) => (
                    <div
                      key={holiday.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIslamicHoliday(holiday);
                      }}
                      className="px-1 py-0.5 text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded truncate flex items-center gap-0.5 cursor-pointer hover:bg-amber-500/30 transition-colors"
                      title={`${holiday.name} - ${holiday.local_name}`}
                    >
                      <Moon className="w-2 h-2 shrink-0" />
                      <span className="truncate">{holiday.name}</span>
                    </div>
                  ))}

                  {/* Events */}
                  {dayEvents.slice(0, viewMode === 'week' ? 5 : 2).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick({ id: event.id, type: 'event' });
                      }}
                      className="px-1 py-0.5 text-[9px] bg-primary/20 text-primary rounded truncate cursor-pointer hover:bg-primary/30 transition-colors"
                    >
                      {event.title}
                    </div>
                  ))}

                  {/* Tasks */}
                  {dayTasks.slice(0, viewMode === 'week' ? 5 : 2).map((task) => {
                    const isOverdue = task.dueDate && !task.completed && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
                    const baseId = task.id.split('-instance-')[0];
                    
                    return (
                      <div
                        key={`${task.id}-${task.dueDate?.toString()}`}
                        className={cn(
                          "px-1 py-0.5 text-[9px] rounded border cursor-pointer transition-colors",
                          task.completed 
                            ? "bg-muted/50 text-muted-foreground line-through opacity-60"
                            : priorityColors[task.priority] || priorityColors.low,
                          isOverdue && "border-destructive",
                          task.isRecurrenceInstance && "border-dashed"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick({ id: task.id, type: 'task' });
                        }}
                      >
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTaskComplete?.(baseId);
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
                  {totalItems > (viewMode === 'week' ? 5 : 2) && (
                    <div className="text-[8px] text-muted-foreground px-1">
                      +{totalItems - (viewMode === 'week' ? 5 : 2)} more
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
           onSave={async (id, updates) => {
             try {
               await Promise.resolve(onUpdateTask?.(id, updates));
               setEditingTask(null);
             } catch (e) {
               console.error('Failed to update task from calendar:', e);
               throw e;
             }
           }}
          onDelete={() => {
            setEditingTask(null);
          }}
        />
      )}

      {/* Add Task Dialog */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('tasks.addTask')} - {selectedDateForTask && format(selectedDateForTask, 'PP', { locale: dateLocale })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">{t('tasks.title')}</Label>
              <Input
                id="task-title"
                placeholder={t('tasks.titlePlaceholder') || 'Task title...'}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">{t('tasks.description')}</Label>
              <Textarea
                id="task-description"
                placeholder={t('tasks.descriptionPlaceholder') || 'Description (optional)...'}
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('tasks.priority')}</Label>
                <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as 'low' | 'medium' | 'high')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('tasks.category')}</Label>
                <Select value={newTaskCategory} onValueChange={(v) => setNewTaskCategory(v as 'personal' | 'business')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">{t('category.personal')}</SelectItem>
                    <SelectItem value="business">{t('category.business')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
                {t('tasks.addTask')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Holiday Details Dialog */}
      <Dialog open={!!selectedHoliday} onOpenChange={(open) => !open && setSelectedHoliday(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-emerald-500" />
              Public Holiday
            </DialogTitle>
          </DialogHeader>
          
          {selectedHoliday && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-lg font-semibold">{selectedHoliday.name}</p>
                {selectedHoliday.local_name && selectedHoliday.local_name !== selectedHoliday.name && (
                  <p className="text-sm text-muted-foreground italic">
                    {selectedHoliday.local_name}
                  </p>
                )}
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{format(parseISO(selectedHoliday.date), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedHoliday.country_name} ({selectedHoliday.country_code})</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelectedHoliday(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                  <span>{format(parseISO(selectedIslamicHoliday.date), 'EEEE, MMMM d, yyyy', { locale: dateLocale })}</span>
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
