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

    return [...overdueItems, ...taskItems, ...eventItems]
      .sort((a, b) => (a.time?.getTime() || 0) - (b.time?.getTime() || 0))
      .slice(0, 5);
  }, [tasks, events]);

  if (items.length === 0) {
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
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                "hover:bg-muted/50 cursor-pointer active:scale-[0.98]",
                item.completed && "opacity-50"
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => onNavigate?.(item.type === 'event' ? 'calendar' : 'tasks')}
            >
              {/* Checkbox for tasks */}
              {item.type === 'task' ? (
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => {
                    if (!item.completed && onCompleteTask) onCompleteTask(item.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
              ) : (
                <div className={cn("w-2 h-2 rounded-full shrink-0 ml-1.5 mr-1.5", "bg-primary")} />
              )}

              {/* Time */}
              <span className="text-xs text-muted-foreground w-12 shrink-0 tabular-nums">
                {item.time
                  ? (item.time.getHours() === 0 && item.time.getMinutes() === 0 ? 'All day' : format(item.time, 'HH:mm'))
                  : '—'}
              </span>

              {/* Title */}
              <span className={cn("text-sm flex-1 truncate", item.completed && "line-through")}>
                {item.title}
              </span>

              {/* Priority dot for tasks */}
              {item.type === 'task' && item.priority === 'high' && (
                <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
              )}

              {/* Type badge */}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                item.type === 'event' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {item.type === 'event' ? 'Event' : 'Task'}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}
