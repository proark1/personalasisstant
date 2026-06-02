import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HealthMetric {
  id: string;
  user_id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface DailyHealthSummary {
  date: string;
  steps: number;
  calories: number;
  activeMinutes: number;
  sleepHours: number;
  heartRateAvg: number;
  weight?: number;
  waterIntake: number;
  // Enhanced metrics from Apple Watch
  restingHeartRate?: number;
  hrv?: number;                    // Heart Rate Variability (ms)
  respiratoryRate?: number;        // Breaths per minute
  bloodOxygen?: number;            // SpO2 percentage
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  distance?: number;               // km
  flightsClimbed?: number;         // Floors
  bodyFat?: number;                // Percentage
  mindfulnessMinutes?: number;
  height?: number;                 // cm
  // Enhanced sleep data
  sleepStartTime?: string;         // ISO timestamp when sleep started
  sleepEndTime?: string;           // ISO timestamp when woke up
  sleepRemMinutes?: number;        // REM sleep duration
  sleepDeepMinutes?: number;       // Deep sleep duration
  sleepCoreMinutes?: number;       // Core/light sleep duration
  sleepAwakeMinutes?: number;      // Time awake during night
  sleepEfficiency?: number;        // Percentage (sleep time / bed time)
  sleepInBedMinutes?: number;      // Total time in bed
}

const isNative = Capacitor.isNativePlatform();
const isIOS = isNative && Capacitor.getPlatform() === 'ios';

const logHealthDebug = (label: string, extra?: Record<string, unknown>) => {
  try {
    const href = typeof window !== 'undefined' ? window.location.href : 'unknown';
    const isRemoteWebview = href.startsWith('http://') || href.startsWith('https://');

     
    console.log(`[AppleHealth][${label}]`, {
      platform: Capacitor.getPlatform(),
      isNative,
      href,
      isRemoteWebview,
      plugins: Object.keys((Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins ?? {}),
      ...extra,
    });

    if (isIOS && isNative && isRemoteWebview) {
      toast.error('This iPhone build is loading a remote site (hot-reload). For HealthKit, rebuild with bundled app assets.');
    }
  } catch {
    // ignore
  }
};

// Dynamic import for HealthKit plugin (only on iOS).
// The plugin shape is not fully typed in @flomentumsolutions/capacitor-health-extended,
// so we describe only the result shapes actually consumed here so property access stays
// type-checked. A single point-in-time reading (latest sample / single-value query).
interface HealthSample {
  value?: number;
  timestamp?: string;
  unit?: string;
}

// One day/bucket of an aggregated query result.
interface HealthAggregatedBucket {
  value?: number;
  startDate: string;
  endDate?: string;
}

interface HealthAggregatedResult {
  aggregatedData?: HealthAggregatedBucket[];
}

// Aggregated query options passed to the native plugin.
interface HealthAggregatedOptions {
  dataType: string;
  startDate: string;
  endDate: string;
  bucket: string;
}

// Accurate, narrow view of the native plugin methods we call. The dynamically
// imported plugin object is cast to this so call sites are type-checked even
// though the published package types don't match this usage exactly.
interface HealthKitPlugin {
  isHealthAvailable(): Promise<{ available?: boolean }>;
  requestHealthPermissions(opts: { permissions: string[] }): Promise<unknown>;
  querySteps(opts?: Record<string, unknown>): Promise<HealthSample>;
  queryHeartRate(opts?: Record<string, unknown>): Promise<HealthSample>;
  queryWeight(opts?: Record<string, unknown>): Promise<HealthSample>;
  queryHeight(opts?: Record<string, unknown>): Promise<HealthSample>;
  queryLatestSample(opts: { dataType: string }): Promise<HealthSample>;
  queryAggregated(opts: HealthAggregatedOptions): Promise<HealthAggregatedResult>;
  openAppleHealthSettings(): Promise<void>;
}
let Health: HealthKitPlugin | null = null;

const loadHealthKitPlugin = async () => {
  if (isIOS && !Health) {
    try {
      logHealthDebug('load_start');
      const module = await import('@flomentumsolutions/capacitor-health-extended');
      // The published HealthPlugin type doesn't match the native methods we call
      // (queryAggregated, queryLatestSample, etc.), so cast through unknown to our
      // accurate, narrow HealthKitPlugin view.
      Health = module.Health as unknown as HealthKitPlugin;
      logHealthDebug('load_ok', { moduleKeys: Object.keys(module as Record<string, unknown>), pluginName: 'HealthPlugin' });
      return true;
    } catch (err) {
      logHealthDebug('load_fail', { err: err instanceof Error ? err.message : String(err) });
      console.warn('HealthKit plugin not available:', err);
      return false;
    }
  }
  return !!Health;
};

export interface HealthDebugInfo {
  platform: string;
  isNative: boolean;
  pluginLoaded: boolean;
  isHealthAvailable: boolean | null;
  lastSyncResult: 'success' | 'no_data' | 'error' | null;
  lastError: string | null;
  metricsCollected: number;
  dataTypes: string[];
  // Diagnostics fields
  diagnosticsRan: boolean;
  diagnosticsTimestamp: string | null;
  permissionResult: string | null;
  sampleQueryResult: string | null;
}

export function useAppleHealth() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailyHealthSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyHealthSummary[]>([]);
  const [pluginLoaded, setPluginLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<HealthDebugInfo>({
    platform: Capacitor.getPlatform(),
    isNative,
    pluginLoaded: false,
    isHealthAvailable: null,
    lastSyncResult: null,
    lastError: null,
    metricsCollected: 0,
    dataTypes: [],
    diagnosticsRan: false,
    diagnosticsTimestamp: null,
    permissionResult: null,
    sampleQueryResult: null,
  });

  const isAvailable = isIOS;

  // Load plugin on mount
  useEffect(() => {
    if (isAvailable) {
      loadHealthKitPlugin().then((loaded) => {
        setPluginLoaded(loaded);
        setDebugInfo(prev => ({ ...prev, pluginLoaded: loaded }));
      });
    }
  }, [isAvailable]);

  // Check if already authorized on mount
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!isAvailable || !pluginLoaded || !user?.id) return;
      
      try {
        // Check if we have existing health data from Apple Health
        const { data } = await supabase
          .from('health_metrics')
          .select('id')
          .eq('user_id', user.id)
          .eq('source', 'apple_health')
          .limit(1);
        
        if (data && data.length > 0) {
          setIsConnected(true);
        }
      } catch (error) {
        console.log('Error checking authorization:', error);
      }
    };

    checkAuthorization();
  }, [isAvailable, pluginLoaded, user?.id]);

  // Fetch the latest date that has health data
  const fetchLatestHealthDate = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .select('recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        return data[0].recorded_at.split('T')[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching latest health date:', error);
      return null;
    }
  }, [user?.id]);

  const fetchHealthMetrics = useCallback(async (dateRangeStart?: string, dateRangeEnd?: string) => {
    if (!user?.id) return;
    
    try {
      // Default: 60-day window ending today
      const endDate = dateRangeEnd || new Date().toISOString().split('T')[0];
      const startDate = dateRangeStart || (() => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - 60);
        return d.toISOString().split('T')[0];
      })();

      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('recorded_at', `${startDate}T00:00:00`)
        .lte('recorded_at', `${endDate}T23:59:59`)
        .order('recorded_at', { ascending: false });
      
      if (error) throw error;
      setHealthMetrics(data || []);
      
      console.log('[HealthMetrics] Fetched:', data?.length || 0, 'records for range', startDate, 'to', endDate);
      console.log('[HealthMetrics] Types:', [...new Set(data?.map(d => d.metric_type) || [])]);
      
      // Helper to sum values for a metric type on a given day
      const sumMetricForDay = (metrics: typeof data, type: string) => {
        const values = metrics?.filter(m => m.metric_type === type).map(m => m.value) || [];
        return values.reduce((sum, v) => sum + v, 0);
      };
      
      // Helper to get latest value for a metric type on a given day
      const getLatestMetricForDay = (metrics: typeof data, type: string) => {
        const metric = metrics?.find(m => m.metric_type === type);
        return metric?.value;
      };
      
      // Calculate today's summary
      const today = new Date().toISOString().split('T')[0];
      const todayMetrics = (data || []).filter(m => 
        m.recorded_at.startsWith(today)
      );
      
      // Always set a summary (even if empty) to show zeros
      setTodaySummary({
        date: today,
        steps: sumMetricForDay(todayMetrics, 'steps'),
        calories: sumMetricForDay(todayMetrics, 'calories'),
        activeMinutes: sumMetricForDay(todayMetrics, 'active_minutes'),
        sleepHours: getLatestMetricForDay(todayMetrics, 'sleep_hours') || 0,
        heartRateAvg: getLatestMetricForDay(todayMetrics, 'heart_rate') || 0,
        weight: getLatestMetricForDay(todayMetrics, 'weight'),
        waterIntake: sumMetricForDay(todayMetrics, 'water_intake'),
        restingHeartRate: getLatestMetricForDay(todayMetrics, 'resting_heart_rate'),
        hrv: getLatestMetricForDay(todayMetrics, 'hrv'),
        respiratoryRate: getLatestMetricForDay(todayMetrics, 'respiratory_rate'),
        bloodOxygen: getLatestMetricForDay(todayMetrics, 'blood_oxygen'),
        bloodPressureSystolic: getLatestMetricForDay(todayMetrics, 'blood_pressure_systolic'),
        bloodPressureDiastolic: getLatestMetricForDay(todayMetrics, 'blood_pressure_diastolic'),
        distance: sumMetricForDay(todayMetrics, 'distance'),
        flightsClimbed: sumMetricForDay(todayMetrics, 'flights_climbed'),
        bodyFat: getLatestMetricForDay(todayMetrics, 'body_fat'),
        mindfulnessMinutes: sumMetricForDay(todayMetrics, 'mindfulness_minutes'),
        height: getLatestMetricForDay(todayMetrics, 'height'),
        sleepRemMinutes: getLatestMetricForDay(todayMetrics, 'sleep_rem_minutes'),
        sleepDeepMinutes: getLatestMetricForDay(todayMetrics, 'sleep_deep_minutes'),
        sleepCoreMinutes: getLatestMetricForDay(todayMetrics, 'sleep_core_minutes'),
        sleepAwakeMinutes: getLatestMetricForDay(todayMetrics, 'sleep_awake_minutes'),
        sleepInBedMinutes: getLatestMetricForDay(todayMetrics, 'sleep_in_bed_minutes'),
        sleepEfficiency: getLatestMetricForDay(todayMetrics, 'sleep_efficiency'),
      });
      
      // Calculate weekly data centered around endDate
      const weekly: DailyHealthSummary[] = [];
      const endDateObj = new Date(endDate);
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(endDateObj);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayMetrics = (data || []).filter(m => m.recorded_at.startsWith(dateStr));
        
        weekly.push({
          date: dateStr,
          steps: sumMetricForDay(dayMetrics, 'steps'),
          calories: sumMetricForDay(dayMetrics, 'calories'),
          activeMinutes: sumMetricForDay(dayMetrics, 'active_minutes'),
          sleepHours: getLatestMetricForDay(dayMetrics, 'sleep_hours') || 0,
          heartRateAvg: getLatestMetricForDay(dayMetrics, 'heart_rate') || 0,
          weight: getLatestMetricForDay(dayMetrics, 'weight'),
          waterIntake: sumMetricForDay(dayMetrics, 'water_intake'),
          restingHeartRate: getLatestMetricForDay(dayMetrics, 'resting_heart_rate'),
          hrv: getLatestMetricForDay(dayMetrics, 'hrv'),
          respiratoryRate: getLatestMetricForDay(dayMetrics, 'respiratory_rate'),
          bloodOxygen: getLatestMetricForDay(dayMetrics, 'blood_oxygen'),
          bloodPressureSystolic: getLatestMetricForDay(dayMetrics, 'blood_pressure_systolic'),
          bloodPressureDiastolic: getLatestMetricForDay(dayMetrics, 'blood_pressure_diastolic'),
          distance: sumMetricForDay(dayMetrics, 'distance'),
          flightsClimbed: sumMetricForDay(dayMetrics, 'flights_climbed'),
          bodyFat: getLatestMetricForDay(dayMetrics, 'body_fat'),
          mindfulnessMinutes: sumMetricForDay(dayMetrics, 'mindfulness_minutes'),
          height: getLatestMetricForDay(dayMetrics, 'height'),
          sleepRemMinutes: getLatestMetricForDay(dayMetrics, 'sleep_rem_minutes'),
          sleepDeepMinutes: getLatestMetricForDay(dayMetrics, 'sleep_deep_minutes'),
          sleepCoreMinutes: getLatestMetricForDay(dayMetrics, 'sleep_core_minutes'),
          sleepAwakeMinutes: getLatestMetricForDay(dayMetrics, 'sleep_awake_minutes'),
          sleepInBedMinutes: getLatestMetricForDay(dayMetrics, 'sleep_in_bed_minutes'),
          sleepEfficiency: getLatestMetricForDay(dayMetrics, 'sleep_efficiency'),
        });
      }
      
      setWeeklyData(weekly);
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    }
  }, [user?.id]);

  // Check if HealthKit capability is properly configured
  const checkHealthKitSetup = useCallback(async (): Promise<{ available: boolean; reason?: string }> => {
    if (!isIOS) {
      return { available: false, reason: 'Not iOS device' };
    }
    
    const loaded = await loadHealthKitPlugin();
    if (!loaded || !Health) {
      return { available: false, reason: 'HealthKit plugin not loaded. Rebuild app with native code.' };
    }
    
    try {
      const result = await Health.isHealthAvailable();
      logHealthDebug('isHealthAvailable_result', { result });
      
      if (!result?.available) {
        return { 
          available: false, 
          reason: 'HealthKit not available. Make sure HealthKit capability is enabled in Xcode (Target → Signing & Capabilities → + Capability → HealthKit).' 
        };
      }
      
      setDebugInfo(prev => ({ ...prev, isHealthAvailable: true }));
      return { available: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logHealthDebug('isHealthAvailable_error', { error: errorMsg });
      
      // Detect specific error patterns that indicate missing native config
      if (errorMsg.includes('not implemented') || errorMsg.includes('not found') || errorMsg.includes('undefined')) {
        return { 
          available: false, 
          reason: 'HealthKit not configured in Xcode. Open your iOS project in Xcode, add HealthKit capability, and rebuild.' 
        };
      }
      
      return { available: false, reason: errorMsg };
    }
  }, []);

  // Run comprehensive HealthKit diagnostics
  const runHealthKitDiagnostics = useCallback(async (): Promise<HealthDebugInfo> => {
    logHealthDebug('diagnostics_start');
    
    const timestamp = new Date().toISOString();
    const newDebugInfo: HealthDebugInfo = {
      ...debugInfo,
      diagnosticsRan: true,
      diagnosticsTimestamp: timestamp,
      lastError: null,
    };

    // Step 1: Check platform
    if (!isIOS) {
      newDebugInfo.lastError = 'Not running on iOS';
      setDebugInfo(newDebugInfo);
      return newDebugInfo;
    }

    // Step 2: Check plugin loaded
    const loaded = await loadHealthKitPlugin();
    newDebugInfo.pluginLoaded = loaded;
    
    if (!loaded || !Health) {
      newDebugInfo.lastError = 'HealthKit plugin failed to load. Native module not bundled in this build.';
      setDebugInfo(newDebugInfo);
      return newDebugInfo;
    }

    // Step 3: Check if HealthKit is available (entitlement test)
    try {
      const availResult = await Health.isHealthAvailable();
      logHealthDebug('diagnostics_isHealthAvailable', { availResult });
      newDebugInfo.isHealthAvailable = availResult?.available ?? false;
      
      if (!availResult?.available) {
        newDebugInfo.lastError = 'HealthKit not available. Check Xcode: Target → Signing & Capabilities → HealthKit enabled.';
        setDebugInfo(newDebugInfo);
        return newDebugInfo;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logHealthDebug('diagnostics_isHealthAvailable_error', { error: errMsg });
      newDebugInfo.isHealthAvailable = false;
      newDebugInfo.lastError = `isHealthAvailable threw: ${errMsg}`;
      setDebugInfo(newDebugInfo);
      return newDebugInfo;
    }

    // Step 4: Request permissions (minimal set)
    try {
      logHealthDebug('diagnostics_requestPermissions_start');
      const permResult = await Health.requestHealthPermissions({
        permissions: [
          'READ_STEPS',
          'READ_HEART_RATE', 
          'READ_ACTIVE_CALORIES',
          'READ_BASAL_CALORIES',
          'READ_WEIGHT',
          'READ_SLEEP',
          'READ_RESTING_HEART_RATE',
          'READ_HRV',
          'READ_RESPIRATORY_RATE',
          'READ_OXYGEN_SATURATION',
          'READ_BLOOD_PRESSURE',
          'READ_BLOOD_GLUCOSE',
          'READ_BODY_TEMPERATURE',
          'READ_HEIGHT',
          'READ_BODY_FAT',
          'READ_DISTANCE',
          'READ_FLOORS_CLIMBED',
          'READ_TOTAL_CALORIES',
          'READ_MINDFULNESS',
          'READ_WORKOUTS',
          'READ_EXERCISE_TIME',
        ],
      });
      logHealthDebug('diagnostics_requestPermissions_result', { permResult });
      newDebugInfo.permissionResult = JSON.stringify(permResult);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logHealthDebug('diagnostics_requestPermissions_error', { error: errMsg });
      newDebugInfo.permissionResult = `Error: ${errMsg}`;
    }

    // Step 5: Try a sample query
    try {
      logHealthDebug('diagnostics_querySteps_start');
      const stepsResult = await Health.querySteps();
      logHealthDebug('diagnostics_querySteps_result', { stepsResult });
      newDebugInfo.sampleQueryResult = JSON.stringify(stepsResult);
      
      if (stepsResult?.value && stepsResult.value > 0) {
        newDebugInfo.lastSyncResult = 'success';
      } else {
        newDebugInfo.lastSyncResult = 'no_data';
        newDebugInfo.lastError = 'Query returned no data. Check Health app → Sharing → Apps → DarAI has categories enabled.';
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logHealthDebug('diagnostics_querySteps_error', { error: errMsg });
      newDebugInfo.sampleQueryResult = `Error: ${errMsg}`;
      newDebugInfo.lastSyncResult = 'error';
      newDebugInfo.lastError = `Query failed: ${errMsg}`;
    }

    setDebugInfo(newDebugInfo);
    return newDebugInfo;
  }, [debugInfo]);

  const requestAppleHealthPermission = useCallback(async () => {
    logHealthDebug('request_permission_click');

    if (!isAvailable) {
      toast.error('Apple Health is only available on iPhone');
      return false;
    }

    const loaded = await loadHealthKitPlugin();
    if (!loaded || !Health) {
      toast.error('HealthKit plugin not available. Rebuild app with native code.');
      setDebugInfo(prev => ({ 
        ...prev, 
        lastError: 'HealthKit plugin not loaded',
        lastSyncResult: 'error' 
      }));
      return false;
    }
    
    setIsLoading(true);
    try {
      logHealthDebug('before_isHealthAvailable');

      // Check if HealthKit is available on this device
      const setupCheck = await checkHealthKitSetup();
      if (!setupCheck.available) {
        toast.error(setupCheck.reason || 'HealthKit is not available');
        setDebugInfo(prev => ({ 
          ...prev, 
          isHealthAvailable: false,
          lastError: setupCheck.reason || 'HealthKit not available',
          lastSyncResult: 'error' 
        }));
        return false;
      }

      logHealthDebug('before_requestHealthPermissions');
      
      // Request authorization for all available health data types
      const permResult = await Health.requestHealthPermissions({
        permissions: [
          // Basic metrics (existing)
          'READ_STEPS',
          'READ_HEART_RATE', 
          'READ_ACTIVE_CALORIES',
          'READ_BASAL_CALORIES',
          'READ_WEIGHT',
          'READ_SLEEP',
          // Enhanced vitals
          'READ_RESTING_HEART_RATE',
          'READ_HRV',
          'READ_RESPIRATORY_RATE',
          'READ_OXYGEN_SATURATION',
          'READ_BLOOD_PRESSURE',
          'READ_BLOOD_GLUCOSE',
          'READ_BODY_TEMPERATURE',
          // Body composition
          'READ_HEIGHT',
          'READ_BODY_FAT',
          // Activity
          'READ_DISTANCE',
          'READ_FLOORS_CLIMBED',
          'READ_TOTAL_CALORIES',
          // Mindfulness
          'READ_MINDFULNESS',
          // Workouts
          'READ_WORKOUTS',
          // Exercise time
          'READ_EXERCISE_TIME',
        ]
      });
      
      logHealthDebug('requestHealthPermissions_result', { permResult });

      setIsConnected(true);
      toast.success('Connected to Apple Health! Syncing data...');
      
      // Immediately sync data after connecting
      await syncAppleHealthInternal();
      
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error connecting to Apple Health:', error);
      logHealthDebug('requestPermission_error', { error: errorMsg });
      
      // Detect if this is a "no prompt shown" scenario (HealthKit entitlement missing)
      if (errorMsg.includes('denied') || errorMsg.includes('not authorized')) {
        toast.error('Health access denied. Check permissions in: Health app → Sharing → Apps → DarAI');
      } else if (errorMsg.includes('not implemented') || errorMsg.includes('undefined')) {
        toast.error('HealthKit not configured. Rebuild in Xcode with HealthKit capability enabled.');
      } else {
        toast.error(errorMsg || 'Failed to connect to Apple Health');
      }
      
      setDebugInfo(prev => ({ 
        ...prev, 
        lastError: errorMsg,
        lastSyncResult: 'error' 
      }));
      return false;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable, checkHealthKitSetup]); // intentionally excludes syncAppleHealthInternal — plain function, listing it would loop

  const syncAppleHealthInternal = async (daysBack: number = 365) => {
    if (!Health || !user?.id) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const syncStartDate = new Date(startOfDay);
    syncStartDate.setDate(syncStartDate.getDate() - daysBack);
    
    logHealthDebug('sync_internal_start', { daysBack, startDate: syncStartDate.toISOString(), endDate: now.toISOString() });

    const metricsToInsert: Array<{
      user_id: string;
      metric_type: string;
      value: number;
      unit: string;
      recorded_at: string;
      source: string;
    }> = [];

    // First, try queryLatestSample for key metrics (more reliable on iOS)
    // This ensures we get at least today's latest readings
    const today = now.toISOString().split('T')[0];
    
    // Get latest steps
    try {
      const latestSteps = await Health.querySteps();
      logHealthDebug('latest_steps', { raw: latestSteps });
      if (latestSteps?.value && latestSteps.value > 0) {
        const date = latestSteps.timestamp 
          ? new Date(latestSteps.timestamp).toISOString().split('T')[0]
          : today;
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'steps',
          value: Math.round(latestSteps.value),
          unit: 'steps',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      logHealthDebug('latest_steps_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Get latest heart rate
    try {
      const latestHR = await Health.queryHeartRate();
      logHealthDebug('latest_hr', { raw: latestHR });
      if (latestHR?.value && latestHR.value > 0) {
        const date = latestHR.timestamp 
          ? new Date(latestHR.timestamp).toISOString().split('T')[0]
          : today;
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'heart_rate',
          value: Math.round(latestHR.value),
          unit: 'bpm',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      logHealthDebug('latest_hr_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Get latest weight
    try {
      const latestWeight = await Health.queryWeight();
      logHealthDebug('latest_weight', { raw: latestWeight });
      if (latestWeight?.value && latestWeight.value > 0) {
        const date = latestWeight.timestamp 
          ? new Date(latestWeight.timestamp).toISOString().split('T')[0]
          : today;
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'weight',
          value: Math.round(latestWeight.value * 10) / 10,
          unit: latestWeight.unit || 'kg',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      logHealthDebug('latest_weight_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Get latest height
    try {
      const latestHeight = await Health.queryHeight();
      logHealthDebug('latest_height', { raw: latestHeight });
      if (latestHeight?.value && latestHeight.value > 0) {
        const date = latestHeight.timestamp 
          ? new Date(latestHeight.timestamp).toISOString().split('T')[0]
          : today;
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'height',
          value: Math.round(latestHeight.value * 100) / 100,
          unit: latestHeight.unit || 'cm',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      logHealthDebug('latest_height_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Get latest samples for other data types
    const latestSampleTypes: Array<{ type: string; metricType: string; unit: string }> = [
      { type: 'active-calories', metricType: 'calories', unit: 'kcal' },
      { type: 'resting-heart-rate', metricType: 'resting_heart_rate', unit: 'bpm' },
      { type: 'hrv', metricType: 'hrv', unit: 'ms' },
      { type: 'respiratory-rate', metricType: 'respiratory_rate', unit: 'brpm' },
      { type: 'oxygen-saturation', metricType: 'blood_oxygen', unit: '%' },
      { type: 'body-fat', metricType: 'body_fat', unit: '%' },
      { type: 'flights-climbed', metricType: 'flights_climbed', unit: 'floors' },
      { type: 'distance', metricType: 'distance', unit: 'km' },
      { type: 'exercise-time', metricType: 'active_minutes', unit: 'min' },
      { type: 'mindfulness', metricType: 'mindfulness_minutes', unit: 'min' },
      { type: 'sleep', metricType: 'sleep_hours', unit: 'hours' },
    ];

    for (const { type, metricType, unit } of latestSampleTypes) {
      try {
        const sample = await Health.queryLatestSample({ dataType: type });
        logHealthDebug(`latest_${type}`, { raw: sample });
        if (sample?.value && sample.value > 0) {
          let value = sample.value;
          // Convert units as needed
          if (type === 'oxygen-saturation' && value <= 1) value = value * 100;
          if (type === 'body-fat' && value <= 1) value = value * 100;
          if (type === 'distance' && value > 1000) value = value / 1000; // m to km
          if (type === 'sleep') value = value / 60; // minutes to hours
          
          const date = sample.timestamp 
            ? new Date(sample.timestamp).toISOString().split('T')[0]
            : today;
          metricsToInsert.push({
            user_id: user.id,
            metric_type: metricType,
            value: Math.round(value * 100) / 100,
            unit,
            recorded_at: `${date}T12:00:00.000Z`,
            source: 'apple_health',
          });
        }
      } catch (e) {
        logHealthDebug(`latest_${type}_error`, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Now also try aggregated queries for historical data
    // Fetch steps (aggregated by day)
    try {
      const stepsData = await Health.queryAggregated({
        dataType: 'steps',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('steps_response', { count: stepsData?.aggregatedData?.length || 0, raw: stepsData });

      if (stepsData?.aggregatedData) {
        for (const bucket of stepsData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'steps',
              value: Math.round(bucket.value),
              unit: 'steps',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('steps_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch heart rate (aggregated by day for average)
    try {
      const heartRateData = await Health.queryAggregated({
        dataType: 'heart-rate',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('heart_rate_response', { count: heartRateData?.aggregatedData?.length || 0, raw: heartRateData });

      if (heartRateData?.aggregatedData) {
        for (const bucket of heartRateData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'heart_rate',
              value: Math.round(bucket.value),
              unit: 'bpm',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('heart_rate_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch active minutes (exercise time aggregated by day)
    try {
      const activeData = await Health.queryAggregated({
        dataType: 'exercise-time',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('active_minutes_response', { count: activeData?.aggregatedData?.length || 0 });

      if (activeData?.aggregatedData) {
        for (const bucket of activeData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Value is in minutes
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'active_minutes',
              value: Math.round(bucket.value),
              unit: 'min',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('active_minutes_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch active energy burned (calories) - aggregated by day
    try {
      const caloriesData = await Health.queryAggregated({
        dataType: 'active-calories',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('calories_response', { count: caloriesData?.aggregatedData?.length || 0 });

      if (caloriesData?.aggregatedData) {
        for (const bucket of caloriesData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'calories',
              value: Math.round(bucket.value),
              unit: 'kcal',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('calories_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch sleep analysis (aggregated by day)
    try {
      const sleepData = await Health.queryAggregated({
        dataType: 'sleep',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_response', { count: sleepData?.aggregatedData?.length || 0, raw: sleepData });

      if (sleepData?.aggregatedData) {
        for (const bucket of sleepData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Sleep value from HealthKit is typically in MINUTES
            // The capacitor-health-extended plugin returns sleep data in minutes
            // Edge cases:
            // - If value is very large (> 1440 = 24 hours in minutes), it might be in seconds
            // - If value is small (< 1), it might already be in hours as a decimal
            // - Normal sleep range: 180-720 minutes (3-12 hours)
            let hours: number;
            
            if (bucket.value > 1440) {
              // Value is definitely in seconds (more than 24 hours worth of minutes)
              hours = bucket.value / 3600;
              logHealthDebug('sleep_conversion', { raw: bucket.value, assumed: 'seconds', hours });
            } else if (bucket.value < 1) {
              // Value is a small decimal, might already be in hours
              hours = bucket.value;
              logHealthDebug('sleep_conversion', { raw: bucket.value, assumed: 'hours_decimal', hours });
            } else {
              // Standard case: value is in minutes (most common for HealthKit sleep data)
              hours = bucket.value / 60;
              logHealthDebug('sleep_conversion', { raw: bucket.value, assumed: 'minutes', hours });
            }
            
            // Sanity check: cap at 16 hours max (nobody sleeps more than this in one day)
            // and minimum 0.5 hours (30 min) to filter out micro-naps
            if (hours > 16) {
              logHealthDebug('sleep_capped', { original: hours, capped: 16 });
              hours = 16;
            }
            if (hours < 0.5) {
              logHealthDebug('sleep_skipped_too_short', { hours });
              continue; // Skip very short sleep entries
            }
            
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_hours',
              value: Math.round(hours * 10) / 10,
              unit: 'hours',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch sleep stages: REM, Deep, Core (iOS 16+)
    // REM Sleep
    try {
      const remData = await Health.queryAggregated({
        dataType: 'sleep-rem',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_rem_response', { count: remData?.aggregatedData?.length || 0 });

      if (remData?.aggregatedData) {
        for (const bucket of remData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Value could be in minutes or seconds
            const minutes = bucket.value > 500 ? bucket.value / 60 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_rem_minutes',
              value: Math.round(minutes),
              unit: 'min',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_rem_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Deep Sleep
    try {
      const deepData = await Health.queryAggregated({
        dataType: 'sleep-deep',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_deep_response', { count: deepData?.aggregatedData?.length || 0 });

      if (deepData?.aggregatedData) {
        for (const bucket of deepData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            const minutes = bucket.value > 500 ? bucket.value / 60 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_deep_minutes',
              value: Math.round(minutes),
              unit: 'min',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_deep_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Core Sleep (Light Sleep)
    try {
      const coreData = await Health.queryAggregated({
        dataType: 'sleep-core',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_core_response', { count: coreData?.aggregatedData?.length || 0 });

      if (coreData?.aggregatedData) {
        for (const bucket of coreData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            const minutes = bucket.value > 500 ? bucket.value / 60 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_core_minutes',
              value: Math.round(minutes),
              unit: 'min',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_core_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Awake time during sleep
    try {
      const awakeData = await Health.queryAggregated({
        dataType: 'sleep-awake',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_awake_response', { count: awakeData?.aggregatedData?.length || 0 });

      if (awakeData?.aggregatedData) {
        for (const bucket of awakeData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            const minutes = bucket.value > 500 ? bucket.value / 60 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_awake_minutes',
              value: Math.round(minutes),
              unit: 'min',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_awake_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Time in bed
    try {
      const inBedData = await Health.queryAggregated({
        dataType: 'sleep-in-bed',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      logHealthDebug('sleep_in_bed_response', { count: inBedData?.aggregatedData?.length || 0 });

      if (inBedData?.aggregatedData) {
        for (const bucket of inBedData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            const minutes = bucket.value > 500 ? bucket.value / 60 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'sleep_in_bed_minutes',
              value: Math.round(minutes),
              unit: 'min',
              recorded_at: `${date}T00:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('sleep_in_bed_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch weight (latest sample)
    try {
      const weightData = await Health.queryWeight();

      if (weightData?.value && weightData.value > 0) {
        const date = weightData.timestamp 
          ? new Date(weightData.timestamp).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'weight',
          value: Math.round(weightData.value * 10) / 10,
          unit: weightData.unit || 'kg',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      console.log('Weight data not available:', e);
    }

    // ============ ENHANCED HEALTH DATA TYPES ============

    // Fetch resting heart rate (aggregated by day)
    try {
      const restingHRData = await Health.queryAggregated({
        dataType: 'resting-heart-rate',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (restingHRData?.aggregatedData) {
        for (const bucket of restingHRData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'resting_heart_rate',
              value: Math.round(bucket.value),
              unit: 'bpm',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('resting_hr_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch HRV (Heart Rate Variability)
    try {
      const hrvData = await Health.queryAggregated({
        dataType: 'hrv',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (hrvData?.aggregatedData) {
        for (const bucket of hrvData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'hrv',
              value: Math.round(bucket.value),
              unit: 'ms',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('hrv_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Blood Oxygen (SpO2)
    try {
      const oxygenData = await Health.queryAggregated({
        dataType: 'oxygen-saturation',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (oxygenData?.aggregatedData) {
        for (const bucket of oxygenData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Value is typically 0-1 (percentage as decimal), convert to percentage
            const percentage = bucket.value > 1 ? bucket.value : bucket.value * 100;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'blood_oxygen',
              value: Math.round(percentage * 10) / 10,
              unit: '%',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('blood_oxygen_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Respiratory Rate
    try {
      const respiratoryData = await Health.queryAggregated({
        dataType: 'respiratory-rate',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (respiratoryData?.aggregatedData) {
        for (const bucket of respiratoryData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'respiratory_rate',
              value: Math.round(bucket.value * 10) / 10,
              unit: 'br/min',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('respiratory_rate_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Distance (walking/running)
    try {
      const distanceData = await Health.queryAggregated({
        dataType: 'distance',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (distanceData?.aggregatedData) {
        for (const bucket of distanceData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Value is typically in meters, convert to km
            const km = bucket.value > 1000 ? bucket.value / 1000 : bucket.value;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'distance',
              value: Math.round(km * 100) / 100,
              unit: 'km',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('distance_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Flights Climbed (floors/stairs)
    try {
      const flightsData = await Health.queryAggregated({
        dataType: 'floors-climbed',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (flightsData?.aggregatedData) {
        for (const bucket of flightsData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'flights_climbed',
              value: Math.round(bucket.value),
              unit: 'floors',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('flights_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Body Fat Percentage
    try {
      const bodyFatData = await Health.queryAggregated({
        dataType: 'body-fat',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (bodyFatData?.aggregatedData) {
        for (const bucket of bodyFatData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            // Value is typically 0-1 (percentage as decimal)
            const percentage = bucket.value > 1 ? bucket.value : bucket.value * 100;
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'body_fat',
              value: Math.round(percentage * 10) / 10,
              unit: '%',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('body_fat_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Height
    try {
      const heightData = await Health.queryHeight();
      if (heightData?.value && heightData.value > 0) {
        const date = heightData.timestamp 
          ? new Date(heightData.timestamp).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        metricsToInsert.push({
          user_id: user.id,
          metric_type: 'height',
          value: Math.round(heightData.value * 100) / 100,
          unit: heightData.unit || 'cm',
          recorded_at: `${date}T12:00:00.000Z`,
          source: 'apple_health',
        });
      }
    } catch (e) {
      console.log('Height data not available:', e);
    }

    // Fetch Mindfulness Minutes
    try {
      const mindfulnessData = await Health.queryAggregated({
        dataType: 'mindfulness',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (mindfulnessData?.aggregatedData) {
        for (const bucket of mindfulnessData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'mindfulness_minutes',
              value: Math.round(bucket.value),
              unit: 'min',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('mindfulness_error', { error: e instanceof Error ? e.message : String(e) });
    }

    // Fetch Blood Pressure (if available)
    try {
      const bpData = await Health.queryAggregated({
        dataType: 'blood-pressure-systolic',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (bpData?.aggregatedData) {
        for (const bucket of bpData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'blood_pressure_systolic',
              value: Math.round(bucket.value),
              unit: 'mmHg',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('bp_systolic_error', { error: e instanceof Error ? e.message : String(e) });
    }

    try {
      const bpDiastolicData = await Health.queryAggregated({
        dataType: 'blood-pressure-diastolic',
        startDate: syncStartDate.toISOString(),
        endDate: now.toISOString(),
        bucket: 'day'
      });

      if (bpDiastolicData?.aggregatedData) {
        for (const bucket of bpDiastolicData.aggregatedData) {
          if (bucket.value && bucket.value > 0) {
            const date = new Date(bucket.startDate).toISOString().split('T')[0];
            metricsToInsert.push({
              user_id: user.id,
              metric_type: 'blood_pressure_diastolic',
              value: Math.round(bucket.value),
              unit: 'mmHg',
              recorded_at: `${date}T12:00:00.000Z`,
              source: 'apple_health',
            });
          }
        }
      }
    } catch (e) {
      logHealthDebug('bp_diastolic_error', { error: e instanceof Error ? e.message : String(e) });
    }

    logHealthDebug('metrics_to_insert', { 
      count: metricsToInsert.length, 
      types: [...new Set(metricsToInsert.map(m => m.metric_type))],
      samples: metricsToInsert.slice(0, 5)
    });

    // Delete existing Apple Health data for the sync period to avoid duplicates
    if (metricsToInsert.length > 0) {
      await supabase
        .from('health_metrics')
        .delete()
        .eq('user_id', user.id)
        .eq('source', 'apple_health')
        .gte('recorded_at', syncStartDate.toISOString());

      // Insert new data
      const { error } = await supabase
        .from('health_metrics')
        .insert(metricsToInsert);

      if (error) throw error;

      toast.success(`Synced ${metricsToInsert.length} health records from last ${daysBack} days`);
      setDebugInfo(prev => ({ 
        ...prev, 
        lastSyncResult: 'success',
        lastError: null,
        metricsCollected: metricsToInsert.length,
        dataTypes: [...new Set(metricsToInsert.map(m => m.metric_type))],
      }));
    } else {
      // No data found - provide more helpful guidance
      logHealthDebug('no_data_found', { 
        message: 'No metrics collected from any data type',
        hint: 'User may need to grant permissions in Apple Health app'
      });
      
      setDebugInfo(prev => ({ 
        ...prev, 
        lastSyncResult: 'no_data',
        lastError: 'No readable health data. Check permissions in Apple Health app.',
        metricsCollected: 0,
        dataTypes: [],
      }));
      
      toast.error(
        'No health data found. Enable permissions in: Health app → Sharing → Apps → DarAI → Turn on all categories.',
        { duration: 10000 }
      );
    }

    await fetchHealthMetrics();
  };

  const syncAppleHealth = useCallback(async () => {
    logHealthDebug('sync_click');

    if (!isAvailable) {
      toast.error('Apple Health sync is only available on iPhone');
      return;
    }

    const loaded = await loadHealthKitPlugin();
    if (!loaded || !Health || !user?.id) {
      toast.error('HealthKit not available');
      return;
    }
    
    setIsLoading(true);
    try {
      await syncAppleHealthInternal();
    } catch (error) {
      console.error('Error syncing Apple Health:', error);
      toast.error((error instanceof Error ? error.message : null) || 'Failed to sync health data');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable, user?.id, fetchHealthMetrics]); // intentionally excludes syncAppleHealthInternal — plain function, listing it would loop

  const addManualMetric = useCallback(async (
    metricType: string,
    value: number,
    unit: string,
    recordedAt?: Date
  ) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .insert({
          user_id: user.id,
          metric_type: metricType,
          value,
          unit,
          recorded_at: (recordedAt || new Date()).toISOString(),
          source: 'manual',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setHealthMetrics(prev => [data, ...prev]);
      toast.success('Health metric added');
      await fetchHealthMetrics();
      return data;
    } catch (error) {
      console.error('Error adding health metric:', error);
      toast.error('Failed to add health metric');
      return null;
    }
  }, [user?.id, fetchHealthMetrics]);

  const deleteMetric = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('health_metrics')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setHealthMetrics(prev => prev.filter(m => m.id !== id));
      toast.success('Health metric deleted');
    } catch (error) {
      console.error('Error deleting health metric:', error);
      toast.error('Failed to delete health metric');
    }
  }, []);

  // Initial fetch removed - HealthHubPanel now controls date-range fetching

  // Function to open iOS Settings (app settings page, not Health permissions)
  const openAppSettings = useCallback(async () => {
    if (!Health) {
      toast.error('Plugin not loaded');
      return;
    }
    try {
      await Health.openAppleHealthSettings();
    } catch (e) {
      logHealthDebug('open_settings_error', { error: e instanceof Error ? e.message : String(e) });
      toast.error('Could not open settings. Go to Settings → Apps → Health → Access and Devices → DarAI manually.');
    }
  }, []);

  return {
    isAvailable,
    isConnected,
    isLoading,
    healthMetrics,
    todaySummary,
    weeklyData,
    debugInfo,
    requestAppleHealthPermission,
    syncAppleHealth,
    addManualMetric,
    deleteMetric,
    openAppSettings,
    runHealthKitDiagnostics,
    fetchLatestHealthDate,
    refetch: fetchHealthMetrics,
  };
}
