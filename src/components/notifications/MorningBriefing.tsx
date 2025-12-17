import { useState, useEffect, useMemo } from 'react';
import { X, Sun, Calendar, CheckCircle2, Flame, Clock, Users, FileText, Zap, FolderKanban, Battery, BatteryLow, BatteryFull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task, CalendarEvent, Project } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { Contract } from '@/hooks/useContracts';
import { isToday, isTomorrow, isPast, differenceInDays, startOfDay, format } from 'date-fns';
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
  
  // Smart Top 3 tasks (prioritized by: overdue > high priority today > due today)
  const top3Tasks = useMemo(() => {
    const sorted = [...tasks]
      .filter(t => !t.completed)
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
