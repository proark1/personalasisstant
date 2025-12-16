import { useState, useCallback, useRef, useEffect } from 'react';
import type { AssistantPersonality } from '@/types/flux';

interface UseGeminiLiveOptions {
  personality?: AssistantPersonality;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useGeminiLive({
  personality = 'balanced',
  onResponse,
  onError,
  onSpeakingChange,
  onConnectionChange,
}: UseGeminiLiveOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const playNextAudio = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      onSpeakingChange?.(false);
      return;
    }

    isPlayingRef.current = true;
    onSpeakingChange?.(true);
    
    const audioData = audioQueueRef.current.shift()!;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      // Decode and play PCM audio
      const audioBuffer = await decodeGeminiAudio(audioContextRef.current, audioData);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => playNextAudio();
      source.start(0);
    } catch (e) {
      console.error('Error playing audio:', e);
      playNextAudio();
    }
  }, [onSpeakingChange]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `wss://femilfmcmqmdbncmgcxh.functions.supabase.co/gemini-live?personality=${personality}`;
    console.log('Connecting to Gemini Live:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', data.type);

        if (data.type === 'setup_complete') {
          setIsConnected(true);
          onConnectionChange?.(true);
          console.log('Gemini Live ready');
        } else if (data.type === 'audio') {
          // Queue audio for playback
          const binaryString = atob(data.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioQueueRef.current.push(bytes.buffer);
          
          if (!isPlayingRef.current) {
            playNextAudio();
          }
        } else if (data.type === 'text') {
          setLastResponse(data.text);
          onResponse?.(data.text);
        } else if (data.type === 'turn_complete') {
          setIsProcessing(false);
        } else if (data.type === 'error') {
          onError?.(data.message);
        } else if (data.type === 'disconnected') {
          setIsConnected(false);
          onConnectionChange?.(false);
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.('Connection error');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
      onConnectionChange?.(false);
    };
  }, [personality, onResponse, onError, onConnectionChange, playNextAudio]);

  const disconnect = useCallback(() => {
    stopAudioCapture();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Audio = encodeAudioToBase64(inputData);
          
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: base64Audio
          }));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log('Audio capture started');
    } catch (e) {
      console.error('Error starting audio capture:', e);
      onError?.('Microphone access denied');
    }
  }, [onError]);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    console.log('Audio capture stopped');
  }, []);

  const sendText = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    setIsProcessing(true);
    wsRef.current.send(JSON.stringify({
      type: 'text',
      text
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isProcessing,
    lastResponse,
    connect,
    disconnect,
    startAudioCapture,
    stopAudioCapture,
    sendText,
  };
}

// Helper: Encode Float32Array to base64 PCM16
function encodeAudioToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

// Helper: Decode Gemini audio (24kHz PCM) to AudioBuffer
async function decodeGeminiAudio(audioContext: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const pcmData = new Uint8Array(arrayBuffer);
  
  // Convert bytes to 16-bit samples (little endian)
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }
  
  // Convert to float32
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768;
  }
  
  // Create audio buffer
  const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
  audioBuffer.getChannelData(0).set(float32Data);
  
  return audioBuffer;
}
