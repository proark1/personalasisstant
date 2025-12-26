import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Expo Push Token format: ExponentPushToken[xxxxxx] or ExpoPushToken[xxxxxx]
// For Capacitor apps, we'll use the native token and store it

export function useExpoPushNotifications() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const saveTokenToDatabase = async (nativeToken: string, expoToken?: string) => {
    if (!user?.id) return;

    try {
      const platform = Capacitor.getPlatform();
      
      // Check if token already exists
      const { data: existing } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('token', nativeToken)
        .single();

      if (existing) {
        // Update existing token
        await supabase
          .from('push_tokens')
          .update({ 
            expo_push_token: expoToken || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert new token
        await supabase
          .from('push_tokens')
          .insert({
            user_id: user.id,
            token: nativeToken,
            expo_push_token: expoToken || null,
            platform,
          });
      }

      console.log('Push token saved to database');
    } catch (err) {
      console.error('Failed to save push token:', err);
    }
  };

  const removeTokenFromDatabase = async () => {
    if (!user?.id || !token) return;

    try {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);
      
      console.log('Push token removed from database');
    } catch (err) {
      console.error('Failed to remove push token:', err);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isNative) {
      // For web, use browser notifications
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission === 'granted' ? 'granted' : 'denied');
        return permission === 'granted';
      }
      return false;
    }

    try {
      let status = await PushNotifications.checkPermissions();
      
      if (status.receive === 'prompt') {
        status = await PushNotifications.requestPermissions();
      }

      setPermissionStatus(status.receive === 'granted' ? 'granted' : 'denied');
      return status.receive === 'granted';
    } catch (err) {
      console.error('Failed to request push permission:', err);
      return false;
    }
  };

  const register = useCallback(async () => {
    if (!isNative) {
      console.log('Push notifications not available on web');
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return;
    }

    try {
      await PushNotifications.register();
    } catch (err) {
      console.error('Failed to register for push notifications:', err);
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;

    // Listen for registration success
    const registrationListener = PushNotifications.addListener('registration', async (tokenData: Token) => {
      console.log('Push registration success:', tokenData.value);
      setToken(tokenData.value);
      
      // For iOS/Android, we can try to get an Expo push token
      // In a real app, you'd use expo-notifications or a server-side conversion
      // For now, we'll store the native token and let the server handle it
      const expoFormatToken = `ExponentPushToken[${tokenData.value.substring(0, 22)}]`;
      setExpoPushToken(expoFormatToken);
      
      await saveTokenToDatabase(tokenData.value, expoFormatToken);
    });

    // Listen for registration errors
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Listen for push notifications received
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      
      // Show a toast for foreground notifications
      toast(notification.title || 'Notification', {
        description: notification.body,
      });
    });

    // Listen for push notification actions (tap)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', async (action: ActionPerformed) => {
      console.log('Push notification action:', action);
      
      const data = action.notification.data;
      
      // Handle reminder actions
      if (data?.reminder_id) {
        // Mark reminder as read/actioned
        await supabase
          .from('proactive_reminders')
          .update({ 
            read_at: new Date().toISOString(),
            action_taken: true,
            action_type: 'opened'
          })
          .eq('id', data.reminder_id);

        // Update delivery log
        await supabase
          .from('reminder_delivery_log')
          .update({ clicked_at: new Date().toISOString() })
          .eq('reminder_id', data.reminder_id)
          .eq('delivery_channel', 'push');
      }

      // Navigate based on notification type
      if (data?.trigger_entity_type && data?.trigger_entity_id) {
        // Could dispatch navigation event here
        console.log('Navigate to:', data.trigger_entity_type, data.trigger_entity_id);
      }
    });

    // Auto-register on mount if user is logged in
    if (user?.id) {
      register();
    }

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isNative, user?.id, register]);

  // Clean up token on logout
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        removeTokenFromDatabase();
        setToken(null);
        setExpoPushToken(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [token]);

  return {
    token,
    expoPushToken,
    permissionStatus,
    isNative,
    requestPermission,
    register,
  };
}
