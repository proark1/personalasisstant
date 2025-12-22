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

// Placeholder for Capacitor HealthKit plugin integration
const isNative = Capacitor.isNativePlatform();

export function useAppleHealth() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailyHealthSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyHealthSummary[]>([]);

  // Check if Apple Health is available (only on native iOS)
  const isAvailable = isNative && Capacitor.getPlatform() === 'ios';

  const fetchHealthMetrics = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      setHealthMetrics(data || []);
      
      // Calculate today's summary
      const today = new Date().toISOString().split('T')[0];
      const todayMetrics = (data || []).filter(m => 
        m.recorded_at.startsWith(today)
      );
      
      if (todayMetrics.length > 0) {
        setTodaySummary({
          date: today,
          steps: todayMetrics.find(m => m.metric_type === 'steps')?.value || 0,
          calories: todayMetrics.find(m => m.metric_type === 'calories')?.value || 0,
          activeMinutes: todayMetrics.find(m => m.metric_type === 'active_minutes')?.value || 0,
          sleepHours: todayMetrics.find(m => m.metric_type === 'sleep_hours')?.value || 0,
          heartRateAvg: todayMetrics.find(m => m.metric_type === 'heart_rate')?.value || 0,
          weight: todayMetrics.find(m => m.metric_type === 'weight')?.value,
          waterIntake: todayMetrics.find(m => m.metric_type === 'water_intake')?.value || 0,
        });
      }
      
      // Calculate weekly data
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekly: DailyHealthSummary[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayMetrics = (data || []).filter(m => m.recorded_at.startsWith(dateStr));
        
        weekly.push({
          date: dateStr,
          steps: dayMetrics.find(m => m.metric_type === 'steps')?.value || 0,
          calories: dayMetrics.find(m => m.metric_type === 'calories')?.value || 0,
          activeMinutes: dayMetrics.find(m => m.metric_type === 'active_minutes')?.value || 0,
          sleepHours: dayMetrics.find(m => m.metric_type === 'sleep_hours')?.value || 0,
          heartRateAvg: dayMetrics.find(m => m.metric_type === 'heart_rate')?.value || 0,
          weight: dayMetrics.find(m => m.metric_type === 'weight')?.value,
          waterIntake: dayMetrics.find(m => m.metric_type === 'water_intake')?.value || 0,
        });
      }
      
      setWeeklyData(weekly.reverse());
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    }
  }, [user?.id]);

  const requestAppleHealthPermission = useCallback(async () => {
    if (!isAvailable) {
      toast.error('Apple Health is only available on iPhone');
      return false;
    }
    
    setIsLoading(true);
    try {
      // TODO: Implement actual HealthKit permission request via Capacitor plugin
      // For now, simulate the flow
      console.log('Requesting Apple Health permissions...');
      setIsConnected(true);
      toast.success('Connected to Apple Health');
      return true;
    } catch (error) {
      console.error('Error connecting to Apple Health:', error);
      toast.error('Failed to connect to Apple Health');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  const syncAppleHealth = useCallback(async () => {
    if (!isConnected || !isAvailable || !user?.id) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement actual HealthKit data sync via Capacitor plugin
      console.log('Syncing Apple Health data...');
      toast.success('Health data synced');
      await fetchHealthMetrics();
    } catch (error) {
      console.error('Error syncing Apple Health:', error);
      toast.error('Failed to sync health data');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, isAvailable, user?.id, fetchHealthMetrics]);

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
