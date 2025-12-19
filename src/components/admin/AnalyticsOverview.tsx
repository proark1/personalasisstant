import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

interface OverviewStats {
  totalUsers: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  totalEvents: number;
  totalAITokens: number;
  totalAICost: number;
  topEvents: { event_type: string; count: number }[];
  topCategories: { event_category: string; count: number }[];
  eventsOverTime: { date: string; count: number }[];
  aiUsageOverTime: { date: string; tokens: number; cost: number }[];
}

interface AnalyticsOverviewProps {
  overview: OverviewStats | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  navigation: 'hsl(var(--chart-1))',
  task: 'hsl(var(--chart-2))',
  event: 'hsl(var(--chart-3))',
  habit: 'hsl(var(--chart-4))',
  ai: 'hsl(var(--chart-5))',
  contact: 'hsl(210, 70%, 50%)',
  contract: 'hsl(280, 70%, 50%)',
  call: 'hsl(340, 70%, 50%)',
  chat: 'hsl(160, 70%, 50%)',
  search: 'hsl(40, 70%, 50%)',
};

export function AnalyticsOverview({ overview }: AnalyticsOverviewProps) {
  if (!overview) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No analytics data available for the selected period.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Events Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Events Over Time</CardTitle>
          <CardDescription>Daily event counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.eventsOverTime}>
                <defs>
                  <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#eventGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* AI Usage Over Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">AI Token Usage</CardTitle>
          <CardDescription>Daily AI consumption</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.aiUsageOverTime}>
                <defs>
                  <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'tokens' ? value.toLocaleString() : `$${value.toFixed(4)}`,
                    name === 'tokens' ? 'Tokens' : 'Cost'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="hsl(var(--chart-5))" 
                  fill="url(#aiGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Event Types */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Top Event Types</CardTitle>
          <CardDescription>Most frequent actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.topEvents.slice(0, 8)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis 
                  type="category" 
                  dataKey="event_type" 
                  tick={{ fontSize: 10 }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Event Categories Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Event Categories</CardTitle>
          <CardDescription>Distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.topCategories}
                  dataKey="count"
                  nameKey="event_category"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ event_category, percent }) => 
                    `${event_category} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {overview.topCategories.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CATEGORY_COLORS[entry.event_category] || `hsl(${index * 40}, 70%, 50%)`}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Feature Usage Summary</CardTitle>
          <CardDescription>What users are doing the most</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {overview.topCategories.map(cat => (
              <Badge 
                key={cat.event_category}
                variant="outline"
                className="text-sm py-1 px-3"
                style={{ 
                  borderColor: CATEGORY_COLORS[cat.event_category] || 'hsl(var(--border))',
                  color: CATEGORY_COLORS[cat.event_category] || 'hsl(var(--foreground))'
                }}
              >
                {cat.event_category}: {cat.count.toLocaleString()}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
