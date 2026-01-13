import { useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export interface AdhanSettings {
  enabled: boolean;
  style: 'makkah' | 'madinah' | 'alaqsa';
  volume: number;
}

// Adhan audio URLs - using Islamcan.com free Adhan audio
const ADHAN_AUDIO_URLS: Record<string, string> = {
  makkah: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
  madinah: 'https://www.islamcan.com/audio/adhan/azan2.mp3',
  alaqsa: 'https://www.islamcan.com/audio/adhan/azan8.mp3',
};

export function useAdhanPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Play Adhan audio
  const playAdhan = useCallback((settings: AdhanSettings, prayerName?: string) => {
    if (!settings.enabled) return;

    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const adhanUrl = ADHAN_AUDIO_URLS[settings.style];
    const audio = new Audio(adhanUrl);
    audio.volume = settings.volume / 100;
    audioRef.current = audio;

    // For native platforms, we need to handle audio playback differently
    // The audio should play even when the app is in background
    if (isNative) {
      // Set audio to play through the phone's speaker (not earpiece)
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
    }

    audio.play().catch(error => {
      console.error('Failed to play Adhan:', error);
      // On native, if audio fails, we can't do much but log it
      // The notification itself should still appear
    });

    audio.onended = () => {
      audioRef.current = null;
    };

    audio.onerror = (e) => {
      console.error('Adhan audio error:', e);
      audioRef.current = null;
    };

    return audio;
  }, [isNative]);

  // Stop Adhan
  const stopAdhan = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // Check if Adhan is currently playing
  const isPlaying = useCallback(() => {
    return audioRef.current !== null && !audioRef.current.paused;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    playAdhan,
    stopAdhan,
    isPlaying,
  };
}
