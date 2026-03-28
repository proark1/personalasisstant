import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatAttachment } from './useDirectMessages';
import { useEncryption } from './useEncryption';

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  members?: GroupMember[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  attachments: ChatAttachment[];
  reactions: MessageReaction[];
  created_at: string;
  encrypted_content?: string | null;
  encryption_version?: number;
  sender_profile?: {
    display_name: string | null;
    email: string | null;
  };
  read_by?: string[];
}

export interface MessageReaction {
  emoji: string;
  user_ids: string[];
}

export function useGroupChat(userId: string | null) {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { 
    isReady, 
    initializeGroupKey, 
    encryptGroupMessage, 
    decryptGroupMessage,
    addMemberToGroupEncryption 
  } = useEncryption();

  // Decrypt a single group message
  const decryptMessage = useCallback(async (msg: GroupMessage): Promise<GroupMessage> => {
    if (msg.encrypted_content && isReady) {
      try {
        const decryptedContent = await decryptGroupMessage(msg.encrypted_content, msg.group_id);
        if (decryptedContent) {
          return { ...msg, content: decryptedContent };
        }
      } catch (error) {
        console.error('Failed to decrypt group message:', error);
      }
    }
    return msg;
  }, [isReady, decryptGroupMessage]);

  // Fetch all groups with silent retry for network errors
  const fetchGroups = useCallback(async (retryCount = 0) => {
    if (!userId) return;

    try {
      const { data: groupsData, error } = await supabase
        .from('chat_groups')
        .select(`
          *,
          chat_group_members (
            id,
            user_id,
            role,
            joined_at
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch member profiles and last messages
      const enrichedGroups = await Promise.all(
        (groupsData || []).map(async (group) => {
          const memberIds = group.chat_group_members?.map((m: GroupMember) => m.user_id) || [];
          
          // Initialize group encryption key
          if (isReady && memberIds.length > 0) {
            await initializeGroupKey(group.id, memberIds);
          }
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, email, avatar_url')
            .in('user_id', memberIds);
          
          const { data: lastMsg } = await supabase
            .from('group_messages')
            .select('content, encrypted_content, created_at')
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          let lastMessageContent = lastMsg?.content || '';
          
          // Decrypt last message if encrypted
          if (lastMsg?.encrypted_content && isReady) {
            try {
              const decrypted = await decryptGroupMessage(lastMsg.encrypted_content, group.id);
              if (decrypted) {
                lastMessageContent = decrypted;
              }
            } catch {
              lastMessageContent = '🔒 Encrypted message';
            }
          }
          
          const members = group.chat_group_members?.map((m: GroupMember) => ({
            ...m,
            profile: profiles?.find(p => p.user_id === m.user_id),
          }));

          return {
            ...group,
            members,
            lastMessage: lastMessageContent,
            lastMessageAt: lastMsg?.created_at || group.created_at,
          };
        })
      );

      setGroups(enrichedGroups);
    } catch (error: any) {
      // Silent retry for transient network errors
      const isNetworkError = error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError');
      if (isNetworkError && retryCount < 2) {
        await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
        return fetchGroups(retryCount + 1);
      }
      // Don't log noisy errors for network issues - just keep existing data
      if (!isNetworkError) {
        console.error('Error fetching groups:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isReady, initializeGroupKey, decryptGroupMessage]);

  // Create a new group
  const createGroup = useCallback(async (name: string, memberIds: string[], description?: string) => {
    if (!userId) return null;

    try {
      const { data: group, error: groupError } = await supabase
        .from('chat_groups')
        .insert({
          name,
          description,
          created_by: userId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin
      const { error: adminError } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'admin',
        });

      if (adminError) throw adminError;

      // Add other members
      if (memberIds.length > 0) {
        const memberInserts = memberIds.map(id => ({
          group_id: group.id,
          user_id: id,
          role: 'member',
        }));

        await supabase
          .from('chat_group_members')
          .insert(memberInserts);
      }

      // Initialize encryption for all members including creator
      if (isReady) {
        await initializeGroupKey(group.id, [userId, ...memberIds]);
      }

      await fetchGroups();
      return group;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }, [userId, fetchGroups, isReady, initializeGroupKey]);

  // Fetch messages for a group
  const fetchMessages = useCallback(async (groupId: string) => {
    if (!userId) return [];

    try {
      // Initialize group key before fetching messages
      const { data: members } = await supabase
        .from('chat_group_members')
        .select('user_id')
        .eq('group_id', groupId);
      
      if (isReady && members) {
        await initializeGroupKey(groupId, members.map(m => m.user_id));
      }

      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', senderIds);

      // Fetch read statuses
      const messageIds = data?.map(m => m.id) || [];
      const { data: reads } = await supabase
        .from('group_message_reads')
        .select('message_id, user_id')
        .in('message_id', messageIds);

      const readMap = new Map<string, string[]>();
      reads?.forEach(r => {
        if (!readMap.has(r.message_id)) {
          readMap.set(r.message_id, []);
        }
        readMap.get(r.message_id)!.push(r.user_id);
      });

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles: GroupMessage[] = (data || []).map(msg => ({
        ...msg,
        attachments: (Array.isArray(msg.attachments) ? msg.attachments : []) as unknown as ChatAttachment[],
        reactions: (Array.isArray(msg.reactions) ? msg.reactions : []) as unknown as MessageReaction[],
        sender_profile: profileMap.get(msg.sender_id) || undefined,
        read_by: readMap.get(msg.id) || [],
      }));

      // Decrypt all messages
      const decryptedMessages = await Promise.all(
        messagesWithProfiles.map(msg => decryptMessage(msg))
      );

      setMessages(decryptedMessages);
      return decryptedMessages;
    } catch (error) {
      console.error('Error fetching group messages:', error);
      return [];
    }
  }, [userId, isReady, initializeGroupKey, decryptMessage]);

  // Send a message (with encryption)
  const sendMessage = useCallback(async (
    groupId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!userId || (!content.trim() && attachments.length === 0)) return null;

    try {
      let messageContent = content.trim();
      let encryptedContent: string | undefined;
      let encryptionVersion: number | undefined;

      // Encrypt if ready
      if (isReady) {
        const encrypted = await encryptGroupMessage(messageContent, groupId);
        if (encrypted) {
          messageContent = ''; // Clear plaintext
          encryptedContent = encrypted;
          encryptionVersion = 1;
        }
      }

      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: messageContent,
          attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
          encrypted_content: encryptedContent,
          encryption_version: encryptionVersion,
        })
        .select()
        .single();

      if (error) throw error;

      // Update group's updated_at
      await supabase
        .from('chat_groups')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupId);

      return data;
    } catch (error) {
      console.error('Error sending group message:', error);
      return null;
    }
  }, [userId, isReady, encryptGroupMessage]);

  // Mark messages as read
  const markAsRead = useCallback(async (groupId: string) => {
    if (!userId) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('group_messages')
        .select('id')
        .eq('group_id', groupId)
        .neq('sender_id', userId);

      if (!unreadMessages || unreadMessages.length === 0) return;

      const reads = unreadMessages.map(m => ({
        message_id: m.id,
        user_id: userId,
      }));

      await supabase
        .from('group_message_reads')
        .upsert(reads, { onConflict: 'message_id,user_id' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  // Add reaction to message
  const addReaction = useCallback(async (messageId: string, emoji: string, isGroup: boolean) => {
    if (!userId) return;

    try {
      const table = isGroup ? 'group_messages' : 'direct_messages';
      
      const { data: message } = await supabase
        .from(table)
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (!message) return;

      const reactions = (Array.isArray(message.reactions) ? message.reactions : []) as unknown as MessageReaction[];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        if (existingReaction.user_ids.includes(userId)) {
          existingReaction.user_ids = existingReaction.user_ids.filter(id => id !== userId);
          if (existingReaction.user_ids.length === 0) {
            const index = reactions.indexOf(existingReaction);
            reactions.splice(index, 1);
          }
        } else {
          existingReaction.user_ids.push(userId);
        }
      } else {
        reactions.push({ emoji, user_ids: [userId] });
      }

      await supabase
        .from(table)
        .update({ reactions: reactions as unknown as null })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }, [userId]);

  // Add member to existing group (also share encryption key)
  const addMember = useCallback(async (groupId: string, memberId: string) => {
    if (!userId) return false;

    try {
      await supabase
        .from('chat_group_members')
        .insert({
          group_id: groupId,
          user_id: memberId,
          role: 'member',
        });

      // Share encryption key with new member
      if (isReady) {
        await addMemberToGroupEncryption(groupId, memberId);
      }

      await fetchGroups();
      return true;
    } catch (error) {
      console.error('Error adding member:', error);
      return false;
    }
  }, [userId, isReady, addMemberToGroupEncryption, fetchGroups]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    fetchGroups();

    const channel = supabase
      .channel('group-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchGroups]);

  return {
    groups,
    messages,
    loading,
    createGroup,
    fetchMessages,
    sendMessage,
    markAsRead,
    addReaction,
    addMember,
    refetch: fetchGroups,
    encryptionReady: isReady,
  };
}
