import { useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarEvent, Task } from '@/types/flux';
import { parseICS, validateICSFile } from '@/lib/icsParser';
import { useToast } from '@/hooks/use-toast';
import { RecurrenceSelector } from '@/components/shared/RecurrenceSelector';
import { getRecurrenceDescription } from '@/lib/recurrence';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus,
  ChevronRight,
  Upload,
  FileUp,
  Share2,
  Repeat,
  CheckSquare,
  AlertCircle,
  Maximize2,
  Minimize2,
  Pencil,
  UserCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, isPast } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

interface CalendarPanelProps {
  events: CalendarEvent[];
  tasks?: Task[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onShareEvent?: (id: string, title: string) => void;
  onShareTask?: (id: string, title: string) => void;
  onToggleTaskComplete?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onUpdateEvent?: (id: string, updates: Partial<CalendarEvent>) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteEvent?: (id: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface CalendarItem {
  id: string;
  type: 'event' | 'task';
  title: string;
  date: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  recurrenceRule?: string;
  recurrenceEnd?: Date;
  priority?: string;
  completed?: boolean;
  isOverdue?: boolean;
  description?: string;
  category?: string;
  reminderBefore?: number;
  sharedBy?: { displayName?: string; email?: string };
}

interface GroupedItems {
  label: string;
  date: Date;
  items: CalendarItem[];
}

export function CalendarPanel({ 
  events, 
  tasks = [], 
  onAddEvent, 
  onImportEvents, 
  onShareEvent,
  onShareTask,
  onToggleTaskComplete,
  onUpdateTask,
  onUpdateEvent,
  onDeleteTask,
  onDeleteEvent,
  isFullscreen = false,
  onToggleFullscreen,
}: CalendarPanelProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine events and tasks with due dates into calendar items
  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];

    // Add events
    events.forEach(event => {
      items.push({
        id: event.id,
        type: 'event',
        title: event.title,
        date: event.startTime,
        endTime: event.endTime,
        location: event.location,
        attendees: event.attendees,
        recurrenceRule: event.recurrenceRule,
        recurrenceEnd: event.recurrenceEnd,
        description: event.description,
        sharedBy: event.sharedBy,
      });
    });

    // Add tasks with due dates
    tasks.filter(task => task.dueDate && !task.parentId).forEach(task => {
      const isOverdue = task.dueDate && !task.completed && isPast(task.dueDate) && !isToday(task.dueDate);
      items.push({
        id: task.id,
        type: 'task',
        title: task.title,
        date: task.dueDate!,
        priority: task.priority,
        completed: task.completed,
        recurrenceRule: task.recurrenceRule,
        recurrenceEnd: task.recurrenceEnd,
        isOverdue,
        description: task.description,
        category: task.category,
        reminderBefore: task.reminderBefore,
        sharedBy: task.sharedBy,
      });
    });

    return items;
  }, [events, tasks]);

