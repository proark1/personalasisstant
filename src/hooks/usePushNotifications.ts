import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

interface UsePushNotificationsOptions {
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const tokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  const registerToken = useCallback(async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Store the push token in user profile or a dedicated table
      // For now, we'll just log it - you can extend this to store in DB
      console.log('Push token registered:', token);
      tokenRef.current = token;
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Fall back to web notifications for non-native platforms
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    }

    try {
      // Check current permission status
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'granted') {
        return true;
      }

      if (permStatus.receive === 'denied') {
        return false;
      }

      // Request permission
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return false;
    }
  }, [isNative]);

  const register = useCallback(async () => {
    if (registeredRef.current || !isNative) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return;
    }

    try {
      // Register with Apple / Google to receive push
      await PushNotifications.register();
      registeredRef.current = true;
    } catch (error) {
      console.error('Error registering push notifications:', error);
    }
  }, [isNative, requestPermission]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    scheduledAt: Date,
    data?: Record<string, string>
  ) => {
    if (!isNative) {
      // For web, we can't schedule local notifications, so just set a timeout
      const delay = scheduledAt.getTime() - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Max 24 hours
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          }
        }, delay);
      }
      return;
    }

    // For native, we'd need @capacitor/local-notifications for scheduled notifications
    // This is a placeholder for future implementation
    console.log('Local notification scheduled:', { title, body, scheduledAt, data });
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;

    // Add listeners for push notifications
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success:', token.value);
      registerToken(token.value);
    });

    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    const notificationListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        options.onNotificationReceived?.(notification);
      }
    );

    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Push notification action:', action);
        options.onNotificationAction?.(action);
      }
    );

    // Auto-register on mount
    register();

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      notificationListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isNative, register, registerToken, options]);

  return {
    isNative,
    token: tokenRef.current,
    requestPermission,
    register,
    scheduleLocalNotification,
  };
}
