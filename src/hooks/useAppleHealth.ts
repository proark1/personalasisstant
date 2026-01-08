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

    // eslint-disable-next-line no-console
    console.log(`[AppleHealth][${label}]`, {
      platform: Capacitor.getPlatform(),
      isNative,
      href,
      isRemoteWebview,
      plugins: Object.keys((Capacitor as any).Plugins ?? {}),
      ...extra,
    });

    if (isIOS && isNative && isRemoteWebview) {
      toast.error('This iPhone build is loading a remote site (hot-reload). For HealthKit, rebuild with bundled app assets.');
    }
  } catch {
    // ignore
  }
};

// Dynamic import for HealthKit plugin (only on iOS)
let Health: any = null;

const loadHealthKitPlugin = async () => {
  if (isIOS && !Health) {
    try {
      logHealthDebug('load_start');
      const module = await import('@flomentumsolutions/capacitor-health-extended');
      Health = module.Health;
      logHealthDebug('load_ok', { moduleKeys: Object.keys(module as any), pluginName: 'HealthPlugin' });
      return true;
    } catch (err) {
      logHealthDebug('load_fail', { err: (err as any)?.message ?? String(err) });
      console.warn('HealthKit plugin not available:', err);
      return false;
    }
  }
  return !!Health;
};

export function useAppleHealth() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailyHealthSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyHealthSummary[]>([]);
  const [pluginLoaded, setPluginLoaded] = useState(false);

  const isAvailable = isIOS;

  // Load plugin on mount
  useEffect(() => {
    if (isAvailable) {
      loadHealthKitPlugin().then(setPluginLoaded);
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

  const fetchHealthMetrics = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      setHealthMetrics(data || []);
      
      console.log('[HealthMetrics] Fetched:', data?.length || 0, 'records');
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
      
      console.log('[HealthMetrics] Today metrics:', todayMetrics.length);
      
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
        // Enhanced metrics
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
        // Enhanced sleep data
        sleepRemMinutes: getLatestMetricForDay(todayMetrics, 'sleep_rem_minutes'),
        sleepDeepMinutes: getLatestMetricForDay(todayMetrics, 'sleep_deep_minutes'),
        sleepCoreMinutes: getLatestMetricForDay(todayMetrics, 'sleep_core_minutes'),
        sleepAwakeMinutes: getLatestMetricForDay(todayMetrics, 'sleep_awake_minutes'),
        sleepInBedMinutes: getLatestMetricForDay(todayMetrics, 'sleep_in_bed_minutes'),
        sleepEfficiency: getLatestMetricForDay(todayMetrics, 'sleep_efficiency'),
      });
      
      // Calculate weekly data
      const weekly: DailyHealthSummary[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
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
          // Enhanced metrics
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
          // Enhanced sleep data
          sleepRemMinutes: getLatestMetricForDay(dayMetrics, 'sleep_rem_minutes'),
          sleepDeepMinutes: getLatestMetricForDay(dayMetrics, 'sleep_deep_minutes'),
          sleepCoreMinutes: getLatestMetricForDay(dayMetrics, 'sleep_core_minutes'),
          sleepAwakeMinutes: getLatestMetricForDay(dayMetrics, 'sleep_awake_minutes'),
          sleepInBedMinutes: getLatestMetricForDay(dayMetrics, 'sleep_in_bed_minutes'),
          sleepEfficiency: getLatestMetricForDay(dayMetrics, 'sleep_efficiency'),
        });
      }
      
      setWeeklyData(weekly.reverse());
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    }
  }, [user?.id]);

  const requestAppleHealthPermission = useCallback(async () => {
    logHealthDebug('request_permission_click');

    if (!isAvailable) {
      toast.error('Apple Health is only available on iPhone');
      return false;
    }

    const loaded = await loadHealthKitPlugin();
    if (!loaded || !Health) {
      toast.error('HealthKit plugin not available. Rebuild app with native code.');
      return false;
    }
    
    setIsLoading(true);
    try {
      logHealthDebug('before_isHealthAvailable');

      // Check if HealthKit is available on this device
      const { available } = await Health.isHealthAvailable();
      if (!available) {
        toast.error('HealthKit is not available on this device');
        return false;
      }

      // Request authorization for all available health data types
      await Health.requestHealthPermissions({
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
        ]
      });

      setIsConnected(true);
      toast.success('Connected to Apple Health');
      
      // Immediately sync data after connecting
      await syncAppleHealthInternal();
      
      return true;
    } catch (error: any) {
      console.error('Error connecting to Apple Health:', error);
      toast.error(error.message || 'Failed to connect to Apple Health');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

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
      logHealthDebug('steps_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('heart_rate_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('active_minutes_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('calories_error', { error: (e as any)?.message || String(e) });
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
            // Sleep value from HealthKit: check if value seems like minutes or hours
            // If value > 24, it's likely in minutes; if > 1440, it's likely in seconds
            let hours: number;
            if (bucket.value > 1440) {
              // Value is in seconds
              hours = bucket.value / 3600;
            } else if (bucket.value > 24) {
              // Value is in minutes
              hours = bucket.value / 60;
            } else {
              // Value is already in hours
              hours = bucket.value;
            }
            // Cap at reasonable max (24 hours)
            hours = Math.min(hours, 24);
            
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
      logHealthDebug('sleep_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('sleep_rem_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('sleep_deep_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('sleep_core_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('sleep_awake_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('sleep_in_bed_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('resting_hr_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('hrv_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('blood_oxygen_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('respiratory_rate_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('distance_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('flights_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('body_fat_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('mindfulness_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('bp_systolic_error', { error: (e as any)?.message || String(e) });
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
      logHealthDebug('bp_diastolic_error', { error: (e as any)?.message || String(e) });
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
    } else {
      toast.info('No health data found to sync. Check Apple Health permissions.');
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
    } catch (error: any) {
      console.error('Error syncing Apple Health:', error);
      toast.error(error.message || 'Failed to sync health data');
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, user?.id, fetchHealthMetrics]);

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

  useEffect(() => {
    fetchHealthMetrics();
  }, [fetchHealthMetrics]);

  return {
    isAvailable,
    isConnected,
    isLoading,
    healthMetrics,
    todaySummary,
    weeklyData,
    requestAppleHealthPermission,
    syncAppleHealth,
    addManualMetric,
    deleteMetric,
    refetch: fetchHealthMetrics,
  };
}
