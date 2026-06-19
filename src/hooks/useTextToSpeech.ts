import { useState, useCallback, useRef } from "react";
import type { AssistantPersonality } from "@/types/flux";

interface UseTextToSpeechOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Map personality to Web Speech API voice characteristics
const getVoiceSettings = (personality?: AssistantPersonality): { rate: number; pitch: number } => {
  switch (personality) {
    case "strict":
      return { rate: 1.1, pitch: 0.9 };
    case "supportive":
      return { rate: 0.95, pitch: 1.1 };
    case "creative":
      return { rate: 1.0, pitch: 1.05 };
    default:
      return { rate: 1.0, pitch: 1.0 };
  }
};

export function useTextToSpeech({ onStart, onEnd, onError }: UseTextToSpeechOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, personality?: AssistantPersonality) => {
      if (!text.trim()) return;

      // Check for Web Speech API support
      if (!window.speechSynthesis) {
        onError?.("Speech synthesis not supported in this browser");
        return;
      }

      // Stop any existing playback
      stop();
      setIsLoading(true);

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        const settings = getVoiceSettings(personality);
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.volume = 1.0;

        // Try to get a good English voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            (v) =>
              v.lang.startsWith("en") &&
              (v.name.includes("Google") ||
                v.name.includes("Microsoft") ||
                v.name.includes("Samantha")),
          ) || voices.find((v) => v.lang.startsWith("en"));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          setIsLoading(false);
          setIsSpeaking(true);
          onStart?.();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          utteranceRef.current = null;
          onEnd?.();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          setIsLoading(false);
          utteranceRef.current = null;
          if (event.error !== "interrupted") {
            onError?.(`Speech error: ${event.error}`);
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("TTS error:", error);
        setIsLoading(false);
        onError?.(error instanceof Error ? error.message : "TTS failed");
      }
    },
    [stop, onStart, onEnd, onError],
  );

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
  };
}
