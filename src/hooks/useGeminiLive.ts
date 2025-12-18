import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AssistantPersonality } from '@/types/flux';

interface UserProfile {
  displayName?: string | null;
  role?: string | null;
  bio?: string | null;
  businesses?: string[] | null;
  interests?: string[] | null;
  skills?: string[] | null;
  goals?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  timezone?: string | null;
  preferredWorkHours?: string | null;
}

interface UseGeminiLiveOptions {
  personality?: AssistantPersonality;
  userProfile?: UserProfile | null;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

export function useGeminiLive({
  personality = 'balanced',
  userProfile,
  onResponse,
  onError,
  onSpeakingChange,
}: UseGeminiLiveOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    onSpeakingChange?.(false);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-live', {
        body: { 
          action: 'send_text', 
          text, 
          personality,
          userProfile: userProfile ? {
            displayName: userProfile.displayName,
            role: userProfile.role,
            bio: userProfile.bio,
            businesses: userProfile.businesses,
            interests: userProfile.interests,
            skills: userProfile.skills,
            goals: userProfile.goals,
            locationCity: userProfile.locationCity,
            locationCountry: userProfile.locationCountry,
            timezone: userProfile.timezone,
            preferredWorkHours: userProfile.preferredWorkHours,
          } : undefined
        }
      });

      if (error) throw error;

      const responseText = data?.text || "I couldn't process that.";
      setLastResponse(responseText);
      onResponse?.(responseText);

      return responseText;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      console.error('Gemini Live error:', err);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [personality, userProfile, onResponse, onError, onSpeakingChange]);

  const sendAudio = useCallback(async (audioData: Float32Array, sampleRate: number = 16000) => {
    setIsProcessing(true);
    onSpeakingChange?.(false);

    try {
      const wavBuffer = encodeWAV(audioData, sampleRate);
      const base64Audio = arrayBufferToBase64(wavBuffer);

      const { data, error } = await supabase.functions.invoke('gemini-live', {
        body: { 
          action: 'send_audio', 
          audio: base64Audio, 
          personality,
          userProfile: userProfile ? {
            displayName: userProfile.displayName,
            role: userProfile.role,
            bio: userProfile.bio,
            businesses: userProfile.businesses,
            interests: userProfile.interests,
            skills: userProfile.skills,
            goals: userProfile.goals,
            locationCity: userProfile.locationCity,
            locationCountry: userProfile.locationCountry,
            timezone: userProfile.timezone,
            preferredWorkHours: userProfile.preferredWorkHours,
          } : undefined
        }
      });

      if (error) throw error;

      const responseText = data?.text || "I couldn't understand that.";
      setLastResponse(responseText);
      onResponse?.(responseText);

      return responseText;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process audio';
      console.error('Gemini Live audio error:', err);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [personality, userProfile, onResponse, onError, onSpeakingChange]);

  return {
    isProcessing,
    lastResponse,
    sendText,
    sendAudio,
  };
}

// Helper: Convert Float32Array to WAV ArrayBuffer
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
