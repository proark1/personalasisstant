import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface MessageReaction {
  emoji: string;
  user_ids: string[];
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  attachments: ChatAttachment[];
  reactions: MessageReaction[];
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender_profile?: {
    display_name: string | null;
    email: string | null;
  };
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useDirectMessages(userId: string | null) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch all messages where user is sender or recipient
      const { data: allMessages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const conversationMap = new Map<string, {
        partnerId: string;
        messages: typeof allMessages;
        unreadCount: number;
      }>();

      for (const msg of allMessages || []) {
        const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            partnerId,
            messages: [],
            unreadCount: 0,
          });
        }
        
        const conv = conversationMap.get(partnerId)!;
        conv.messages.push(msg);
        
        if (msg.recipient_id === userId && !msg.is_read) {
          conv.unreadCount++;
        }
      }

      // Fetch partner profiles
      const partnerIds = Array.from(conversationMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', partnerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build conversation list
      const convList: Conversation[] = [];
      for (const [partnerId, conv] of conversationMap) {
        const profile = profileMap.get(partnerId);
        const lastMsg = conv.messages[0];
        
        convList.push({
          partnerId,
          partnerName: profile?.display_name || 'Unknown',
          partnerEmail: profile?.email || '',
          lastMessage: lastMsg?.content || '',
          lastMessageAt: lastMsg?.created_at || '',
          unreadCount: conv.unreadCount,
        });
      }

      setConversations(convList.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      ));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles: DirectMessage[] = (data || []).map(msg => ({
        ...msg,
        attachments: (Array.isArray(msg.attachments) ? msg.attachments : []) as unknown as ChatAttachment[],
        reactions: (Array.isArray(msg.reactions) ? msg.reactions : []) as unknown as MessageReaction[],
        read_at: msg.read_at || null,
        sender_profile: profileMap.get(msg.sender_id) || undefined,
      }));

      setMessages(messagesWithProfiles);
      return messagesWithProfiles;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, [userId]);

  // Send a message
  const sendMessage = useCallback(async (
    recipientId: string, 
    content: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!userId || (!content.trim() && attachments.length === 0)) return null;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: userId,
          recipient_id: recipientId,
          content: content.trim(),
          attachments: attachments as unknown as null,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }, [userId]);

  // Mark messages as read
  const markAsRead = useCallback(async (partnerId: string) => {
    if (!userId) return;

    try {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('recipient_id', userId)
        .eq('is_read', false);

      // Update local state
      setConversations(prev => prev.map(c => 
        c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  // Set up realtime subscription for all messages involving the user
  useEffect(() => {
    if (!userId) return;

    fetchConversations();

    // Subscribe to messages where user is recipient (incoming)
    const incomingChannel = supabase
      .channel('direct-messages-incoming')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New incoming message received:', payload);
          fetchConversations();
          // Also update messages if currently viewing this conversation
          const newMsg = payload.new as { sender_id: string };
          if (newMsg?.sender_id) {
            setMessages(prev => {
              // Check if this message is from the partner we're currently chatting with
              const lastPartnerId = prev.length > 0 ? 
                (prev[0].sender_id === userId ? prev[0].recipient_id : prev[0].sender_id) : null;
              if (lastPartnerId === newMsg.sender_id) {
                // Add the new message to the list
                const fullMsg = payload.new as DirectMessage & { sender_profile?: { display_name: string | null; email: string | null } };
                return [...prev, {
                  ...fullMsg,
                  attachments: (Array.isArray(fullMsg.attachments) ? fullMsg.attachments : []) as ChatAttachment[],
                  reactions: (Array.isArray(fullMsg.reactions) ? fullMsg.reactions : []) as MessageReaction[],
                  read_at: fullMsg.read_at || null,
                }];
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    // Subscribe to messages where user is sender (for delivery/read status)
    const outgoingChannel = supabase
      .channel('direct-messages-outgoing')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Outgoing message update:', payload);
          if (payload.eventType === 'UPDATE') {
            // Update read status in current messages
            setMessages(prev => prev.map(msg => 
              msg.id === (payload.new as DirectMessage).id 
                ? { ...msg, is_read: (payload.new as DirectMessage).is_read, read_at: (payload.new as DirectMessage).read_at }
                : msg
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(incomingChannel);
      supabase.removeChannel(outgoingChannel);
    };
  }, [userId, fetchConversations]);

  return {
    messages,
    conversations,
    loading,
    fetchMessages,
    sendMessage,
    markAsRead,
    refetch: fetchConversations,
  };
}
