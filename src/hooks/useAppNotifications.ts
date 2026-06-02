import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type NotificationType = 'info' | 'task' | 'event' | 'contract' | 'contact' | 'invitation' | 'share' | 'reminder';

interface CreateNotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

interface ScheduleNativeNotificationOptions {
  id?: number;
  title: string;
  body: string;
  scheduledAt: Date;
  data?: Record<string, string>;
}

export function useAppNotifications() {
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  // Create in-app notification (stores in user_notifications table)
  const createNotification = useCallback(async (options: CreateNotificationOptions) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: user.id,
          type: options.type,
          title: options.title,
          message: options.message,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: (options.data || {}) as any,
          action_url: options.actionUrl,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;
      console.log('[useAppNotifications] Notification created:', data.id);
      return data;
    } catch (error) {
      console.error('[useAppNotifications] Error creating notification:', error);
      return null;
    }
  }, [user?.id]);

  // Schedule native iOS/Android push notification
  const scheduleNativeNotification = useCallback(async (options: ScheduleNativeNotificationOptions): Promise<number | null> => {
    if (!isNative) {
      // For web, schedule a timeout-based notification
      const delay = options.scheduledAt.getTime() - Date.now();
      if (delay > 0 && delay < 7 * 24 * 60 * 60 * 1000) { // Max 7 days
        setTimeout(() => {
          type NotificationConstructor = typeof Notification;
          const BrowserNotification = (typeof window !== 'undefined'
            ? (window as unknown as { Notification?: NotificationConstructor }).Notification
            : undefined);

          if (BrowserNotification?.permission === 'granted') {
            new BrowserNotification(options.title, {
              body: options.body,
              icon: '/pwa-192x192.svg',
              tag: options.id?.toString(),
            });
          }
        }, delay);
      }
      return options.id || null;
    }

    try {
      const notificationId = options.id || Math.floor(Math.random() * 2147483647);
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: options.title,
            body: options.body,
            schedule: { at: options.scheduledAt },
            extra: options.data,
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#6366f1',
          },
        ],
      });
      
      console.log('[useAppNotifications] Native notification scheduled:', { 
        notificationId, 
        title: options.title, 
        scheduledAt: options.scheduledAt 
      });
      return notificationId;
    } catch (error) {
      console.error('[useAppNotifications] Error scheduling native notification:', error);
      return null;
    }
  }, [isNative]);

  // Cancel a scheduled native notification
  const cancelNativeNotification = useCallback(async (notificationId: number) => {
    if (!isNative) return;

    try {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      console.log('[useAppNotifications] Native notification cancelled:', notificationId);
    } catch (error) {
      console.error('[useAppNotifications] Error cancelling native notification:', error);
    }
  }, [isNative]);

  // Helper: Create notification for task events
  const notifyTaskCreated = useCallback((taskTitle: string, taskId: string) => {
    return createNotification({
      type: 'task',
      title: 'New Task Created',
      message: `Task "${taskTitle}" has been created`,
      data: { taskId },
      actionUrl: `/tasks/${taskId}`,
    });
  }, [createNotification]);

  const notifyTaskCompleted = useCallback((taskTitle: string, taskId: string) => {
    return createNotification({
      type: 'task',
      title: 'Task Completed',
      message: `You completed "${taskTitle}"`,
      data: { taskId },
    });
  }, [createNotification]);

  const notifyTaskDueSoon = useCallback((taskTitle: string, taskId: string, dueIn: string) => {
    return createNotification({
      type: 'reminder',
      title: 'Task Due Soon',
      message: `"${taskTitle}" is due ${dueIn}`,
      data: { taskId },
    });
  }, [createNotification]);

  // Helper: Create notification for events
  const notifyEventCreated = useCallback((eventTitle: string, eventId: string) => {
    return createNotification({
      type: 'event',
      title: 'New Event Added',
      message: `Event "${eventTitle}" has been added to your calendar`,
      data: { eventId },
    });
  }, [createNotification]);

  const notifyEventReminder = useCallback((eventTitle: string, eventId: string, startsIn: string) => {
    return createNotification({
      type: 'reminder',
      title: 'Upcoming Event',
      message: `"${eventTitle}" starts ${startsIn}`,
      data: { eventId },
    });
  }, [createNotification]);

  // Helper: Create notification for appointments (also schedules native notification)
  const notifyAppointmentCreated = useCallback(async (
    appointmentTitle: string, 
    appointmentId: string, 
    appointmentDate: Date,
    reminderMinutes?: number
  ) => {
    // Create in-app notification
    await createNotification({
      type: 'event',
      title: 'Appointment Scheduled',
      message: `"${appointmentTitle}" has been scheduled`,
      data: { appointmentId },
    });

    // Schedule native notification for the reminder time (default 30 min before)
    const reminderTime = reminderMinutes || 30;
    const notificationTime = new Date(appointmentDate.getTime() - reminderTime * 60 * 1000);
    
    if (notificationTime > new Date()) {
      const notificationId = parseInt(appointmentId.replace(/-/g, '').slice(0, 8), 16) % 2147483647;
      await scheduleNativeNotification({
        id: notificationId,
        title: '📅 Appointment Reminder',
        body: `"${appointmentTitle}" starts in ${reminderTime} minutes`,
        scheduledAt: notificationTime,
        data: { appointmentId, type: 'appointment' },
      });
    }

    return true;
  }, [createNotification, scheduleNativeNotification]);

  const notifyAppointmentUpdated = useCallback((appointmentTitle: string, appointmentId: string) => {
    return createNotification({
      type: 'event',
      title: 'Appointment Updated',
      message: `"${appointmentTitle}" has been updated`,
      data: { appointmentId },
    });
  }, [createNotification]);

  // Helper: Create notification for contracts
  const notifyContractCreated = useCallback((contractName: string, contractId: string) => {
    return createNotification({
      type: 'contract',
      title: 'Contract Added',
      message: `Contract "${contractName}" has been added`,
      data: { contractId },
    });
  }, [createNotification]);

  const notifyContractRenewal = useCallback((contractName: string, contractId: string, daysUntil: number) => {
    return createNotification({
      type: 'contract',
      title: 'Contract Renewal Reminder',
      message: `"${contractName}" renews in ${daysUntil} days`,
      data: { contractId },
    });
  }, [createNotification]);

  // Helper: Create notification for contacts
  const notifyContactReminder = useCallback((contactName: string, contactId: string, reason?: string) => {
    return createNotification({
      type: 'contact',
      title: 'Contact Reminder',
      message: reason || `Time to reach out to ${contactName}`,
      data: { contactId },
    });
  }, [createNotification]);

  // Helper: Create notification for habits
  const notifyHabitCompleted = useCallback((habitName: string, habitId: string, streak: number) => {
    return createNotification({
      type: 'info',
      title: 'Habit Completed!',
      message: `You completed "${habitName}"${streak > 1 ? ` - ${streak} day streak!` : ''}`,
      data: { habitId, streak },
    });
  }, [createNotification]);

  // Helper: Create notification for sharing
  const notifyItemShared = useCallback((itemType: string, itemName: string, sharedBy: string) => {
    return createNotification({
      type: 'share',
      title: 'Item Shared With You',
      message: `${sharedBy} shared a ${itemType}: "${itemName}"`,
      data: { itemType, itemName },
    });
  }, [createNotification]);

  return {
    createNotification,
    scheduleNativeNotification,
    cancelNativeNotification,
    // Task notifications
    notifyTaskCreated,
    notifyTaskCompleted,
    notifyTaskDueSoon,
    // Event notifications
    notifyEventCreated,
    notifyEventReminder,
    // Appointment notifications
    notifyAppointmentCreated,
    notifyAppointmentUpdated,
    // Contract notifications
    notifyContractCreated,
    notifyContractRenewal,
    // Contact notifications
    notifyContactReminder,
    // Habit notifications
    notifyHabitCompleted,
    // Share notifications
    notifyItemShared,
    // Utils
    isNative,
  };
}
