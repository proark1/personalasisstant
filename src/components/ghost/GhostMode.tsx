import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { 
  Mic, 
  MicOff, 
  X, 
  Wifi, 
  WifiOff,
  Volume2,
  VolumeX
} from 'lucide-react';

interface GhostModeProps {
  onClose: () => void;
  onCommand: (command: string) => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function GhostMode({ onClose, onCommand }: GhostModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Simulate connection and voice interaction
  const startListening = useCallback(() => {
    setConnectionStatus('connecting');
    
    // Simulate connection delay
    setTimeout(() => {
      setConnectionStatus('connected');
      setIsListening(true);
    }, 1000);
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setConnectionStatus('disconnected');
    setTranscript('');
  }, []);

  // Simulate voice activity for demo
  useEffect(() => {
    if (!isListening) return;

    const phrases = [
      "Add a task to review the quarterly report...",
      "Schedule a meeting with the design team for next Tuesday at 2 PM...",
      "What's on my agenda for today?",
      "Remind me to call Alex tomorrow morning...",
    ];

    let currentPhrase = 0;
    let charIndex = 0;

    const typeInterval = setInterval(() => {
      if (charIndex < phrases[currentPhrase].length) {
        setTranscript(phrases[currentPhrase].substring(0, charIndex + 1));
        charIndex++;
      } else {
        // Simulate AI response
        setIsListening(false);
        setIsSpeaking(true);
        
        setTimeout(() => {
          setIsSpeaking(false);
          setIsListening(true);
          currentPhrase = (currentPhrase + 1) % phrases.length;
          charIndex = 0;
          setTranscript('');
        }, 3000);
      }
    }, 80);

    return () => clearInterval(typeInterval);
  }, [isListening]);

  const statusColors = {
    connecting: 'text-warning',
    connected: 'text-success',
    disconnected: 'text-muted-foreground',
    error: 'text-destructive',
  };

  const statusLabels = {
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Connection Error',
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
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="font-mono text-xs">{statusLabels[connectionStatus]}</span>
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
            isActive={isListening || isSpeaking}
            isSpeaking={isSpeaking}
            isListening={isListening}
          />
        </div>

        {/* Transcript */}
        <div className="h-24 flex items-center justify-center">
          {transcript ? (
            <p className="text-2xl md:text-3xl font-light text-center max-w-2xl text-foreground/90 animate-fade-in">
              "{transcript}"
            </p>
          ) : isSpeaking ? (
            <p className="text-lg text-ghost-primary animate-pulse">
              Flux is speaking...
            </p>
          ) : isListening ? (
            <p className="text-lg text-muted-foreground">
              Listening...
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
          onClick={isListening ? stopListening : startListening}
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
