import { useState, useEffect } from 'react';
import { X, Sun, Calendar, CheckCircle2, Flame, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Task, CalendarEvent } from '@/types/flux';
import { isToday, isTomorrow, isPast, differenceInDays, startOfDay, format } from 'date-fns';

interface MorningDigestProps {
  tasks: Task[];
  events: CalendarEvent[];
  streak: number;
  onDismiss: () => void;
}

export function MorningDigest({ tasks, events, streak, onDismiss }: MorningDigestProps) {
  const [visible, setVisible] = useState(true);

  // Check if we should show the digest (only show once per day)
  useEffect(() => {
    const lastShown = localStorage.getItem('flux-digest-last-shown');
    const today = startOfDay(new Date()).toISOString();
    
    if (lastShown === today) {
      setVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    const today = startOfDay(new Date()).toISOString();
    localStorage.setItem('flux-digest-last-shown', today);
    setVisible(false);
    onDismiss();
  };

  if (!visible) return null;

  const todayTasks = tasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate));
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate));
  const todayEvents = events.filter(e => isToday(e.startTime));
  const upcomingDeadlines = tasks
    .filter(t => !t.completed && t.dueDate && !isPast(t.dueDate))
    .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
    .slice(0, 3);

  const highPriorityCount = todayTasks.filter(t => t.priority === 'high').length;
  const greeting = getGreeting();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-lg mx-4 border-primary/20 bg-card/95 backdrop-blur shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-xl">{greeting}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Streak */}
          {streak > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-orange-500">
                {streak} day streak! Keep it going!
              </span>
            </div>
          )}

          {/* Overdue Alert */}
          {overdueTasks.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">
                ⚠️ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need attention
              </p>
            </div>
          )}

          {/* Today's Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Tasks Today</span>
              </div>
              <p className="text-2xl font-bold">{todayTasks.length}</p>
              {highPriorityCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {highPriorityCount} high priority
                </p>
              )}
            </div>
            
            <div className="p-3 rounded-lg bg-secondary/50 border border-secondary">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-secondary-foreground" />
                <span className="text-sm font-medium">Events</span>
              </div>
              <p className="text-2xl font-bold">{todayEvents.length}</p>
              {todayEvents.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Next: {format(todayEvents[0].startTime, 'h:mm a')}
                </p>
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Upcoming Deadlines</span>
              </div>
              <div className="space-y-1">
                {upcomingDeadlines.map(task => (
                  <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span className="truncate">{task.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDeadline(task.dueDate!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button onClick={handleDismiss} className="w-full">
            Let's Get Started
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning!';
  if (hour < 17) return 'Good Afternoon!';
  return 'Good Evening!';
}

function formatDeadline(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const days = differenceInDays(date, new Date());
  if (days < 7) return `${days} days`;
  return format(date, 'MMM d');
}
