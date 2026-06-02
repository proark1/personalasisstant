import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Dynamic import to avoid issues when not on native
interface StatusBarPlugin { setStyle(opts: { style: unknown }): Promise<void>; setBackgroundColor(opts: { color: string }): Promise<void>; hide(): Promise<void>; show(): Promise<void>; }
let StatusBar: StatusBarPlugin | null = null;
let Style: Record<string, string> | null = null;

const loadStatusBar = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const module = await import('@capacitor/status-bar');
      StatusBar = module.StatusBar;
      Style = module.Style;
      return true;
    } catch (e) {
      console.log('[StatusBar] Plugin not available:', e);
      return false;
    }
  }
  return false;
};

export function useStatusBar(theme: 'dark' | 'light' | 'colorful') {
  const updateStatusBar = useCallback(async (isDark: boolean) => {
    if (!Capacitor.isNativePlatform()) return;

    const loaded = await loadStatusBar();
    if (!loaded || !StatusBar) return;

    try {
      // Set status bar style based on theme
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light,
      });

      // On Android, also set the background color
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({
          color: isDark ? '#0a0a0a' : '#ffffff',
        });
      }

      console.log('[StatusBar] Updated to', isDark ? 'dark' : 'light', 'mode');
    } catch (error) {
      console.error('[StatusBar] Error updating:', error);
    }
  }, []);

  useEffect(() => {
    // Colorful theme uses light status bar style
    updateStatusBar(theme === 'dark');
  }, [theme, updateStatusBar]);

  return { updateStatusBar };
}
