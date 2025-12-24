import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useContracts } from '@/hooks/useContracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ContractCostWidget } from '@/components/contracts/ContractCostWidget';
import { XPDisplay } from '@/components/gamification/XPDisplay';
import { CheckinPrompt } from '@/components/checkin/CheckinPrompt';
import { WhatNowButton } from '@/components/assistant/WhatNowButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  CheckCircle2, 
  Flame, 
  Clock, 
  Calendar,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameDay, subDays, addDays, startOfDay } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Task, TaskCategory } from '@/types/flux';

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  completed: boolean;
  created_at: string;
  due_date: string | null;
  user_id: string;
}

interface DashboardPanelProps {
  userId: string;
}

export function DashboardPanel({ userId }: DashboardPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { contracts } = useContracts(userId);
  const { t } = useLanguage();

  useEffect(() => {
    if (!userId) return;

    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (data) {
        setTasks(data.map((t: DbTask) => ({
          id: t.id,
          title: t.title,
          description: t.description || undefined,
          category: t.category as TaskCategory,
          priority: t.priority as 'high' | 'medium' | 'low',
          completed: t.completed,
          createdAt: new Date(t.created_at),
          dueDate: t.due_date ? new Date(t.due_date) : undefined,
        })));
      }
      setLoading(false);
    };

    fetchTasks();
  }, [userId]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const completedThisWeek = tasks.filter(t => 
      t.completed && 
      t.createdAt && 
      isWithinInterval(t.createdAt, { start: weekStart, end: weekEnd })
    ).length;

    const completedThisMonth = tasks.filter(t => 
      t.completed && 
      t.createdAt && 
      isWithinInterval(t.createdAt, { start: monthStart, end: monthEnd })
    ).length;

    const businessTasks = tasks.filter(t => t.category === 'business').length;
    const personalTasks = tasks.filter(t => t.category === 'personal').length;
    const familyTasks = tasks.filter(t => t.category === 'family').length;

    let streak = 0;
    let checkDate = startOfDay(now);
    
    for (let i = 0; i < 365; i++) {
      const dayTasks = tasks.filter(t => 
        t.completed && 
        t.createdAt && 
        isSameDay(t.createdAt, checkDate)
      );
      
      if (dayTasks.length > 0) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    const hourCounts: Record<number, number> = {};
    tasks.filter(t => t.completed).forEach(t => {
      if (t.createdAt) {
        const hour = t.createdAt.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    const peakHour = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];
    const peakHourLabel = peakHour 
      ? `${parseInt(peakHour)}:00 - ${parseInt(peakHour) + 1}:00`
      : 'N/A';

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      tasks: hourCounts[i] || 0,
    }));

    const upcomingDeadlines = tasks
      .filter(t => !t.completed && t.dueDate && isWithinInterval(t.dueDate, { 
        start: now, 
        end: addDays(now, 7) 
      }))
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));

    return {
      completedThisWeek,
      completedThisMonth,
      businessTasks,
      personalTasks,
      familyTasks,
      streak,
      peakHourLabel,
      hourlyData,
      upcomingDeadlines,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
    };
  }, [tasks]);

  const categoryData = [
    { name: 'Business', value: stats.businessTasks, color: 'hsl(var(--primary))' },
    { name: 'Personal', value: stats.personalTasks, color: 'hsl(var(--accent))' },
    { name: 'Family', value: stats.familyTasks, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-primary">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Daily Check-in Prompt */}
      <CheckinPrompt />

      {/* Header with XP and What Now */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <XPDisplay variant="compact" />
          <WhatNowButton tasks={tasks} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-panel-solid">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">{t('dashboard.thisWeek')}</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.completedThisWeek}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.tasksCompleted')}</p>
          </CardContent>
        </Card>

        <Card className="glass-panel-solid">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">{t('dashboard.thisMonth')}</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.completedThisMonth}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.tasksCompleted')}</p>
          </CardContent>
        </Card>

        <Card className="glass-panel-solid">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">{t('dashboard.streak')}</CardTitle>
            <Flame className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.streak}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.consecutiveDays')}</p>
          </CardContent>
        </Card>

        <Card className="glass-panel-solid">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">{t('dashboard.peakHours')}</CardTitle>
            <Zap className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-bold">{stats.peakHourLabel}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.mostProductive')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-panel-solid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-primary" />
              {t('dashboard.categoryBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    {t('dashboard.noTasks')}
                  </div>
                )}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs">{t('dashboard.business')}: {stats.businessTasks}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs">{t('dashboard.personal')}: {stats.personalTasks}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">{t('dashboard.completionRate')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={completionRate} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">{completionRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel-solid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              {t('dashboard.productivityByHour')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.hourlyData.filter((_, i) => i >= 6 && i <= 22)}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Costs Widget */}
      <ContractCostWidget contracts={contracts} />

      {/* Upcoming Deadlines */}
      <Card className="glass-panel-solid">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            {t('dashboard.upcomingDeadlines')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.upcomingDeadlines.length > 0 ? (
            <div className="space-y-2">
              {stats.upcomingDeadlines.slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'high' ? 'bg-destructive' :
                      task.priority === 'medium' ? 'bg-warning' :
                      'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.category} • {task.priority}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.dueDate && format(task.dueDate, 'MMM d, h:mm a')}
                  </div>
                </div>
              ))}
              {stats.upcomingDeadlines.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{stats.upcomingDeadlines.length - 5} {t('dashboard.more')}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('dashboard.noDeadlines')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
