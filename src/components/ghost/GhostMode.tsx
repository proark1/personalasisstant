import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  MicOff, 
  X, 
  Wifi, 
  WifiOff,
  Volume2,
  VolumeX,
  AlertCircle
} from 'lucide-react';

interface GhostModeProps {
  onClose: () => void;
  onCommand: (command: string) => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function GhostMode({ onClose, onCommand }: GhostModeProps) {
  const { toast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [pendingCommand, setPendingCommand] = useState('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTranscript = useCallback((transcript: string, isFinal: boolean) => {
    setDisplayTranscript(transcript);
    
    // Clear any existing silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    if (isFinal && transcript.trim()) {
      setPendingCommand(transcript.trim());
    } else if (transcript.trim()) {
      // Set a timeout to send the command after silence
      silenceTimeoutRef.current = setTimeout(() => {
        if (transcript.trim()) {
          setPendingCommand(transcript.trim());
        }
      }, 1500);
    }
  }, []);

  const handleError = useCallback((error: string) => {
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
    onError: handleError,
    continuous: true,
  });

  // Process pending commands
  useEffect(() => {
    if (pendingCommand) {
      setIsSpeaking(true);
      onCommand(pendingCommand);
      
      // Simulate AI "speaking" response time
      const speakDuration = Math.min(3000, pendingCommand.length * 50);
      setTimeout(() => {
        setIsSpeaking(false);
        setDisplayTranscript('');
        setPendingCommand('');
      }, speakDuration);
    }
  }, [pendingCommand, onCommand]);

  // Update connection status based on listening state
  useEffect(() => {
    if (isListening) {
      setConnectionStatus('connected');
    } else if (connectionStatus === 'connected') {
      setConnectionStatus('disconnected');
    }
  }, [isListening, connectionStatus]);

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
    setTimeout(() => {
      startListening();
    }, 500);
  }, [isSupported, startListening, toast]);

  const handleStopListening = useCallback(() => {
    stopListening();
    setConnectionStatus('disconnected');
    setDisplayTranscript('');
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  }, [stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      stopListening();
    };
  }, [stopListening]);

  const statusColors = {
    connecting: 'text-warning',
    connected: 'text-success',
    disconnected: 'text-muted-foreground',
    error: 'text-destructive',
  };

  const statusLabels = {
    connecting: 'Connecting...',
    connected: 'Listening',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  return (
    <div className="fixed inset-0 ghost-gradient z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-sm",
            statusColors[connectionStatus]
          )}>
            {connectionStatus === 'connected' ? (
              <Wifi className="w-4 h-4" />
            ) : connectionStatus === 'connecting' ? (
              <Wifi className="w-4 h-4 animate-pulse" />
            ) : connectionStatus === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="font-mono text-xs">{statusLabels[connectionStatus]}</span>
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
            isActive={isListening || isSpeaking}
            isSpeaking={isSpeaking}
            isListening={isListening}
          />
        </div>

        {/* Transcript */}
        <div className="h-24 flex items-center justify-center">
          {displayTranscript ? (
            <p className="text-2xl md:text-3xl font-light text-center max-w-2xl text-foreground/90 animate-fade-in">
              "{displayTranscript}"
            </p>
          ) : isSpeaking ? (
            <p className="text-lg text-ghost-primary animate-pulse">
              Flux is responding...
            </p>
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
          size="iconLg"
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "rounded-full",
            isMuted ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>

        <Button
          variant={isListening ? "ghost_mode" : "glow"}
          size="xl"
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={!isSupported && !isListening}
          className={cn(
            "rounded-full w-20 h-20",
            isListening && "animate-pulse-glow"
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
