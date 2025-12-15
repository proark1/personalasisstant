import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useToast } from '@/hooks/use-toast';
import type { AssistantPersonality } from '@/types/flux';
import { 
  Mic, 
  MicOff, 
  X, 
  Wifi, 
  WifiOff,
  Volume2,
  VolumeX,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface GhostModeProps {
  onClose: () => void;
  onCommand: (command: string) => void;
  personality?: AssistantPersonality;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'processing' | 'speaking' | 'error';

export function GhostMode({ onClose, onCommand, personality = 'balanced' }: GhostModeProps) {
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<string>('');

  // TTS hook for AI voice output
  const { speak, stop: stopSpeaking, isLoading: isTTSLoading } = useTextToSpeech();

  // Gemini Live hook for AI responses
  const { isProcessing, sendText } = useGeminiLive({
    personality,
    onResponse: async (text) => {
      setAiResponse(text);
      setConnectionStatus('speaking');
      
      // Speak the response if not muted
      if (!isMuted) {
        await speak(text, personality);
      }
      
      // Also send to parent for any task/event processing
      onCommand(text);
      
      setConnectionStatus('connected');
    },
    onError: (error) => {
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: error,
      });
      setConnectionStatus('connected');
    },
  });

  const handleTranscript = useCallback((transcript: string, isFinal: boolean) => {
    setDisplayTranscript(transcript);
    
    // Clear any existing silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    if (isFinal && transcript.trim() && transcript.trim() !== lastProcessedRef.current) {
      lastProcessedRef.current = transcript.trim();
      setConnectionStatus('processing');
      sendText(transcript.trim());
    } else if (transcript.trim()) {
      // Set a timeout to send after silence
      silenceTimeoutRef.current = setTimeout(() => {
        if (transcript.trim() && transcript.trim() !== lastProcessedRef.current) {
          lastProcessedRef.current = transcript.trim();
          setConnectionStatus('processing');
          sendText(transcript.trim());
        }
      }, 2000);
    }
  }, [sendText]);

  const handleVoiceError = useCallback((error: string) => {
    setConnectionStatus('error');
    toast({
      variant: 'destructive',
      title: 'Voice Recognition Error',
      description: error,
    });
  }, [toast]);

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
  } = useVoiceRecognition({
    onTranscript: handleTranscript,
    onError: handleVoiceError,
    continuous: true,
  });

  // Update connection status based on state
  useEffect(() => {
    if (isProcessing) {
      setConnectionStatus('processing');
    } else if (isListening && connectionStatus !== 'speaking') {
      setConnectionStatus('connected');
    }
  }, [isListening, isProcessing, connectionStatus]);

  const handleStartListening = useCallback(() => {
    if (!isSupported) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser. Try Chrome or Edge.',
      });
      return;
    }

    setConnectionStatus('connecting');
    setDisplayTranscript('');
    setAiResponse('');
    lastProcessedRef.current = '';
    
    setTimeout(() => {
      startListening();
      setConnectionStatus('connected');
    }, 500);
  }, [isSupported, startListening, toast]);

  const handleStopListening = useCallback(() => {
    stopListening();
    stopSpeaking();
    setConnectionStatus('disconnected');
    setDisplayTranscript('');
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  }, [stopListening, stopSpeaking]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  const statusConfig = {
    connecting: { color: 'text-warning', icon: Wifi, label: 'Connecting...', animate: true },
    connected: { color: 'text-success', icon: Wifi, label: 'Listening', animate: false },
    processing: { color: 'text-ghost-primary', icon: Loader2, label: 'Thinking...', animate: true },
    speaking: { color: 'text-purple-400', icon: Volume2, label: 'Speaking', animate: true },
    disconnected: { color: 'text-muted-foreground', icon: WifiOff, label: 'Disconnected', animate: false },
    error: { color: 'text-destructive', icon: AlertCircle, label: 'Error', animate: false },
  };

  const currentStatus = statusConfig[connectionStatus];
  const StatusIcon = currentStatus.icon;

  const isSpeaking = connectionStatus === 'speaking' || isTTSLoading;

  return (
    <div className="fixed inset-0 ghost-gradient z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-sm",
            currentStatus.color
          )}>
            <StatusIcon className={cn("w-4 h-4", currentStatus.animate && "animate-pulse")} />
            <span className="font-mono text-xs">{currentStatus.label}</span>
          </div>
          
          {!isSupported && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-warning text-sm">
              <AlertCircle className="w-4 h-4" />
              <span className="font-mono text-xs">Use Chrome/Edge</span>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-6 h-6" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Visualizer */}
        <div className="w-80 h-80 mb-8">
          <AudioVisualizer 
            isActive={isListening || isProcessing || isSpeaking}
            isSpeaking={isSpeaking}
            isListening={isListening && !isProcessing && !isSpeaking}
          />
        </div>

        {/* Transcript / Response */}
        <div className="h-32 flex flex-col items-center justify-center gap-2 max-w-2xl">
          {displayTranscript && connectionStatus !== 'speaking' ? (
            <p className="text-2xl md:text-3xl font-light text-center text-foreground/90 animate-fade-in">
              "{displayTranscript}"
            </p>
          ) : aiResponse && (connectionStatus === 'speaking' || connectionStatus === 'connected') ? (
            <p className="text-xl md:text-2xl font-light text-center text-purple-300 animate-fade-in">
              {aiResponse}
            </p>
          ) : isProcessing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-ghost-primary" />
              <p className="text-lg text-ghost-primary">
                Processing...
              </p>
            </div>
          ) : isListening ? (
            <p className="text-lg text-muted-foreground">
              Listening... say something
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">
              Tap the microphone to start
            </p>
          )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsMuted(!isMuted);
            if (!isMuted) stopSpeaking();
          }}
          className={cn(
            "rounded-full w-12 h-12",
            isMuted ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>

        <Button
          variant={isListening ? "ghost" : "default"}
          size="icon"
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={(!isSupported && !isListening) || isProcessing}
          className={cn(
            "rounded-full w-20 h-20 transition-all",
            isListening && "bg-ghost-primary/20 border-2 border-ghost-primary animate-pulse",
            !isListening && "bg-ghost-primary hover:bg-ghost-primary/90"
          )}
        >
          {isListening ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>

        <div className="w-12" /> {/* Spacer for symmetry */}
      </footer>

      {/* Keyboard shortcut hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <span className="text-xs text-muted-foreground/50 font-mono">
          Press ESC to exit
        </span>
      </div>
    </div>
  );
}
