import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CallRecording {
  id: string;
  sessionId: string;
  url: string;
  duration: number;
  createdAt: Date;
}

interface UseCallRecordingOptions {
  callerId?: string;
  calleeId?: string;
}

export function useCallRecording(
  sessionId: string | null, 
  userId: string | undefined,
  options: UseCallRecordingOptions = {}
) {
  const { callerId, calleeId } = options;
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async (
    localStream: MediaStream | null,
    remoteStream: MediaStream | null
  ) => {
    if (!sessionId || !userId) {
      console.warn('[recording] No session or user ID');
      return;
    }

    if (!localStream && !remoteStream) {
      console.warn('[recording] No streams available');
      return;
    }

    try {
      // Create an AudioContext to mix streams
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add local audio if available
      if (localStream) {
        const localAudioTracks = localStream.getAudioTracks();
        if (localAudioTracks.length > 0) {
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream(localAudioTracks)
          );
          localSource.connect(destination);
        }
      }

      // Add remote audio if available
      if (remoteStream) {
        const remoteAudioTracks = remoteStream.getAudioTracks();
        if (remoteAudioTracks.length > 0) {
          const remoteSource = audioContext.createMediaStreamSource(
            new MediaStream(remoteAudioTracks)
          );
          remoteSource.connect(destination);
        }
      }

      // Create MediaRecorder with the mixed stream
      const mixedStream = destination.stream;
      
      // Try WebM first, fallback to other formats
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      if (!mimeType) {
        throw new Error('No supported audio format found');
      }

      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Upload to Supabase storage
        await uploadRecording(blob, duration);
        
        // Clean up audio context
        audioContext.close();
      };

      mediaRecorder.onerror = (event) => {
        console.error('[recording] MediaRecorder error:', event);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      console.log('[recording] Started recording with', mimeType);
    } catch (error) {
      console.error('[recording] Failed to start:', error);
      toast({
        title: 'Recording Error',
        description: 'Could not start call recording.',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, toast]); // intentionally excludes uploadRecording — defined after this callback to avoid circular deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('[recording] Stopped recording');
    }
  }, []);

  const uploadRecording = useCallback(async (blob: Blob, duration: number) => {
    if (!sessionId || !userId) return;

    try {
      // Store in user's folder for RLS policy: auth.uid()::text = (storage.foldername(name))[1]
      const fileName = `${userId}/${sessionId}_${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from('call-recordings')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (error) {
        throw error;
      }

      // Get time-limited signed URL (1 hour) for secure access
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('call-recordings')
        .createSignedUrl(fileName, 60 * 60); // 1 hour expiry

      if (signedUrlError) {
        console.error('[recording] Signed URL error:', signedUrlError);
        throw signedUrlError;
      }

      setRecordingUrl(signedUrlData.signedUrl);

      // Save metadata to database - store file_path, not the signed URL (URLs expire)
      const { error: dbError } = await supabase
        .from('call_recordings')
        .insert({
          user_id: userId,
          session_id: sessionId,
          caller_id: callerId || userId,
          callee_id: calleeId || userId,
          file_path: fileName,
          file_url: signedUrlData.signedUrl, // Will be regenerated on access
          duration_seconds: duration,
          file_size_bytes: blob.size,
        });

      if (dbError) {
        console.error('[recording] DB insert error:', dbError);
        // Don't throw - file is already uploaded
      }

      toast({
        title: 'Recording Saved',
        description: `Call recording saved (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
      });

      console.log('[recording] Uploaded securely with signed URL');
    } catch (error) {
      console.error('[recording] Upload failed:', error);
      toast({
        title: 'Upload Error',
        description: 'Could not save call recording.',
        variant: 'destructive',
      });
    }
  }, [sessionId, userId, callerId, calleeId, toast]);

  const giveConsent = useCallback(() => {
    setRecordingConsent(true);
  }, []);

  const revokeConsent = useCallback(() => {
    setRecordingConsent(false);
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    recordingConsent,
    recordingUrl,
    giveConsent,
    revokeConsent,
    startRecording,
    stopRecording,
  };
}
