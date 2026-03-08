import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, CalendarEvent } from '@/types/flux';
import { Clock, ChevronRight, Sunrise, Sun, Sunset, Moon as MoonIcon } from 'lucide-react';
import { format, isToday, startOfDay, endOfDay, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { fetchPrayerTimesForTimeline } from './DashboardPrayerCard';

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
  type: 'task' | 'event' | 'prayer';
  priority?: string;
  completed?: boolean;
  category?: string;
}

function getPrayerIcon(name: string) {
  switch (name) {
    case 'Fajr': return <Sunrise className="w-3.5 h-3.5 text-indigo-500" />;
    case 'Dhuhr': return <Sun className="w-3.5 h-3.5 text-orange-500" />;
    case 'Asr': return <Sun className="w-3.5 h-3.5 text-amber-600" />;
    case 'Maghrib': return <Sunset className="w-3.5 h-3.5 text-rose-500" />;
    case 'Isha': return <MoonIcon className="w-3.5 h-3.5 text-purple-500" />;
    default: return null;
  }
}

function TimelineRow({ item, index, onNavigate, onCompleteTask, isOverdue = false }: {
  item: TimelineItem; index: number;
  onNavigate?: (panel: string) => void;
  onCompleteTask?: (taskId: string) => void;
  isOverdue?: boolean;
}) {
  return (
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
      transition={{ delay: 0.05 * index }}
      onClick={() => onNavigate?.(item.type === 'event' ? 'calendar' : 'tasks')}
    >
      {item.type === 'task' ? (
        <Checkbox
          checked={item.completed}
          onCheckedChange={() => { if (!item.completed && onCompleteTask) onCompleteTask(item.id); }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
      ) : item.type === 'prayer' ? (
        <div className="shrink-0 ml-0.5 mr-0.5">
          {getPrayerIcon(item.title)}
        </div>
      ) : (
        <div className={cn("w-2 h-2 rounded-full shrink-0 ml-1.5 mr-1.5", "bg-primary")} />
      )}
      <span className="text-xs text-muted-foreground w-12 shrink-0 tabular-nums">
        {isOverdue
          ? (item.time ? format(item.time, 'MMM d') : 'Overdue')
          : item.time
            ? (item.time.getHours() === 0 && item.time.getMinutes() === 0 ? 'All day' : format(item.time, 'HH:mm'))
            : '—'}
      </span>
      <span className={cn("text-sm flex-1 line-clamp-2", item.completed && "line-through")}>
        {item.type === 'prayer' ? `${item.title} Prayer` : item.title}
      </span>
      {item.type === 'task' && item.priority === 'high' && (
        <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
      )}
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
        item.type === 'event' ? "bg-primary/10 text-primary" 
          : item.type === 'prayer' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}>
        {item.type === 'event' ? 'Event' : item.type === 'prayer' ? '🕌 Salah' : 'Task'}
      </span>
    </motion.div>
  );
}

export function TodayTimeline({ tasks, events = [], onNavigate, onCompleteTask }: TodayTimelineProps) {
  const [prayerItems, setPrayerItems] = useState<TimelineItem[]>([]);

  // Fetch prayer times for timeline
  useEffect(() => {
    fetchPrayerTimesForTimeline().then(prayers => {
      if (prayers.length > 0) {
        const now = new Date();
        setPrayerItems(prayers.map(p => {
          const [h, m] = p.time.split(':').map(Number);
          const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
          return {
            id: `prayer-${p.name}`,
            title: p.name,
            time: prayerDate,
            type: 'prayer' as const,
          };
        }));
      }
    });
  }, []);

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

    const isAllDay = (item: TimelineItem) =>
      item.time && item.time.getHours() === 0 && item.time.getMinutes() === 0;
    
    const timed = [...taskItems, ...eventItems, ...prayerItems]
      .filter(i => !isAllDay(i))
      .sort((a, b) => (a.time?.getTime() || 0) - (b.time?.getTime() || 0));
    
    const allDay = [...taskItems, ...eventItems]
      .filter(i => isAllDay(i));

    return { overdue: overdueItems, timed, allDay };
  }, [tasks, events, prayerItems]);

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
          {items.overdue.slice(0, 3).map((item, i) => (
            <TimelineRow key={item.id} item={item} index={i} onNavigate={onNavigate} onCompleteTask={onCompleteTask} isOverdue />
          ))}
          {items.overdue.length > 3 && (
            <button
              onClick={() => onNavigate?.('tasks')}
              className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 rounded-lg px-3 py-2 mx-2.5 mt-1 transition-colors"
            >
              See all {items.overdue.length} overdue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          
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
