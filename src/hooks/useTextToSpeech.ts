import { useState, useCallback, useRef } from 'react';
import type { AssistantPersonality } from '@/types/flux';
import { personalityConfigs } from '@/types/flux';

type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface UseTextToSpeechOptions {
  defaultVoice?: Voice;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Map personality to voice
const getVoiceForPersonality = (personality?: AssistantPersonality): Voice => {
  if (!personality) return 'alloy';
  const config = personalityConfigs.find(p => p.id === personality);
  return (config?.voice as Voice) || 'alloy';
};

export function useTextToSpeech({
  defaultVoice = 'alloy',
  onStart,
  onEnd,
  onError,
}: UseTextToSpeechOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, personality?: AssistantPersonality) => {
    if (!text.trim()) return;

    // Stop any existing playback
    stop();
    setIsLoading(true);

    const voice = personality ? getVoiceForPersonality(personality) : defaultVoice;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voice }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Create audio from base64
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        onStart?.();
      };

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        onEnd?.();
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        onError?.('Failed to play audio');
      };

      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      onError?.(error instanceof Error ? error.message : 'TTS failed');
    } finally {
      setIsLoading(false);
    }
  }, [defaultVoice, stop, onStart, onEnd, onError]);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
  };
}
