import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useMorningBriefing } from './useMorningBriefing';
import { useProactiveSettings } from './useProactiveSettings';

const LAST_AUTO_PLAY_KEY = 'dori_last_morning_autoplay';

export function useMorningAutoPlay() {
  const { user } = useAuth();
  const { playBriefing } = useMorningBriefing();
  const { settings } = useProactiveSettings();
  const hasTriggered = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id || hasTriggered.current) return;

    const voiceEnabled = settings?.voice_proactive_enabled ?? false;

    // Check if we should auto-play
    const checkAutoPlay = () => {
      const today = new Date().toISOString().split('T')[0];
      const lastAutoPlay = localStorage.getItem(LAST_AUTO_PLAY_KEY);

      // Only auto-play once per day
      if (lastAutoPlay === today) return;
      if (!voiceEnabled) return;

      // Check if it's morning time (6 AM - 11 AM)
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 11) return;

      // Mark as triggered
      hasTriggered.current = true;
      localStorage.setItem(LAST_AUTO_PLAY_KEY, today);

      // Small delay before playing
      timeoutRef.current = setTimeout(() => {
        playBriefing();
      }, 2000);
    };

    checkAutoPlay();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user?.id, settings?.voice_proactive_enabled, playBriefing]);

  return null;
}