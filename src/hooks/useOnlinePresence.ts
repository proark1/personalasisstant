import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

export function useOnlinePresence(userId: string | null, _spaceMemberIds: string[] = [], enabled = true) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase.channel('online-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as PresenceState;
        const online = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            online.add(presence.user_id);
          });
        });
        
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          (newPresences as unknown as Array<{ user_id: string }>).forEach((p) => next.add(p.user_id));
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          (leftPresences as unknown as Array<{ user_id: string }>).forEach((p) => next.delete(p.user_id));
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, enabled]);

  const isOnline = useCallback((memberId: string) => {
    return onlineUsers.has(memberId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isOnline,
  };
}
