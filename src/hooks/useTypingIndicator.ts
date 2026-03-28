import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  id: string;
  name: string;
  typing: boolean;
}

interface UseTypingIndicatorOptions {
  chatId: string;
  userId: string;
  userName: string;
}

export function useTypingIndicator({ chatId, userId, userName }: UseTypingIndicatorOptions) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Subscribe to typing presence
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase.channel(`typing-${chatId}`);
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.user_id !== userId && presence.typing) {
              users.push({
                id: presence.user_id,
                name: presence.user_name,
                typing: presence.typing,
              });
            }
          });
        });
        
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track initial presence (not typing)
          await channel.track({
            user_id: userId,
            user_name: userName,
            typing: false,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chatId, userId, userName]);

  // Set typing status
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!channelRef.current || isTypingRef.current === isTyping) return;
    
    isTypingRef.current = isTyping;
    
    await channelRef.current.track({
      user_id: userId,
      user_name: userName,
      typing: isTyping,
      online_at: new Date().toISOString(),
    });
  }, [userId, userName]);

  // Handle input change - start typing indicator with auto-stop
  const onInputChange = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing to true
    setTyping(true);

    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 3000);
  }, [setTyping]);

  // Stop typing (e.g., when message is sent)
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);
  }, [setTyping]);

  return {
    typingUsers,
    onInputChange,
    stopTyping,
  };
}