  // Group items by date
  const groupedItems: GroupedItems[] = useMemo(() => {
    const itemsByDate = new Map<string, CalendarItem[]>();

    calendarItems.forEach(item => {
      const dateKey = startOfDay(item.date).toISOString();
      if (!itemsByDate.has(dateKey)) {
        itemsByDate.set(dateKey, []);
      }
      itemsByDate.get(dateKey)!.push(item);
    });

    // Sort and create groups
    const sortedDates = Array.from(itemsByDate.keys()).sort();
    return sortedDates.map(dateKey => {
      const date = new Date(dateKey);
      let label = format(date, 'EEEE, MMMM d', { locale: dateLocale });
      if (isToday(date)) label = t('common.today');
      else if (isTomorrow(date)) label = t('common.tomorrow');

      return {
        label,
        date,
        items: itemsByDate.get(dateKey)!.sort((a, b) => 
          a.date.getTime() - b.date.getTime()
        ),
      };
    });
  }, [calendarItems, dateLocale, t]);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateICSFile(file)) {
      toast({
        variant: 'destructive',
        title: t('calendar.invalidFile'),
        description: t('calendar.invalidFileDesc'),
      });
      return;
    }

    setIsImporting(true);
    try {
      const content = await file.text();
      const importedEvents = parseICS(content);
      
      if (importedEvents.length === 0) {
        toast({
          variant: 'destructive',
          title: t('calendar.noEventsFound'),
          description: t('calendar.noEventsFoundDesc'),
        });
        return;
      }

      if (onImportEvents) {
        onImportEvents(importedEvents);
      } else {
        importedEvents.forEach(event => {
          onAddEvent({
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            attendees: event.attendees,
          });
        });
      }

      toast({
        title: t('calendar.importSuccess'),
        description: t('calendar.importedEvents').replace('{count}', importedEvents.length.toString()),
      });
    } catch (error) {
      console.error('ICS import error:', error);
      toast({
        variant: 'destructive',
        title: t('calendar.importFailed'),
        description: t('calendar.importFailedDesc'),
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleEditItem = (item: CalendarItem) => {
    if (item.type === 'task') {
      // Find the full task object to edit
      const fullTask = tasks.find(t => t.id === item.id);
      if (fullTask) {
        setEditingTask(fullTask);
      }
    } else {
      // For events, we'll use a simplified edit for now
      // Convert to task-like object for editing
      const taskLike: Task = {
        id: item.id,
        title: item.title,
        description: item.description,
        dueDate: item.date,
        priority: 'medium',
        category: 'personal',
        completed: false,
        createdAt: new Date(),
        recurrenceRule: item.recurrenceRule,
        recurrenceEnd: item.recurrenceEnd,
      };
      setEditingTask(taskLike);
    }
  };

  const handleSaveTask = async (id: string, updates: Partial<Task>) => {
    // Check if this is actually an event
    const isEvent = events.some(e => e.id === id);

    if (isEvent && onUpdateEvent) {
      await Promise.resolve(
        onUpdateEvent(id, {
          title: updates.title,
          startTime: updates.dueDate,
          endTime: updates.dueDate ? new Date(updates.dueDate.getTime() + 60 * 60 * 1000) : undefined,
        })
      );
    } else if (onUpdateTask) {
      await Promise.resolve(onUpdateTask(id, updates));
    }

    toast({ title: t('calendar.updatedSuccess') });
  };

  const handleDeleteItem = (id: string) => {
    const isEvent = events.some(e => e.id === id);
    
    if (isEvent && onDeleteEvent) {
      onDeleteEvent(id);
    } else if (onDeleteTask) {
      onDeleteTask(id);
    }
    setEditingTask(null);
    toast({ title: t('calendar.deletedSuccess') });
  };

  const priorityColors: Record<string, string> = {
    high: 'text-destructive',
    medium: 'text-warning',
    low: 'text-muted-foreground',
  };

  const ItemCard = ({ item }: { item: CalendarItem }) => (
    <div 
      onClick={() => handleEditItem(item)}
      className={cn(
        "flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer",
        item.completed && "opacity-60",
        item.isOverdue && "border-l-2 border-l-destructive"
      )}
    >
      <div className={cn(
        "w-1 rounded-full shrink-0",
        item.type === 'event' ? "bg-primary" : "bg-accent"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {item.type === 'task' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTaskComplete?.(item.id);
                }}
                className="shrink-0"
              >
                <CheckSquare className={cn(
                  "w-4 h-4",
                  item.completed ? "text-primary" : "text-muted-foreground hover:text-primary"
                )} />
              </button>
            )}
            <h4 className={cn(
              "font-medium text-sm truncate",
              item.completed && "line-through text-muted-foreground"
            )}>
              {item.title}
            </h4>
            {item.type === 'task' && item.priority && (
              <span className={cn(
                "text-[10px] font-medium uppercase",
                priorityColors[item.priority]
              )}>
                {item.priority}
              </span>
            )}
            {item.isOverdue && (
              <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {item.type === 'event' && onShareEvent && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareEvent(item.id, item.title); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {item.type === 'task' && onShareTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareTask(item.id, item.title); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {item.type === 'event' && item.endTime 
              ? `${format(item.date, 'h:mm a')} - ${format(item.endTime, 'h:mm a')}`
              : format(item.date, 'h:mm a')
            }
          </span>
          {item.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.location}</span>
            </span>
          )}
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            item.type === 'event' ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent-foreground"
          )}>
            {item.type === 'event' ? t('taskList.event') : t('taskList.task')}
          </span>
        </div>

        {item.attendees && item.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground min-w-0">
            <Users className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.attendees.join(', ')}</span>
          </div>
        )}

        {item.recurrenceRule && (
          <div className="flex items-center gap-1 mt-1 text-xs text-primary min-w-0">
            <Repeat className="w-3 h-3 shrink-0" />
            <span className="truncate">{getRecurrenceDescription(item.recurrenceRule)}</span>
          </div>
        )}

        {item.sharedBy && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-accent-foreground bg-accent/30 px-1.5 py-0.5 rounded w-fit max-w-full">
            <UserCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('calendar.sharedBy')} {item.sharedBy.displayName || item.sharedBy.email || 'someone'}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t('calendar.agenda')}</h2>
          <span className="text-xs text-muted-foreground">
            ({calendarItems.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={handleFileImport}
            className="hidden"
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t('calendar.import')}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            {t('common.add')}
          </Button>
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

      {/* Items List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
        {groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t('calendar.noUpcoming')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('calendar.tasksWithDueDates')}
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-3 h-3" />
                {t('calendar.importIcs')}
              </Button>
              <Button 
                variant="link" 
                size="sm" 
                className="text-primary text-xs"
                onClick={() => setShowAddModal(true)}
              >
                {t('calendar.scheduleSomething')}
              </Button>
            </div>
          </div>
        ) : (
          groupedItems.map((group) => (
            <div key={group.date.toISOString()}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className={cn(
                  "text-sm font-medium",
                  isToday(group.date) && "text-primary"
                )}>
                  {group.label}
                </h3>
                {isToday(group.date) && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
                    NOW
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  ({group.items.length})
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map(item => (
                  <ItemCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Add Modal */}
      {showAddModal && (
        <QuickAddEvent 
          onClose={() => setShowAddModal(false)}
          onAdd={onAddEvent}
        />
      )}

      {/* Edit Task Modal - using the detailed one from TaskList */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteItem}
        />
      )}
    </div>
  );
}

function QuickAddEvent({ 
  onClose, 
  onAdd 
}: { 
  onClose: () => void;
  onAdd: (event: Omit<CalendarEvent, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [recurrence, setRecurrence] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + parseInt(duration) * 60 * 1000);

    onAdd({
      title: title.trim(),
      startTime,
      endTime,
      recurrenceRule: recurrence,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-md p-6 animate-scale-in rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Add Event</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Time</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Duration (minutes)</label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="15"
              step="15"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Recurrence</label>
            <div className="mt-1">
              <RecurrenceSelector
                value={recurrence}
                onChange={setRecurrence}
                className="w-full justify-start"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
