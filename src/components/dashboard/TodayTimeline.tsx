import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, CalendarEvent } from '@/types/flux';
import { Clock } from 'lucide-react';
import { format, isToday, startOfDay, endOfDay, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface TodayTimelineProps {
  tasks: Task[];
  events?: CalendarEvent[];
  onNavigate?: (panel: string) => void;
  onCompleteTask?: (taskId: string) => void;
}

interface TimelineItem {
  id: string;
  title: string;
  time?: Date;
  type: 'task' | 'event';
  priority?: string;
  completed?: boolean;
  category?: string;
}

export function TodayTimeline({ tasks, events = [], onNavigate, onCompleteTask }: TodayTimelineProps) {
  const items = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const taskItems: TimelineItem[] = tasks
      .filter(t => !t.trashed && t.dueDate && isToday(t.dueDate))
      .map(t => ({
        id: t.id, title: t.title, time: t.dueDate, type: 'task' as const,
        priority: t.priority, completed: t.completed, category: t.category,
      }));

    const eventItems: TimelineItem[] = events
      .filter(e => e.startTime >= dayStart && e.startTime <= dayEnd)
      .map(e => ({
        id: e.id, title: e.title, time: e.startTime, type: 'event' as const, category: e.category,
      }));

    const overdueItems: TimelineItem[] = tasks
      .filter(t => !t.trashed && !t.completed && t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate))
      .map(t => ({
        id: t.id, title: t.title, time: t.dueDate, type: 'task' as const,
        priority: t.priority, completed: false, category: t.category,
      }));

    // Group: overdue first, then timed, then all-day
    const isAllDay = (item: TimelineItem) =>
      item.time && item.time.getHours() === 0 && item.time.getMinutes() === 0;
    
    const timed = [...taskItems, ...eventItems]
      .filter(i => !isAllDay(i))
      .sort((a, b) => (a.time?.getTime() || 0) - (b.time?.getTime() || 0));
    
    const allDay = [...taskItems, ...eventItems]
      .filter(i => isAllDay(i));

    return { overdue: overdueItems, timed, allDay };
  }, [tasks, events]);

  const allItems = [...items.overdue, ...items.timed, ...items.allDay];
  
  if (allItems.length === 0) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Nothing scheduled for today</p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Today
          </GlassCardTitle>
          <button onClick={() => onNavigate?.('calendar')} className="text-xs text-primary hover:underline">
            See all
          </button>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-1">
        <AnimatePresence>
          {items.overdue.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive px-2.5">Overdue</span>
            </div>
          )}
          {items.overdue.map((item, i) => (
            <TimelineRow key={item.id} item={item} index={i} onNavigate={onNavigate} onCompleteTask={onCompleteTask} />
          ))}
          
          {items.timed.length > 0 && items.overdue.length > 0 && (
            <div className="h-px bg-border/40 my-1" />
          )}
          {items.timed.map((item, i) => (
            <TimelineRow key={item.id} item={item} index={i + items.overdue.length} onNavigate={onNavigate} onCompleteTask={onCompleteTask} />
          ))}
          
          {items.allDay.length > 0 && (items.timed.length > 0 || items.overdue.length > 0) && (
            <div className="h-px bg-border/40 my-1" />
          )}
          {items.allDay.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2.5">All Day</span>
            </div>
          )}
          {items.allDay.map((item, i) => (
            <TimelineRow key={item.id} item={item} index={i + items.overdue.length + items.timed.length} onNavigate={onNavigate} onCompleteTask={onCompleteTask} />
          ))}
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}
