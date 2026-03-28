import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserNotification {
  id: string;
  user_id: string;
  type: 'info' | 'task' | 'event' | 'contract' | 'contact' | 'invitation' | 'share' | 'reminder';
  title: string;
  message: string;
  read: boolean;
  data: Record<string, any>;
  action_url?: string;
  created_at: string;
}

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch all notifications for user
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications((data || []) as UserNotification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Mark notification as read
  const markRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllRead = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [userId]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [userId]);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    const BrowserNotification = (typeof window !== 'undefined'
      ? (window as any).Notification
      : undefined) as any;

    if (BrowserNotification?.permission === 'default' && typeof BrowserNotification.requestPermission === 'function') {
      await BrowserNotification.requestPermission();
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      // Audio not supported or blocked
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: UserNotification) => {
    const BrowserNotification = (typeof window !== 'undefined'
      ? (window as any).Notification
      : undefined) as any;

    if (BrowserNotification?.permission === 'granted') {
      new BrowserNotification(notification.title, {
        body: notification.message,
        icon: '/pwa-192x192.svg',
        tag: notification.id,
      });
    }
  }, []);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    console.log('[useRealtimeNotifications] Setting up realtime subscription for user:', userId);

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[useRealtimeNotifications] New notification received:', payload);
          const newNotification = payload.new as UserNotification;
          
          // Add to local state
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show toast notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
          
          // Play sound
          playNotificationSound();
          
          // Show browser notification
          showBrowserNotification(newNotification);
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeNotifications] Subscription status:', status);
      });

    return () => {
      console.log('[useRealtimeNotifications] Cleaning up subscription');
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications, toast, playNotificationSound, showBrowserNotification]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    loading,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
    requestPermission,
    refetch: fetchNotifications,
  };
}
