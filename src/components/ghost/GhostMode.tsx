import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDatabase } from '@/hooks/useDatabase';
import { useContacts } from '@/hooks/useContacts';
import { useContracts } from '@/hooks/useContracts';
import { useAuth } from '@/hooks/useAuth';
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

  // Get current user
  const { user } = useAuth();
  const userId = user?.id;

  // Fetch user profile for personalized AI responses
  const { profile } = useUserProfile();
  
  // Fetch real data from the platform
  const { tasks, events } = useDatabase(userId);
  const { contacts } = useContacts(userId);
  const { contracts } = useContracts(userId);

  // Prepare context data for the AI - convert Date objects to strings for serialization
  const contextData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Filter tasks
    const pendingTasks = tasks.filter(t => !t.completed);
    const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < now);
    const todayTasks = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate.toISOString().split('T')[0] === todayStr;
    });
    const upcomingTasks = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate > now && t.dueDate <= nextWeek;
    });

    // Filter events for next 7 days
    const upcomingEvents = events.filter(e => {
      return e.startTime >= now && e.startTime <= nextWeek;
    }).slice(0, 10);

    // Get key contacts (due for follow-up or recently added)
    const contactsDue = contacts.filter(c => 
      c.nextContactDue && c.nextContactDue <= now
    ).slice(0, 5);

    // Get active contracts with upcoming renewals
    const activeContracts = contracts.filter(c => c.isActive);
    const contractsWithRenewals = activeContracts.filter(c => {
      if (!c.renewalDate) return false;
      return c.renewalDate <= nextWeek;
    }).slice(0, 5);

    return {
      overdueTasks: overdueTasks.slice(0, 5).map(t => ({
        title: t.title,
        category: String(t.category),
        priority: String(t.priority),
        dueDate: t.dueDate?.toISOString() || null
      })),
      todayTasks: todayTasks.slice(0, 5).map(t => ({
        title: t.title,
        category: String(t.category),
        priority: String(t.priority),
        dueDate: t.dueDate?.toISOString() || null
      })),
      upcomingTasks: upcomingTasks.slice(0, 5).map(t => ({
        title: t.title,
        category: String(t.category),
        priority: String(t.priority),
        dueDate: t.dueDate?.toISOString() || null
      })),
      upcomingEvents: upcomingEvents.map(e => ({
        title: e.title,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        location: e.location || null,
        category: e.category || null
      })),
      contactsDue: contactsDue.map(c => ({
        name: c.name,
        company: c.company || null,
        role: c.role || null,
        nextContactDue: c.nextContactDue?.toISOString() || null
      })),
      contractsWithRenewals: contractsWithRenewals.map(c => ({
        name: c.name,
        category: String(c.category),
        renewalDate: c.renewalDate?.toISOString() || null,
        costAmount: c.costAmount || null,
        costFrequency: c.costFrequency || null
      })),
      totalPendingTasks: pendingTasks.length,
      totalOverdue: overdueTasks.length,
      totalEvents: events.length,
      totalContacts: contacts.length,
      totalContracts: activeContracts.length
    };
  }, [tasks, events, contacts, contracts]);

  // Voice recognition with pause/resume capability
  const {
    isListening,
    isSupported,
    isPaused,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
  } = useVoiceRecognition({
    onTranscript: handleTranscript,
    onError: handleVoiceError,
    continuous: true,
  });

  // TTS hook - pause recognition when speaking to prevent echo
  const { speak, stop: stopSpeaking, isSpeaking, isLoading: isTTSLoading } = useTextToSpeech({
    onStart: () => {
      pauseListening();
    },
    onEnd: () => {
      setConnectionStatus('connected');
      setTimeout(() => {
        resumeListening();
      }, 300);
    }
  });

  // Gemini Live hook for AI responses with full context
  const { isProcessing, sendText } = useGeminiLive({
    personality,
    userProfile: profile,
    contextData,
    onResponse: async (text) => {
      setAiResponse(text);
      setConnectionStatus('speaking');
      
      if (!isMuted) {
        await speak(text, personality);
      } else {
        setConnectionStatus('connected');
      }
    },
    onError: (error) => {
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: error,
      });
      setTimeout(() => setConnectionStatus('connected'), 2000);
    },
  });

  function handleTranscript(transcript: string, isFinal: boolean) {
    if (isPaused) return;
    
    setDisplayTranscript(transcript);
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    if (isFinal && transcript.trim() && transcript.trim() !== lastProcessedRef.current) {
      lastProcessedRef.current = transcript.trim();
      setConnectionStatus('processing');
      sendText(transcript.trim());
    } else if (transcript.trim()) {
      silenceTimeoutRef.current = setTimeout(() => {
        if (transcript.trim() && transcript.trim() !== lastProcessedRef.current) {
          lastProcessedRef.current = transcript.trim();
          setConnectionStatus('processing');
          sendText(transcript.trim());
        }
      }, 2000);
    }
  }

  function handleVoiceError(error: string) {
    setConnectionStatus('error');
    toast({
      variant: 'destructive',
      title: 'Voice Recognition Error',
      description: error,
    });
  }

  useEffect(() => {
    if (isProcessing) {
      setConnectionStatus('processing');
    } else if (isSpeaking || isTTSLoading) {
      setConnectionStatus('speaking');
    } else if (isListening && !isPaused) {
      setConnectionStatus('connected');
    }
  }, [isListening, isProcessing, isSpeaking, isTTSLoading, isPaused]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    speaking: { color: 'text-purple-400', icon: Volume2, label: 'Speaking (mic paused)', animate: true },
    disconnected: { color: 'text-muted-foreground', icon: WifiOff, label: 'Disconnected', animate: false },
    error: { color: 'text-destructive', icon: AlertCircle, label: 'Error', animate: false },
  };

  const currentStatus = statusConfig[connectionStatus];
  const StatusIcon = currentStatus.icon;

  const isCurrentlySpeaking = connectionStatus === 'speaking' || isTTSLoading || isSpeaking;

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
            isActive={isListening || isProcessing || isCurrentlySpeaking}
            isSpeaking={isCurrentlySpeaking}
            isListening={isListening && !isProcessing && !isCurrentlySpeaking && !isPaused}
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
                Processing with Gemini...
              </p>
            </div>
          ) : isListening && !isPaused ? (
            <p className="text-lg text-muted-foreground">
              Listening... say something
            </p>
          ) : isPaused ? (
            <p className="text-lg text-purple-300">
              AI is speaking...
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
