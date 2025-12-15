import { useState, useEffect, useCallback } from 'react';
import { UserSettings, defaultSettings, ThemeMode, ColorScheme } from '@/types/flux';

const SETTINGS_KEY = 'flux-settings';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    
    // Apply theme
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(settings.theme);
    
    // Apply color scheme via CSS custom properties
    applyColorScheme(settings.colorScheme);
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const updateNotifications = useCallback((updates: Partial<UserSettings['notifications']>) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, ...updates },
    }));
  }, []);

  return { settings, updateSettings, updateNotifications };
}

function applyColorScheme(scheme: ColorScheme) {
  const root = document.documentElement;
  
  const schemes: Record<ColorScheme, { primary: string; accent: string; ghost: string }> = {
    cyan: { primary: '187 94% 43%', accent: '270 60% 50%', ghost: '270 80% 60%' },
    purple: { primary: '270 60% 50%', accent: '187 94% 43%', ghost: '270 80% 60%' },
    green: { primary: '142 71% 45%', accent: '187 94% 43%', ghost: '142 80% 50%' },
    orange: { primary: '25 95% 53%', accent: '270 60% 50%', ghost: '25 90% 55%' },
    pink: { primary: '330 80% 55%', accent: '270 60% 50%', ghost: '330 85% 60%' },
  };

  const colors = schemes[scheme];
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--glow-primary', colors.primary);
  root.style.setProperty('--ring', colors.primary);
  root.style.setProperty('--sidebar-primary', colors.primary);
  root.style.setProperty('--sidebar-ring', colors.primary);
  root.style.setProperty('--ghost-primary', colors.ghost);
}
