import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useOpenAIRealtime } from '@/hooks/useOpenAIRealtime';
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
  Loader2,
  Phone,
  PhoneOff
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
  const aiResponseRef = useRef('');

  // Get current user
  const { user } = useAuth();
  const userId = user?.id;

  // Fetch user profile for personalized AI responses
  const { profile } = useUserProfile();
  
  // Fetch real data from the platform
  const { tasks, events, addTask, updateTask, trashTask, toggleTaskComplete, refetch } = useDatabase(userId);
  const { contacts } = useContacts(userId);
  const { contracts } = useContracts(userId);

  // Prepare context data for the AI
  const contextData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Filter tasks
    const pendingTasks = tasks.filter(t => !t.completed && !t.trashed);
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

    // All tasks for voice command matching (include id)
    const allTasks = tasks.filter(t => !t.trashed).map(t => ({
      id: t.id,
      title: t.title,
      category: String(t.category),
      priority: String(t.priority),
      dueDate: t.dueDate?.toISOString() || null,
      completed: t.completed,
    }));

    return {
      allTasks,
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
      // ALL contacts for AI searching
      allContacts: contacts.slice(0, 100).map(c => ({
        name: c.name,
        company: c.company || null,
        role: c.role || null,
        city: c.city || null,
        country: c.country || null,
        contactType: c.contactType,
        personalTier: c.personalTier || null,
        businessLevel: c.businessLevel || null,
        notes: c.notes || null,
        tags: c.tags || [],
        phone: c.phone || null,
        email: c.email || null,
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

  // OpenAI Realtime hook
  const {
    isConnected,
    isListening,
    isSpeaking,
    connect,
    disconnect,
  } = useOpenAIRealtime({
    userProfile: profile,
    contextData,
    onTranscript: (text, isFinal) => {
      setDisplayTranscript(text);
      if (isFinal) {
        // Clear after a moment
        setTimeout(() => setDisplayTranscript(''), 3000);
      }
    },
    onResponse: (text) => {
      // Accumulate response text
      aiResponseRef.current += text;
      setAiResponse(aiResponseRef.current);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Voice Error',
        description: error,
      });
      setConnectionStatus('error');
      setTimeout(() => setConnectionStatus('disconnected'), 2000);
    },
    onConnectionChange: (status) => {
      setConnectionStatus(status);
      if (status === 'connected') {
        aiResponseRef.current = '';
        setAiResponse('');
        setDisplayTranscript('');
      }
    },
    onSpeakingChange: (speaking) => {
      if (speaking) {
        setConnectionStatus('speaking');
      } else if (isConnected) {
        setConnectionStatus('connected');
        // Clear AI response after speaking ends
        setTimeout(() => {
          aiResponseRef.current = '';
          setAiResponse('');
        }, 2000);
      }
    },
    // Pass task operations
    addTask,
    updateTask,
    trashTask,
    toggleTaskComplete,
    refetch,
  });

  // Update connection status based on state
  useEffect(() => {
    if (isSpeaking) {
      setConnectionStatus('speaking');
    } else if (isListening && isConnected) {
      setConnectionStatus('connected');
    }
  }, [isListening, isSpeaking, isConnected]);

  const handleStartSession = useCallback(async () => {
    setConnectionStatus('connecting');
    aiResponseRef.current = '';
    setAiResponse('');
    setDisplayTranscript('');
    await connect();
  }, [connect]);

  const handleEndSession = useCallback(() => {
    disconnect();
    setConnectionStatus('disconnected');
  }, [disconnect]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleEndSession();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleEndSession]);

  // Auto-start session when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      handleStartSession();
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const statusConfig = {
    connecting: { color: 'text-warning', icon: Loader2, label: 'Connecting...', animate: true },
    connected: { color: 'text-success', icon: Wifi, label: 'Listening', animate: false },
    processing: { color: 'text-ghost-primary', icon: Loader2, label: 'Thinking...', animate: true },
    speaking: { color: 'text-purple-400', icon: Volume2, label: 'Speaking', animate: true },
    disconnected: { color: 'text-muted-foreground', icon: WifiOff, label: 'Disconnected', animate: false },
    error: { color: 'text-destructive', icon: AlertCircle, label: 'Error', animate: false },
  };

  const currentStatus = statusConfig[connectionStatus];
  const StatusIcon = currentStatus.icon;

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
          
          <div className="px-3 py-1.5 rounded-full glass-panel text-sm text-ghost-primary">
            <span className="font-mono text-xs">OpenAI Realtime</span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            handleEndSession();
            onClose();
          }}
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
            isActive={isConnected || connectionStatus === 'connecting'}
            isSpeaking={isSpeaking}
            isListening={isListening && !isSpeaking}
          />
        </div>

        {/* Transcript / Response */}
        <div className="h-32 flex flex-col items-center justify-center gap-2 max-w-2xl">
          {displayTranscript && !isSpeaking ? (
            <p className="text-2xl md:text-3xl font-light text-center text-foreground/90 animate-fade-in">
              "{displayTranscript}"
            </p>
          ) : aiResponse && isSpeaking ? (
            <p className="text-xl md:text-2xl font-light text-center text-purple-300 animate-fade-in">
              {aiResponse}
            </p>
          ) : connectionStatus === 'connecting' ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-ghost-primary" />
              <p className="text-lg text-ghost-primary">
                Connecting to AI...
              </p>
            </div>
          ) : isListening && !isSpeaking ? (
            <p className="text-lg text-muted-foreground">
              Listening... say something
            </p>
          ) : isSpeaking ? (
            <p className="text-lg text-purple-300">
              AI is speaking...
            </p>
          ) : connectionStatus === 'disconnected' ? (
            <p className="text-lg text-muted-foreground">
              Press the button to start
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">
              Ready to assist
            </p>
          )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center gap-4">
        {/* Speaker Mute */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "rounded-full w-12 h-12",
            isMuted ? "text-destructive" : "text-muted-foreground"
          )}
          title={isMuted ? "Unmute speaker" : "Mute speaker"}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Button>

        {/* Main Action Button */}
        {!isConnected ? (
          <Button
            onClick={handleStartSession}
            disabled={connectionStatus === 'connecting'}
            className={cn(
              "rounded-full w-20 h-20 bg-ghost-primary hover:bg-ghost-primary/80",
              connectionStatus === 'connecting' && "opacity-50"
            )}
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              <Phone className="w-10 h-10" />
            )}
          </Button>
        ) : (
          <Button
            onClick={handleEndSession}
            className="rounded-full w-20 h-20 bg-destructive hover:bg-destructive/80"
          >
            <PhoneOff className="w-10 h-10" />
          </Button>
        )}

        {/* Mic indicator */}
        <div className={cn(
          "rounded-full w-12 h-12 flex items-center justify-center",
          isListening && !isSpeaking ? "text-success" : "text-muted-foreground"
        )}>
          {isListening && !isSpeaking ? (
            <Mic className="w-6 h-6 animate-pulse" />
          ) : (
            <MicOff className="w-6 h-6" />
          )}
        </div>
      </footer>
    </div>
  );
}
