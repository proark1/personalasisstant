import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AudioVisualizer } from './AudioVisualizer';
import { useOpenAIRealtime } from '@/hooks/useOpenAIRealtime';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useDatabase } from '@/hooks/useDatabase';
import { useContacts } from '@/hooks/useContacts';
import { useContracts } from '@/hooks/useContracts';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAppleHealth } from '@/hooks/useAppleHealth';
import { useHabits } from '@/hooks/useHabits';
import { useNotes } from '@/hooks/useNotes';
import { useDirectMessages } from '@/hooks/useDirectMessages';
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
  PhoneCall,
  PhoneOff,
  Bug,
  MessageSquare,
} from 'lucide-react';

interface GhostModeProps {
  onClose: () => void;
  onCommand: (command: string) => void;
  personality?: AssistantPersonality;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'processing' | 'speaking' | 'error';

// Helper component for debug timing rows
function DebugTimingRow({ 
  label, 
  start, 
  end, 
  baseTime 
}: { 
  label: string; 
  start?: number; 
  end?: number; 
  baseTime?: number; 
}) {
  const formatTime = (time?: number) => {
    if (!time || !baseTime) return '—';
    return `+${((time - baseTime) / 1000).toFixed(2)}s`;
  };
  
  const duration = start && end ? `(${((end - start) / 1000).toFixed(2)}s)` : '';
  
  return (
    <div className="flex justify-between items-center text-muted-foreground">
      <span>{label}</span>
      <span className={start ? 'text-foreground' : ''}>
        {formatTime(end || start)} {duration}
      </span>
    </div>
  );
}

// Helper to get time-based greeting
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning! How can I help you today?";
  if (hour < 17) return "Good afternoon! What can I do for you?";
  if (hour < 21) return "Good evening! How can I assist you?";
  return "Hey there, night owl! What's on your mind?";
}

