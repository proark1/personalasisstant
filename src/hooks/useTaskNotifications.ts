import { useEffect, useCallback, useRef } from 'react';
import { Task } from '@/types/flux';
import { differenceInMinutes, isPast } from 'date-fns';

interface UseTaskNotificationsOptions {
  tasks: Task[];
  reminderMinutesBefore: number;
  enabled: boolean;
}

export function useTaskNotifications({ 
  tasks, 
  reminderMinutesBefore,
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

  const showNotification = useCallback((task: Task) => {
    if (!permissionGranted.current || notifiedTasks.current.has(task.id)) return;

    const notification = new Notification('Task Due Soon', {
      body: `"${task.title}" is due in ${reminderMinutesBefore} minutes`,
      icon: '/favicon.ico',
      tag: task.id,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    notifiedTasks.current.add(task.id);
  }, [reminderMinutesBefore]);

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
        
        const minutesUntilDue = differenceInMinutes(task.dueDate, now);
        
        if (minutesUntilDue <= reminderMinutesBefore && minutesUntilDue > 0) {
          showNotification(task);
        }
      });
    };

    // Check immediately
    checkTasks();

    // Check every minute
    const interval = setInterval(checkTasks, 60000);

    return () => clearInterval(interval);
  }, [tasks, enabled, reminderMinutesBefore, showNotification]);

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
