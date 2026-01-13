import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CalendarEvent } from '@/types/flux';
import { differenceInMinutes, isAfter, isBefore, addMinutes } from 'date-fns';

interface UseEventNotificationsOptions {
  events: CalendarEvent[];
  defaultReminderMinutes: number;
  enabled: boolean;
}

export function useEventNotifications({
  events,
  defaultReminderMinutes,
  enabled,
}: UseEventNotificationsOptions) {
  const notifiedEvents = useRef<Map<string, Set<number>>>(new Map());
  const scheduledNotifications = useRef<Map<string, number[]>>(new Map());
  const permissionGranted = useRef(false);
  
  const isNative = Capacitor.isNativePlatform();

  const requestPermission = useCallback(async () => {
    if (isNative) {
      try {
        const result = await LocalNotifications.requestPermissions();
        permissionGranted.current = result.display === 'granted';
        return permissionGranted.current;
      } catch (error) {
        console.error('Error requesting native notification permission:', error);
        return false;
      }
    }

    const BrowserNotification = (typeof window !== 'undefined'
      ? (window as any).Notification
      : undefined) as any;

    if (!BrowserNotification) {
      return false;
    }

    if (BrowserNotification.permission === 'granted') {
      permissionGranted.current = true;
      return true;
    }

    if (BrowserNotification.permission !== 'denied') {
      const permission = await BrowserNotification.requestPermission();
      permissionGranted.current = permission === 'granted';
      return permissionGranted.current;
    }

    return false;
  }, [isNative]);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  const scheduleNativeNotification = useCallback(async (event: CalendarEvent, minutesBefore: number) => {
    const eventTime = new Date(event.startTime);
    const notifyTime = addMinutes(eventTime, -minutesBefore);
    const now = new Date();
    
    if (notifyTime <= now || differenceInMinutes(notifyTime, now) > 24 * 60) {
      return null;
    }

    try {
      const notificationId = Math.floor(Math.random() * 2147483647);
      
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: minutesBefore === 0 ? '📅 Meeting Now!' : '📅 Upcoming Meeting',
          body: minutesBefore > 0 
            ? `"${event.title}" starts in ${minutesBefore} minutes`
            : `"${event.title}" is starting now`,
          schedule: { at: notifyTime },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          largeIcon: 'ic_launcher',
        }]
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule native event notification:', error);
      return null;
    }
  }, []);

  const showNotification = useCallback((
    event: CalendarEvent, 
    minutesBefore: number
  ) => {
    if (!permissionGranted.current) return;

    // Check if we already notified for this interval
    const eventNotifications = notifiedEvents.current.get(event.id) || new Set();
    if (eventNotifications.has(minutesBefore)) return;

    let title: string;
    let body: string;

    if (minutesBefore === 0) {
      title = '📅 Meeting Now!';
      body = `"${event.title}" is starting now`;
    } else if (minutesBefore >= 60) {
      const hours = Math.round(minutesBefore / 60);
      title = '📅 Upcoming Meeting';
      body = `"${event.title}" starts in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      title = minutesBefore <= 5 ? '📅 Meeting Starting Soon!' : '📅 Meeting Reminder';
      body = `"${event.title}" starts in ${minutesBefore} minute${minutesBefore !== 1 ? 's' : ''}`;
    }

    // Play sound for imminent meetings
    if (!isNative && minutesBefore <= 5) {
      playNotificationSound();
    }

    if (isNative) {
      // On native, schedule an immediate notification
      LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 2147483647),
          title,
          body,
          schedule: { at: new Date() },
          sound: 'default',
        }]
      });
    } else {
      // Use web notification
      const BrowserNotification = (typeof window !== 'undefined'
        ? (window as any).Notification
        : undefined) as any;

      if (BrowserNotification?.permission === 'granted') {
        const notification = new BrowserNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          tag: `event-${event.id}-${minutesBefore}`,
          requireInteraction: minutesBefore <= 5,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }

    // Mark as notified
    eventNotifications.add(minutesBefore);
    notifiedEvents.current.set(event.id, eventNotifications);
  }, [isNative, playNotificationSound]);

  // Request permission on mount
  useEffect(() => {
    if (!enabled) return;
    requestPermission();
  }, [enabled, requestPermission]);

  // Check events periodically
  useEffect(() => {
    if (!enabled || !permissionGranted.current) return;

    const checkEvents = () => {
      const now = new Date();
      
      events.forEach(event => {
        const eventTime = new Date(event.startTime);
        
        // Only check events in the future
        if (isBefore(eventTime, now)) return;
        
        const minutesUntilEvent = differenceInMinutes(eventTime, now);
        
        // Standard reminder intervals: 60, 30, 15, 5, 0 minutes
        const reminderIntervals = [60, 30, 15, 5, 0];
        
        // Also include custom default
        if (!reminderIntervals.includes(defaultReminderMinutes)) {
          reminderIntervals.push(defaultReminderMinutes);
        }
        
        for (const interval of reminderIntervals) {
          if (minutesUntilEvent <= interval && minutesUntilEvent >= interval - 1) {
            showNotification(event, interval);
          }
        }
      });
    };

    // Check immediately
    checkEvents();

    // Check every minute
    const interval = setInterval(checkEvents, 60000);

    return () => clearInterval(interval);
  }, [events, enabled, defaultReminderMinutes, showNotification]);

  // Schedule advance notifications for native platforms
  useEffect(() => {
    if (!isNative || !enabled) return;

    const scheduleForEvents = async () => {
      for (const event of events) {
        const eventTime = new Date(event.startTime);
        const now = new Date();
        
        // Only schedule for future events
        if (isBefore(eventTime, now)) continue;

        // Cancel existing scheduled notifications for this event
        const existingIds = scheduledNotifications.current.get(event.id) || [];
        for (const id of existingIds) {
          try {
            await LocalNotifications.cancel({ notifications: [{ id }] });
          } catch (e) {
            // Ignore cancel errors
          }
        }

        const newIds: number[] = [];
        const intervals = [defaultReminderMinutes, 5, 0];
        
        for (const interval of intervals) {
          const notifyTime = addMinutes(eventTime, -interval);
          if (isAfter(notifyTime, now)) {
            const id = await scheduleNativeNotification(event, interval);
            if (id) newIds.push(id);
          }
        }

        if (newIds.length > 0) {
          scheduledNotifications.current.set(event.id, newIds);
        }
      }
    };

    scheduleForEvents();
  }, [events, isNative, enabled, defaultReminderMinutes, scheduleNativeNotification]);

  // Clean up notifications for removed events
  useEffect(() => {
    const currentEventIds = new Set(events.map(e => e.id));
    
    notifiedEvents.current.forEach((_, id) => {
      if (!currentEventIds.has(id)) {
        notifiedEvents.current.delete(id);
        
        const scheduledIds = scheduledNotifications.current.get(id) || [];
        scheduledIds.forEach(notifId => {
          LocalNotifications.cancel({ notifications: [{ id: notifId }] }).catch(() => {});
        });
        scheduledNotifications.current.delete(id);
      }
    });
  }, [events]);

  return { requestPermission };
}
