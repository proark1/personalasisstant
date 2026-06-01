import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChatAI() {
  const [loading, setLoading] = useState(false);

  const getSmartReplies = useCallback(async (messages: Message[], lastMessage: string): Promise<string[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { action: 'smart_reply', messages, message: lastMessage }
      });

      if (error) throw error;
      return Array.isArray(data.result) ? data.result : [];
    } catch (error) {
      console.error('Smart reply error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const translateMessage = useCallback(async (message: string, targetLanguage: string): Promise<string> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { action: 'translate', message, targetLanguage }
      });

      if (error) throw error;
      return data.result;
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(await describeEdgeError(error, 'Failed to translate message'));
      return message;
    } finally {
      setLoading(false);
    }
  }, []);

  const summarizeConversation = useCallback(async (messages: Message[]): Promise<string> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { action: 'summarize', messages }
      });

      if (error) throw error;
      return data.result;
    } catch (error) {
      console.error('Summarize error:', error);
      toast.error(await describeEdgeError(error, 'Failed to summarize conversation'));
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeSentiment = useCallback(async (message: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    urgency: 'high' | 'medium' | 'low';
  } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { action: 'sentiment', message }
      });

      if (error) throw error;
      return data.result;
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return null;
    }
  }, []);

  const summarizeCallTranscription = useCallback(async (transcription: string): Promise<string> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-ai', {
        body: { action: 'transcribe_summary', message: transcription }
      });

      if (error) throw error;
      return data.result;
    } catch (error) {
      console.error('Transcription summary error:', error);
      toast.error(await describeEdgeError(error, 'Failed to summarize transcription'));
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    getSmartReplies,
    translateMessage,
    summarizeConversation,
    analyzeSentiment,
    summarizeCallTranscription,
  };
}
