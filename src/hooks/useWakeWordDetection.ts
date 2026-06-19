import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API types (avoiding global conflicts)
interface WakeWordSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      length: number;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface WakeWordSpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface WakeWordSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: WakeWordSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WakeWordSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// Get Speech Recognition constructor
const getSpeechRecognition = (): (new () => WakeWordSpeechRecognition) | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

interface UseWakeWordDetectionOptions {
  enabled?: boolean;
  wakeWords?: string[];
  onWakeWordDetected: () => void;
  cooldownMs?: number;
}

export const useWakeWordDetection = ({
  enabled = true,
  wakeWords = ["hey dori", "hey dory", "hi dori", "hi dory", "ok dori", "okay dori"],
  onWakeWordDetected,
  cooldownMs = 3000,
}: UseWakeWordDetectionOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<WakeWordSpeechRecognition | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const isActiveRef = useRef(false);

  // Check for browser support
  useEffect(() => {
    setIsSupported(!!getSpeechRecognition());
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isActiveRef.current) return;

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition not supported");
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        isActiveRef.current = true;
      };

      recognition.onresult = (event) => {
        const now = Date.now();

        // Check cooldown to prevent multiple triggers
        if (now - lastTriggerRef.current < cooldownMs) {
          return;
        }

        // Check all results for wake word
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];

          // Check all alternatives
          for (let j = 0; j < result.length; j++) {
            const transcript = result[j].transcript.toLowerCase().trim();

            // Check if any wake word is detected
            const detected = wakeWords.some(
              (word) => transcript.includes(word) || transcript.endsWith(word.split(" ")[1]), // Just "dori" at the end
            );

            if (detected) {
              console.log("[WakeWord] Wake word detected:", transcript);
              lastTriggerRef.current = now;

              // Stop listening before triggering to avoid conflicts
              recognition.stop();
              isActiveRef.current = false;

              // Trigger callback
              onWakeWordDetected();
              return;
            }
          }
        }
      };

      recognition.onerror = (event) => {
        // Ignore aborted errors (happens when we stop intentionally)
        if (event.error === "aborted") return;

        console.error("[WakeWord] Error:", event.error);

        // Handle specific errors
        if (event.error === "not-allowed") {
          setError("Microphone access denied");
          setIsListening(false);
          isActiveRef.current = false;
          return;
        }

        if (event.error === "no-speech") {
          // This is normal, restart listening
          return;
        }

        setError(event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
        isActiveRef.current = false;

        // Auto-restart if we should still be listening, with backoff to avoid tight loops
        if (enabled && !error) {
          setTimeout(() => {
            if (enabled && !isActiveRef.current) {
              startListening();
            }
          }, 1500);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[WakeWord] Failed to start:", err);
      setError(err instanceof Error ? err.message : "Failed to start");
      isActiveRef.current = false;
    }
  }, [isSupported, wakeWords, onWakeWordDetected, cooldownMs, enabled, error]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    isActiveRef.current = false;
  }, []);

  // NOTE: We intentionally do NOT auto-start on mount.
  // Calling recognition.start() without a user gesture triggers the
  // microphone permission prompt on page load (especially on mobile),
  // and on iOS Safari can crash the tab. Consumers must call
  // startListening() from an explicit user interaction (e.g. a toggle
  // in settings or a button press).
  useEffect(() => {
    if (!enabled) {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, stopListening]);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  };
};
