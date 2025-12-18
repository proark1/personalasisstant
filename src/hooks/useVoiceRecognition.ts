import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceRecognitionOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  lang?: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Type declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceRecognition({
  onTranscript,
  onError,
  continuous = true,
  lang = 'en-US',
}: UseVoiceRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const isPausedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  // Keep refs in sync
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Don't process results if paused (AI is speaking)
        if (isPausedRef.current) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        onTranscriptRef.current?.(currentTranscript, !!finalTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          onErrorRef.current?.(event.error);
        }
        // Don't set isListening to false on no-speech, just restart
        if (event.error === 'no-speech' && shouldRestartRef.current) {
          // Will be restarted in onend
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // If we're paused (e.g. AI is speaking or mic muted), do NOT auto-restart.
        // We'll resume explicitly via resumeListening().
        if (isPausedRef.current) return;

        // Always restart if continuous and should be listening
        if (continuous && shouldRestartRef.current) {
          setTimeout(() => {
            if (isPausedRef.current) return;
            if (shouldRestartRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log('Recognition restart delayed, will retry');
                // Try again after a short delay
                setTimeout(() => {
                  if (isPausedRef.current) return;
                  if (shouldRestartRef.current && recognitionRef.current) {
                    try {
                      recognitionRef.current.start();
                    } catch (e2) {
                      setIsListening(false);
                    }
                  }
                }, 500);
              }
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      onError?.('Speech recognition not supported');
      return;
    }

    setTranscript('');
    shouldRestartRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setIsPaused(false);
    } catch (e) {
      console.error('Failed to start recognition:', e);
      onError?.('Failed to start voice recognition');
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsPaused(false);
  }, []);

  // Pause recognition (e.g., when AI is speaking to prevent echo)
  const pauseListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsPaused(true);
  }, [isListening]);

  // Resume recognition after pause
  const resumeListening = useCallback(() => {
    setIsPaused(false);
    if (recognitionRef.current && shouldRestartRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Failed to resume recognition:', e);
      }
    }
  }, []);

  return {
    isListening,
    isSupported,
    isPaused,
    transcript,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
  };
}
