import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppleHealth, DailyHealthSummary } from '@/hooks/useAppleHealth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHealthTracking } from '@/hooks/useHealthTracking';
import { AddHealthMetricDialog } from './AddHealthMetricDialog';
import { HealthTrackingPanel } from '@/components/family/HealthTrackingPanel';
import { AgeBasedCheckupsPanel } from './AgeBasedCheckupsPanel';
import { HealthInsightsCard } from './HealthInsightsCard';
import { HealthCoachPanel } from './HealthCoachPanel';
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
  Clock,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Wind,
  Gauge,
  ArrowUpDown,
  Mountain,
  Brain,
  Ruler,
  Percent,
  Settings,
  ChevronDown,
  Info,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO, subDays, addDays, isSameDay } from 'date-fns';

export function HealthHubPanel() {
  const [activeTab, setActiveTab] = useState('coach');
  const [showAddMetricDialog, setShowAddMetricDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [latestDataDate, setLatestDataDate] = useState<string | null>(null);
  const [initialDateSet, setInitialDateSet] = useState(false);
  
  const {
    isAvailable,
    isConnected,
    isLoading: healthLoading,
    todaySummary,
    weeklyData,
    healthMetrics,
    debugInfo,
    requestAppleHealthPermission,
    syncAppleHealth,
    addManualMetric,
    openAppSettings,
    runHealthKitDiagnostics,
    fetchLatestHealthDate,
    refetch,
  } = useAppleHealth();

  // On mount: find latest data date and default to it if today has no data
  useEffect(() => {
    if (initialDateSet) return;
    const init = async () => {
      const latest = await fetchLatestHealthDate();
      if (latest) {
        setLatestDataDate(latest);
        const today = new Date().toISOString().split('T')[0];
        if (latest !== today) {
          setSelectedDate(new Date(latest + 'T12:00:00'));
        }
      }
      setInitialDateSet(true);
    };
    init();
  }, [fetchLatestHealthDate, initialDateSet]);

  // Re-fetch metrics when selected date changes (60-day window around it)
  useEffect(() => {
    if (!initialDateSet) return;
    const startDate = format(subDays(selectedDate, 30), 'yyyy-MM-dd');
    const endDate = format(addDays(selectedDate, 7), 'yyyy-MM-dd');
    refetch(startDate, endDate);
  }, [selectedDate, initialDateSet, refetch]);
  
  const {
    isLoading: trackingLoading,
    getActiveMedications,
    getUpcomingAppointments,
    getMedicationsNeedingRefill,
  } = useHealthTracking();

  const _activeMedications = getActiveMedications();
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
      // Enhanced metrics
      restingHeartRate: getLatest('resting_heart_rate'),
      hrv: getLatest('hrv'),
      respiratoryRate: getLatest('respiratory_rate'),
      bloodOxygen: getLatest('blood_oxygen'),
      bloodPressureSystolic: getLatest('blood_pressure_systolic'),
      bloodPressureDiastolic: getLatest('blood_pressure_diastolic'),
      distance: sumMetric('distance'),
      flightsClimbed: sumMetric('flights_climbed'),
      bodyFat: getLatest('body_fat'),
      mindfulnessMinutes: sumMetric('mindfulness_minutes'),
      height: getLatest('height'),
      // Enhanced sleep data
      sleepRemMinutes: getLatest('sleep_rem_minutes'),
      sleepDeepMinutes: getLatest('sleep_deep_minutes'),
      sleepCoreMinutes: getLatest('sleep_core_minutes'),
      sleepAwakeMinutes: getLatest('sleep_awake_minutes'),
      sleepInBedMinutes: getLatest('sleep_in_bed_minutes'),
      sleepEfficiency: getLatest('sleep_efficiency'),
    };
  }, [healthMetrics, selectedDate]);

  // Calculate weekly sleep data for trends
  const weeklySleepData = useMemo(() => {
    const data: Array<{
      date: string;
      sleepHours: number;
      remMinutes?: number;
      deepMinutes?: number;
      coreMinutes?: number;
      awakeMinutes?: number;
      efficiency?: number;
    }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayMetrics = healthMetrics.filter(m => m.recorded_at.startsWith(dateStr));
      
      const getLatest = (type: string) => 
        dayMetrics.find(m => m.metric_type === type)?.value;
      
      data.push({
        date: dateStr,
        sleepHours: getLatest('sleep_hours') || 0,
        remMinutes: getLatest('sleep_rem_minutes'),
        deepMinutes: getLatest('sleep_deep_minutes'),
        coreMinutes: getLatest('sleep_core_minutes'),
        awakeMinutes: getLatest('sleep_awake_minutes'),
        efficiency: getLatest('sleep_efficiency'),
      });
    }
    
    return data;
  }, [healthMetrics]);

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
              {latestDataDate && !isSameDay(selectedDate, new Date()) ? (
                <>Showing data from {format(selectedDate, 'MMM d, yyyy')}</>
              ) : (
                'Track your health & wellness'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAvailable && !isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSetupGuide(true);
                  requestAppleHealthPermission();
                }}
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
        
        {/* Apple Health Setup Guide */}
        {isAvailable && showSetupGuide && (
          <Collapsible open={showSetupGuide} onOpenChange={setShowSetupGuide} className="mt-3">
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      How to Enable Apple Health Permissions
                    </p>
                    <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1.5 list-decimal list-inside">
                      <li>Open the <strong>Health</strong> app on your iPhone</li>
                      <li>Tap your profile icon (top right) → <strong>Apps</strong></li>
                      <li>Find and tap <strong>DarAI</strong></li>
                      <li>Toggle <strong>ON</strong> all data categories you want to share</li>
                      <li>Return here and tap <strong>Sync</strong></li>
                    </ol>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-2 italic">
                      Note: Permissions are NOT in iOS Settings → DarAI. They're only in the Health app.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAppSettings}
                        className="text-xs h-7"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open App Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSetupGuide(false)}
                        className="text-xs h-7"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Collapsible>
        )}
        
        {/* Debug Info (collapsible) */}
        {isAvailable && (
          <Collapsible open={showDebugInfo} onOpenChange={setShowDebugInfo} className="mt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2">
                <Settings className="w-3 h-3 mr-1" />
                Debug Info
                <ChevronDown className={cn("w-3 h-3 ml-1 transition-transform", showDebugInfo && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2 bg-muted/50">
                <CardContent className="p-3 text-xs font-mono space-y-1">
                  {/* Verify Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-2 text-xs h-8"
                    onClick={async () => {
                      setIsRunningDiagnostics(true);
                      try {
                        await runHealthKitDiagnostics();
                      } finally {
                        setIsRunningDiagnostics(false);
                      }
                    }}
                    disabled={isRunningDiagnostics}
                  >
                    {isRunningDiagnostics ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Running Diagnostics...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Verify HealthKit Setup
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between">
                    <span>Platform:</span>
                    <span>{debugInfo.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Native:</span>
                    <span>{debugInfo.isNative ? '✅' : '❌'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plugin Loaded:</span>
                    <span>{debugInfo.pluginLoaded ? '✅' : '❌'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HealthKit Available:</span>
                    <span>{debugInfo.isHealthAvailable === null ? '❓' : debugInfo.isHealthAvailable ? '✅' : '❌'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Sync:</span>
                    <span className={cn(
                      debugInfo.lastSyncResult === 'success' && 'text-green-600',
                      debugInfo.lastSyncResult === 'no_data' && 'text-yellow-600',
                      debugInfo.lastSyncResult === 'error' && 'text-red-600',
                    )}>
                      {debugInfo.lastSyncResult || 'Not synced'}
                    </span>
                  </div>
                  
                  {debugInfo.diagnosticsRan && (
                    <>
                      <div className="pt-1 border-t mt-1">
                        <span className="text-muted-foreground font-semibold">Diagnostics Results:</span>
                      </div>
                      {debugInfo.diagnosticsTimestamp && (
                        <div className="flex justify-between">
                          <span>Ran at:</span>
                          <span className="text-muted-foreground">{new Date(debugInfo.diagnosticsTimestamp).toLocaleTimeString()}</span>
                        </div>
                      )}
                      {debugInfo.permissionResult && (
                        <div>
                          <span className="text-muted-foreground">Permission Result: </span>
                          <span className="break-all text-[10px]">{debugInfo.permissionResult}</span>
                        </div>
                      )}
                      {debugInfo.sampleQueryResult && (
                        <div>
                          <span className="text-muted-foreground">Sample Query: </span>
                          <span className="break-all text-[10px]">{debugInfo.sampleQueryResult}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {debugInfo.metricsCollected > 0 && (
                    <div className="flex justify-between">
                      <span>Metrics:</span>
                      <span>{debugInfo.metricsCollected}</span>
                    </div>
                  )}
                  {debugInfo.dataTypes.length > 0 && (
                    <div className="pt-1 border-t">
                      <span className="text-muted-foreground">Types: </span>
                      <span className="break-all">{debugInfo.dataTypes.join(', ')}</span>
                    </div>
                  )}
                  {debugInfo.lastError && (
                    <div className="pt-1 border-t text-red-600">
                      <span>Error: </span>
                      <span>{debugInfo.lastError}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </header>

      {/* Tabs - Mobile Optimized */}
      <div className="border-b border-border shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-12 p-1 bg-transparent grid grid-cols-6 gap-1">
            <TabsTrigger value="coach" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Brain className="w-4 h-4" />
              <span className="hidden xs:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Activity className="w-4 h-4" />
              <span className="hidden xs:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="sleep" className="flex flex-col items-center justify-center gap-0.5 text-xs data-[state=active]:bg-muted h-full px-1">
              <Moon className="w-4 h-4" />
              <span className="hidden xs:inline">Sleep</span>
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

      {/* AI Coach Tab - Full height without ScrollArea wrapper */}
      {activeTab === 'coach' && (
        <div className="flex-1 overflow-hidden">
          <HealthCoachPanel />
        </div>
      )}

      {/* Sleep Tab */}
      {activeTab === 'sleep' && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 pb-20">
            {/* Last Night's Sleep */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Last Night's Sleep
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-3xl font-bold">
                      {selectedDateSummary.sleepHours.toFixed(1)}h
                    </p>
                    <p className="text-sm text-muted-foreground">
                      of {healthGoals.sleepHours}h goal
                    </p>
                  </div>
                  <div className="text-right">
                    {selectedDateSummary.sleepEfficiency && (
                      <div>
                        <p className="text-lg font-semibold">{selectedDateSummary.sleepEfficiency.toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">Efficiency</p>
                      </div>
                    )}
                  </div>
                </div>
                <Progress 
                  value={getProgress(selectedDateSummary.sleepHours, healthGoals.sleepHours)} 
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Sleep Stages */}
            {(selectedDateSummary.sleepRemMinutes || selectedDateSummary.sleepDeepMinutes || selectedDateSummary.sleepCoreMinutes) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Sleep Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedDateSummary.sleepRemMinutes && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            REM
                          </span>
                          <span className="text-sm font-medium">
                            {Math.floor(selectedDateSummary.sleepRemMinutes / 60)}h {selectedDateSummary.sleepRemMinutes % 60}m
                          </span>
                        </div>
                        <Progress 
                          value={(selectedDateSummary.sleepRemMinutes / (selectedDateSummary.sleepHours * 60)) * 100} 
                          className="h-2 bg-purple-100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {((selectedDateSummary.sleepRemMinutes / (selectedDateSummary.sleepHours * 60)) * 100).toFixed(0)}% of sleep (optimal: 20-25%)
                        </p>
                      </div>
                    )}
                    
                    {selectedDateSummary.sleepDeepMinutes && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                            Deep
                          </span>
                          <span className="text-sm font-medium">
                            {Math.floor(selectedDateSummary.sleepDeepMinutes / 60)}h {selectedDateSummary.sleepDeepMinutes % 60}m
                          </span>
                        </div>
                        <Progress 
                          value={(selectedDateSummary.sleepDeepMinutes / (selectedDateSummary.sleepHours * 60)) * 100} 
                          className="h-2 bg-blue-100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {((selectedDateSummary.sleepDeepMinutes / (selectedDateSummary.sleepHours * 60)) * 100).toFixed(0)}% of sleep (optimal: 15-20%)
                        </p>
                      </div>
                    )}

                    {selectedDateSummary.sleepCoreMinutes && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-cyan-500" />
                            Core
                          </span>
                          <span className="text-sm font-medium">
                            {Math.floor(selectedDateSummary.sleepCoreMinutes / 60)}h {selectedDateSummary.sleepCoreMinutes % 60}m
                          </span>
                        </div>
                        <Progress 
                          value={(selectedDateSummary.sleepCoreMinutes / (selectedDateSummary.sleepHours * 60)) * 100} 
                          className="h-2 bg-cyan-100"
                        />
                      </div>
                    )}

                    {selectedDateSummary.sleepAwakeMinutes && selectedDateSummary.sleepAwakeMinutes > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-400" />
                            Awake
                          </span>
                          <span className="text-sm font-medium">
                            {selectedDateSummary.sleepAwakeMinutes}m
                          </span>
                        </div>
                        <Progress 
                          value={(selectedDateSummary.sleepAwakeMinutes / (selectedDateSummary.sleepInBedMinutes || selectedDateSummary.sleepHours * 60)) * 100} 
                          className="h-2 bg-orange-100"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Sleep Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {weeklySleepData.map((day, i) => {
                    const dayLabel = format(parseISO(day.date), 'EEE');
                    const isCurrentDay = isSameDay(parseISO(day.date), new Date());
                    return (
                      <div key={i} className={cn("flex items-center gap-2", isCurrentDay && "bg-muted/50 rounded-lg p-2 -mx-2")}>
                        <span className="text-xs w-8 text-muted-foreground">{dayLabel}</span>
                        <div className="flex-1">
                          <Progress 
                            value={getProgress(day.sleepHours, healthGoals.sleepHours)} 
                            className="h-3"
                          />
                        </div>
                        <span className={cn(
                          "text-xs font-medium w-12 text-right",
                          day.sleepHours >= healthGoals.sleepHours ? "text-green-600" : 
                          day.sleepHours >= 6 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {day.sleepHours > 0 ? `${day.sleepHours.toFixed(1)}h` : '--'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Weekly Average */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Weekly Average</span>
                    <span className="text-lg font-semibold">
                      {(weeklySleepData.filter(d => d.sleepHours > 0).reduce((sum, d) => sum + d.sleepHours, 0) / 
                        Math.max(1, weeklySleepData.filter(d => d.sleepHours > 0).length)).toFixed(1)}h
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sleep Quality Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sleep Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Clock className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.sleepInBedMinutes 
                        ? `${Math.floor(selectedDateSummary.sleepInBedMinutes / 60)}h ${selectedDateSummary.sleepInBedMinutes % 60}m`
                        : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Time in Bed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Percent className="w-5 h-5 mx-auto text-green-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.sleepEfficiency 
                        ? `${selectedDateSummary.sleepEfficiency.toFixed(0)}%`
                        : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Efficiency</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <AlertCircle className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.sleepAwakeMinutes 
                        ? `${selectedDateSummary.sleepAwakeMinutes}m`
                        : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Awake Time</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <Gauge className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-semibold">
                      {selectedDateSummary.hrv || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">HRV (ms)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sleep Tips */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Sleep Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Keep a consistent sleep schedule, even on weekends
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Avoid screens 1 hour before bedtime
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Keep your room cool (65-68°F / 18-20°C)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    Limit caffeine after 2pm
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      )}

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
              {/* AI Health Insights */}
              <HealthInsightsCard 
                metrics={healthMetrics} 
                goals={healthGoals} 
              />
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

              {/* Quick Stats - Basic */}
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

              {/* Enhanced Metrics from Apple Watch */}
              {(selectedDateSummary.restingHeartRate || selectedDateSummary.hrv || 
                selectedDateSummary.bloodOxygen || selectedDateSummary.distance ||
                selectedDateSummary.flightsClimbed || selectedDateSummary.respiratoryRate) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Apple className="w-4 h-4" />
                      Apple Watch Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedDateSummary.restingHeartRate && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Heart className="w-4 h-4 mx-auto text-pink-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.restingHeartRate}</p>
                          <p className="text-xs text-muted-foreground">Resting HR</p>
                        </div>
                      )}
                      {selectedDateSummary.hrv && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Gauge className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.hrv}</p>
                          <p className="text-xs text-muted-foreground">HRV (ms)</p>
                        </div>
                      )}
                      {selectedDateSummary.bloodOxygen && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Wind className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.bloodOxygen}%</p>
                          <p className="text-xs text-muted-foreground">SpO2</p>
                        </div>
                      )}
                      {selectedDateSummary.respiratoryRate && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Wind className="w-4 h-4 mx-auto text-teal-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.respiratoryRate}</p>
                          <p className="text-xs text-muted-foreground">Breaths/min</p>
                        </div>
                      )}
                      {selectedDateSummary.distance && selectedDateSummary.distance > 0 && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <ArrowUpDown className="w-4 h-4 mx-auto text-green-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.distance.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">km</p>
                        </div>
                      )}
                      {selectedDateSummary.flightsClimbed && selectedDateSummary.flightsClimbed > 0 && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Mountain className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.flightsClimbed}</p>
                          <p className="text-xs text-muted-foreground">Floors</p>
                        </div>
                      )}
                      {selectedDateSummary.mindfulnessMinutes && selectedDateSummary.mindfulnessMinutes > 0 && (
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <Brain className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                          <p className="text-sm font-semibold">{selectedDateSummary.mindfulnessMinutes}</p>
                          <p className="text-xs text-muted-foreground">Mindful min</p>
                        </div>
                      )}
                    </div>

                    {/* Blood Pressure if available */}
                    {selectedDateSummary.bloodPressureSystolic && selectedDateSummary.bloodPressureDiastolic && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Blood Pressure</p>
                        <p className="text-xl font-semibold">
                          {selectedDateSummary.bloodPressureSystolic}/{selectedDateSummary.bloodPressureDiastolic}
                        </p>
                        <p className="text-xs text-muted-foreground">mmHg</p>
                      </div>
                    )}

                    {/* Body Composition */}
                    {(selectedDateSummary.bodyFat || selectedDateSummary.height) && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {selectedDateSummary.height && (
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <Ruler className="w-4 h-4 mx-auto text-gray-500 mb-1" />
                            <p className="text-sm font-semibold">{selectedDateSummary.height} cm</p>
                            <p className="text-xs text-muted-foreground">Height</p>
                          </div>
                        )}
                        {selectedDateSummary.bodyFat && (
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <Percent className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                            <p className="text-sm font-semibold">{selectedDateSummary.bodyFat}%</p>
                            <p className="text-xs text-muted-foreground">Body Fat</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                    {healthMetrics.slice(0, 10).map(metric => (
                      <div key={metric.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {metric.metric_type === 'steps' && <Footprints className="w-3 h-3 text-primary" />}
                          {metric.metric_type === 'calories' && <Flame className="w-3 h-3 text-orange-500" />}
                          {metric.metric_type === 'heart_rate' && <Heart className="w-3 h-3 text-red-500" />}
                          {metric.metric_type === 'resting_heart_rate' && <Heart className="w-3 h-3 text-pink-500" />}
                          {metric.metric_type === 'hrv' && <Gauge className="w-3 h-3 text-purple-500" />}
                          {metric.metric_type === 'sleep_hours' && <Moon className="w-3 h-3 text-purple-500" />}
                          {metric.metric_type === 'weight' && <Scale className="w-3 h-3 text-blue-500" />}
                          {metric.metric_type === 'water_intake' && <Droplets className="w-3 h-3 text-blue-400" />}
                          {metric.metric_type === 'blood_oxygen' && <Wind className="w-3 h-3 text-blue-500" />}
                          {metric.metric_type === 'respiratory_rate' && <Wind className="w-3 h-3 text-teal-500" />}
                          {metric.metric_type === 'distance' && <ArrowUpDown className="w-3 h-3 text-green-500" />}
                          {metric.metric_type === 'flights_climbed' && <Mountain className="w-3 h-3 text-amber-500" />}
                          {metric.metric_type === 'mindfulness_minutes' && <Brain className="w-3 h-3 text-indigo-500" />}
                          {metric.metric_type === 'body_fat' && <Percent className="w-3 h-3 text-orange-500" />}
                          {metric.metric_type === 'height' && <Ruler className="w-3 h-3 text-gray-500" />}
                          {metric.metric_type.includes('blood_pressure') && <Activity className="w-3 h-3 text-red-400" />}
                          <span className="capitalize">{metric.metric_type.replace(/_/g, ' ')}</span>
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
                      <p className="font-medium">{todaySummary?.restingHeartRate || '--'}</p>
                      <p className="text-xs text-muted-foreground">Resting</p>
                    </div>
                    <div>
                      <p className="font-medium">{todaySummary?.heartRateAvg || '--'}</p>
                      <p className="text-xs text-muted-foreground">Average</p>
                    </div>
                    <div>
                      <p className="font-medium">{todaySummary?.hrv || '--'}</p>
                      <p className="text-xs text-muted-foreground">HRV (ms)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Blood Oxygen & Respiratory */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wind className="w-4 h-4 text-blue-500" />
                    Oxygen & Breathing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center py-4">
                      <p className="text-3xl font-bold">{todaySummary?.bloodOxygen?.toFixed(1) || '--'}</p>
                      <p className="text-muted-foreground text-sm">SpO2 %</p>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-3xl font-bold">{todaySummary?.respiratoryRate?.toFixed(1) || '--'}</p>
                      <p className="text-muted-foreground text-sm">Breaths/min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-500" />
                    Body Composition
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="py-2">
                      <p className="text-2xl font-bold">{todaySummary?.weight?.toFixed(1) || '--'}</p>
                      <p className="text-xs text-muted-foreground">Weight (kg)</p>
                    </div>
                    <div className="py-2">
                      <p className="text-2xl font-bold">{todaySummary?.height || '--'}</p>
                      <p className="text-xs text-muted-foreground">Height (cm)</p>
                    </div>
                    <div className="py-2">
                      <p className="text-2xl font-bold">{todaySummary?.bodyFat?.toFixed(1) || '--'}</p>
                      <p className="text-xs text-muted-foreground">Body Fat %</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
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
                    {weeklyData.map((day) => {
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
