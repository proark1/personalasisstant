import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { ChatMessage } from "@/types/flux";

interface DbChatMessage {
  id: string;
  user_id: string;
  role: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export function useChatHistory() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!error && data) {
      setMessages(
        data.map((m: DbChatMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
        })),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback(
    async (message: Omit<ChatMessage, "id" | "timestamp">): Promise<ChatMessage | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          role: message.role,
          content: message.content,
        })
        .select()
        .single();

      if (!error && data) {
        const newMessage: ChatMessage = {
          id: data.id,
          role: data.role as "user" | "assistant",
          content: data.content,
          timestamp: new Date(data.created_at),
        };
        setMessages((prev) => [...prev, newMessage]);
        return newMessage;
      }
      return null;
    },
    [user],
  );

  const updateMessage = useCallback(async (id: string, content: string) => {
    const { error } = await supabase.from("chat_messages").update({ content }).eq("id", id);

    if (!error) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
    }
  }, []);

  const clearHistory = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);

    if (!error) {
      setMessages([]);
    }
    return { error: error?.message || null };
  }, [user]);

  const searchMessages = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) return [];

      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        return data.map((m: DbChatMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
      }
      return [];
    },
    [user],
  );

  const exportHistory = useCallback(() => {
    const exportData = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flux-chat-history-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messages]);

  return {
    messages,
    loading,
    addMessage,
    updateMessage,
    clearHistory,
    searchMessages,
    exportHistory,
    setMessages,
    refetch: fetchMessages,
  };
}
