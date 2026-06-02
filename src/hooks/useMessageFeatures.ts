import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PinnedMessage {
  id: string;
  messageId: string;
  messageType: 'direct' | 'group';
  pinnedBy: string;
  chatId: string;
  createdAt: Date;
}

export interface StarredMessage {
  id: string;
  messageId: string;
  messageType: 'direct' | 'group';
  createdAt: Date;
}

export interface ScheduledMessage {
  id: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  attachments: unknown[];
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: Date;
}

export function useMessageFeatures() {
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [loading] = useState(false);

  // Fetch pinned messages for a chat
  const fetchPinnedMessages = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from('pinned_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPinnedMessages(data.map(p => ({
        id: p.id,
        messageId: p.message_id,
        messageType: p.message_type as 'direct' | 'group',
        pinnedBy: p.pinned_by,
        chatId: p.chat_id,
        createdAt: new Date(p.created_at),
      })));
    }
  }, []);

  // Pin a message
  const pinMessage = useCallback(async (messageId: string, messageType: 'direct' | 'group', chatId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('pinned_messages')
      .insert({
        message_id: messageId,
        message_type: messageType,
        pinned_by: user.id,
        chat_id: chatId,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Message already pinned');
      } else {
        toast.error('Failed to pin message');
      }
      return;
    }

    toast.success('Message pinned');
    fetchPinnedMessages(chatId);
  }, [user, fetchPinnedMessages]);

  // Unpin a message
  const unpinMessage = useCallback(async (messageId: string, messageType: 'direct' | 'group', chatId: string) => {
    const { error } = await supabase
      .from('pinned_messages')
      .delete()
      .eq('message_id', messageId)
      .eq('message_type', messageType);

    if (error) {
      toast.error('Failed to unpin message');
      return;
    }

    toast.success('Message unpinned');
    fetchPinnedMessages(chatId);
  }, [fetchPinnedMessages]);

  // Fetch starred messages
  const fetchStarredMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('starred_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStarredMessages(data.map(s => ({
        id: s.id,
        messageId: s.message_id,
        messageType: s.message_type as 'direct' | 'group',
        createdAt: new Date(s.created_at),
      })));
    }
  }, [user]);

  // Star a message
  const starMessage = useCallback(async (messageId: string, messageType: 'direct' | 'group') => {
    if (!user) return;

    const { error } = await supabase
      .from('starred_messages')
      .insert({
        user_id: user.id,
        message_id: messageId,
        message_type: messageType,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Message already starred');
      } else {
        toast.error('Failed to star message');
      }
      return;
    }

    toast.success('Message starred');
    fetchStarredMessages();
  }, [user, fetchStarredMessages]);

  // Unstar a message
  const unstarMessage = useCallback(async (messageId: string, messageType: 'direct' | 'group') => {
    if (!user) return;

    const { error } = await supabase
      .from('starred_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId)
      .eq('message_type', messageType);

    if (error) {
      toast.error('Failed to unstar message');
      return;
    }

    toast.success('Message unstarred');
    fetchStarredMessages();
  }, [user, fetchStarredMessages]);

  // Check if message is starred
  const isMessageStarred = useCallback((messageId: string) => {
    return starredMessages.some(s => s.messageId === messageId);
  }, [starredMessages]);

  // Fetch scheduled messages
  const fetchScheduledMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (!error && data) {
      setScheduledMessages(data.map(s => ({
        id: s.id,
        recipientId: s.recipient_id || undefined,
        groupId: s.group_id || undefined,
        content: s.content,
        attachments: Array.isArray(s.attachments) ? s.attachments : [],
        scheduledFor: new Date(s.scheduled_for),
        status: s.status as 'pending' | 'sent' | 'cancelled',
        createdAt: new Date(s.created_at),
      })));
    }
  }, [user]);

  // Schedule a message
  const scheduleMessage = useCallback(async (
    content: string,
    scheduledFor: Date,
    recipientId?: string,
    groupId?: string,
    attachments: unknown[] = []
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from('scheduled_messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        group_id: groupId,
        content,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attachments: attachments as any,
        scheduled_for: scheduledFor.toISOString(),
      });

    if (error) {
      toast.error('Failed to schedule message');
      return;
    }

    toast.success(`Message scheduled for ${scheduledFor.toLocaleString()}`);
    fetchScheduledMessages();
  }, [user, fetchScheduledMessages]);

  // Cancel scheduled message
  const cancelScheduledMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from('scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', messageId);

    if (error) {
      toast.error('Failed to cancel scheduled message');
      return;
    }

    toast.success('Scheduled message cancelled');
    fetchScheduledMessages();
  }, [fetchScheduledMessages]);

  // Edit a message
  const editMessage = useCallback(async (messageId: string, newContent: string, messageType: 'direct' | 'group') => {
    // Branch on the concrete table so the payload type-checks against a
    // single table (a dynamic union table name collapses it to `never`).
    // Cast preserves the existing write behavior; is_edited/edited_at are
    // not in the generated types for these tables.
    const patch = { content: newContent, is_edited: true, edited_at: new Date().toISOString() };
    const { error } = messageType === 'direct'
      ? await supabase.from('direct_messages').update(patch as TablesUpdate<'direct_messages'>).eq('id', messageId)
      : await supabase.from('group_messages').update(patch as TablesUpdate<'group_messages'>).eq('id', messageId);

    if (error) {
      toast.error('Failed to edit message');
      return false;
    }

    toast.success('Message edited');
    return true;
  }, []);

  // Delete a message (soft delete)
  const deleteMessage = useCallback(async (messageId: string, messageType: 'direct' | 'group') => {
    const patch = {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      content: 'This message was deleted',
    };
    const { error } = messageType === 'direct'
      ? await supabase.from('direct_messages').update(patch as TablesUpdate<'direct_messages'>).eq('id', messageId)
      : await supabase.from('group_messages').update(patch as TablesUpdate<'group_messages'>).eq('id', messageId);

    if (error) {
      toast.error('Failed to delete message');
      return false;
    }

    toast.success('Message deleted');
    return true;
  }, []);

  // Search messages
  const searchMessages = useCallback(async (query: string, _chatPartnerId?: string) => {
    if (!user || !query.trim()) return [];

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    return data || [];
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStarredMessages();
      fetchScheduledMessages();
    }
  }, [user, fetchStarredMessages, fetchScheduledMessages]);

  return {
    pinnedMessages,
    starredMessages,
    scheduledMessages,
    loading,
    fetchPinnedMessages,
    pinMessage,
    unpinMessage,
    fetchStarredMessages,
    starMessage,
    unstarMessage,
    isMessageStarred,
    fetchScheduledMessages,
    scheduleMessage,
    cancelScheduledMessage,
    editMessage,
    deleteMessage,
    searchMessages,
  };
}
