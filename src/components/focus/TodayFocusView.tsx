import { useMemo } from 'react';
import { Task, CalendarEvent } from '@/types/flux';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, 
  AlertTriangle, 
  Calendar, 
  Sparkles,
  Clock,
  CheckCircle2,
  X,
  Focus,
} from 'lucide-react';
import { format, isToday, isPast, isBefore, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDailyCheckins } from '@/hooks/useDailyCheckins';

interface TodayFocusViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  onToggleComplete: (id: string) => void;
  onClose: () => void;
  onPlanDay?: () => void;
}

export function TodayFocusView({
  tasks,
  events,
  onToggleComplete,
  onClose,
  onPlanDay,
}: TodayFocusViewProps) {
  const { todayMorning } = useDailyCheckins();
  // Compute "now" fresh on every render so "today"/"overdue" stay correct across midnight.
  const now = new Date();
  const todayEnd = endOfDay(now);

  // Get overdue tasks (max 3 to reduce overwhelm)
  const overdueTasks = useMemo(() => {
    return tasks
      .filter(t => !t.completed && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 3);
  }, [tasks]);

  // Get tasks due today
  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => !t.completed && t.dueDate && isToday(new Date(t.dueDate)))
      .sort((a, b) => {
        // Sort by time if available
        const aTime = new Date(a.dueDate!).getTime();
        const bTime = new Date(b.dueDate!).getTime();
        return aTime - bTime;
      });
  }, [tasks]);

  // Get next upcoming event — computed each render so it tracks the live `now`.
  const nextEvent = events
    .filter(e => new Date(e.startTime) >= now && new Date(e.startTime) <= todayEnd)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  // Get high priority incomplete tasks (if no due dates set)
  const highPriorityTasks = useMemo(() => {
    if (todayTasks.length > 0 || overdueTasks.length > 0) return [];
    return tasks
      .filter(t => !t.completed && t.priority === 'high' && !t.dueDate)
      .slice(0, 3);
  }, [tasks, todayTasks, overdueTasks]);

  // AI suggestion for what to do first — computed each render so it tracks the live `now`.
  const computeSuggestion = () => {
    if (overdueTasks.length > 0) {
      return `Start with "${overdueTasks[0].title}" - it's overdue and needs your attention`;
    }
    if (nextEvent && isBefore(new Date(nextEvent.startTime), new Date(now.getTime() + 30 * 60000))) {
      return `You have "${nextEvent.title}" coming up in less than 30 minutes`;
    }
    if (todayTasks.length > 0) {
      const highPriority = todayTasks.find(t => t.priority === 'high');
      if (highPriority) {
        return `Focus on "${highPriority.title}" - it's high priority`;
      }
      return `Start with "${todayTasks[0].title}" - it's your first task for today`;
    }
    if (highPriorityTasks.length > 0) {
      return `Consider working on "${highPriorityTasks[0].title}" - it's high priority`;
    }
    return "You're all caught up! Great job!";
  };
  const suggestion = computeSuggestion();

  const totalTasks = overdueTasks.length + todayTasks.length + highPriorityTasks.length;
  const hasNoTasks = totalTasks === 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto">
      <Card className="w-full max-w-lg shadow-2xl border-primary/20 my-2 sm:my-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Today's Focus</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(now, 'EEEE, MMMM d')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Today's Main Focus from Check-in */}
          {todayMorning?.main_focus && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-accent/20 to-primary/10 border border-accent/30">
              <div className="flex items-center gap-2 mb-2">
                <Focus className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-accent uppercase">Your Focus Today</span>
              </div>
              <p className="font-medium text-foreground">{todayMorning.main_focus}</p>
            </div>
          )}

          {/* AI Suggestion */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-foreground">{suggestion}</p>
            </div>
          </div>

          {/* Next Event */}
          {nextEvent && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-xs font-medium text-accent">NEXT EVENT</span>
              </div>
              <p className="font-medium">{nextEvent.title}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(nextEvent.startTime), 'h:mm a')}
                {nextEvent.location && ` • ${nextEvent.location}`}
              </p>
            </div>
          )}

          <ScrollArea className="h-[300px]">
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-medium text-destructive">OVERDUE</span>
                </div>
                <div className="space-y-2">
                  {overdueTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => onToggleComplete(task.id)}
                      variant="overdue"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Today's Tasks */}
            {todayTasks.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary">DUE TODAY</span>
                </div>
                <div className="space-y-2">
                  {todayTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => onToggleComplete(task.id)}
                      variant="today"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* High Priority (if no dated tasks) */}
            {highPriorityTasks.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-orange-500">HIGH PRIORITY</span>
                </div>
                <div className="space-y-2">
                  {highPriorityTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => onToggleComplete(task.id)}
                      variant="priority"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All caught up */}
            {hasNoTasks && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <h3 className="font-semibold text-lg">All caught up!</h3>
                <p className="text-sm text-muted-foreground">
                  No urgent tasks for today. Great job staying on top of things!
                </p>
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onPlanDay && (
              <Button onClick={onPlanDay} className="flex-1" variant="default">
                <Sparkles className="w-4 h-4 mr-2" />
                Plan My Day
              </Button>
            )}
            <Button onClick={onClose} variant="outline" className="flex-1">
              View All Tasks
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  variant: 'overdue' | 'today' | 'priority';
}

function TaskItem({ task, onToggle, variant }: TaskItemProps) {
  const priorityColors = {
    high: 'text-red-500',
    medium: 'text-yellow-500',
    low: 'text-green-500',
  };

  const variantStyles = {
    overdue: 'border-destructive/30 bg-destructive/5',
    today: 'border-primary/30 bg-primary/5',
    priority: 'border-orange-500/30 bg-orange-500/5',
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
      variantStyles[variant]
    )}>
      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{task.title}</p>
        {task.dueDate && (
          <p className="text-xs text-muted-foreground">
            {variant === 'overdue' 
              ? `Was due ${format(new Date(task.dueDate), 'MMM d')}`
              : format(new Date(task.dueDate), 'h:mm a')
            }
          </p>
        )}
      </div>
      <Badge 
        variant="outline" 
        className={cn("shrink-0 text-xs", priorityColors[task.priority])}
      >
        {task.priority}
      </Badge>
    </div>
  );
}