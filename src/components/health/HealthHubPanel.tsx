import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppleHealth, DailyHealthSummary } from '@/hooks/useAppleHealth';
import { useHealthTracking } from '@/hooks/useHealthTracking';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { AddHealthMetricDialog } from './AddHealthMetricDialog';
import { HealthTrackingPanel } from '@/components/family/HealthTrackingPanel';
import { AgeBasedCheckupsPanel } from './AgeBasedCheckupsPanel';
import {
  Activity,
  Heart,
  Moon,
  Footprints,
  Flame,
  Droplets,
  Scale,
  Apple,
  RefreshCw,
  Plus,
  TrendingUp,
  Calendar,
  Pill,
  Syringe,
  Clock,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
} from 'lucide-react';
import { format, parseISO, subDays, addDays, isSameDay, startOfDay } from 'date-fns';

export function HealthHubPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddMetricDialog, setShowAddMetricDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const {
    isAvailable,
    isConnected,
    isLoading: healthLoading,
    todaySummary,
    weeklyData,
    healthMetrics,
    requestAppleHealthPermission,
    syncAppleHealth,
    addManualMetric,
  } = useAppleHealth();
  
  const {
    medications,
    appointments,
    isLoading: trackingLoading,
    getActiveMedications,
    getUpcomingAppointments,
    getMedicationsNeedingRefill,
  } = useHealthTracking();

  const activeMedications = getActiveMedications();
  const upcomingAppointments = getUpcomingAppointments();
  const refillNeeded = getMedicationsNeedingRefill();

  // Calculate summary for selected date
  const selectedDateSummary = useMemo((): DailyHealthSummary => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayMetrics = healthMetrics.filter(m => m.recorded_at.startsWith(dateStr));
    
    const sumMetric = (type: string) => 
      dayMetrics.filter(m => m.metric_type === type).reduce((sum, m) => sum + m.value, 0);
    const getLatest = (type: string) => 
      dayMetrics.find(m => m.metric_type === type)?.value;
    
    return {
      date: dateStr,
      steps: sumMetric('steps'),
      calories: sumMetric('calories'),
      activeMinutes: sumMetric('active_minutes'),
      sleepHours: getLatest('sleep_hours') || 0,
      heartRateAvg: getLatest('heart_rate') || 0,
      weight: getLatest('weight'),
      waterIntake: sumMetric('water_intake'),
    };
  }, [healthMetrics, selectedDate]);

  const isToday = isSameDay(selectedDate, new Date());

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => {
    if (!isToday) setSelectedDate(prev => addDays(prev, 1));
  };
  const goToToday = () => setSelectedDate(new Date());

  const healthGoals = {
    steps: 10000,
    calories: 500,
    activeMinutes: 30,
    sleepHours: 8,
    waterIntake: 8,
  };

  const getProgress = (current: number, goal: number) => 
    Math.min((current / goal) * 100, 100);

  const isLoading = healthLoading || trackingLoading;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="border-b border-border p-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Health Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              Track your health & wellness
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAvailable && !isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={requestAppleHealthPermission}
                disabled={isLoading}
              >
                <Apple className="w-4 h-4 mr-2" />
                Connect Health
              </Button>
            )}
            {isConnected && (
              <Button
                variant="ghost"
                size="icon"
                onClick={syncAppleHealth}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShowAddMetricDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Data
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs - Mobile Optimized */}
      <div className="border-b border-border shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-12 p-1 bg-transparent grid grid-cols-4 gap-1">
            <TabsTrigger value="overview" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Activity className="w-4 h-4" />
              <span className="hidden xs:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="vitals" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Heart className="w-4 h-4" />
              <span className="hidden xs:inline">Vitals</span>
            </TabsTrigger>
            <TabsTrigger value="medical" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Pill className="w-4 h-4" />
              <span className="hidden xs:inline">Medical</span>
            </TabsTrigger>
            <TabsTrigger value="checkups" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Calendar className="w-4 h-4" />
              <span className="hidden xs:inline">Checkups</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pb-20">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && activeTab === 'overview' && (
            <>
              {/* Date Navigation */}
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="font-medium">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {isToday ? 'Today' : format(selectedDate, 'EEE, MMM d')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedDate(date);
                              setCalendarOpen(false);
                            }
                          }}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={goToNextDay}
                      disabled={isToday}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                  {!isToday && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="w-full mt-1 text-xs"
                      onClick={goToToday}
                    >
                      Go to Today
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Selected Day Summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Footprints className="w-4 h-4" />
                      <span className="text-xs">Steps</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedDateSummary.steps.toLocaleString()}
                    </p>
                    <Progress 
                      value={getProgress(selectedDateSummary.steps, healthGoals.steps)} 
                      className="h-1 mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {healthGoals.steps.toLocaleString()} goal
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Flame className="w-4 h-4" />
                      <span className="text-xs">Calories</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedDateSummary.calories}
                    </p>
                    <Progress 
                      value={getProgress(selectedDateSummary.calories, healthGoals.calories)} 
                      className="h-1 mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {healthGoals.calories} kcal goal
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Droplets className="w-4 h-4" />
                      <span className="text-xs">Water</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedDateSummary.waterIntake}
                    </p>
                    <Progress 
                      value={getProgress(selectedDateSummary.waterIntake, healthGoals.waterIntake)} 
                      className="h-1 mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {healthGoals.waterIntake} glasses goal
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Moon className="w-4 h-4" />
                      <span className="text-xs">Sleep</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {selectedDateSummary.sleepHours.toFixed(1)}h
                    </p>
                    <Progress 
                      value={getProgress(selectedDateSummary.sleepHours, healthGoals.sleepHours)} 
                      className="h-1 mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {healthGoals.sleepHours}h goal
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Heart className="w-5 h-5 mx-auto text-red-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.heartRateAvg || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">BPM</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Activity className="w-5 h-5 mx-auto text-green-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.activeMinutes}
                    </p>
                    <p className="text-xs text-muted-foreground">Active min</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Scale className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.weight?.toFixed(1) || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">kg</p>
                  </CardContent>
                </Card>
              </div>

              {/* Alerts */}
              {(refillNeeded.length > 0 || upcomingAppointments.length > 0) && (
                <Card className="border-warning/50 bg-warning/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning" />
                      Reminders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {refillNeeded.slice(0, 2).map(med => (
                      <div key={med.id} className="flex items-center gap-2 text-sm">
                        <Pill className="w-4 h-4 text-warning" />
                        <span>{med.name} needs refill</span>
                      </div>
                    ))}
                    {upcomingAppointments.slice(0, 2).map(appt => (
                      <div key={appt.id} className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{appt.title} - {format(parseISO(appt.appointment_date), 'MMM d')}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recent Synced Data */}
              {healthMetrics.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Recent Health Data ({healthMetrics.length} records)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {healthMetrics.slice(0, 8).map(metric => (
                      <div key={metric.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {metric.metric_type === 'steps' && <Footprints className="w-3 h-3 text-primary" />}
                          {metric.metric_type === 'calories' && <Flame className="w-3 h-3 text-orange-500" />}
                          {metric.metric_type === 'heart_rate' && <Heart className="w-3 h-3 text-red-500" />}
                          {metric.metric_type === 'sleep_hours' && <Moon className="w-3 h-3 text-purple-500" />}
                          {metric.metric_type === 'weight' && <Scale className="w-3 h-3 text-blue-500" />}
                          {metric.metric_type === 'water_intake' && <Droplets className="w-3 h-3 text-blue-400" />}
                          <span className="capitalize">{metric.metric_type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {metric.value.toLocaleString()} {metric.unit}
                          </span>
                          <span className="text-xs">
                            {format(parseISO(metric.recorded_at), 'MMM d')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Apple Health Connection */}
              {isAvailable && !isConnected && (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Apple className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-1">Connect Apple Health</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sync your health data automatically from your iPhone
                    </p>
                    <Button onClick={requestAppleHealthPermission} disabled={isLoading}>
                      <Apple className="w-4 h-4 mr-2" />
                      Connect Now
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!isLoading && activeTab === 'vitals' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    Heart Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold">{todaySummary?.heartRateAvg || '--'}</p>
                    <p className="text-muted-foreground">BPM</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <p className="font-medium">60</p>
                      <p className="text-xs text-muted-foreground">Resting</p>
                    </div>
                    <div>
                      <p className="font-medium">85</p>
                      <p className="text-xs text-muted-foreground">Average</p>
                    </div>
                    <div>
                      <p className="font-medium">145</p>
                      <p className="text-xs text-muted-foreground">Peak</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-500" />
                    Weight
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold">{todaySummary?.weight?.toFixed(1) || '--'}</p>
                    <p className="text-muted-foreground">kg</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowAddMetricDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Log Weight
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Moon className="w-4 h-4 text-purple-500" />
                    Sleep
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold">{todaySummary?.sleepHours?.toFixed(1) || '--'}</p>
                    <p className="text-muted-foreground">hours last night</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isLoading && activeTab === 'medical' && (
            <HealthTrackingPanel />
          )}

          {!isLoading && activeTab === 'checkups' && (
            <AgeBasedCheckupsPanel />
          )}

          {!isLoading && activeTab === 'trends' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weekly Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-32">
                    {weeklyData.map((day, i) => {
                      const height = (day.steps / healthGoals.steps) * 100;
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-primary/20 rounded-t relative overflow-hidden"
                            style={{ height: '100%' }}
                          >
                            <div 
                              className="absolute bottom-0 w-full bg-primary rounded-t transition-all"
                              style={{ height: `${Math.min(height, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(day.date), 'EEE').slice(0, 1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weekly Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {weeklyData.slice(-5).reverse().map((day) => (
                      <div key={day.date} className="flex items-center justify-between">
                        <span className="text-sm">{format(parseISO(day.date), 'EEE, MMM d')}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            <Footprints className="w-3 h-3 inline mr-1" />
                            {day.steps.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">
                            <Flame className="w-3 h-3 inline mr-1" />
                            {day.calories}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      <AddHealthMetricDialog
        open={showAddMetricDialog}
        onOpenChange={setShowAddMetricDialog}
        onAdd={addManualMetric}
      />
    </div>
  );
}
