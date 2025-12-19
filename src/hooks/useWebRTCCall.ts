import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'video' | 'audio';

interface CallSession {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  call_type: CallType;
  started_at: string | null;
  ended_at: string | null;
}

interface UseWebRTCCallOptions {
  userId: string;
  onIncomingCall?: (session: CallSession, callerName: string) => void;
}

export function useWebRTCCall({ userId, onIncomingCall }: UseWebRTCCallOptions) {
  const { toast } = useToast();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callType, setCallType] = useState<CallType>('video');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const originalVideoTrack = useRef<MediaStreamTrack | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Signaling readiness + early ICE candidate queue (prevents race before channel SUBSCRIBED)
  const isSignalingReadyRef = useRef(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // ICE servers configuration
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Initialize media stream
  const initializeMedia = useCallback(async (type: CallType) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Camera/Microphone Error',
        description: 'Could not access your camera or microphone. Please check permissions.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  // Create peer connection
  const createPeerConnection = useCallback((_sessionId: string) => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      const candidate = event.candidate.toJSON();

      if (!channelRef.current) {
        console.log('[webrtc] ICE candidate generated before channel exists');
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      if (!isSignalingReadyRef.current) {
        console.log('[webrtc] queueing ICE candidate (channel not subscribed yet)');
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'ice-candidate',
        payload: {
          candidate,
          from: userId,
        },
      });
    };


    pc.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [userId]);

  // Start a call
  const startCall = useCallback(async (calleeId: string, type: CallType = 'video') => {
    try {
      setCallType(type);
      setCallStatus('calling');

      // Create call session in database
      const { data: session, error } = await supabase
        .from('call_sessions')
        .insert({
          caller_id: userId,
          callee_id: calleeId,
          call_type: type,
          status: 'ringing',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSession({
        ...session,
        call_type: session.call_type as CallType,
      });

      // Initialize local media
      const stream = await initializeMedia(type);

       // Set up signaling channel FIRST (needed for early ICE candidates)
       const channel = supabase.channel(`call-signaling-${session.id}`);
       channelRef.current = channel;
       isSignalingReadyRef.current = false;
       pendingIceCandidatesRef.current = [];

       // Create peer connection
       const pc = createPeerConnection(session.id);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[webrtc] adding local track', track.kind);
        pc.addTrack(track, stream);
      });


      // Store offer for resending
      let currentOffer: RTCSessionDescriptionInit | null = null;

      channel
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.from !== userId && payload.sdp) {
            console.log('Received answer');
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.from !== userId && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          }
        })
        .on('broadcast', { event: 'call-declined' }, () => {
          toast({
            title: 'Call Declined',
            description: 'The other user declined the call.',
          });
          endCall();
        })
        .on('broadcast', { event: 'request-offer' }, async ({ payload }) => {
          if (payload.from !== userId && currentOffer) {
            console.log('Resending offer upon request');
            channel.send({
              type: 'broadcast',
              event: 'offer',
              payload: {
                sdp: currentOffer,
                from: userId,
                callType: type,
              },
            });
          }
        })
         .subscribe(async (status) => {
           if (status === 'SUBSCRIBED') {
             isSignalingReadyRef.current = true;

             // Flush any queued ICE candidates gathered before subscription finished
             if (pendingIceCandidatesRef.current.length) {
               console.log('[webrtc] flushing queued ICE candidates:', pendingIceCandidatesRef.current.length);
               for (const candidate of pendingIceCandidatesRef.current) {
                 channel.send({
                   type: 'broadcast',
                   event: 'ice-candidate',
                   payload: { candidate, from: userId },
                 });
               }
               pendingIceCandidatesRef.current = [];
             }

             // Create and send offer after subscription is confirmed
             const offer = await pc.createOffer();
             await pc.setLocalDescription(offer);
             currentOffer = offer;

             console.log('Sending initial offer');
             channel.send({
               type: 'broadcast',
               event: 'offer',
               payload: {
                 sdp: offer,
                 from: userId,
                 callType: type,
               },
             });
           }
         });

      return session;
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [userId, initializeMedia, createPeerConnection, toast]);

  // Answer a call
  const answerCall = useCallback(async (session: CallSession) => {
    try {
      setCallStatus('connected');
      setCurrentSession(session);
      setCallType(session.call_type);

      // Initialize local media
      const stream = await initializeMedia(session.call_type);

       // Set up signaling channel FIRST (needed for early ICE candidates)
       const channel = supabase.channel(`call-signaling-${session.id}`);
       channelRef.current = channel;
       isSignalingReadyRef.current = false;
       pendingIceCandidatesRef.current = [];

       // Create peer connection
       const pc = createPeerConnection(session.id);

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        console.log('[webrtc] adding local track', track.kind);
        pc.addTrack(track, stream);
      });


      // Store reference to handle offer
      let hasReceivedOffer = false;

      const handleOffer = async (payload: any) => {
        if (payload.from !== userId && payload.sdp && !hasReceivedOffer) {
          hasReceivedOffer = true;
          console.log('Received offer, creating answer');
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              sdp: answer,
              from: userId,
            },
          });
        }
      };

      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          await handleOffer(payload);
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          if (payload.from !== userId && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          }
        })
         .subscribe(async (status) => {
           if (status === 'SUBSCRIBED') {
             isSignalingReadyRef.current = true;

             // Flush any queued ICE candidates gathered before subscription finished
             if (pendingIceCandidatesRef.current.length) {
               console.log('[webrtc] flushing queued ICE candidates:', pendingIceCandidatesRef.current.length);
               for (const candidate of pendingIceCandidatesRef.current) {
                 channel.send({
                   type: 'broadcast',
                   event: 'ice-candidate',
                   payload: { candidate, from: userId },
                 });
               }
               pendingIceCandidatesRef.current = [];
             }

             console.log('Callee subscribed to signaling channel, requesting offer');
             // Request the caller to resend the offer
             channel.send({
               type: 'broadcast',
               event: 'request-offer',
               payload: { from: userId },
             });
           }
         });

      // Update session status
      await supabase
        .from('call_sessions')
        .update({ status: 'connected', started_at: new Date().toISOString() })
        .eq('id', session.id);

    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }, [userId, initializeMedia, createPeerConnection]);

  // Decline a call
  const declineCall = useCallback(async (session: CallSession) => {
    const channel = supabase.channel(`call-signaling-${session.id}`);
    await channel.subscribe();
    
    channel.send({
      type: 'broadcast',
      event: 'call-declined',
      payload: { from: userId },
    });

    await supabase
      .from('call_sessions')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', session.id);

    setCallStatus('idle');
    setCurrentSession(null);
  }, [userId]);

  // End call
  const endCall = useCallback(async () => {
    // Stop all local tracks
    localStream?.getTracks().forEach((track) => track.stop());
    remoteStream?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    peerConnection.current?.close();
    peerConnection.current = null;

     // Unsubscribe from channel
     if (channelRef.current) {
       supabase.removeChannel(channelRef.current);
       channelRef.current = null;
     }
     isSignalingReadyRef.current = false;
     pendingIceCandidatesRef.current = [];

    // Update session status
    if (currentSession) {
      await supabase
        .from('call_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCurrentSession(null);
    setCallStatus('idle');
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  }, [localStream, remoteStream, currentSession]);

  // Toggle audio mute
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnection.current) return;

    try {
      if (isScreenSharing) {
        // Stop screen sharing, restore original video
        screenStream.current?.getTracks().forEach((track) => track.stop());
        
        if (originalVideoTrack.current && localStream) {
          const sender = peerConnection.current
            .getSenders()
            .find((s) => s.track?.kind === 'video');
          
          if (sender) {
            await sender.replaceTrack(originalVideoTrack.current);
          }
        }
        
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        
        screenStream.current = displayStream;
        const screenTrack = displayStream.getVideoTracks()[0];
        
        // Save original video track
        if (localStream) {
          originalVideoTrack.current = localStream.getVideoTracks()[0];
        }
        
        // Replace video track with screen track
        const sender = peerConnection.current
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
        
        // Handle when user stops sharing via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast({
        title: 'Screen Share Error',
        description: 'Could not share your screen.',
        variant: 'destructive',
      });
    }
  }, [isScreenSharing, localStream, toast]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `callee_id=eq.${userId}`,
        },
        async (payload) => {
          const session = payload.new as CallSession;
          
          if (session.status === 'ringing' && callStatus === 'idle') {
            // Fetch caller info
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, email')
              .eq('user_id', session.caller_id)
              .single();

            const callerName = profile?.display_name || profile?.email || 'Unknown';
            
            setCallStatus('ringing');
            setCurrentSession(session);
            onIncomingCall?.(session, callerName);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, callStatus, onIncomingCall]);

  return {
    callStatus,
    callType,
    currentSession,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    peerConnection: peerConnection.current,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
