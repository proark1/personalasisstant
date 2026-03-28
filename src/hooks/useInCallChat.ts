import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InCallMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

export function useInCallChat(sessionId: string | null, userId: string) {
  const [messages, setMessages] = useState<InCallMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to in-call chat channel
  useEffect(() => {
    if (!sessionId || !userId) return;

    const channel = supabase.channel(`call-chat-${sessionId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        const newMessage: InCallMessage = {
          id: payload.id,
          senderId: payload.senderId,
          senderName: payload.senderName,
          content: payload.content,
          timestamp: new Date(payload.timestamp),
        };
        setMessages(prev => [...prev, newMessage]);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  const sendMessage = useCallback(async (content: string, senderName: string) => {
    if (!channelRef.current || !sessionId || !content.trim()) return;

    const message = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName,
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add to local state immediately
    setMessages(prev => [...prev, {
      ...message,
      timestamp: new Date(message.timestamp),
    }]);

    // Broadcast to other participants
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message,
    });
  }, [sessionId, userId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, clearMessages };
}
