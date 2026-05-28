import { useState, useCallback, useRef, useEffect } from 'react';

export interface AmbientSound {
  id: string;
  name: string;
  icon: string;
  url: string;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', name: 'Rain', icon: '🌧️', url: 'https://assets.mixkit.co/active_storage/sfx/2432/2432-preview.mp3' },
  { id: 'forest', name: 'Forest', icon: '🌲', url: 'https://assets.mixkit.co/active_storage/sfx/2518/2518-preview.mp3' },
  { id: 'ocean', name: 'Ocean', icon: '🌊', url: 'https://assets.mixkit.co/active_storage/sfx/2187/2187-preview.mp3' },
  { id: 'fire', name: 'Fireplace', icon: '🔥', url: 'https://assets.mixkit.co/active_storage/sfx/2181/2181-preview.mp3' },
  { id: 'coffee', name: 'Café', icon: '☕', url: 'https://assets.mixkit.co/active_storage/sfx/2513/2513-preview.mp3' },
  { id: 'wind', name: 'Wind', icon: '🍃', url: 'https://assets.mixkit.co/active_storage/sfx/2192/2192-preview.mp3' },
];

const STORAGE_KEY = 'darai-ambient-settings';

interface AmbientSettings {
  activeSound: string | null;
  volume: number;
}

export function useAmbientSounds() {
  const [settings, setSettings] = useState<AmbientSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { activeSound: null, volume: 0.5 };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Save settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Handle audio playback
  useEffect(() => {
    if (settings.activeSound && isPlaying) {
      const sound = AMBIENT_SOUNDS.find(s => s.id === settings.activeSound);
      if (sound) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(sound.url);
        audio.loop = true;
        audio.volume = settings.volume;
        audioRef.current = audio;
        
        audio.play().catch(console.error);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [settings.activeSound, isPlaying]);

  // Update volume on existing audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  const playSound = useCallback((soundId: string) => {
    setSettings(prev => ({ ...prev, activeSound: soundId }));
    setIsPlaying(true);
  }, []);

  const stopSound = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const toggleSound = useCallback((soundId: string) => {
    if (settings.activeSound === soundId && isPlaying) {
      stopSound();
    } else {
      playSound(soundId);
    }
  }, [settings.activeSound, isPlaying, playSound, stopSound]);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  return {
    sounds: AMBIENT_SOUNDS,
    activeSound: settings.activeSound,
    isPlaying,
    volume: settings.volume,
    playSound,
    stopSound,
    toggleSound,
    setVolume,
  };
}
