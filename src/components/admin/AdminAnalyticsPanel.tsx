import { useState } from 'react';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  Users,
  Activity,
  TrendingUp,
  Calendar,
  DollarSign,
  MousePointer,
  Bot,
  RefreshCw,
  ShieldAlert,
  Database
} from 'lucide-react';
import { format } from 'date-fns';
import { AnalyticsOverview } from './AnalyticsOverview';
import { UserAnalyticsTable } from './UserAnalyticsTable';
import { EventsLog } from './EventsLog';
import { AIUsagePanel } from './AIUsagePanel';
import { AdminDataExportImport } from './AdminDataExportImport';

interface AdminAnalyticsPanelProps {
  userId: string;
}

export function AdminAnalyticsPanel({ userId }: AdminAnalyticsPanelProps) {
  const {
    isAdmin,
    loading,
    overview,
    userStats,
    events,
    aiUsage,
    dateRange,
    setDateRange,
    fetchOverview,
    fetchUserStats,
  } = useAdminAnalytics();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOverview(), fetchUserStats()]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldAlert className="h-16 w-16" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p>You don't have admin privileges to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Admin Analytics</h1>
            <p className="text-sm text-muted-foreground">Track user activity and AI usage</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={format(dateRange.start, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
              className="w-36 h-8"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={format(dateRange.end, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
              className="w-36 h-8"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Users</span>
              </div>
              <p className="text-2xl font-bold mt-1">{overview.totalUsers}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Active Today</span>
              </div>
              <p className="text-2xl font-bold mt-1">{overview.activeUsersToday}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Active This Week</span>
              </div>
              <p className="text-2xl font-bold mt-1">{overview.activeUsersWeek}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Total Events</span>
              </div>
              <p className="text-2xl font-bold mt-1">{overview.totalEvents.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-500" />
                <span className="text-xs text-muted-foreground">AI Tokens</span>
              </div>
              <p className="text-2xl font-bold mt-1">{overview.totalAITokens.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">AI Cost</span>
              </div>
              <p className="text-2xl font-bold mt-1">${overview.totalAICost.toFixed(4)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 w-fit">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Activity className="h-4 w-4" />
            Events Log
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            AI Usage
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="overview" className="mt-0">
            <AnalyticsOverview overview={overview} />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <UserAnalyticsTable userStats={userStats} onChanged={handleRefresh} />
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            <EventsLog events={events} />
          </TabsContent>

          <TabsContent value="ai" className="mt-0">
            <AIUsagePanel aiUsage={aiUsage} />
          </TabsContent>

          <TabsContent value="data" className="mt-0">
            <AdminDataExportImport />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
