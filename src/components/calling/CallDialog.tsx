import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Circle,
  CircleStop,
  AlertTriangle,
} from "lucide-react";
import type { CallStatus, CallType } from "@/hooks/useWebRTCCall";
import { useCallQuality } from "@/hooks/useCallQuality";
import { useCallRecording } from "@/hooks/useCallRecording";
import { CallQualityIndicator } from "./CallQualityIndicator";
import { InCallChat } from "./InCallChat";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CallDialogProps {
  isOpen: boolean;
  callStatus: CallStatus;
  callType: CallType;
  callerName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isScreenShareSupported: boolean;
  peerConnection: RTCPeerConnection | null;
  sessionId?: string | null;
  userId?: string;
  userName?: string;
  onAnswer: () => void;
  onDecline: () => void;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSwitchToAudioOnly?: () => void;
}

export function CallDialog({
  isOpen,
  callStatus,
  callType,
  callerName,
  localStream,
  remoteStream,
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isScreenShareSupported,
  peerConnection,
  sessionId,
  userId,
  userName,
  onAnswer,
  onDecline,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onSwitchToAudioOnly,
}: CallDialogProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const qualityStats = useCallQuality(peerConnection);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [showFallbackSuggestion, setShowFallbackSuggestion] = useState(false);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);

  // Show fallback suggestion when quality is poor
  useEffect(() => {
    if (
      qualityStats.shouldFallbackToAudio &&
      callType === "video" &&
      !fallbackDismissed &&
      callStatus === "connected"
    ) {
      setShowFallbackSuggestion(true);
    }
  }, [qualityStats.shouldFallbackToAudio, callType, fallbackDismissed, callStatus]);

  const handleAcceptFallback = () => {
    setShowFallbackSuggestion(false);
    setFallbackDismissed(true);
    onSwitchToAudioOnly?.();
  };

  const handleDismissFallback = () => {
    setShowFallbackSuggestion(false);
    setFallbackDismissed(true);
  };

  // Call recording
  const { isRecording, recordingConsent, giveConsent, startRecording, stopRecording } =
    useCallRecording(sessionId ?? null, userId);

  // Handle recording toggle
  const handleRecordingToggle = () => {
    if (isRecording) {
      stopRecording();
    } else if (recordingConsent) {
      startRecording(localStream, remoteStream);
    } else {
      setShowRecordingConsent(true);
    }
  };

  const handleConsentConfirm = () => {
    giveConsent();
    setShowRecordingConsent(false);
    startRecording(localStream, remoteStream);
  };

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video/audio elements
  useEffect(() => {
    if (!remoteStream) return;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      // Some browsers still require an explicit play() call.
      remoteAudioRef.current.play().catch((err) => {
        console.log("Remote audio autoplay blocked or failed:", err);
      });
    }
  }, [remoteStream]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isRinging = callStatus === "ringing";
  const isCalling = callStatus === "calling";
  const isConnected = callStatus === "connected";

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-[600px] md:max-w-[800px] p-0 overflow-hidden bg-background/95 backdrop-blur-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="relative w-full aspect-video bg-muted/50 rounded-t-lg overflow-hidden">
            {/* Remote audio element for voice calls */}
            {callType === "audio" && remoteStream && (
              <audio ref={remoteAudioRef} autoPlay playsInline />
            )}

            {/* Call quality indicator - shown when connected */}
            {isConnected && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <CallQualityIndicator stats={qualityStats} />
                {qualityStats.signalStrength === "poor" && callType === "video" && (
                  <Badge variant="destructive" className="gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    Poor connection
                  </Badge>
                )}
              </div>
            )}

            {/* Debug toggle + panel */}
            {isConnected && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Debug</span>
                <Switch
                  checked={isDebugOpen}
                  onCheckedChange={setIsDebugOpen}
                  aria-label="Toggle call debug stats"
                />
              </div>
            )}

            {isConnected && isDebugOpen && (
              <div className="absolute top-14 right-4 z-10 w-[320px] rounded-lg border border-border bg-background/90 backdrop-blur p-3 shadow-sm">
                <div className="text-xs font-medium">Call Debug</div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <span>PC state</span>
                    <span className="text-foreground">{qualityStats.connectionState}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>ICE state</span>
                    <span className="text-foreground">{qualityStats.iceConnectionState}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Bitrate</span>
                    <span className="text-foreground">{qualityStats.bitrate ?? "—"} kbps</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>RTT</span>
                    <span className="text-foreground">{qualityStats.latency ?? "—"} ms</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Packet loss</span>
                    <span className="text-foreground">{qualityStats.packetLoss ?? "—"}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Jitter</span>
                    <span className="text-foreground">{qualityStats.jitter ?? "—"} ms</span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/60">
                    <div className="text-xs font-medium text-foreground">Selected route</div>
                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between gap-4">
                        <span>Protocol</span>
                        <span className="text-foreground">
                          {qualityStats.selectedCandidatePair?.protocol ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Local</span>
                        <span className="text-foreground">
                          {qualityStats.selectedCandidatePair?.localType ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Remote</span>
                        <span className="text-foreground">
                          {qualityStats.selectedCandidatePair?.remoteType ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* In-Call Chat */}
            {isConnected && sessionId && userId && (
              <InCallChat
                sessionId={sessionId}
                userId={userId}
                userName={userName || "You"}
                isOpen={isChatOpen}
                onToggle={() => setIsChatOpen(!isChatOpen)}
              />
            )}
            {/* Remote video (main view) */}
            {isConnected && remoteStream && callType === "video" ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarFallback className="text-3xl bg-primary/20">
                    {getInitials(callerName)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xl font-medium">{callerName}</p>
                <p className="text-muted-foreground mt-2">
                  {isRinging && "Incoming call..."}
                  {isCalling && (callType === "audio" ? "Connecting voice call…" : "Calling...")}
                  {isConnected &&
                    (callType === "audio" ? "Voice call connected" : "Video call connected")}
                </p>
              </div>
            )}

            {/* Local video (picture-in-picture) */}
            {isConnected && localStream && callType === "video" && !isVideoOff && (
              <div className="absolute bottom-4 right-4 w-32 h-24 md:w-48 md:h-36 rounded-lg overflow-hidden shadow-lg border border-border">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Call controls */}
          <div className="p-6 flex items-center justify-center gap-4">
            {isRinging ? (
              <>
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-14 h-14"
                  onClick={onDecline}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full w-14 h-14 bg-success hover:bg-success/90"
                  onClick={onAnswer}
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </>
            ) : (
              <>
                {/* Audio toggle */}
                <Button
                  size="lg"
                  variant={isAudioMuted ? "destructive" : "secondary"}
                  className="rounded-full w-12 h-12"
                  onClick={onToggleAudio}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>

                {/* Video toggle (only for video calls) */}
                {callType === "video" && (
                  <Button
                    size="lg"
                    variant={isVideoOff ? "destructive" : "secondary"}
                    className="rounded-full w-12 h-12"
                    onClick={onToggleVideo}
                  >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </Button>
                )}

                {/* Screen share toggle - disabled on iOS */}
                <Button
                  size="lg"
                  variant={isScreenSharing ? "default" : "secondary"}
                  className="rounded-full w-12 h-12"
                  onClick={onToggleScreenShare}
                  disabled={!isScreenShareSupported}
                  title={
                    !isScreenShareSupported ? "Screen sharing not available on iOS" : undefined
                  }
                >
                  {isScreenSharing ? (
                    <MonitorOff className="w-5 h-5" />
                  ) : (
                    <Monitor className="w-5 h-5" />
                  )}
                </Button>

                {/* Recording toggle (only when connected) */}
                {isConnected && (
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "secondary"}
                    className="rounded-full w-12 h-12"
                    onClick={handleRecordingToggle}
                    title={isRecording ? "Stop recording" : "Start recording"}
                  >
                    {isRecording ? (
                      <CircleStop className="w-5 h-5" />
                    ) : (
                      <Circle className="w-5 h-5 text-red-500" />
                    )}
                  </Button>
                )}

                {/* End call */}
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-14 h-14"
                  onClick={onEndCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recording Consent Dialog */}
      <AlertDialog open={showRecordingConsent} onOpenChange={setShowRecordingConsent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record this call?</AlertDialogTitle>
            <AlertDialogDescription>
              This will record the audio from both participants. The recording will be saved for
              later playback and troubleshooting. Both parties should consent to being recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConsentConfirm}>Start Recording</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Poor Quality Fallback Suggestion Dialog */}
      <AlertDialog open={showFallbackSuggestion} onOpenChange={setShowFallbackSuggestion}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Poor Video Quality Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your video connection quality is poor. This may be due to network conditions. Would
              you like to switch to audio-only mode for a better experience?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismissFallback}>Keep Video</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptFallback}>
              Switch to Audio Only
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
