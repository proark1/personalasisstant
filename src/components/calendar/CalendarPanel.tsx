import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarEvent } from '@/types/flux';
import { parseICS, validateICSFile } from '@/lib/icsParser';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus,
  ChevronRight,
  Upload,
  FileUp
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay } from 'date-fns';

interface CalendarPanelProps {
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
}

interface GroupedEvents {
  label: string;
  date: Date;
  events: CalendarEvent[];
}

export function CalendarPanel({ events, onAddEvent, onImportEvents }: CalendarPanelProps) {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group events by date
  const groupedEvents: GroupedEvents[] = [];
  const eventsByDate = new Map<string, CalendarEvent[]>();

  events.forEach(event => {
    const dateKey = startOfDay(event.startTime).toISOString();
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  // Sort and create groups
  const sortedDates = Array.from(eventsByDate.keys()).sort();
  sortedDates.forEach(dateKey => {
    const date = new Date(dateKey);
    let label = format(date, 'EEEE, MMMM d');
    if (isToday(date)) label = 'Today';
    else if (isTomorrow(date)) label = 'Tomorrow';

    groupedEvents.push({
      label,
      date,
      events: eventsByDate.get(dateKey)!.sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      ),
    });
  });

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

  const EventCard = ({ event }: { event: CalendarEvent }) => (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer">
      <div className="w-1 rounded-full bg-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-sm truncate">{event.title}</h4>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
        
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>

        {event.attendees && event.attendees.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{event.attendees.join(', ')}</span>
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

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {groupedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming events</p>
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
          groupedEvents.map((group) => (
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
              </div>
              <div className="space-y-2">
                {group.events.map(event => (
                  <EventCard key={event.id} event={event} />
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + parseInt(duration) * 60 * 1000);

    onAdd({
      title: title.trim(),
      startTime,
      endTime,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel-solid w-full max-w-md p-6 animate-scale-in">
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
