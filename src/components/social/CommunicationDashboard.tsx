import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, 
  Phone, 
  Clock, 
  Users, 
  TrendingUp,
  Activity
} from 'lucide-react';
import { useCommunicationStats } from '@/hooks/useCommunicationStats';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface CommunicationDashboardProps {
  userId: string;
}

export function CommunicationDashboard({ userId: _userId }: CommunicationDashboardProps) {
  const { dashboard, loading } = useCommunicationStats();

  if (loading || !dashboard) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Messages',
      value: dashboard.totalMessages.toLocaleString(),
      icon: MessageCircle,
      color: 'text-blue-500',
    },
    {
      title: 'Total Calls',
      value: dashboard.totalCalls.toLocaleString(),
      icon: Phone,
      color: 'text-green-500',
    },
    {
      title: 'Call Minutes',
      value: dashboard.totalCallMinutes.toLocaleString(),
      icon: Clock,
      color: 'text-purple-500',
    },
    {
      title: 'Active Contacts',
      value: dashboard.totalContacts.toLocaleString(),
      icon: Users,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.recentActivity}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en', { weekday: 'short' })}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary) / 0.2)" 
                  name="Messages"
                />
                <Area 
                  type="monotone" 
                  dataKey="calls" 
                  stroke="hsl(142.1 76.2% 36.3%)" 
                  fill="hsl(142.1 76.2% 36.3% / 0.2)" 
                  name="Calls"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Most Active Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Most Active Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.mostActiveContacts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-4">
                {dashboard.mostActiveContacts.map((contact) => {
                  const total = contact.totalMessagesSent + contact.totalMessagesReceived + contact.totalCalls;
                  const maxTotal = dashboard.mostActiveContacts[0] 
                    ? dashboard.mostActiveContacts[0].totalMessagesSent + 
                      dashboard.mostActiveContacts[0].totalMessagesReceived + 
                      dashboard.mostActiveContacts[0].totalCalls 
                    : 1;
                  
                  return (
                    <div key={contact.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{contact.contactName}</span>
                        <span className="text-sm text-muted-foreground">
                          {total} interactions
                        </span>
                      </div>
                      <Progress value={(total / maxTotal) * 100} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold">
                {dashboard.avgResponseTime > 0 
                  ? `${dashboard.avgResponseTime} min`
                  : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Average response time
              </p>
            </div>

            {dashboard.neglectedContacts.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Need attention:</p>
                <div className="flex flex-wrap gap-2">
                  {dashboard.neglectedContacts.slice(0, 3).map((contact) => (
                    <Badge key={contact.id} variant="secondary">
                      {contact.contactName}
                    </Badge>
                  ))}
                  {dashboard.neglectedContacts.length > 3 && (
                    <Badge variant="outline">
                      +{dashboard.neglectedContacts.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
