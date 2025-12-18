import { useState, useEffect, useMemo } from 'react';
import { X, Sun, Calendar, CheckCircle2, Flame, Clock, Users, FileText, Zap, FolderKanban, Battery, BatteryLow, BatteryFull, AlertTriangle, Moon, CloudSun, Newspaper, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Task, CalendarEvent, Project } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { Contract } from '@/hooks/useContracts';
import { useWeather } from '@/hooks/useWeather';
import { usePersonalizedNews } from '@/hooks/usePersonalizedNews';
import { useUserProfile } from '@/hooks/useUserProfile';
import { isToday, isTomorrow, isPast, differenceInDays, startOfDay, format, addDays, isWithinInterval, endOfDay, getHours } from 'date-fns';
import { cn } from '@/lib/utils';

type EnergyLevel = 'low' | 'medium' | 'high' | null;

interface MorningBriefingProps {
  tasks: Task[];
  events: CalendarEvent[];
  contacts: Contact[];
  contracts: Contract[];
  projects: Project[];
  streak: number;
  onDismiss: () => void;
  onMarkContactContacted?: (contactId: string) => void;
}

export function MorningBriefing({ 
  tasks, 
  events, 
  contacts, 
  contracts, 
  projects, 
  streak, 
  onDismiss,
  onMarkContactContacted 
}: MorningBriefingProps) {
  const [visible, setVisible] = useState(true);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(null);

  // Weather data
  const { weather, loading: weatherLoading } = useWeather();

  // User profile for personalized news
  const { profile } = useUserProfile();

  // Personalized news based on user interests
  const { news, loading: newsLoading } = usePersonalizedNews({
    interests: profile?.interests || [],
    skills: profile?.skills || [],
    businesses: profile?.businesses || [],
  });

  // Check if we should show the briefing (only show once per day)
  useEffect(() => {
    const lastShown = localStorage.getItem('flux-briefing-last-shown');
    const today = startOfDay(new Date()).toISOString();
    
    if (lastShown === today) {
      setVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    const today = startOfDay(new Date()).toISOString();
    localStorage.setItem('flux-briefing-last-shown', today);
    if (energyLevel) {
      localStorage.setItem('flux-energy-level', energyLevel);
    }
    setVisible(false);
    onDismiss();
  };

  // Calculate data
  const todayTasks = tasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate));
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate));
  const todayEvents = events.filter(e => isToday(e.startTime)).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Smart Top 3 tasks - ONLY overdue and due today
  const top3Tasks = useMemo(() => {
    const sorted = [...tasks]
      .filter(t => {
        if (t.completed) return false;
        if (!t.dueDate) return false;
        // Only include overdue or due today
        const isOverdue = isPast(t.dueDate) && !isToday(t.dueDate);
        const isDueToday = isToday(t.dueDate);
        return isOverdue || isDueToday;
      })
      .sort((a, b) => {
        // Overdue first
        const aOverdue = a.dueDate && isPast(a.dueDate) && !isToday(a.dueDate);
        const bOverdue = b.dueDate && isPast(b.dueDate) && !isToday(b.dueDate);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        // High priority next
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Due date
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    return sorted.slice(0, 3);
  }, [tasks]);

  // Next Week tasks (due in next 7 days, excluding today)
  const nextWeekTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const nextWeekEnd = addDays(today, 7);
    
    return [...tasks]
      .filter(t => {
        if (t.completed) return false;
        if (!t.dueDate) return false;
        const dueDate = startOfDay(t.dueDate);
        // Exclude today, include next 7 days
        return dueDate > today && dueDate <= nextWeekEnd;
      })
      .sort((a, b) => {
        // Sort by due date first
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        // Then by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 5);
  }, [tasks]);

  // Projects needing attention (most overdue tasks)
  const projectsNeedingAttention = useMemo(() => {
    const projectOverdueCounts = projects.map(p => ({
      project: p,
      overdueCount: tasks.filter(t => 
        t.projectId === p.id && 
        !t.completed && 
        t.dueDate && 
        isPast(t.dueDate)
      ).length,
      dueTodayCount: tasks.filter(t => 
        t.projectId === p.id && 
        !t.completed && 
        t.dueDate && 
        isToday(t.dueDate)
      ).length,
    })).filter(p => p.overdueCount > 0 || p.dueTodayCount > 0)
      .sort((a, b) => b.overdueCount - a.overdueCount)
      .slice(0, 3);
    return projectOverdueCounts;
  }, [projects, tasks]);

  // Contacts due for follow-up
  const contactsDue = useMemo(() => {
    const now = new Date();
    return contacts
      .filter(c => c.nextContactDue && c.nextContactDue <= now)
      .sort((a, b) => {
        const daysA = differenceInDays(now, a.nextContactDue!);
        const daysB = differenceInDays(now, b.nextContactDue!);
        return daysB - daysA;
      })
      .slice(0, 3);
  }, [contacts]);

  // Contract alerts (cancellation deadlines and renewals)
  const contractAlerts = useMemo(() => {
    const now = new Date();
    const alerts: { contract: Contract; type: 'cancellation' | 'renewal'; date: Date; daysLeft: number }[] = [];
    
    contracts.filter(c => c.isActive && c.renewalDate).forEach(c => {
      const daysToRenewal = differenceInDays(c.renewalDate!, now);
      
      // Cancellation deadline
      if (c.autoRenews && daysToRenewal > 0) {
        const cancellationDate = new Date(c.renewalDate!);
        cancellationDate.setDate(cancellationDate.getDate() - c.cancellationNoticeDays);
        const daysToCancellation = differenceInDays(cancellationDate, now);
        
        if (daysToCancellation >= 0 && daysToCancellation <= 14) {
          alerts.push({ contract: c, type: 'cancellation', date: cancellationDate, daysLeft: daysToCancellation });
        }
      }
      
      // Renewal coming up
      if (daysToRenewal >= 0 && daysToRenewal <= 7) {
        alerts.push({ contract: c, type: 'renewal', date: c.renewalDate!, daysLeft: daysToRenewal });
      }
    });
    
    return alerts.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 3);
  }, [contracts]);

  // Week Ahead - next 7 days overview with evening highlights
  const weekAhead = useMemo(() => {
    const today = startOfDay(new Date());
    const days: { 
      date: Date; 
      dayName: string; 
      events: CalendarEvent[]; 
      hasEveningCommitment: boolean;
      eveningEvents: CalendarEvent[];
    }[] = [];

    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const dayEvents = events.filter(e => 
        isWithinInterval(e.startTime, { start: dayStart, end: dayEnd })
      ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      const eveningEvents = dayEvents.filter(e => getHours(e.startTime) >= 17);
      const hasEveningCommitment = eveningEvents.length > 0;

      days.push({
        date,
        dayName: i === 1 ? 'Tomorrow' : format(date, 'EEE'),
        events: dayEvents,
        hasEveningCommitment,
        eveningEvents,
      });
    }

    return days;
  }, [events]);

  // Time blocks - find free time for deep work
  const timeBlocks = useMemo(() => {
    const blocks: { start: string; end: string; type: 'event' | 'free'; title?: string }[] = [];
    const workStart = 9;
    const workEnd = 18;
    
    let currentHour = workStart;
    const sortedEvents = [...todayEvents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    for (const event of sortedEvents) {
      const eventStart = event.startTime.getHours();
      const eventEnd = event.endTime.getHours();
      
      if (currentHour < eventStart && eventStart <= workEnd) {
        blocks.push({
          start: `${currentHour}:00`,
          end: `${eventStart}:00`,
          type: 'free',
        });
      }
      
      if (eventStart < workEnd) {
        blocks.push({
          start: format(event.startTime, 'HH:mm'),
          end: format(event.endTime, 'HH:mm'),
          type: 'event',
          title: event.title,
        });
      }
      
      currentHour = Math.max(currentHour, eventEnd);
    }
    
    if (currentHour < workEnd) {
      blocks.push({
        start: `${currentHour}:00`,
        end: `${workEnd}:00`,
        type: 'free',
      });
    }
    
    return blocks.slice(0, 5);
  }, [todayEvents]);

  const greeting = getGreeting();

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg border-primary/20 bg-card/95 backdrop-blur shadow-2xl my-4">
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
          {/* Weather */}
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-sky-500/10 border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{weather?.icon || '🌡️'}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {weatherLoading ? '...' : weather ? `${weather.temperature}°C` : '--'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {weather?.condition || 'Loading...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {weather?.location || 'Detecting location...'}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {weather && (
                  <>
                    <p>Humidity: {weather.humidity}%</p>
                    <p>Wind: {weather.windSpeed} km/h</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Personalized News */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Today's Headlines</span>
              {newsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {!newsLoading && news.length > 0 ? (
              <div className="space-y-2">
                {news.slice(0, 4).map((item, i) => (
                  <div key={i} className="p-2 rounded bg-muted/50">
                    <p className="text-sm font-medium">{item.headline}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{item.category}</Badge>
                  </div>
                ))}
              </div>
            ) : !newsLoading && (
              <p className="text-xs text-muted-foreground">
                Add interests to your profile to get personalized news
              </p>
            )}
          </div>

          <Separator className="my-2" />

          {/* Streak */}
          {streak > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-orange-500">
                {streak} day streak! Keep it going!
              </span>
            </div>
          )}

          {/* Energy Check */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              How are you feeling today?
            </p>
            <div className="flex gap-2">
              <Button
                variant={energyLevel === 'low' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEnergyLevel('low')}
                className={cn("flex-1 gap-1", energyLevel === 'low' && "bg-yellow-600")}
              >
                <BatteryLow className="h-4 w-4" />
                Low
              </Button>
              <Button
                variant={energyLevel === 'medium' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEnergyLevel('medium')}
                className={cn("flex-1 gap-1", energyLevel === 'medium' && "bg-blue-600")}
              >
                <Battery className="h-4 w-4" />
                Good
              </Button>
              <Button
                variant={energyLevel === 'high' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEnergyLevel('high')}
                className={cn("flex-1 gap-1", energyLevel === 'high' && "bg-green-600")}
              >
                <BatteryFull className="h-4 w-4" />
                Great
              </Button>
            </div>
          </div>

          {/* Overdue Alert */}
          {overdueTasks.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">
                ⚠️ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need attention
              </p>
            </div>
          )}

          {/* Top 3 Tasks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Today's Top 3</span>
            </div>
            <div className="space-y-1">
              {top3Tasks.map((task, i) => (
                <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                  <span className="truncate flex items-center gap-2">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    {task.title}
                  </span>
                  <Badge 
                    variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
              {top3Tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No tasks scheduled</p>
              )}
            </div>
          </div>

          {/* Next Week Tasks */}
          {nextWeekTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Next Week</span>
              </div>
              <div className="space-y-1">
                {nextWeekTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span className="truncate flex items-center gap-2">
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isTomorrow(task.dueDate!) ? 'Tomorrow' : format(task.dueDate!, 'EEE, MMM d')}
                      </span>
                      <Badge 
                        variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Needing Attention */}
          {projectsNeedingAttention.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Needs Attention</span>
              </div>
              <div className="space-y-1">
                {projectsNeedingAttention.map(({ project, overdueCount, dueTodayCount }) => (
                  <div key={project.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                      {project.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {overdueCount > 0 && <span className="text-destructive">{overdueCount} overdue</span>}
                      {overdueCount > 0 && dueTodayCount > 0 && ' · '}
                      {dueTodayCount > 0 && `${dueTodayCount} today`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts Due */}
          {contactsDue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Reach Out Today</span>
              </div>
              <div className="space-y-1">
                {contactsDue.map(contact => {
                  const daysOverdue = differenceInDays(new Date(), contact.nextContactDue!);
                  return (
                    <div key={contact.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                      <span className="truncate">
                        {contact.name}
                        <span className="text-muted-foreground ml-1">
                          ({contact.contactType === 'personal' ? contact.personalTier : contact.businessLevel})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        {daysOverdue > 0 && (
                          <Badge variant="outline" className="text-xs text-destructive">
                            {daysOverdue}d overdue
                          </Badge>
                        )}
                        {onMarkContactContacted && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => onMarkContactContacted(contact.id)}
                          >
                            ✓
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contract Alerts */}
          {contractAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Contract Alerts</span>
              </div>
              <div className="space-y-1">
                {contractAlerts.map((alert, i) => (
                  <div key={`${alert.contract.id}-${alert.type}`} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span className="truncate">{alert.contract.name}</span>
                    <Badge 
                      variant={alert.type === 'cancellation' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {alert.type === 'cancellation' ? 'Cancel by' : 'Renewal'} {format(alert.date, 'MMM d')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Week Ahead - Evening commitments highlighted */}
          {weekAhead.some(d => d.hasEveningCommitment || d.events.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Week Ahead</span>
                {weekAhead.filter(d => d.hasEveningCommitment).length > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 ml-auto">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {weekAhead.filter(d => d.hasEveningCommitment).length} evening{weekAhead.filter(d => d.hasEveningCommitment).length > 1 ? 's' : ''} busy
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                {weekAhead.slice(0, 5).map((day) => (
                  <div 
                    key={day.date.toISOString()} 
                    className={cn(
                      "flex items-center justify-between text-sm p-2 rounded",
                      day.hasEveningCommitment && "bg-amber-500/10 border border-amber-500/20"
                    )}
                  >
                    <span className="font-medium text-muted-foreground w-16">{day.dayName}</span>
                    <span className="flex-1 truncate text-right">
                      {day.events.length === 0 ? (
                        <span className="text-muted-foreground/60">Free</span>
                      ) : day.hasEveningCommitment ? (
                        <span className="text-amber-600">
                          ⚠️ {day.eveningEvents[0]?.title} ({format(day.eveningEvents[0]?.startTime, 'HH:mm')})
                        </span>
                      ) : (
                        <span>{day.events[0]?.title}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Schedule */}
          {timeBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Today's Schedule</span>
              </div>
              <div className="space-y-1">
                {timeBlocks.map((block, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex items-center justify-between text-sm p-2 rounded",
                      block.type === 'free' ? "bg-green-500/10 border border-green-500/20" : "bg-muted/50"
                    )}
                  >
                    <span className="text-muted-foreground">{block.start} - {block.end}</span>
                    <span className={cn(block.type === 'free' && "text-green-600 font-medium")}>
                      {block.type === 'free' ? '✨ Deep work' : block.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button onClick={handleDismiss} className="w-full" size="lg">
            🚀 Let's Get Started
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
