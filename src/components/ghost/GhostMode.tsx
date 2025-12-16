import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useGeminiLive } from '@/hooks/useGeminiLive';
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
  const [aiResponse, setAiResponse] = useState('');

  // Gemini Live hook for native voice AI
  const { 
    isConnected, 
    isProcessing,
    connect, 
    disconnect, 
    startAudioCapture, 
    stopAudioCapture,
  } = useGeminiLive({
    personality,
    onResponse: (text) => {
      setAiResponse(text);
      // Send to parent for any task/event processing
      onCommand(text);
    },
    onError: (error) => {
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: error,
      });
    },
    onSpeakingChange: (speaking) => {
      if (speaking) {
        setConnectionStatus('speaking');
      } else if (isConnected) {
        setConnectionStatus('connected');
      }
    },
    onConnectionChange: (connected) => {
      if (connected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    },
  });

  // Update status based on processing state
  useEffect(() => {
    if (isProcessing) {
      setConnectionStatus('processing');
    }
  }, [isProcessing]);

  const handleStartListening = useCallback(async () => {
    setConnectionStatus('connecting');
    setAiResponse('');
    
    try {
      // Connect to Gemini Live
      connect();
      
      // Start capturing audio
      await startAudioCapture();
    } catch (error) {
      console.error('Error starting:', error);
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Failed to start voice connection. Please try again.',
      });
    }
  }, [connect, startAudioCapture, toast]);

  const handleStopListening = useCallback(() => {
    stopAudioCapture();
    disconnect();
    setConnectionStatus('disconnected');
    setAiResponse('');
  }, [stopAudioCapture, disconnect]);

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
      stopAudioCapture();
      disconnect();
    };
  }, [stopAudioCapture, disconnect]);

  const statusConfig = {
    connecting: { color: 'text-warning', icon: Wifi, label: 'Connecting to Gemini...', animate: true },
    connected: { color: 'text-success', icon: Wifi, label: 'Listening (Native Voice)', animate: false },
    processing: { color: 'text-ghost-primary', icon: Loader2, label: 'Thinking...', animate: true },
    speaking: { color: 'text-purple-400', icon: Volume2, label: 'Speaking', animate: true },
    disconnected: { color: 'text-muted-foreground', icon: WifiOff, label: 'Disconnected', animate: false },
    error: { color: 'text-destructive', icon: AlertCircle, label: 'Error', animate: false },
  };

  const currentStatus = statusConfig[connectionStatus];
  const StatusIcon = currentStatus.icon;
  const isActive = connectionStatus !== 'disconnected' && connectionStatus !== 'error';
  const isSpeaking = connectionStatus === 'speaking';

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
            isActive={isActive}
            isSpeaking={isSpeaking}
            isListening={isConnected && !isProcessing && !isSpeaking}
          />
        </div>

        {/* Response Display */}
        <div className="h-32 flex flex-col items-center justify-center gap-2 max-w-2xl">
          {aiResponse && (connectionStatus === 'speaking' || connectionStatus === 'connected') ? (
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
          ) : isConnected ? (
            <p className="text-lg text-muted-foreground">
              Speak naturally... Gemini is listening
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">
              Tap the microphone to start native voice chat
            </p>
          )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "rounded-full w-12 h-12",
            isMuted ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>

        <Button
          variant={isActive ? "ghost" : "default"}
          size="icon"
          onClick={isActive ? handleStopListening : handleStartListening}
          disabled={connectionStatus === 'connecting'}
          className={cn(
            "rounded-full w-20 h-20 transition-all",
            isActive && "bg-ghost-primary/20 border-2 border-ghost-primary animate-pulse",
            !isActive && "bg-ghost-primary hover:bg-ghost-primary/90"
          )}
        >
          {connectionStatus === 'connecting' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isActive ? (
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
