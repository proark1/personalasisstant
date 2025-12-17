import { useEffect, useCallback, useRef } from 'react';
import { Task } from '@/types/flux';
import { differenceInMinutes, isPast } from 'date-fns';

interface UseTaskNotificationsOptions {
  tasks: Task[];
  defaultReminderMinutes: number;
  enabled: boolean;
}

export function useTaskNotifications({ 
  tasks, 
  defaultReminderMinutes,
  enabled 
}: UseTaskNotificationsOptions) {
  const notifiedTasks = useRef<Set<string>>(new Set());
  const permissionGranted = useRef(false);

  const requestPermission = useCallback(async () => {
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
  }, []);

  const showNotification = useCallback((task: Task, minutesBefore: number) => {
    if (!permissionGranted.current || notifiedTasks.current.has(task.id)) return;

    // Format the time remaining for the notification
    let timeMessage: string;
    if (minutesBefore >= 1440) {
      const days = Math.round(minutesBefore / 1440);
      timeMessage = `${days} day${days > 1 ? 's' : ''}`;
    } else if (minutesBefore >= 60) {
      const hours = Math.round(minutesBefore / 60);
      timeMessage = `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      timeMessage = `${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;
    }

    const notification = new Notification('Task Due Soon', {
      body: `"${task.title}" is due in ${timeMessage}`,
      icon: '/favicon.ico',
      tag: task.id,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    notifiedTasks.current.add(task.id);
  }, []);

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
        if (isPast(task.dueDate)) return;
        
        // Use task-specific reminder or fall back to default
        const reminderMinutes = task.reminderBefore ?? defaultReminderMinutes;
        if (reminderMinutes <= 0) return; // No reminder set
        
        const minutesUntilDue = differenceInMinutes(task.dueDate, now);
        
        if (minutesUntilDue <= reminderMinutes && minutesUntilDue > 0) {
          showNotification(task, minutesUntilDue);
        }
      });
    };

    // Check immediately
    checkTasks();

    // Check every minute
    const interval = setInterval(checkTasks, 60000);

    return () => clearInterval(interval);
  }, [tasks, enabled, defaultReminderMinutes, showNotification]);

  // Reset notified tasks when tasks change significantly
  useEffect(() => {
    const currentTaskIds = new Set(tasks.map(t => t.id));
    notifiedTasks.current.forEach(id => {
      if (!currentTaskIds.has(id)) {
        notifiedTasks.current.delete(id);
      }
    });
  }, [tasks]);

  return { requestPermission };
}
