import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useVoiceRecorder(userId: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice messages.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; duration: number } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      const duration = recordingDuration;

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());

        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        setIsRecording(false);
        setRecordingDuration(0);

        resolve({ blob, duration });
      };

      mediaRecorderRef.current.stop();
    });
  }, [recordingDuration]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    chunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const uploadVoiceMessage = useCallback(
    async (
      blob: Blob,
      duration: number,
    ): Promise<{
      url: string;
      duration: number;
    } | null> => {
      setIsProcessing(true);

      try {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        // Bucket is private — generate a long-lived signed URL (7 days).
        const { data: signed, error: signErr } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);
        if (signErr || !signed?.signedUrl)
          throw signErr ?? new Error("Could not create signed URL");

        return { url: signed.signedUrl, duration };
      } catch (error) {
        console.error("Error uploading voice message:", error);
        toast({
          title: "Upload failed",
          description: "Could not upload voice message.",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, toast],
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    isRecording,
    recordingDuration,
    isProcessing,
    startRecording,
    stopRecording,
    cancelRecording,
    uploadVoiceMessage,
    formatDuration,
  };
}
