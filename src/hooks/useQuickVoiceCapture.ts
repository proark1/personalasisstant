import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceCaptureResult {
  type: 'task' | 'note' | 'event' | 'reminder';
  title: string;
  category: 'personal' | 'business' | 'family';
  priority: 'low' | 'medium' | 'high';
  originalText: string;
}

// SpeechRecognition is not uniformly typed across browser environments
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean } };
}
interface SpeechRecognitionErrorEvent { error: string }
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance }
interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function useQuickVoiceCapture() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<VoiceCaptureResult | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const processTranscript = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;

    setIsProcessing(true);
    try {
      // First, save to brain dumps for backup
      await supabase.from('brain_dumps').insert({
        user_id: user.id,
        content: text,
        is_processed: false,
      });

      // Use AI to categorize
      const response = await supabase.functions.invoke('ai-assistant', {
        body: {
          type: 'categorize_dump',
          content: text,
        },
      });

      if (response.data) {
        setResult({
          type: response.data.suggested_type || 'task',
          title: response.data.ai_summary || text.slice(0, 50),
          category: response.data.suggested_category || 'personal',
          priority: response.data.suggested_priority || 'medium',
          originalText: text,
        });
        toast.success('Voice captured!', {
          description: response.data.ai_summary || text.slice(0, 30),
        });
      }
    } catch (error) {
      console.error('Failed to process transcript:', error);
      // Fallback to basic result
      setResult({
        type: 'task',
        title: text.slice(0, 50),
        category: 'personal',
        priority: 'medium',
        originalText: text,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const startRecording = useCallback(() => {
    const w = window as unknown as WindowWithSpeech;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      setResult(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = event.resultIndex;
      const res = event.results[current];
      setTranscript(res[0].transcript);

      if (res.isFinal) {
        processTranscript(res[0].transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        toast.error('Could not recognize speech');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [processTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setTranscript('');
  }, []);

  return {
    isRecording,
    isProcessing,
    transcript,
    result,
    startRecording,
    stopRecording,
    clearResult,
  };
}
