import { useState, useEffect, useCallback } from "react";

export interface PrayerNotificationSettings {
  enabled: boolean;
  prayers: Record<string, boolean>;
  minutesBefore: number;
  adhanEnabled: boolean;
  adhanStyle: "makkah" | "madinah" | "alaqsa";
  adhanVolume: number;
}

const DEFAULT_SETTINGS: PrayerNotificationSettings = {
  enabled: false,
  prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  minutesBefore: 5,
  adhanEnabled: false,
  adhanStyle: "makkah",
  adhanVolume: 70,
};

const STORAGE_KEY = "prayer-notifications";

export function usePrayerNotificationSettings() {
  const [settings, setSettings] = useState<PrayerNotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error("Error loading prayer notification settings:", error);
    }
    return DEFAULT_SETTINGS;
  });

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving prayer notification settings:", error);
    }
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<PrayerNotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission === "granted";
  }, []);

  return {
    settings,
    updateSettings,
    notificationPermission,
    requestPermission,
    isEnabled: settings.enabled && notificationPermission === "granted",
  };
}
