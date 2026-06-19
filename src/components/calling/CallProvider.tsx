import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useWebRTCCall, CallType } from "@/hooks/useWebRTCCall";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useCallPushNotifications } from "@/hooks/useCallPushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { CallDialog } from "./CallDialog";
import { useToast } from "@/hooks/use-toast";
import {
  showCallNotification,
  stopRingtone,
  setupServiceWorkerListener,
} from "@/lib/notificationSounds";
import { supabase } from "@/integrations/supabase/client";

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

// eslint-disable-next-line react-refresh/only-export-components
export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}

interface CallProviderProps {
  userId: string;
  userName?: string;
  children: ReactNode;
}

export function CallProvider({ userId, userName, children }: CallProviderProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [incomingCallerName, setIncomingCallerName] = useState("");
  const [pendingSession, setPendingSession] = useState<CallSession | null>(null);
  const isNativePlatform =
    typeof window !== "undefined" &&
    !!(
      window as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.();
  const enableBackgroundCallFeatures = !isMobile || isNativePlatform;

  const handleIncomingCall = useCallback(
    (session: CallSession, callerName: string) => {
      console.log("Incoming call from:", callerName);
      setIncomingCallerName(callerName);
      setPendingSession(session);
      setIsDialogOpen(true);

      // Play ringtone and show desktop/push notification with session ID
      showCallNotification(callerName, session.call_type as "video" | "audio", session.id);

      toast({
        title: "Incoming Call",
        description: `${callerName} is calling you`,
      });
    },
    [toast],
  );

  // Handle push notification incoming calls
  const handlePushIncomingCall = useCallback(
    (callerId: string, callerName: string, sessionId: string) => {
      console.log("[CallProvider] Push notification incoming call:", {
        callerId,
        callerName,
        sessionId,
      });
      // The session will be fetched and handled by the WebRTC hook
      // This is just to bring the app to foreground
      setIsDialogOpen(true);
    },
    [],
  );

  // Initialize push notifications for calls
  useCallPushNotifications({
    userId,
    onIncomingCall: handlePushIncomingCall,
    enabled: enableBackgroundCallFeatures,
  });

  const {
    callStatus,
    callType,
    currentSession,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isScreenShareSupported,
    peerConnection,
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
    enabled: enableBackgroundCallFeatures,
  });

  const { isOnline } = useOnlinePresence(userId, [], enableBackgroundCallFeatures);

  const startVideoCall = useCallback(
    async (calleeId: string) => {
      try {
        await startCall(calleeId, "video");
        setIsDialogOpen(true);

        // Send push notification to callee
        const callerDisplayName = userName || "Someone";
        supabase.functions
          .invoke("call-push-notification", {
            body: {
              callee_id: calleeId,
              caller_id: userId,
              caller_name: callerDisplayName,
              session_id: currentSession?.id,
              call_type: "video",
            },
          })
          .catch((err) => console.log("[CallProvider] Push notification error:", err));
      } catch (error) {
        console.error("Failed to start video call:", error);
        toast({
          title: "Call Failed",
          description: "Could not start the video call.",
          variant: "destructive",
        });
      }
    },
    [startCall, toast, userName, userId, currentSession],
  );

  const startAudioCall = useCallback(
    async (calleeId: string) => {
      try {
        await startCall(calleeId, "audio");
        setIsDialogOpen(true);

        // Send push notification to callee
        const callerDisplayName = userName || "Someone";
        supabase.functions
          .invoke("call-push-notification", {
            body: {
              callee_id: calleeId,
              caller_id: userId,
              caller_name: callerDisplayName,
              session_id: currentSession?.id,
              call_type: "audio",
            },
          })
          .catch((err) => console.log("[CallProvider] Push notification error:", err));
      } catch (error) {
        console.error("Failed to start audio call:", error);
        toast({
          title: "Call Failed",
          description: "Could not start the audio call.",
          variant: "destructive",
        });
      }
    },
    [startCall, toast, userName, userId, currentSession],
  );

  const handleAnswer = useCallback(async () => {
    stopRingtone();
    if (pendingSession) {
      await answerCall(pendingSession);
      setPendingSession(null);
    }
  }, [pendingSession, answerCall]);

  const handleDecline = useCallback(async () => {
    stopRingtone();
    if (pendingSession) {
      await declineCall(pendingSession);
      setPendingSession(null);
      setIsDialogOpen(false);
    }
  }, [pendingSession, declineCall]);

  // Set up service worker message listener for notification actions
  useEffect(() => {
    const cleanup = setupServiceWorkerListener(
      // Handle answer from notification
      () => {
        if (pendingSession) {
          handleAnswer();
        }
      },
      // Handle decline from notification
      () => {
        if (pendingSession) {
          handleDecline();
        }
      },
    );

    return cleanup;
  }, [pendingSession, handleAnswer, handleDecline]);

  const handleEndCall = useCallback(async () => {
    stopRingtone();
    await endCall();
    setIsDialogOpen(false);
    setPendingSession(null);
  }, [endCall]);

  // Handle switch to audio-only when video quality is poor
  const handleSwitchToAudioOnly = useCallback(() => {
    console.log("[CallProvider] Switching to audio-only mode");
    toggleVideo(); // This will turn off video
    toast({
      title: "Switched to Audio Only",
      description: "Video was disabled due to poor connection quality.",
    });
  }, [toggleVideo, toast]);

  const callerName = pendingSession ? incomingCallerName : "Calling...";

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
        isScreenShareSupported={isScreenShareSupported}
        peerConnection={peerConnection}
        sessionId={currentSession?.id || null}
        userId={userId}
        userName={userName}
        onAnswer={handleAnswer}
        onDecline={handleDecline}
        onEndCall={handleEndCall}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onSwitchToAudioOnly={handleSwitchToAudioOnly}
      />
    </CallContext.Provider>
  );
}
