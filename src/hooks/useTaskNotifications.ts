import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Task } from '@/types/flux';
import { differenceInMinutes, isPast, isToday } from 'date-fns';
import { usePushNotifications } from './usePushNotifications';

interface UseTaskNotificationsOptions {
  tasks: Task[];
  defaultReminderMinutes: number;
  enabled: boolean;
  adhdMode?: boolean; // Enable multiple gentle reminders
}

// ADHD mode reminder intervals (minutes before due)
const ADHD_REMINDER_INTERVALS = [15, 5, 0]; // 15min, 5min, now
const OVERDUE_NAG_INTERVAL = 10; // Nag every 10 minutes if overdue
const MAX_OVERDUE_NAGS = 3;

export function useTaskNotifications({ 
  tasks, 
  defaultReminderMinutes,
  enabled,
  adhdMode = false,
}: UseTaskNotificationsOptions) {
  // Track notifications per task per interval to avoid duplicates
  const notifiedTasks = useRef<Map<string, Set<number>>>(new Map());
  const overdueNagCount = useRef<Map<string, number>>(new Map());
  const permissionGranted = useRef(false);
  
  const isNative = Capacitor.isNativePlatform();
  const { scheduleLocalNotification, requestPermission: requestNativePermission } = usePushNotifications();

  const requestPermission = useCallback(async () => {
    if (isNative) {
      const granted = await requestNativePermission();
      permissionGranted.current = granted;
      return granted;
    }

    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      permissionGranted.current = true;
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      permissionGranted.current = permission === 'granted';
      return permissionGranted.current;
    }

    return false;
  }, [isNative, requestNativePermission]);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  const showNotification = useCallback((
    task: Task, 
    minutesBefore: number,
    isOverdue: boolean = false,
    isUrgent: boolean = false
  ) => {
    if (!permissionGranted.current) return;

    // Check if we already notified for this interval
    const taskNotifications = notifiedTasks.current.get(task.id) || new Set();
    const notificationKey = isOverdue ? -minutesBefore : minutesBefore;
    if (taskNotifications.has(notificationKey)) return;

    // Format the time message
    let timeMessage: string;
    let title: string;
    
    if (isOverdue) {
      const minutesOverdue = Math.abs(minutesBefore);
      if (minutesOverdue < 60) {
        timeMessage = `${minutesOverdue} minute${minutesOverdue !== 1 ? 's' : ''} overdue`;
      } else {
        const hours = Math.floor(minutesOverdue / 60);
        timeMessage = `${hours} hour${hours !== 1 ? 's' : ''} overdue`;
      }
      title = isUrgent ? '⚠️ Task Overdue!' : '📋 Task Reminder';
    } else if (minutesBefore === 0) {
      timeMessage = 'due now';
      title = '🔔 Task Due Now!';
    } else if (minutesBefore >= 1440) {
      const days = Math.round(minutesBefore / 1440);
      timeMessage = `due in ${days} day${days > 1 ? 's' : ''}`;
      title = '📋 Upcoming Task';
    } else if (minutesBefore >= 60) {
      const hours = Math.round(minutesBefore / 60);
      timeMessage = `due in ${hours} hour${hours > 1 ? 's' : ''}`;
      title = '📋 Task Reminder';
    } else {
      timeMessage = `due in ${minutesBefore} minute${minutesBefore !== 1 ? 's' : ''}`;
      title = minutesBefore <= 5 ? '⏰ Task Due Soon!' : '📋 Task Reminder';
    }

    const body = `"${task.title}" is ${timeMessage}`;

    // Play sound for urgent notifications (web only)
    if (!isNative && (isUrgent || minutesBefore <= 5)) {
      playNotificationSound();
    }

    if (isNative) {
      // Use native push notification on mobile
      scheduleLocalNotification(title, body, new Date(), { taskId: task.id });
    } else {
      // Use web notification on desktop
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `${task.id}-${notificationKey}`,
        requireInteraction: isUrgent || minutesBefore <= 5,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    // Mark as notified
    taskNotifications.add(notificationKey);
    notifiedTasks.current.set(task.id, taskNotifications);
  }, [isNative, playNotificationSound, scheduleLocalNotification]);

  useEffect(() => {
    if (!enabled) return;
    requestPermission();
  }, [enabled, requestPermission]);

  useEffect(() => {
    if (!enabled || !permissionGranted.current) return;

    const checkTasks = () => {
      const now = new Date();
      
      tasks.forEach(task => {
        if (!task.dueDate || task.completed) return;
        
        const dueDate = new Date(task.dueDate);
        const minutesUntilDue = differenceInMinutes(dueDate, now);
        const isOverdue = minutesUntilDue < 0;
        
        if (adhdMode) {
          // ADHD Mode: Multiple gentle reminders
          if (isOverdue && isToday(dueDate)) {
            // Nag for overdue tasks (up to MAX_OVERDUE_NAGS times)
            const nagCount = overdueNagCount.current.get(task.id) || 0;
            const minutesOverdue = Math.abs(minutesUntilDue);
            
            if (nagCount < MAX_OVERDUE_NAGS && minutesOverdue % OVERDUE_NAG_INTERVAL < 1) {
              const currentNagInterval = Math.floor(minutesOverdue / OVERDUE_NAG_INTERVAL);
              const taskNotifications = notifiedTasks.current.get(task.id) || new Set();
              
              if (!taskNotifications.has(-currentNagInterval * OVERDUE_NAG_INTERVAL)) {
                showNotification(task, -minutesOverdue, true, nagCount >= 2);
                overdueNagCount.current.set(task.id, nagCount + 1);
              }
            }
          } else if (!isOverdue) {
            // Send reminders at each ADHD interval
            for (const interval of ADHD_REMINDER_INTERVALS) {
              if (minutesUntilDue <= interval && minutesUntilDue >= interval - 1) {
                showNotification(task, interval, false, interval <= 5);
              }
            }
            
            // Also send at default reminder time if it's different
            const reminderMinutes = task.reminderBefore ?? defaultReminderMinutes;
            if (reminderMinutes > 0 && !ADHD_REMINDER_INTERVALS.includes(reminderMinutes)) {
              if (minutesUntilDue <= reminderMinutes && minutesUntilDue >= reminderMinutes - 1) {
                showNotification(task, reminderMinutes);
              }
            }
          }
        } else {
          // Standard mode: Single reminder
          if (isOverdue) return;
          
          const reminderMinutes = task.reminderBefore ?? defaultReminderMinutes;
          if (reminderMinutes <= 0) return;
          
          if (minutesUntilDue <= reminderMinutes && minutesUntilDue > 0) {
            showNotification(task, minutesUntilDue);
          }
        }
      });
    };

    // Check immediately
    checkTasks();

    // Check every minute
    const interval = setInterval(checkTasks, 60000);

    return () => clearInterval(interval);
  }, [tasks, enabled, defaultReminderMinutes, adhdMode, showNotification]);

  // Reset tracking when tasks change
  useEffect(() => {
    const currentTaskIds = new Set(tasks.map(t => t.id));
    
    // Clean up notifications for removed tasks
    notifiedTasks.current.forEach((_, id) => {
      if (!currentTaskIds.has(id)) {
        notifiedTasks.current.delete(id);
        overdueNagCount.current.delete(id);
      }
    });

    // Reset completed tasks
    tasks.forEach(task => {
      if (task.completed) {
        notifiedTasks.current.delete(task.id);
        overdueNagCount.current.delete(task.id);
      }
    });
  }, [tasks]);

  return { requestPermission };
}
