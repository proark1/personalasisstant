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

      // Request authorization for health data types
      await Health.requestHealthPermissions({
        permissions: [
          'READ_STEPS',
          'READ_HEART_RATE', 
          'READ_ACTIVE_CALORIES',
          'READ_BASAL_CALORIES',
          'READ_WEIGHT',
          'READ_SLEEP'
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
