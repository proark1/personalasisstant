import { useMemo } from 'react';
import { CalendarEvent, Task } from '@/types/flux';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertTriangle, Moon } from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, isWithinInterval, getHours } from 'date-fns';
import { cn } from '@/lib/utils';

interface WeekAtAGlanceProps {
  events: CalendarEvent[];
  tasks: Task[];
}

interface DaySummary {
  date: Date;
  dayName: string;
  events: CalendarEvent[];
  tasks: Task[];
  hasEveningCommitment: boolean;
  isToday: boolean;
}

export function WeekAtAGlance({ events, tasks }: WeekAtAGlanceProps) {
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    const days: DaySummary[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Get events for this day
      const dayEvents = events.filter(e => 
        isWithinInterval(e.startTime, { start: dayStart, end: dayEnd })
      ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Get tasks due this day
      const dayTasks = tasks.filter(t => 
        !t.completed && 
        t.dueDate && 
        isWithinInterval(t.dueDate, { start: dayStart, end: dayEnd })
      );

      // Check for evening commitments (after 5pm / 17:00)
      const hasEveningCommitment = dayEvents.some(e => getHours(e.startTime) >= 17);

      days.push({
        date,
        dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE'),
        events: dayEvents,
        tasks: dayTasks,
        hasEveningCommitment,
        isToday: i === 0,
      });
    }

    return days;
  }, [events, tasks]);

  const eveningWarnings = weekDays.filter(d => d.hasEveningCommitment && !d.isToday).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Week at a Glance</CardTitle>
          </div>
          {eveningWarnings > 0 && (
            <Badge variant="outline" className="text-xs gap-1 text-amber-500 border-amber-500/30">
              <Moon className="h-3 w-3" />
              {eveningWarnings} evening{eveningWarnings > 1 ? 's' : ''} busy
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {weekDays.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg text-sm",
              day.isToday && "bg-primary/10 border border-primary/20",
              !day.isToday && "hover:bg-muted/50"
            )}
          >
            {/* Day Label */}
            <div className={cn(
              "w-16 shrink-0 font-medium",
              day.isToday && "text-primary"
            )}>
              {day.dayName}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {day.events.length === 0 && day.tasks.length === 0 ? (
                <span className="text-muted-foreground text-xs">No commitments</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {day.events.slice(0, 2).map((event) => (
                    <Badge
                      key={event.id}
                      variant="secondary"
                      className={cn(
                        "text-xs truncate max-w-[120px]",
                        getHours(event.startTime) >= 17 && "bg-amber-500/20 text-amber-600 border-amber-500/30"
                      )}
                    >
                      {format(event.startTime, 'HH:mm')} {event.title}
                    </Badge>
                  ))}
                  {day.tasks.length > 0 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {day.tasks.length} task{day.tasks.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {day.events.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{day.events.length - 2} more
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Evening Warning */}
            {day.hasEveningCommitment && !day.isToday && (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}