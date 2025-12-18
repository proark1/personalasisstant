import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AudioRecorder, encodeAudioForAPI, AudioQueue, parseNaturalDate, fuzzyMatchTask } from '@/utils/RealtimeAudio';
import type { Task, TaskCategory, TaskPriority } from '@/types/flux';

interface UseOpenAIRealtimeOptions {
  userProfile: any;
  contextData: any;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  // Task operations
  addTask?: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<Task | null>;
  updateTask?: (id: string, updates: Partial<Task>) => Promise<void>;
  trashTask?: (id: string) => Promise<{ error: any }>;
  toggleTaskComplete?: (id: string) => Promise<void>;
  refetch?: () => void;
}

export function useOpenAIRealtime({
  userProfile,
  contextData,
  onTranscript,
  onResponse,
  onError,
  onConnectionChange,
  onSpeakingChange,
  addTask,
  updateTask,
  trashTask,
  toggleTaskComplete,
  refetch,
}: UseOpenAIRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  
  const currentTranscriptRef = useRef<string>('');
  const pendingFunctionCallRef = useRef<{ name: string; callId: string; args: string } | null>(null);

  // Handle function calls from OpenAI
  const handleFunctionCall = useCallback(async (name: string, args: any, callId: string) => {
    console.log('Function call:', name, args);
    let result: any = { success: false, message: 'Unknown function' };
    
    const tasks = contextData?.allTasks || [];
    
    try {
      switch (name) {
        case 'create_task': {
          if (addTask && args.title) {
            const newTask = await addTask({
              title: args.title,
              priority: (args.priority || 'medium') as TaskPriority,
              category: (args.category || 'personal') as TaskCategory,
              completed: false,
              dueDate: args.due_date ? new Date(args.due_date) : undefined,
            });
            if (newTask) {
              result = { success: true, message: `Created task "${args.title}"`, task: newTask };
              refetch?.();
            } else {
              result = { success: false, message: 'Failed to create task' };
            }
          }
          break;
        }
        
        case 'complete_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (toggleTaskComplete) {
              await toggleTaskComplete(matches[0].id);
              result = { success: true, message: `Completed task "${matches[0].title}"` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { 
              success: false, 
              multiple_matches: true,
              matches: matches.slice(0, 3),
              message: `Found multiple tasks: ${taskList}. Please be more specific.` 
            };
          }
          break;
        }
        
        case 'trash_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (trashTask) {
              await trashTask(matches[0].id);
              result = { success: true, message: `Moved "${matches[0].title}" to trash` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { 
              success: false, 
              multiple_matches: true,
              matches: matches.slice(0, 3),
              message: `Found multiple tasks: ${taskList}. Please be more specific.` 
            };
          }
          break;
        }
        
        case 'reschedule_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          const newDate = parseNaturalDate(args.new_date);
          
          if (!newDate) {
            result = { success: false, message: `Could not understand the date "${args.new_date}"` };
          } else if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (updateTask) {
              await updateTask(matches[0].id, { dueDate: new Date(newDate) });
              result = { success: true, message: `Rescheduled "${matches[0].title}" to ${newDate}` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { 
              success: false, 
              multiple_matches: true,
              message: `Found multiple tasks: ${taskList}. Please be more specific.` 
            };
          }
          break;
        }
        
        case 'edit_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (updateTask) {
              const updates: Partial<Task> = {};
              if (args.new_title) updates.title = args.new_title;
              if (args.new_priority) updates.priority = args.new_priority as TaskPriority;
              if (args.new_category) updates.category = args.new_category as TaskCategory;
              
              await updateTask(matches[0].id, updates);
              result = { success: true, message: `Updated task "${matches[0].title}"` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { 
              success: false, 
              multiple_matches: true,
              message: `Found multiple tasks: ${taskList}. Please be more specific.` 
            };
          }
          break;
        }
        
        case 'search_tasks': {
          const matches = fuzzyMatchTask(args.query, tasks);
          if (matches.length === 0) {
            result = { success: true, message: 'No tasks found matching that query', tasks: [] };
          } else {
            result = { 
              success: true, 
              message: `Found ${matches.length} task(s)`,
              tasks: matches.slice(0, 5)
            };
          }
          break;
        }
        
        case 'get_task_summary': {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          
          let summary = '';
          let relevantTasks: any[] = [];
          
          switch (args.type) {
            case 'today':
              relevantTasks = tasks.filter((t: any) => 
                !t.completed && t.dueDate?.startsWith(todayStr)
              );
              summary = relevantTasks.length > 0 
                ? `You have ${relevantTasks.length} task(s) due today`
                : 'No tasks due today';
              break;
            case 'overdue':
              relevantTasks = tasks.filter((t: any) => 
                !t.completed && t.dueDate && t.dueDate < todayStr
              );
              summary = relevantTasks.length > 0
                ? `You have ${relevantTasks.length} overdue task(s)`
                : 'No overdue tasks';
              break;
            case 'upcoming':
              const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              relevantTasks = tasks.filter((t: any) => 
                !t.completed && t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeek.toISOString().split('T')[0]
              );
              summary = relevantTasks.length > 0
                ? `You have ${relevantTasks.length} task(s) coming up this week`
                : 'No tasks scheduled for this week';
              break;
            default:
              relevantTasks = tasks.filter((t: any) => !t.completed);
              summary = `You have ${relevantTasks.length} pending task(s) in total`;
          }
          
          result = { 
            success: true, 
            message: summary, 
            tasks: relevantTasks.slice(0, 5).map((t: any) => ({ title: t.title, dueDate: t.dueDate }))
          };
          break;
        }
      }
    } catch (err) {
      console.error('Function call error:', err);
      result = { success: false, message: 'An error occurred while processing' };
    }
    
    // Send function result back to OpenAI
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      }));
      
      // Trigger response generation
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
    
    return result;
  }, [contextData, addTask, updateTask, trashTask, toggleTaskComplete, refetch]);

  const connect = useCallback(async () => {
    try {
      onConnectionChange?.('connecting');
      console.log('Getting ephemeral token...');
      
      // Get ephemeral token from edge function
      const { data, error } = await supabase.functions.invoke('openai-realtime-session', {
        body: { userProfile, contextData }
      });
      
      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || 'Failed to get session token');
      }
      
      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('Got ephemeral token, establishing WebRTC...');
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // Create audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      
      // Set up audio context for queue
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioQueueRef.current = new AudioQueue(audioContextRef.current, {
        onPlaybackStart: () => {
          setIsSpeaking(true);
          onSpeakingChange?.(true);
        },
        onPlaybackEnd: () => {
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        }
      });
      
      // Set up remote audio
      pc.ontrack = (e) => {
        console.log('Received audio track');
        audioEl.srcObject = e.streams[0];
      };
      
      // Add local audio track
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(ms.getTracks()[0]);
      
      // Set up data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      
      dc.addEventListener('open', () => {
        console.log('Data channel opened');
        setIsConnected(true);
        setIsListening(true);
        onConnectionChange?.('connected');
      });
      
      dc.addEventListener('message', async (e) => {
        const event = JSON.parse(e.data);
        console.log('Received event:', event.type);
        
        switch (event.type) {
          case 'input_audio_buffer.speech_started':
            // User started speaking
            currentTranscriptRef.current = '';
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            // Final user transcript
            const userText = event.transcript || '';
            currentTranscriptRef.current = userText;
            onTranscript?.(userText, true);
            break;
            
          case 'response.audio_transcript.delta':
            // AI response text (streaming)
            onResponse?.(event.delta || '');
            break;
            
          case 'response.audio.delta':
            // AI audio response
            if (event.delta) {
              setIsSpeaking(true);
              onSpeakingChange?.(true);
              const binaryString = atob(event.delta);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              audioQueueRef.current?.addToQueue(bytes);
            }
            break;
            
          case 'response.audio.done':
            // Audio finished
            setTimeout(() => {
              setIsSpeaking(false);
              onSpeakingChange?.(false);
            }, 500);
            break;
            
          case 'response.function_call_arguments.delta':
            // Accumulate function call arguments
            if (!pendingFunctionCallRef.current) {
              pendingFunctionCallRef.current = {
                name: event.name || '',
                callId: event.call_id || '',
                args: ''
              };
            }
            pendingFunctionCallRef.current.args += event.delta || '';
            break;
            
          case 'response.function_call_arguments.done':
            // Function call complete
            if (pendingFunctionCallRef.current || event.arguments) {
              const fnName = pendingFunctionCallRef.current?.name || event.name;
              const fnArgs = event.arguments || pendingFunctionCallRef.current?.args || '{}';
              const callId = event.call_id || pendingFunctionCallRef.current?.callId;
              
              try {
                const parsedArgs = JSON.parse(fnArgs);
                await handleFunctionCall(fnName, parsedArgs, callId);
              } catch (err) {
                console.error('Error parsing function args:', err);
              }
              pendingFunctionCallRef.current = null;
            }
            break;
            
          case 'error':
            console.error('OpenAI error:', event.error);
            onError?.(event.error?.message || 'Unknown error');
            break;
        }
      });
      
      dc.addEventListener('close', () => {
        console.log('Data channel closed');
        setIsConnected(false);
        setIsListening(false);
        onConnectionChange?.('disconnected');
      });
      
      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Connect to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp'
        },
      });
      
      if (!sdpResponse.ok) {
        throw new Error(`Failed to connect to OpenAI: ${sdpResponse.status}`);
      }
      
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');
      
    } catch (err) {
      console.error('Connection error:', err);
      onConnectionChange?.('error');
      onError?.(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [userProfile, contextData, onConnectionChange, onError, onTranscript, onResponse, onSpeakingChange, handleFunctionCall]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting...');
    
    audioRecorderRef.current?.stop();
    audioRecorderRef.current = null;
    
    audioQueueRef.current?.clear();
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    onConnectionChange?.('disconnected');
  }, [onConnectionChange]);

  // Send text message (for testing or accessibility)
  const sendTextMessage = useCallback((text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('Data channel not ready');
      return;
    }
    
    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    }));
    
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isListening,
    isSpeaking,
    connect,
    disconnect,
    sendTextMessage,
  };
}
