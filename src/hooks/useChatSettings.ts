import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ChatSettings {
  dndEnabled: boolean;
  dndStart?: string;
  dndEnd?: string;
  dndDays: number[];
  disappearingMessagesDefault?: number;
  priorityContacts: string[];
}

export interface BlockedUser {
  id: string;
  blockedId: string;
  blockedName?: string;
  reason?: string;
  createdAt: Date;
}

export function useChatSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ChatSettings>({
    dndEnabled: false,
    dndDays: [],
    priorityContacts: [],
  });
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading] = useState(false);

  // Fetch chat settings
  const fetchSettings = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("user_chat_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      setSettings({
        dndEnabled: data.dnd_enabled,
        dndStart: data.dnd_start,
        dndEnd: data.dnd_end,
        dndDays: data.dnd_days || [],
        disappearingMessagesDefault: data.disappearing_messages_default,
        priorityContacts: data.priority_contacts || [],
      });
    }
  }, [user]);

  // Update chat settings
  const updateSettings = useCallback(
    async (newSettings: Partial<ChatSettings>) => {
      if (!user) return;

      const { error } = await supabase.from("user_chat_settings").upsert({
        user_id: user.id,
        dnd_enabled: newSettings.dndEnabled ?? settings.dndEnabled,
        dnd_start: newSettings.dndStart ?? settings.dndStart,
        dnd_end: newSettings.dndEnd ?? settings.dndEnd,
        dnd_days: newSettings.dndDays ?? settings.dndDays,
        disappearing_messages_default:
          newSettings.disappearingMessagesDefault ?? settings.disappearingMessagesDefault,
        priority_contacts: newSettings.priorityContacts ?? settings.priorityContacts,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        toast.error("Failed to update settings");
        return;
      }

      setSettings((prev) => ({ ...prev, ...newSettings }));
      toast.success("Settings updated");
    },
    [user, settings],
  );

  // Check if currently in DND mode
  const isInDndMode = useCallback(() => {
    if (!settings.dndEnabled) return false;
    if (!settings.dndStart || !settings.dndEnd) return settings.dndEnabled;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    // Check if current day is in DND days
    if (settings.dndDays.length > 0 && !settings.dndDays.includes(currentDay)) {
      return false;
    }

    // Check if current time is within DND window
    if (settings.dndStart <= settings.dndEnd) {
      return currentTime >= settings.dndStart && currentTime <= settings.dndEnd;
    } else {
      // DND spans midnight
      return currentTime >= settings.dndStart || currentTime <= settings.dndEnd;
    }
  }, [settings]);

  // Fetch blocked users
  const fetchBlockedUsers = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("blocked_users")
      .select("*")
      .eq("blocker_id", user.id);

    if (!error && data) {
      // Get blocked user names
      const blockedIds = data.map((b) => b.blocked_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", blockedIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

      setBlockedUsers(
        data.map((b) => ({
          id: b.id,
          blockedId: b.blocked_id,
          blockedName: profileMap.get(b.blocked_id) || "Unknown",
          reason: b.reason,
          createdAt: new Date(b.created_at),
        })),
      );
    }
  }, [user]);

  // Block a user
  const blockUser = useCallback(
    async (blockedId: string, reason?: string) => {
      if (!user) return;

      const { error } = await supabase.from("blocked_users").insert({
        blocker_id: user.id,
        blocked_id: blockedId,
        reason,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("User already blocked");
        } else {
          toast.error("Failed to block user");
        }
        return;
      }

      toast.success("User blocked");
      fetchBlockedUsers();
    },
    [user, fetchBlockedUsers],
  );

  // Unblock a user
  const unblockUser = useCallback(
    async (blockedId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", blockedId);

      if (error) {
        toast.error("Failed to unblock user");
        return;
      }

      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== blockedId));
      toast.success("User unblocked");
    },
    [user],
  );

  // Check if a user is blocked
  const isUserBlocked = useCallback(
    (userId: string) => {
      return blockedUsers.some((b) => b.blockedId === userId);
    },
    [blockedUsers],
  );

  // Add priority contact
  const addPriorityContact = useCallback(
    async (contactId: string) => {
      if (!settings.priorityContacts.includes(contactId)) {
        await updateSettings({
          priorityContacts: [...settings.priorityContacts, contactId],
        });
      }
    },
    [settings.priorityContacts, updateSettings],
  );

  // Remove priority contact
  const removePriorityContact = useCallback(
    async (contactId: string) => {
      await updateSettings({
        priorityContacts: settings.priorityContacts.filter((id) => id !== contactId),
      });
    },
    [settings.priorityContacts, updateSettings],
  );

  // Check if contact is priority
  const isPriorityContact = useCallback(
    (contactId: string) => {
      return settings.priorityContacts.includes(contactId);
    },
    [settings.priorityContacts],
  );

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchBlockedUsers();
    }
  }, [user, fetchSettings, fetchBlockedUsers]);

  return {
    settings,
    blockedUsers,
    loading,
    updateSettings,
    isInDndMode,
    fetchBlockedUsers,
    blockUser,
    unblockUser,
    isUserBlocked,
    addPriorityContact,
    removePriorityContact,
    isPriorityContact,
  };
}
