import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AssistantMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AssistantConversation {
  id: string;
  user_id: string;
  title?: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  related_startup_id?: string;
  is_startup_brainstorm: boolean;
  created_at: string;
  messages?: AssistantMessage[];
}

export function useAssistantConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AssistantConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const messageBufferRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversations((data || []) as AssistantConversation[]);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string): Promise<AssistantMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (data || []) as AssistantMessage[];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, []);

  // Start a new conversation
  const startConversation = useCallback(async (isStartupBrainstorm = false, title?: string): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .insert({
          user_id: user.id,
          title: title || (isStartupBrainstorm ? 'Startup Brainstorm' : 'Assistant Chat'),
          is_startup_brainstorm: isStartupBrainstorm,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      const conversation = data as AssistantConversation;
      setCurrentConversation(conversation);
      messageBufferRef.current = [];
      return conversation.id;
    } catch (error) {
      console.error('Error starting conversation:', error);
      return null;
    }
  }, [user?.id]);

  // Add message to buffer (for real-time during conversation)
  const bufferMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    if (content.trim()) {
      messageBufferRef.current.push({ role, content: content.trim() });
      console.log('[useAssistantConversations] Buffered message:', role, content.trim().substring(0, 50) + '...', 'Buffer size:', messageBufferRef.current.length);
    }
  }, []);

  // Save buffered messages to database
  const saveBufferedMessages = useCallback(async (conversationId: string) => {
    console.log('[useAssistantConversations] saveBufferedMessages called with', messageBufferRef.current.length, 'messages for conversation', conversationId);
    
    if (messageBufferRef.current.length === 0) {
      console.log('[useAssistantConversations] No messages in buffer to save');
      return;
    }

    try {
      const messages = messageBufferRef.current.map((msg, index) => ({
        conversation_id: conversationId,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(Date.now() + index).toISOString(),
      }));

      console.log('[useAssistantConversations] Saving messages to DB:', messages);

      const { error } = await supabase
        .from('assistant_messages')
        .insert(messages);

      if (error) {
        console.error('[useAssistantConversations] DB error saving messages:', error);
        throw error;
      }
      
      console.log('[useAssistantConversations] Messages saved successfully');
      messageBufferRef.current = [];
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  }, []);

  // Add single message directly
  const addMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    if (!content.trim()) return;

    try {
      const { error } = await supabase
        .from('assistant_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content: content.trim(),
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding message:', error);
    }
  }, []);

  // End conversation
  const endConversation = useCallback(async (conversationId: string, summary?: string) => {
    try {
      // Save any buffered messages first
      await saveBufferedMessages(conversationId);

      const { error } = await supabase
        .from('assistant_conversations')
        .update({
          ended_at: new Date().toISOString(),
          summary,
        })
        .eq('id', conversationId);

      if (error) throw error;
      setCurrentConversation(null);
    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  }, [saveBufferedMessages]);

  // Update conversation title
  const updateConversationTitle = useCallback(async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('assistant_conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }, []);

  // Link conversation to startup idea
  const linkToStartupIdea = useCallback(async (conversationId: string, startupId: string) => {
    try {
      const { error } = await supabase
        .from('assistant_conversations')
        .update({ related_startup_id: startupId, is_startup_brainstorm: true })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error linking to startup:', error);
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('assistant_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user?.id);

      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }, [user?.id]);

  return {
    conversations,
    currentConversation,
    loading,
    fetchConversations,
    fetchMessages,
    startConversation,
    bufferMessage,
    saveBufferedMessages,
    addMessage,
    endConversation,
    updateConversationTitle,
    linkToStartupIdea,
    deleteConversation,
  };
}
