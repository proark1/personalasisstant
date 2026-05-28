import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';

export interface LocationTrigger {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  trigger_type: 'enter' | 'exit' | 'both';
  reminder_message: string;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationTrigger {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  trigger_type: 'enter' | 'exit' | 'both';
  reminder_message: string;
}

// Calculate distance between two coordinates in meters (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useLocationReminders() {
  const { user } = useAuth();
  const [triggers, setTriggers] = useState<LocationTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<string | null>(null);
  const previousPositionsRef = useRef<Map<string, boolean>>(new Map()); // triggerId -> wasInside

  const isNative = Capacitor.isNativePlatform();

  // Fetch location triggers
  const fetchTriggers = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('location_triggers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTriggers((data as LocationTrigger[]) || []);
    } catch (err) {
      console.error('Failed to fetch location triggers:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  // Check and request permissions
  const checkPermissions = useCallback(async () => {
    if (!isNative) {
      // For web, check navigator.permissions
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          return result.state;
        } catch {
          return 'prompt';
        }
      }
      return 'prompt';
    }

    try {
      const status = await Geolocation.checkPermissions();
      const permState = status.location === 'granted' ? 'granted' : 
                        status.location === 'denied' ? 'denied' : 'prompt';
      setPermissionStatus(permState);
      return permState;
    } catch (err) {
      console.error('Error checking permissions:', err);
      return 'prompt';
    }
  }, [isNative]);

  const requestPermissions = useCallback(async () => {
    if (!isNative) {
      // For web, just try to get position which triggers prompt
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        setPermissionStatus('granted');
        return 'granted';
      } catch {
        setPermissionStatus('denied');
        return 'denied';
      }
    }

    try {
      const result = await Geolocation.requestPermissions();
      const permState = result.location === 'granted' ? 'granted' : 'denied';
      setPermissionStatus(permState);
      return permState;
    } catch (err) {
      console.error('Error requesting permissions:', err);
      return 'denied';
    }
  }, [isNative]);

  // Check if position is inside a trigger zone
  const checkTriggers = useCallback(async (position: Position) => {
    if (!user?.id || triggers.length === 0) return;

    const { latitude, longitude } = position.coords;

    for (const trigger of triggers) {
      const distance = calculateDistance(latitude, longitude, trigger.latitude, trigger.longitude);
      const isInside = distance <= trigger.radius_meters;
      const wasInside = previousPositionsRef.current.get(trigger.id) ?? null;

      // Update previous state
      previousPositionsRef.current.set(trigger.id, isInside);

      // Skip if no previous state (first check)
      if (wasInside === null) continue;

      // Check for trigger conditions
      const shouldTrigger = 
        (trigger.trigger_type === 'enter' && !wasInside && isInside) ||
        (trigger.trigger_type === 'exit' && wasInside && !isInside) ||
        (trigger.trigger_type === 'both' && wasInside !== isInside);

      if (shouldTrigger) {
        const action = isInside ? 'Arrived at' : 'Left';
        
        // Show notification
        toast.info(`${action} ${trigger.name}`, {
          description: trigger.reminder_message,
          duration: 10000,
        });

        // Create proactive reminder
        await supabase.from('proactive_reminders').insert({
          user_id: user.id,
          reminder_type: 'location_trigger',
          trigger_entity_type: 'location',
          trigger_entity_id: trigger.id,
          title: `📍 ${action} ${trigger.name}`,
          message: trigger.reminder_message,
          priority: 'medium',
          scheduled_for: new Date().toISOString(),
          metadata: { 
            location_name: trigger.name, 
            trigger_type: trigger.trigger_type,
            action: isInside ? 'enter' : 'exit'
          }
        });

        // Update last triggered
        await supabase
          .from('location_triggers')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', trigger.id);
      }
    }
  }, [user?.id, triggers]);

  // Start location tracking
  const startTracking = useCallback(async () => {
    const perm = await checkPermissions();
    if (perm !== 'granted') {
      const result = await requestPermissions();
      if (result !== 'granted') {
        toast.error('Location permission is required for location-based reminders');
        return false;
      }
    }

    if (isNative) {
      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (position, err) => {
            if (err) {
              console.error('Watch position error:', err);
              return;
            }
            if (position) {
              setCurrentPosition(position);
              checkTriggers(position);
            }
          }
        );
        watchIdRef.current = id;
        setIsTracking(true);
        return true;
      } catch (err) {
        console.error('Failed to start tracking:', err);
        return false;
      }
    } else {
      // Web fallback - use navigator.geolocation.watchPosition
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const position = {
            coords: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              altitudeAccuracy: pos.coords.altitudeAccuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
            },
            timestamp: pos.timestamp,
          } as Position;
          setCurrentPosition(position);
          checkTriggers(position);
        },
        (err) => console.error('Watch position error:', err),
        { enableHighAccuracy: true }
      );
      watchIdRef.current = String(id);
      setIsTracking(true);
      return true;
    }
  }, [isNative, checkPermissions, requestPermissions, checkTriggers]);

  // Stop location tracking
  const stopTracking = useCallback(async () => {
    if (watchIdRef.current) {
      if (isNative) {
        await Geolocation.clearWatch({ id: watchIdRef.current });
      } else {
        navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
      }
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, [isNative]);

  // Get current position once
  const getCurrentPosition = useCallback(async (): Promise<Position | null> => {
    const perm = await checkPermissions();
    if (perm !== 'granted') {
      const result = await requestPermissions();
      if (result !== 'granted') return null;
    }

    try {
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        setCurrentPosition(position);
        return position;
      } else {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const position = {
                coords: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  altitude: pos.coords.altitude,
                  altitudeAccuracy: pos.coords.altitudeAccuracy,
                  heading: pos.coords.heading,
                  speed: pos.coords.speed,
                },
                timestamp: pos.timestamp,
              } as Position;
              setCurrentPosition(position);
              resolve(position);
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
    } catch (err) {
      console.error('Failed to get current position:', err);
      return null;
    }
  }, [isNative, checkPermissions, requestPermissions]);

  // CRUD operations
  const createTrigger = async (data: CreateLocationTrigger): Promise<LocationTrigger | null> => {
    if (!user?.id) return null;

    try {
      const { data: created, error } = await supabase
        .from('location_triggers')
        .insert({
          user_id: user.id,
          ...data,
          radius_meters: data.radius_meters || 100,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newTrigger = created as LocationTrigger;
      setTriggers(prev => [newTrigger, ...prev]);
      toast.success('Location reminder created');
      return newTrigger;
    } catch (err) {
      console.error('Failed to create location trigger:', err);
      toast.error('Failed to create location reminder');
      return null;
    }
  };

  const updateTrigger = async (id: string, updates: Partial<LocationTrigger>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('location_triggers')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setTriggers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success('Location reminder updated');
      return true;
    } catch (err) {
      console.error('Failed to update location trigger:', err);
      toast.error('Failed to update location reminder');
      return false;
    }
  };

  const deleteTrigger = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('location_triggers')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setTriggers(prev => prev.filter(t => t.id !== id));
      previousPositionsRef.current.delete(id);
      toast.success('Location reminder deleted');
      return true;
    } catch (err) {
      console.error('Failed to delete location trigger:', err);
      toast.error('Failed to delete location reminder');
      return false;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
        }
      }
    };
  }, [isNative]);

  return {
    triggers,
    loading,
    currentPosition,
    permissionStatus,
    isTracking,
    isNative,
    fetchTriggers,
    checkPermissions,
    requestPermissions,
    startTracking,
    stopTracking,
    getCurrentPosition,
    createTrigger,
    updateTrigger,
    deleteTrigger,
  };
}
