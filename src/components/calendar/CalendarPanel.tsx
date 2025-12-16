import { useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarEvent, Task } from '@/types/flux';
import { parseICS, validateICSFile } from '@/lib/icsParser';
import { useToast } from '@/hooks/use-toast';
import { RecurrenceSelector } from '@/components/shared/RecurrenceSelector';
import { getRecurrenceDescription } from '@/lib/recurrence';
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
  AlertCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, isPast } from 'date-fns';

interface CalendarPanelProps {
  events: CalendarEvent[];
  tasks?: Task[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onShareEvent?: (id: string, title: string) => void;
  onToggleTaskComplete?: (id: string) => void;
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
  priority?: string;
  completed?: boolean;
  isOverdue?: boolean;
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
  onToggleTaskComplete 
}: CalendarPanelProps) {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
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
        isOverdue,
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
      let label = format(date, 'EEEE, MMMM d');
      if (isToday(date)) label = 'Today';
      else if (isTomorrow(date)) label = 'Tomorrow';

      return {
        label,
        date,
        items: itemsByDate.get(dateKey)!.sort((a, b) => 
          a.date.getTime() - b.date.getTime()
        ),
      };
    });
  }, [calendarItems]);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateICSFile(file)) {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please upload a valid .ics calendar file.',
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
          title: 'No Events Found',
          description: 'The file does not contain any valid events.',
        });
        return;
      }

      // Add events through callback or directly
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
        title: 'Import Successful',
        description: `Imported ${importedEvents.length} event${importedEvents.length > 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('ICS import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'Failed to parse the calendar file. Please check the format.',
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const priorityColors: Record<string, string> = {
    high: 'text-destructive',
    medium: 'text-warning',
    low: 'text-muted-foreground',
  };

  const ItemCard = ({ item }: { item: CalendarItem }) => (
    <div className={cn(
      "flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer",
      item.completed && "opacity-60",
      item.isOverdue && "border-l-2 border-l-destructive"
    )}>
      <div className={cn(
        "w-1 rounded-full shrink-0",
        item.type === 'event' ? "bg-primary" : "bg-accent"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {item.type === 'task' && (
              <CheckSquare className={cn(
                "w-4 h-4 shrink-0",
                item.completed ? "text-primary" : "text-muted-foreground"
              )} />
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
            {item.type === 'event' && onShareEvent && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareEvent(item.id, item.title); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {item.type === 'task' && onToggleTaskComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleTaskComplete(item.id); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
              >
                <CheckSquare className="w-3.5 h-3.5" />
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
            {item.type === 'event' ? 'Event' : 'Task'}
          </span>
        </div>

        {item.attendees && item.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{item.attendees.join(', ')}</span>
          </div>
        )}

        {item.recurrenceRule && (
          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
            <Repeat className="w-3 h-3" />
            <span>{getRecurrenceDescription(item.recurrenceRule)}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Agenda</h2>
          <span className="text-xs text-muted-foreground">
            ({calendarItems.length} items)
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
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming events or tasks</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tasks with due dates will appear here automatically
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-3 h-3" />
                Import .ics
              </Button>
              <Button 
                variant="link" 
                size="sm" 
                className="text-primary text-xs"
                onClick={() => setShowAddModal(true)}
              >
                Schedule something
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
