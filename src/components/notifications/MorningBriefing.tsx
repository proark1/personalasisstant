import { useState, useEffect, useMemo, ReactNode } from 'react';
import { X, Sun, Calendar, CheckCircle2, Flame, Users, FileText, Zap, FolderKanban, Battery, BatteryLow, BatteryFull, Moon, Newspaper, MapPin, Loader2, Volume2 } from 'lucide-react';
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

interface SectionProps {
  icon: ReactNode;
  children: ReactNode;
}

function Section({ icon, children }: SectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

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
    const lastShown = localStorage.getItem('darai-briefing-last-shown');
    const today = startOfDay(new Date()).toISOString();
    
    if (lastShown === today) {
      setVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    const today = startOfDay(new Date()).toISOString();
    localStorage.setItem('darai-briefing-last-shown', today);
    if (energyLevel) {
      localStorage.setItem('darai-energy-level', energyLevel);
    }
    setVisible(false);
    onDismiss();
  };

  // Calculate data
  const _todayTasks = tasks.filter(t => !t.completed && t.dueDate && isToday(t.dueDate));
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300 p-2 sm:p-4 md:p-6 lg:p-8 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl border-primary/20 bg-card/95 backdrop-blur shadow-2xl my-2 sm:my-4">
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
          {/* Top Row: Weather + Energy + Streak */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Weather */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-sky-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{weather?.icon || '🌡️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">
                      {weatherLoading ? '...' : weather ? `${weather.temperature}°C` : '--'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {weather?.condition || 'Loading...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{weather?.location || 'Detecting...'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Energy Check */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                How are you feeling?
              </p>
              <div className="flex gap-1">
                <Button
                  variant={energyLevel === 'low' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnergyLevel('low')}
                  className={cn("flex-1 gap-1 h-7 text-xs", energyLevel === 'low' && "bg-yellow-600")}
                >
                  <BatteryLow className="h-3 w-3" />
                  Low
                </Button>
                <Button
                  variant={energyLevel === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnergyLevel('medium')}
                  className={cn("flex-1 gap-1 h-7 text-xs", energyLevel === 'medium' && "bg-blue-600")}
                >
                  <Battery className="h-3 w-3" />
                  Good
                </Button>
                <Button
                  variant={energyLevel === 'high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnergyLevel('high')}
                  className={cn("flex-1 gap-1 h-7 text-xs", energyLevel === 'high' && "bg-green-600")}
                >
                  <BatteryFull className="h-3 w-3" />
                  Great
                </Button>
              </div>
            </div>

            {/* Streak + Overdue */}
            <div className="space-y-2">
              {streak > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-sm text-orange-500">
                    {streak} day streak!
                  </span>
                </div>
              )}
              {overdueTasks.length > 0 && (
                <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive">
                    ⚠️ {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Column 1: Tasks */}
            <div className="space-y-4">
              {/* Top 3 Tasks */}
              <Section icon={<CheckCircle2 className="h-4 w-4 text-primary" />}>
                {top3Tasks.map((task, i) => (
                  <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <span className="truncate flex items-center gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {task.title}
                    </span>
                    <Badge 
                      variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
                {top3Tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2">No tasks scheduled</p>
                )}
              </Section>

              {/* Next Week Tasks */}
              {nextWeekTasks.length > 0 && (
                <Section icon={<Calendar className="h-4 w-4 text-blue-500" />}>
                  {nextWeekTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                      <span className="truncate">{task.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {isTomorrow(task.dueDate!) ? 'Tomorrow' : format(task.dueDate!, 'EEE')}
                      </span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Projects Needing Attention */}
              {projectsNeedingAttention.length > 0 && (
                <Section icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}>
                  {projectsNeedingAttention.map(({ project, overdueCount, dueTodayCount }) => (
                    <div key={project.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                      <span className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        {project.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {overdueCount > 0 && <span className="text-destructive">{overdueCount} overdue</span>}
                        {overdueCount > 0 && dueTodayCount > 0 && ' · '}
                        {dueTodayCount > 0 && `${dueTodayCount} today`}
                      </span>
                    </div>
                  ))}
                </Section>
              )}
            </div>

            {/* Column 2: Contacts & Contracts */}
            <div className="space-y-4">
              {/* Contacts Due */}
              {contactsDue.length > 0 && (
                <Section icon={<Users className="h-4 w-4 text-muted-foreground" />}>
                  {contactsDue.map(contact => {
                    const daysOverdue = differenceInDays(new Date(), contact.nextContactDue!);
                    return (
                      <div key={contact.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                        <span className="truncate">
                          {contact.name}
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({contact.contactType === 'personal' ? contact.personalTier : contact.businessLevel})
                          </span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {daysOverdue > 0 && (
                            <Badge variant="outline" className="text-[10px] text-destructive">
                              {daysOverdue}d
                            </Badge>
                          )}
                          {onMarkContactContacted && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={() => onMarkContactContacted(contact.id)}
                            >
                              ✓
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Contract Alerts */}
              {contractAlerts.length > 0 && (
                <Section icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                  {contractAlerts.map((alert) => (
                    <div key={`${alert.contract.id}-${alert.type}`} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                      <span className="truncate">{alert.contract.name}</span>
                      <Badge 
                        variant={alert.type === 'cancellation' ? 'destructive' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {alert.type === 'cancellation' ? 'Cancel' : 'Renew'} {format(alert.date, 'MMM d')}
                      </Badge>
                    </div>
                  ))}
                </Section>
              )}

              {/* Personalized News */}
              <Section icon={<Newspaper className="h-4 w-4 text-primary" />}>
                {newsLoading ? (
                  <div className="flex items-center gap-2 p-2">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Loading news...</span>
                  </div>
                ) : news.length > 0 ? (
                  news.slice(0, 3).map((item, i) => (
                    <div key={i} className="p-2 rounded bg-muted/50">
                      {item.url ? (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium line-clamp-2 hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {item.headline}
                        </a>
                      ) : (
                        <p className="text-sm font-medium line-clamp-2">{item.headline}</p>
                      )}
                      <Badge variant="outline" className="text-[10px] mt-1">{item.category}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground p-2">
                    Add interests to your profile for personalized news
                  </p>
                )}
              </Section>
            </div>

            {/* Column 3: Schedule */}
            <div className="space-y-4">
              {/* Today's Schedule */}
              {timeBlocks.length > 0 && (
                <Section icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                  {timeBlocks.map((block, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex items-center justify-between text-sm p-2 rounded",
                        block.type === 'free' ? "bg-green-500/10 border border-green-500/20" : "bg-muted/50"
                      )}
                    >
                      <span className="text-muted-foreground text-xs">{block.start}-{block.end}</span>
                      <span className={cn("truncate ml-2", block.type === 'free' && "text-green-600 font-medium")}>
                        {block.type === 'free' ? '✨ Deep work' : block.title}
                      </span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Week Ahead */}
              {weekAhead.some(d => d.hasEveningCommitment || d.events.length > 0) && (
                <Section icon={<Moon className="h-4 w-4 text-muted-foreground" />}>
                  {weekAhead.slice(0, 5).map((day) => (
                    <div 
                      key={day.date.toISOString()} 
                      className={cn(
                        "flex items-center justify-between text-sm p-2 rounded",
                        day.hasEveningCommitment ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/50"
                      )}
                    >
                      <span className="font-medium text-muted-foreground w-12 text-xs">{day.dayName}</span>
                      <span className="flex-1 truncate text-right text-xs">
                        {day.events.length === 0 ? (
                          <span className="text-muted-foreground/60">Free</span>
                        ) : day.hasEveningCommitment ? (
                          <span className="text-amber-600">
                            ⚠️ {day.eveningEvents[0]?.title}
                          </span>
                        ) : (
                          <span>{day.events[0]?.title}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              onClick={() => {
                // Audio briefing feature - would integrate with text-to-speech
                console.log('Audio briefing requested');
              }}
            >
              <Volume2 className="w-4 h-4" />
              Listen
            </Button>
            <Button onClick={handleDismiss} className="flex-1" size="lg">
              🚀 Let's Go
            </Button>
          </div>
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
