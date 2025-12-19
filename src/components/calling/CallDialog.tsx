import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import type { CallStatus, CallType } from '@/hooks/useWebRTCCall';
import { useCallQuality } from '@/hooks/useCallQuality';
import { CallQualityIndicator } from './CallQualityIndicator';
import { InCallChat } from './InCallChat';
import { TooltipProvider } from '@/components/ui/tooltip';

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
}: CallDialogProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const qualityStats = useCallQuality(peerConnection);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
        console.log('Remote audio autoplay blocked or failed:', err);
      });
    }
  }, [remoteStream]);

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isRinging = callStatus === 'ringing';
  const isCalling = callStatus === 'calling';
  const isConnected = callStatus === 'connected';

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-[600px] md:max-w-[800px] p-0 overflow-hidden bg-background/95 backdrop-blur-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="relative w-full aspect-video bg-muted/50 rounded-t-lg overflow-hidden">
            {/* Remote audio element for voice calls */}
            {callType === 'audio' && remoteStream && (
              <audio ref={remoteAudioRef} autoPlay playsInline />
            )}

            {/* Call quality indicator - shown when connected */}
            {isConnected && (
              <div className="absolute top-4 left-4 z-10">
                <CallQualityIndicator stats={qualityStats} />
            </div>
          )}
          
          {/* In-Call Chat */}
          {isConnected && sessionId && userId && (
            <InCallChat
              sessionId={sessionId}
              userId={userId}
              userName={userName || 'You'}
              isOpen={isChatOpen}
              onToggle={() => setIsChatOpen(!isChatOpen)}
            />
          )}
          {/* Remote video (main view) */}
          {isConnected && remoteStream && callType === 'video' ? (
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
                {isRinging && 'Incoming call...'}
                {isCalling && (callType === 'audio' ? 'Connecting voice call…' : 'Calling...')}
                {isConnected && (callType === 'audio' ? 'Voice call connected' : 'Video call connected')}
              </p>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {isConnected && localStream && callType === 'video' && !isVideoOff && (
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
                variant={isAudioMuted ? 'destructive' : 'secondary'}
                className="rounded-full w-12 h-12"
                onClick={onToggleAudio}
              >
                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              {/* Video toggle (only for video calls) */}
              {callType === 'video' && (
                <Button
                  size="lg"
                  variant={isVideoOff ? 'destructive' : 'secondary'}
                  className="rounded-full w-12 h-12"
                  onClick={onToggleVideo}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
              )}

              {/* Screen share toggle */}
              <Button
                size="lg"
                variant={isScreenSharing ? 'default' : 'secondary'}
                className="rounded-full w-12 h-12"
                onClick={onToggleScreenShare}
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </Button>

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
    </TooltipProvider>
  );
}
