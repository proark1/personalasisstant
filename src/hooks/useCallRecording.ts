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

export function useCallRecording(sessionId: string | null, userId: string | undefined) {
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
  }, [sessionId, userId, toast]);

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
      const fileName = `${userId}/${sessionId}_${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      setRecordingUrl(urlData.publicUrl);

      toast({
        title: 'Recording Saved',
        description: `Call recording saved (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
      });

      console.log('[recording] Uploaded:', urlData.publicUrl);
    } catch (error) {
      console.error('[recording] Upload failed:', error);
      toast({
        title: 'Upload Error',
        description: 'Could not save call recording.',
        variant: 'destructive',
      });
    }
  }, [sessionId, userId, toast]);

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
