import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useContracts } from '@/hooks/useContracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ContractCostWidget } from '@/components/contracts/ContractCostWidget';
import { 
  ArrowLeft, 
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { contracts } = useContracts(user?.id);

  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

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
  }, [user]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Tasks completed this week
    const completedThisWeek = tasks.filter(t => 
      t.completed && 
      t.createdAt && 
      isWithinInterval(t.createdAt, { start: weekStart, end: weekEnd })
    ).length;

    // Tasks completed this month
    const completedThisMonth = tasks.filter(t => 
      t.completed && 
      t.createdAt && 
      isWithinInterval(t.createdAt, { start: monthStart, end: monthEnd })
    ).length;

    // Category breakdown
    const businessTasks = tasks.filter(t => t.category === 'business').length;
    const personalTasks = tasks.filter(t => t.category === 'personal').length;
    const familyTasks = tasks.filter(t => t.category === 'family').length;

    // Productivity streak (consecutive days with completed tasks)
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

    // Peak productivity hours
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

    // Hourly distribution for chart
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      tasks: hourCounts[i] || 0,
    }));

    // Upcoming deadlines (next 7 days)
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Productivity Dashboard</h1>
            <p className="text-muted-foreground">Track your progress and insights</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-panel-solid">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completedThisWeek}</div>
              <p className="text-xs text-muted-foreground">tasks completed</p>
            </CardContent>
          </Card>

          <Card className="glass-panel-solid">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.completedThisMonth}</div>
              <p className="text-xs text-muted-foreground">tasks completed</p>
            </CardContent>
          </Card>

          <Card className="glass-panel-solid">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Streak</CardTitle>
              <Flame className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.streak}</div>
              <p className="text-xs text-muted-foreground">consecutive days</p>
            </CardContent>
          </Card>

          <Card className="glass-panel-solid">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
              <Zap className="w-4 h-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.peakHourLabel}</div>
              <p className="text-xs text-muted-foreground">most productive</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card className="glass-panel-solid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="w-40 h-40">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
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
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                      No tasks yet
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm">Business: {stats.businessTasks}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-accent" />
                    <span className="text-sm">Personal: {stats.personalTasks}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      Completion Rate
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={completionRate} className="h-2 flex-1" />
                      <span className="text-sm font-medium">{completionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card className="glass-panel-solid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Productivity by Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourlyData.filter((_, i) => i >= 6 && i <= 22)}>
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10 }}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar 
                      dataKey="tasks" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Deadlines (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingDeadlines.slice(0, 5).map(task => (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        task.priority === 'high' ? 'bg-destructive' :
                        task.priority === 'medium' ? 'bg-warning' :
                        'bg-muted-foreground'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{task.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {task.category} • {task.priority} priority
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {task.dueDate && format(task.dueDate, 'MMM d, h:mm a')}
                    </div>
                  </div>
                ))}
                {stats.upcomingDeadlines.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{stats.upcomingDeadlines.length - 5} more deadlines
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No upcoming deadlines in the next 7 days</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
