import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Task, TaskPriority } from '@/types/flux';
import { SwipeableTaskItem } from './SwipeableTaskItem';
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Sun, 
  ArrowRight, 
  CalendarDays, 
  CalendarClock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, endOfWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

type TimelineBucket = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDate';

interface BucketConfig {
  id: TimelineBucket;
  label: string;
  icon: React.ElementType;
  accentClass: string;
  bgClass: string;
}

const buckets: BucketConfig[] = [
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle, accentClass: 'text-destructive', bgClass: 'bg-destructive/5 border-destructive/20' },
  { id: 'today', label: 'Today', icon: Sun, accentClass: 'text-primary', bgClass: 'bg-primary/5 border-primary/20' },
  { id: 'tomorrow', label: 'Tomorrow', icon: ArrowRight, accentClass: 'text-warning', bgClass: 'bg-warning/5 border-warning/20' },
  { id: 'thisWeek', label: 'This Week', icon: CalendarDays, accentClass: 'text-foreground', bgClass: 'bg-muted/30 border-border' },
  { id: 'later', label: 'Later', icon: CalendarClock, accentClass: 'text-muted-foreground', bgClass: 'bg-muted/20 border-border' },
  { id: 'noDate', label: 'No Date', icon: HelpCircle, accentClass: 'text-muted-foreground', bgClass: 'bg-muted/10 border-border' },
];

const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const priorityDot: Record<TaskPriority, string> = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-muted-foreground/50',
};

function TimelineTaskRow({ task, onToggleComplete }: { task: Task; onToggleComplete: (id: string) => void }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors",
      task.completed && "opacity-50",
    )}>
      <div className={cn("w-2 h-2 rounded-full shrink-0", priorityDot[task.priority])} />
      
      <button onClick={() => onToggleComplete(task.id)} className="shrink-0">
        {task.completed ? (
          <CheckCircle2 className="w-4.5 h-4.5 text-primary" />
        ) : (
          <Circle className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      
      <span className={cn(
        "flex-1 text-sm font-medium truncate",
        task.completed && "line-through text-muted-foreground"
      )}>
        {task.title}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">
            {format(task.dueDate, 'MMM d')}
          </span>
        )}
        <span className={cn(
          "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
          task.priority === 'high' && "text-destructive bg-destructive/10",
          task.priority === 'medium' && "text-warning bg-warning/10",
          task.priority === 'low' && "text-muted-foreground bg-muted",
        )}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

export function TimelineView({
  tasks,
  onToggleComplete,
  onDeleteTask,
  onUpdateTask,
}: TimelineViewProps) {
  const incompleteTasks = useMemo(() => tasks.filter(t => !t.completed && !t.trashed), [tasks]);

  const groupedTasks = useMemo(() => {
    const now = new Date();
    const weekEnd = endOfWeek(now);
    const groups: Record<TimelineBucket, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDate: [],
    };

    incompleteTasks.forEach(task => {
      if (!task.dueDate) {
        groups.noDate.push(task);
        return;
      }
      const due = new Date(task.dueDate);
      if (isPast(due) && !isToday(due)) {
        groups.overdue.push(task);
      } else if (isToday(due)) {
        groups.today.push(task);
      } else if (isTomorrow(due)) {
        groups.tomorrow.push(task);
      } else if (due <= weekEnd) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    // Sort each group by priority
    Object.keys(groups).forEach(key => {
      groups[key as TimelineBucket].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    });

    return groups;
  }, [incompleteTasks]);

  if (incompleteTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <Sparkles className="w-12 h-12 text-primary/30 mb-3" />
        <p className="text-base font-medium">Timeline clear!</p>
        <p className="text-sm text-muted-foreground">No upcoming tasks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto h-full">
      {buckets.map(bucket => {
        const bucketTasks = groupedTasks[bucket.id];
        if (bucketTasks.length === 0) return null;

        const Icon = bucket.icon;
        return (
          <div key={bucket.id}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border mb-1",
              bucket.bgClass
            )}>
              <Icon className={cn("w-4 h-4", bucket.accentClass)} />
              <span className={cn("font-medium text-sm", bucket.accentClass)}>
                {bucket.label}
              </span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {bucketTasks.length}
              </Badge>
            </div>
            <AnimatePresence mode="popLayout">
              <div className="space-y-0.5">
                {bucketTasks.map(task => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SwipeableTaskItem
                      onComplete={() => onToggleComplete(task.id)}
                      onDelete={() => onDeleteTask(task.id)}
                      isCompleted={task.completed}
                    >
                      <TimelineTaskRow task={task} onToggleComplete={onToggleComplete} />
                    </SwipeableTaskItem>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
