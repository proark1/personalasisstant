import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Task, CalendarEvent } from '@/types/flux';
import { Widget } from '@/hooks/useWidgetLayout';
import { useWeather } from '@/hooks/useWeather';
import { useGamification } from '@/hooks/useGamification';
import { useSmartTaskSuggestions } from '@/hooks/useSmartTaskSuggestions';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Flame, 
  Target, 
  Plus,
  Calendar,
  Clock,
  Lightbulb,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';

interface WidgetGridProps {
  widgets: Widget[];
  tasks: Task[];
  events: CalendarEvent[];
  onAddTask?: () => void;
  onSelectTask?: (taskId: string) => void;
}

export function WidgetGrid({ widgets, tasks, events, onAddTask, onSelectTask }: WidgetGridProps) {
  const { weather } = useWeather();
  const { userXP } = useGamification();
  const { suggestion, loading: suggestionLoading, refresh: refreshSuggestion } = useSmartTaskSuggestions(tasks, events);

  const todayTasks = tasks.filter(t => {
    if (t.completed) return false;
    if (!t.dueDate) return false;
    return isToday(new Date(t.dueDate));
  });

  const upcomingEvents = events.filter(e => {
    const start = new Date(e.startTime);
    return start > new Date() && start < new Date(Date.now() + 24 * 60 * 60 * 1000);
  }).slice(0, 3);

  const renderWidget = (widget: Widget) => {
    const sizeClasses = {
      small: 'col-span-1',
      medium: 'col-span-2',
      large: 'col-span-2 md:col-span-3',
    };

    switch (widget.type) {
      case 'streak':
        return (
          <GlassCard className={cn(sizeClasses[widget.size], 'bg-gradient-to-br from-warning/20 to-warning/5')}>
            <GlassCardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-warning/20 rounded-full">
                <Flame className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userXP?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </GlassCardContent>
          </GlassCard>
        );

      case 'tasks_today':
        return (
          <GlassCard className={cn(sizeClasses[widget.size])}>
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Today's Tasks
                <Badge variant="secondary" className="ml-auto">{todayTasks.length}</Badge>
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No tasks due today! 🎉
                </p>
              ) : (
                todayTasks.slice(0, 3).map(task => (
                  <div 
                    key={task.id} 
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => onSelectTask?.(task.id)}
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      task.priority === 'high' ? 'bg-destructive' : 
                      task.priority === 'medium' ? 'bg-warning' : 'bg-muted-foreground'
                    )} />
                    <span className="text-sm truncate flex-1">{task.title}</span>
                  </div>
                ))
              )}
              {todayTasks.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{todayTasks.length - 3} more
                </p>
              )}
            </GlassCardContent>
          </GlassCard>
        );

      case 'ai_suggestion':
        return (
          <GlassCard className={cn(sizeClasses[widget.size], 'bg-gradient-to-br from-primary/10 to-accent/5')}>
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Suggestion
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 ml-auto"
                  onClick={refreshSuggestion}
                  disabled={suggestionLoading}
                >
                  {suggestionLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {suggestionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </div>
              ) : suggestion ? (
                <div className="space-y-2">
                  <p className="font-medium text-sm">{suggestion.recommendation.title}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.recommendation.reason}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      ~{suggestion.recommendation.estimatedMinutes} min
                    </Badge>
                  </div>
                  {suggestion.encouragement && (
                    <p className="text-xs text-primary italic mt-2">{suggestion.encouragement}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete some tasks to get personalized suggestions!
                </p>
              )}
            </GlassCardContent>
          </GlassCard>
        );

      case 'weather':
        return (
          <GlassCard className={cn(sizeClasses[widget.size])}>
            <GlassCardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted rounded-full">
                {weather?.condition === 'rainy' ? <CloudRain className="w-6 h-6 text-accent" /> :
                 weather?.condition === 'cloudy' ? <Cloud className="w-6 h-6 text-accent" /> :
                 <Sun className="w-6 h-6 text-warning" />}
              </div>
              <div>
                <p className="text-2xl font-bold">{weather?.temperature || '--'}°</p>
                <p className="text-xs text-muted-foreground capitalize">{weather?.condition || 'Loading...'}</p>
              </div>
            </GlassCardContent>
          </GlassCard>
        );

      case 'upcoming_events':
        return (
          <GlassCard className={cn(sizeClasses[widget.size])}>
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Upcoming
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No upcoming events
                </p>
              ) : (
                upcomingEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.startTime), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </GlassCardContent>
          </GlassCard>
        );

      case 'focus_stats': {
        const todayFocus = 0;
        const dailyGoal = 120;
        return (
          <GlassCard className={cn(sizeClasses[widget.size])}>
            <GlassCardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Focus Today</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{todayFocus} min</span>
                  <span className="text-muted-foreground">{dailyGoal} min goal</span>
                </div>
                <Progress value={(todayFocus / dailyGoal) * 100} className="h-2" />
              </div>
            </GlassCardContent>
          </GlassCard>
        );
      }

      case 'quick_add':
        return (
          <GlassCard className={cn(sizeClasses[widget.size], 'cursor-pointer hover:bg-muted/50 transition-colors')} onClick={onAddTask} pressable>
            <GlassCardContent className="p-4 flex items-center justify-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              <span className="font-medium">Quick Add</span>
            </GlassCardContent>
          </GlassCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {widgets.map(widget => (
        <div key={widget.id}>
          {renderWidget(widget)}
        </div>
      ))}
    </div>
  );
}