export function GhostMode({ onClose, onCommand, personality = 'balanced' }: GhostModeProps) {
  const { toast } = useToast();
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [buttonCooldown, setButtonCooldown] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>>([]);
  const aiResponseRef = useRef('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isConnectingRef = useRef(false);
  const disconnectRef = useRef<() => void>(() => {});

  // Get current user
  const { user } = useAuth();
  const userId = user?.id;

  // Fetch user profile for personalized AI responses
  const { profile } = useUserProfile();
  
  // Fetch real data from the platform
  const { tasks, events, addTask, updateTask, trashTask, toggleTaskComplete, addEvent, updateEvent, deleteEvent, refetch } = useDatabase(userId);
  const { contacts, addContact, updateContact, deleteContact, markContacted, refetch: refetchContacts } = useContacts(userId);
  const { contracts, addContract, updateContract, deleteContract, refetch: refetchContracts } = useContracts(userId);
  const { projects, addProject, updateProject, deleteProject, refetch: refetchProjects } = useProjects(userId);
  const { healthMetrics, todaySummary, weeklyData, isConnected: healthConnected, refetch: refetchHealth } = useAppleHealth();
  const { habits, logs: habitLogs, createHabit, logHabit, deleteHabit, refetch: refetchHabits } = useHabits(userId);
  const { notes, createNote, updateNote, deleteNote, refetch: refetchNotes } = useNotes(userId);
  const { sendMessage: sendDirectMessage, conversations, refetch: refetchMessages } = useDirectMessages(userId || null);

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

    // Active projects
    const activeProjects = projects.filter(p => !p.isArchived);

    // All tasks for voice command matching (include id)
    const allTasks = tasks.filter(t => !t.trashed).map(t => ({
      id: t.id,
      title: t.title,
      category: String(t.category),
      priority: String(t.priority),
      dueDate: t.dueDate?.toISOString() || null,
      completed: t.completed,
      projectId: t.projectId || null,
    }));

    // All events for matching
    const allEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      location: e.location || null,
    }));

    // All contacts for matching (include familyRelationship for voice commands like "call my wife")
    const allContacts = contacts.slice(0, 100).map(c => ({
      id: c.id,
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
      nextContactDue: c.nextContactDue?.toISOString() || null,
      lastContactedAt: c.lastContactedAt?.toISOString() || null,
      familyRelationship: c.familyRelationship || null,
    }));

    // All contracts for matching
    const allContracts = activeContracts.map(c => ({
      id: c.id,
      name: c.name,
      provider: c.provider || null,
      category: String(c.category),
      costAmount: c.costAmount || null,
      costFrequency: c.costFrequency || null,
      renewalDate: c.renewalDate?.toISOString() || null,
      autoRenews: c.autoRenews,
      isActive: c.isActive,
      notes: c.notes || null,
    }));

    // All projects for matching
    const allProjects = activeProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      color: p.color,
    }));

    // Health data for AI access
    const healthData = {
      isConnected: healthConnected,
      todaySummary: todaySummary ? {
        date: todaySummary.date,
        steps: todaySummary.steps,
        calories: todaySummary.calories,
        activeMinutes: todaySummary.activeMinutes,
        sleepHours: todaySummary.sleepHours,
        heartRateAvg: todaySummary.heartRateAvg,
        weight: todaySummary.weight,
        waterIntake: todaySummary.waterIntake,
      } : null,
      weeklyData: weeklyData.map(d => ({
        date: d.date,
        steps: d.steps,
        calories: d.calories,
        activeMinutes: d.activeMinutes,
        sleepHours: d.sleepHours,
        heartRateAvg: d.heartRateAvg,
      })),
      recentMetrics: healthMetrics.slice(0, 100).map(m => ({
        type: m.metric_type,
        value: m.value,
        unit: m.unit,
        recordedAt: m.recorded_at,
        source: m.source,
      })),
    };

    // Habit data for AI access
    const habitData = {
      habits: habits.map(h => ({
        id: h.id,
        name: h.name,
        description: h.description,
        icon: h.icon,
        frequency: h.frequency,
        targetCount: h.targetCount,
        isActive: h.isActive,
      })),
      recentLogs: habitLogs.slice(0, 50).map(l => ({
        habitId: l.habitId,
        date: l.logDate.toISOString().split('T')[0],
        completedCount: l.completedCount,
      })),
    };

    // Notes data for AI access
    const notesData = notes.slice(0, 50).map(n => ({
      id: n.id,
      title: n.title,
      contentPreview: n.content.substring(0, 100),
      tags: n.tags,
      isPinned: n.isPinned,
      updatedAt: n.updatedAt.toISOString(),
    }));

    // Conversations data for AI access (who can receive messages)
    const conversationPartners = conversations.map(c => ({
      partnerId: c.partnerId,
      partnerName: c.partnerName,
      partnerEmail: c.partnerEmail,
    }));

    return {
      allTasks,
      allEvents,
      allContacts,
      allContracts,
      allProjects,
      healthData,
      habitData,
      notesData,
      conversationPartners,
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
      totalContracts: activeContracts.length,
      totalProjects: activeProjects.length,
      totalHabits: habits.length,
      totalNotes: notes.length,
    };
  }, [tasks, events, contacts, contracts, projects, healthMetrics, todaySummary, weeklyData, healthConnected, habits, habitLogs, notes, conversations]);

  // OpenAI Realtime hook
  const {
    isConnected,
    isListening,
    isSpeaking,
    connect,
    disconnect,
    setSpeakerMuted: setSpeakerMutedInEngine,
    setMicMuted: setMicMutedInEngine,
    debugTimings,
  } = useOpenAIRealtime({
    userProfile: profile,
    contextData,
    onTranscript: (text, isFinal) => {
      setDisplayTranscript(text);
      // Check for voice commands to end session
      if (isFinal) {
        const lower = text.toLowerCase();
        if (lower.includes('quit') || lower.includes('end session') || lower.includes('goodbye') || lower.includes('stop listening')) {
          handleEndSession();
          onClose();
          return;
        }
        // Add user transcript to history
        if (text.trim()) {
          setTranscriptHistory(prev => [...prev, { role: 'user', text: text.trim(), timestamp: new Date() }]);
        }
        setTimeout(() => setDisplayTranscript(''), 3000);
      }
    },
    onResponse: (text) => {
      aiResponseRef.current += text;
      setAiResponse(aiResponseRef.current);
    },
    onError: (error) => {
      console.error('Voice error:', error);
      toast({
        variant: 'destructive',
        title: 'Voice Error',
        description: error,
        duration: 8000, // Show error longer so user can read it
      });
      setConnectionStatus('error');
      isConnectingRef.current = false;
      setTimeout(() => setConnectionStatus('disconnected'), 4000);
    },
    onConnectionChange: (status) => {
      console.log('Connection status changed:', status);
      setConnectionStatus(status);
      if (status === 'connected') {
        isConnectingRef.current = false;
        aiResponseRef.current = '';
        setDisplayTranscript('');
        // Use time-based greeting
        setAiResponse(getTimeBasedGreeting());
      } else if (status === 'disconnected') {
        isConnectingRef.current = false;
      } else if (status === 'error') {
        isConnectingRef.current = false;
      }
    },
    onSpeakingChange: (speaking) => {
      if (speaking) {
        setConnectionStatus('speaking');
      } else if (isConnected) {
        setConnectionStatus('connected');
        // Add AI response to history when done speaking
        if (aiResponseRef.current.trim()) {
          setTranscriptHistory(prev => [...prev, { role: 'assistant', text: aiResponseRef.current.trim(), timestamp: new Date() }]);
        }
        setTimeout(() => {
          aiResponseRef.current = '';
          setAiResponse('');
        }, 2000);
      }
    },
    // Task operations
    addTask,
    updateTask,
    trashTask,
    toggleTaskComplete,
    // Contact operations
    addContact,
    updateContact,
    deleteContact,
    markContacted,
    // Event operations
    addEvent,
    updateEvent,
    deleteEvent,
    // Contract operations
    addContract,
    updateContract,
    deleteContract,
    // Project operations
    addProject,
    updateProject,
    deleteProject,
    // Refetch functions
    refetch,
    refetchContacts,
    refetchContracts,
    refetchProjects,
    // Note operations
    createNote,
    updateNote,
    deleteNote,
    refetchNotes,
    // Habit operations
    createHabit,
    logHabit,
    deleteHabit,
    refetchHabits,
    // Message operations
    sendDirectMessage,
    refetchMessages,
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
    // Prevent multiple simultaneous connection attempts + cooldown
    if (isConnectingRef.current || isConnected || buttonCooldown) {
      console.log('Already connecting, connected, or in cooldown, skipping...');
      return;
    }

    // Enable cooldown and haptic pulse feedback
    setButtonCooldown(true);
    setButtonPulse(true);
    setTimeout(() => setButtonPulse(false), 200);
    setTimeout(() => setButtonCooldown(false), 2500);
    
    isConnectingRef.current = true;
    setConnectionStatus('connecting');
    aiResponseRef.current = '';
    setAiResponse('');
    setDisplayTranscript('');
    
    try {
      await connect();
    } catch (err) {
      console.error('Failed to start session:', err);
      isConnectingRef.current = false;
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: err instanceof Error ? err.message : 'Failed to connect to voice service',
        duration: 8000,
      });
      setTimeout(() => setConnectionStatus('disconnected'), 4000);
    }
  }, [connect, isConnected, buttonCooldown, toast]);

  const handleEndSession = useCallback(() => {
    isConnectingRef.current = false;
    setButtonCooldown(false);
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

  // Do not auto-start: user initiates the call explicitly via the call button.

  // Keep disconnectRef updated to the latest disconnect function
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // Cleanup on unmount ONLY - empty dependency array prevents premature disconnect
  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []);

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

  // Determine mic button state
  const isMicActive = isListening && !isSpeaking && !micMuted;
  const isSessionActive = isConnected || connectionStatus === 'connecting';

  useEffect(() => {
    setSpeakerMutedInEngine?.(speakerMuted);
  }, [speakerMuted, setSpeakerMutedInEngine]);

  useEffect(() => {
    setMicMutedInEngine?.(micMuted);
  }, [micMuted, setMicMutedInEngine]);

  // Auto-scroll transcript history
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptHistory]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10 z-50 flex flex-col animate-fade-in">
      {/* Close button */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            handleEndSession();
            onClose();
          }}
          className="rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/70 text-foreground/70 hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="absolute top-20 right-6 w-72 glass-panel rounded-lg p-4 text-xs font-mono space-y-2">
          <div className="text-ghost-primary font-semibold mb-2">Voice Debug Timings</div>
          <DebugTimingRow 
            label="Token Fetch" 
            start={debugTimings.tokenFetchStart} 
            end={debugTimings.tokenFetchEnd} 
            baseTime={debugTimings.connectStart} 
          />
          <DebugTimingRow 
            label="Mic Permission" 
            start={debugTimings.micPermissionStart} 
            end={debugTimings.micPermissionEnd} 
            baseTime={debugTimings.connectStart} 
          />
          <DebugTimingRow 
            label="Data Channel Open" 
            start={debugTimings.dataChannelOpen} 
            baseTime={debugTimings.connectStart} 
          />
          <DebugTimingRow 
            label="Remote SDP Set" 
            start={debugTimings.remoteSdpSet} 
            baseTime={debugTimings.connectStart} 
          />
          <DebugTimingRow 
            label="First Audio Received" 
            start={debugTimings.firstAudioReceived} 
            baseTime={debugTimings.connectStart} 
          />
          {debugTimings.connectStart && (
            <div className="pt-2 border-t border-border/50 text-muted-foreground">
              Total elapsed: {debugTimings.remoteSdpSet 
                ? `${((debugTimings.remoteSdpSet - debugTimings.connectStart) / 1000).toFixed(2)}s`
                : '...'
              }
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 pt-20 pb-48 relative overflow-hidden">
        {/* Full-screen ambient visualizer background */}
        <div className="absolute inset-0 pointer-events-none">
          <AudioVisualizer 
            isActive={isConnected || connectionStatus === 'connecting'}
            isSpeaking={isSpeaking}
            isListening={isListening && !isSpeaking}
          />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full">

        {/* Current Transcript / Response */}
        <div className="h-20 flex flex-col items-center justify-center gap-2 max-w-2xl mb-4">
          {displayTranscript && !isSpeaking ? (
            <p className="text-xl md:text-2xl font-light text-center text-foreground/90 animate-fade-in">
              "{displayTranscript}"
            </p>
          ) : aiResponse && isSpeaking ? (
            <p className="text-lg md:text-xl font-light text-center text-purple-300 animate-fade-in">
              {aiResponse}
            </p>
          ) : connectionStatus === 'connecting' ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-ghost-primary" />
              <p className="text-lg text-ghost-primary">
                Connecting to AI...
              </p>
            </div>
          ) : connectionStatus === 'error' ? (
            <p className="text-lg text-destructive">
              Connection failed. Tap mic to retry.
            </p>
          ) : isListening && !isSpeaking ? (
            <p className="text-lg text-muted-foreground">
              Listening... speak now
            </p>
          ) : isSpeaking ? (
            <p className="text-lg text-purple-300">
              AI is speaking...
            </p>
          ) : connectionStatus === 'disconnected' ? (
            <p className="text-lg text-muted-foreground">
              Tap the call button to start
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">
              Ready to assist
            </p>
          )}
        </div>

        {/* Persistent Transcript History */}
        {transcriptHistory.length > 0 && (
          <div className="w-full max-w-xl p-4 max-h-48 overflow-y-auto">
            <div className="space-y-3">
              {transcriptHistory.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 animate-fade-in",
                    item.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {item.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-purple-500/30 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <Volume2 className="w-3 h-3 text-purple-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] px-3 py-1.5 rounded-lg text-sm backdrop-blur-md",
                      item.role === 'user'
                        ? "bg-background/70 dark:bg-background/50 text-foreground"
                        : "bg-purple-500/20 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{item.text}</p>
                  </div>
                  {item.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-primary/30 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <Mic className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-4">
        {/* Text input when in text mode */}
        {textMode && isSessionActive && (
          <div className="w-full max-w-md flex gap-2 px-4">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.trim()) {
                  onCommand(textInput.trim());
                  setTextInput('');
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 rounded-full bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={() => {
                if (textInput.trim()) {
                  onCommand(textInput.trim());
                  setTextInput('');
                }
              }}
              disabled={!textInput.trim()}
              className="rounded-full w-12 h-12"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* Left: Speaker mute */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSpeakerMuted((v) => !v)}
            className={cn(
              "rounded-full w-14 h-14 transition-all",
              speakerMuted
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            title={speakerMuted ? "Unmute speaker" : "Mute speaker"}
          >
            {speakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Button>

          {/* Center: Call / Hang up */}
          <Button
            onClick={isSessionActive ? handleEndSession : handleStartSession}
            disabled={connectionStatus === 'connecting' || buttonCooldown}
            className={cn(
              "rounded-full w-24 h-24 transition-all shadow-lg",
              connectionStatus === 'connecting' && "opacity-70 cursor-wait",
              buttonCooldown && !isSessionActive && "opacity-50 cursor-not-allowed",
              buttonPulse && "scale-95",
              isSessionActive ? "bg-ghost-primary hover:bg-ghost-primary/80" : "bg-muted hover:bg-muted/80"
            )}
            style={{
              transition: buttonPulse ? 'transform 100ms ease-out' : 'transform 200ms ease-out, opacity 200ms',
            }}
            title={isSessionActive ? "End call" : buttonCooldown ? "Please wait..." : "Call assistant"}
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 className="w-12 h-12 animate-spin text-white" />
            ) : isSessionActive ? (
              <PhoneOff className="w-12 h-12 text-white" />
            ) : (
              <PhoneCall className="w-12 h-12 text-foreground/70" />
            )}
          </Button>

          {/* Right: Mic mute / Text mode toggle */}
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMicMuted((v) => !v)}
              disabled={!isSessionActive || textMode}
              className={cn(
                "rounded-full w-14 h-14 transition-all",
                (!isSessionActive || textMode) && "opacity-40",
                micMuted
                  ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                  : "bg-success/20 text-success hover:bg-success/30"
              )}
              title={micMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Text mode toggle */}
        {isSessionActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTextMode((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {textMode ? "Switch to Voice" : "Switch to Text"}
          </Button>
        )}
      </footer>
    </div>
  );
}
