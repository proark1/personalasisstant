import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useWebRTCCall, CallType } from '@/hooks/useWebRTCCall';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { CallDialog } from './CallDialog';
import { useToast } from '@/hooks/use-toast';

interface CallSession {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  call_type: CallType;
  started_at: string | null;
  ended_at: string | null;
}

interface CallContextType {
  startVideoCall: (calleeId: string) => Promise<void>;
  startAudioCall: (calleeId: string) => Promise<void>;
  isOnline: (userId: string) => boolean;
  callStatus: string;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

interface CallProviderProps {
  userId: string;
  children: ReactNode;
}

export function CallProvider({ userId, children }: CallProviderProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [incomingCallerName, setIncomingCallerName] = useState('');
  const [pendingSession, setPendingSession] = useState<CallSession | null>(null);

  const handleIncomingCall = useCallback((session: CallSession, callerName: string) => {
    console.log('Incoming call from:', callerName);
    setIncomingCallerName(callerName);
    setPendingSession(session);
    setIsDialogOpen(true);
    
    toast({
      title: 'Incoming Call',
      description: `${callerName} is calling you`,
    });
  }, [toast]);

  const {
    callStatus,
    callType,
    currentSession,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTCCall({
    userId,
    onIncomingCall: handleIncomingCall,
  });

  const { isOnline } = useOnlinePresence(userId);

  const startVideoCall = useCallback(async (calleeId: string) => {
    try {
      await startCall(calleeId, 'video');
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Failed to start video call:', error);
      toast({
        title: 'Call Failed',
        description: 'Could not start the video call.',
        variant: 'destructive',
      });
    }
  }, [startCall, toast]);

  const startAudioCall = useCallback(async (calleeId: string) => {
    try {
      await startCall(calleeId, 'audio');
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Failed to start audio call:', error);
      toast({
        title: 'Call Failed',
        description: 'Could not start the audio call.',
        variant: 'destructive',
      });
    }
  }, [startCall, toast]);

  const handleAnswer = useCallback(async () => {
    if (pendingSession) {
      await answerCall(pendingSession);
      setPendingSession(null);
    }
  }, [pendingSession, answerCall]);

  const handleDecline = useCallback(async () => {
    if (pendingSession) {
      await declineCall(pendingSession);
      setPendingSession(null);
      setIsDialogOpen(false);
    }
  }, [pendingSession, declineCall]);

  const handleEndCall = useCallback(async () => {
    await endCall();
    setIsDialogOpen(false);
    setPendingSession(null);
  }, [endCall]);

  const callerName = pendingSession ? incomingCallerName : 'Calling...';

  return (
    <CallContext.Provider value={{ startVideoCall, startAudioCall, isOnline, callStatus }}>
      {children}
      
      <CallDialog
        isOpen={isDialogOpen}
        callStatus={callStatus}
        callType={callType}
        callerName={callerName}
        localStream={localStream}
        remoteStream={remoteStream}
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        onAnswer={handleAnswer}
        onDecline={handleDecline}
        onEndCall={handleEndCall}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
      />
    </CallContext.Provider>
  );
}
