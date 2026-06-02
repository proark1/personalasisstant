import { useState, useCallback, useEffect } from 'react';
import { AppNotification } from '@/components/notifications/NotificationCenter';

// Browser Notification API may not be typed on all environments (e.g. iOS)
interface BrowserNotificationConstructor {
  new (title: string, opts?: NotificationOptions): Notification;
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
}

function getBrowserNotification(): BrowserNotificationConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Notification?: BrowserNotificationConstructor }).Notification;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('darai_notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<AppNotification & { timestamp: string }>;
        setNotifications(parsed.map((n) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        })));
      } catch {
        // ignore malformed stored data
      }
    }
  }, []);

  // Save to localStorage when notifications change
  useEffect(() => {
    localStorage.setItem('darai_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((
    notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
  ) => {
    const newNotification: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 100)); // Keep max 100

    // Play sound for urgent notifications
    if (notification.type === 'share' || notification.type === 'reminder') {
      playNotificationSound();
    }

    // Show browser notification if permitted (check if Notification API exists first for iOS compatibility)
    const BrowserNotification = getBrowserNotification();

    if (BrowserNotification?.permission === 'granted') {
      new BrowserNotification(notification.title, {
        body: notification.message,
        icon: '/pwa-192x192.svg',
      });
    }
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    const BrowserNotification = getBrowserNotification();

    if (BrowserNotification?.permission === 'default' && typeof BrowserNotification.requestPermission === 'function') {
      await BrowserNotification.requestPermission();
    }
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
    requestPermission,
  };
}

// Simple notification sound
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
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
  } catch {
    // Audio not supported or blocked
  }
}
