import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "./useEncryption";

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
  encrypted_content?: string | null;
  encrypted_key?: string | null;
  encryption_version?: number;
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
  const { isReady, encryptDirectMessage, decryptDirectMessage, getRecipientPublicKey } =
    useEncryption();

  // Cache profile lookups so names don't flicker to "Unknown" on transient network failures.
  const profileCacheRef = useRef(
    new Map<string, { display_name: string | null; email: string | null }>(),
  );

  // Decrypt a single message
  const decryptMessage = useCallback(
    async (msg: DirectMessage): Promise<DirectMessage> => {
      if (msg.encrypted_content && msg.encrypted_key && isReady) {
        try {
          const decryptedContent = await decryptDirectMessage(
            msg.encrypted_content,
            msg.encrypted_key,
          );
          if (decryptedContent) {
            return { ...msg, content: decryptedContent };
          }
        } catch (error) {
          console.error("Failed to decrypt message:", error);
        }
      }
      return msg;
    },
    [isReady, decryptDirectMessage],
  );

  // Fetch all conversations with silent retry for network errors
  const fetchConversations = useCallback(
    async (retryCount = 0) => {
      if (!userId) return;

      try {
        const { data: allMessages, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Group by conversation partner
        const conversationMap = new Map<
          string,
          {
            partnerId: string;
            messages: typeof allMessages;
            unreadCount: number;
          }
        >();

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

        // Fetch partner profiles (best-effort)
        const partnerIds = Array.from(conversationMap.keys());
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", partnerIds);

        if (!profilesError && profiles) {
          profiles.forEach((p) => {
            profileCacheRef.current.set(p.user_id, {
              display_name: p.display_name,
              email: p.email,
            });
          });
        }
        // Silently ignore profile errors - we have cache fallback

        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        // Build conversation list with decrypted last messages
        const convList: Conversation[] = [];
        for (const [partnerId, conv] of conversationMap) {
          const profile = profileMap.get(partnerId);
          const lastMsg = conv.messages[0];

          let lastMessageContent = lastMsg?.content || "";

          // Decrypt last message if encrypted
          if (lastMsg?.encrypted_content && lastMsg?.encrypted_key && isReady) {
            try {
              const decrypted = await decryptDirectMessage(
                lastMsg.encrypted_content,
                lastMsg.encrypted_key,
              );
              if (decrypted) {
                lastMessageContent = decrypted;
              }
            } catch {
              lastMessageContent = "🔒 Encrypted message";
            }
          }

          const cached = profileCacheRef.current.get(partnerId);
          const displayName = profile?.display_name ?? cached?.display_name ?? null;
          const email = profile?.email ?? cached?.email ?? null;

          convList.push({
            partnerId,
            partnerName: displayName || "Unknown",
            partnerEmail: email || "",
            lastMessage: lastMessageContent,
            lastMessageAt: lastMsg?.created_at || "",
            unreadCount: conv.unreadCount,
          });
        }

        setConversations(
          convList.sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
          ),
        );
      } catch (error) {
        // Silent retry for transient network errors
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError");
        if (isNetworkError && retryCount < 2) {
          await new Promise((r) => setTimeout(r, 500 * (retryCount + 1)));
          return fetchConversations(retryCount + 1);
        }
        // Don't log noisy errors for network issues - just keep existing data
        if (!isNetworkError) {
          console.error("Error fetching conversations:", error);
        }
      } finally {
        setLoading(false);
      }
    },
    [userId, isReady, decryptDirectMessage],
  );

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(
    async (partnerId: string) => {
      if (!userId) return [];

      try {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${userId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${userId})`,
          )
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Fetch sender profiles
        const senderIds = [...new Set(data?.map((m) => m.sender_id) || [])];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", senderIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

        const messagesWithProfiles: DirectMessage[] = (data || []).map((msg) => ({
          ...msg,
          attachments: (Array.isArray(msg.attachments)
            ? msg.attachments
            : []) as unknown as ChatAttachment[],
          reactions: (Array.isArray(msg.reactions)
            ? msg.reactions
            : []) as unknown as MessageReaction[],
          read_at: msg.read_at || null,
          sender_profile: profileMap.get(msg.sender_id) || undefined,
        }));

        // Decrypt all messages
        const decryptedMessages = await Promise.all(
          messagesWithProfiles.map((msg) => decryptMessage(msg)),
        );

        setMessages(decryptedMessages);
        return decryptedMessages;
      } catch (error) {
        console.error("Error fetching messages:", error);
        return [];
      }
    },
    [userId, decryptMessage],
  );

  // Send a message (with encryption)
  const sendMessage = useCallback(
    async (recipientId: string, content: string, attachments: ChatAttachment[] = []) => {
      if (!userId || (!content.trim() && attachments.length === 0)) return null;

      try {
        // Check if recipient has encryption keys
        const recipientPublicKey = await getRecipientPublicKey(recipientId);

        let messageContent = content.trim();
        let encryptedContent: string | undefined;
        let encryptedKey: string | undefined;
        let encryptionVersion: number | undefined;

        if (messageContent) {
          if (!isReady) {
            console.warn("Direct message encryption is not ready; refusing plaintext send");
            return null;
          }

          if (!recipientPublicKey) {
            console.warn("Recipient does not have encryption keys; refusing plaintext send");
            return null;
          }

          const encrypted = await encryptDirectMessage(messageContent, recipientId);
          if (!encrypted) {
            console.warn("Direct message encryption failed; refusing plaintext send");
            return null;
          }

          messageContent = ""; // Clear plaintext
          encryptedContent = encrypted.encryptedContent;
          encryptedKey = encrypted.encryptedKey;
          encryptionVersion = 1;
        }

        const { data, error } = await supabase
          .from("direct_messages")
          .insert({
            sender_id: userId,
            recipient_id: recipientId,
            content: messageContent,
            attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
            encrypted_content: encryptedContent,
            encrypted_key: encryptedKey,
            encryption_version: encryptionVersion,
          })
          .select()
          .single();

        if (error) throw error;

        return data;
      } catch (error) {
        console.error("Error sending message:", error);
        return null;
      }
    },
    [userId, isReady, encryptDirectMessage, getRecipientPublicKey],
  );

  // Mark messages as read
  const markAsRead = useCallback(
    async (partnerId: string) => {
      if (!userId) return;

      try {
        await supabase
          .from("direct_messages")
          .update({ is_read: true })
          .eq("sender_id", partnerId)
          .eq("recipient_id", userId)
          .eq("is_read", false);

        setConversations((prev) =>
          prev.map((c) => (c.partnerId === partnerId ? { ...c, unreadCount: 0 } : c)),
        );
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    },
    [userId],
  );

  // Set up realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Guards the async incoming handler: decryptMessage() awaits, so the
    // channel can be torn down (unmount or userId change) before it resolves.
    // Without this, setMessages would fire after teardown — a React warning
    // and, on a fast conversation switch, an append to the wrong thread.
    let active = true;

    fetchConversations();

    const incomingChannel = supabase
      .channel("direct-messages-incoming")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          console.log("New incoming message received:", payload);
          fetchConversations();

          const newMsg = payload.new as DirectMessage;
          if (newMsg?.sender_id) {
            // Decrypt the new message
            const decrypted = await decryptMessage(newMsg);
            if (!active) return;

            setMessages((prev) => {
              const lastPartnerId =
                prev.length > 0
                  ? prev[0].sender_id === userId
                    ? prev[0].recipient_id
                    : prev[0].sender_id
                  : null;
              if (lastPartnerId === newMsg.sender_id) {
                return [
                  ...prev,
                  {
                    ...decrypted,
                    attachments: (Array.isArray(decrypted.attachments)
                      ? decrypted.attachments
                      : []) as ChatAttachment[],
                    reactions: (Array.isArray(decrypted.reactions)
                      ? decrypted.reactions
                      : []) as MessageReaction[],
                    read_at: decrypted.read_at || null,
                  },
                ];
              }
              return prev;
            });
          }
        },
      )
      .subscribe();

    const outgoingChannel = supabase
      .channel("direct-messages-outgoing")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === (payload.new as DirectMessage).id
                  ? {
                      ...msg,
                      is_read: (payload.new as DirectMessage).is_read,
                      read_at: (payload.new as DirectMessage).read_at,
                    }
                  : msg,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      incomingChannel.unsubscribe();
      supabase.removeChannel(incomingChannel);
      outgoingChannel.unsubscribe();
      supabase.removeChannel(outgoingChannel);
    };
  }, [userId, fetchConversations, decryptMessage]);

  return {
    messages,
    conversations,
    loading,
    fetchMessages,
    sendMessage,
    markAsRead,
    refetch: fetchConversations,
    encryptionReady: isReady,
  };
}
