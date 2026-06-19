import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface IslamicNotificationSettings {
  id: string;
  user_id: string;

  // Islamic event reminders
  events_enabled: boolean;
  events_hours_before: number;
  events_send_time: string;

  // Daily hadith
  daily_hadith_enabled: boolean;
  daily_hadith_time: string;
  hadith_source_preference: string;

  // Prayer reminders
  prayer_reminders_enabled: boolean;
  prayer_reminder_minutes_before: number;
  prayer_reminders_for_all_five: boolean;
  prayer_reminders_selected: string[];

  notification_language: string;
  timezone: string;

  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Partial<IslamicNotificationSettings> = {
  events_enabled: true,
  events_hours_before: 24,
  events_send_time: "08:00",
  daily_hadith_enabled: true,
  daily_hadith_time: "07:00",
  hadith_source_preference: "mixed",
  prayer_reminders_enabled: true,
  prayer_reminder_minutes_before: 5,
  prayer_reminders_for_all_five: true,
  prayer_reminders_selected: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
  notification_language: "en",
  timezone: "UTC",
};

export function useIslamicNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["islamic-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("islamic_notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Create default settings if none exist
      if (!data && user?.id) {
        const { data: created, error: createError } = await supabase
          .from("islamic_notification_settings")
          .insert([
            {
              user_id: user.id,
              ...DEFAULT_SETTINGS,
            },
          ])
          .select()
          .maybeSingle();

        if (createError) throw createError;
        return created;
      }

      return data;
    },
    enabled: !!user?.id,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<IslamicNotificationSettings>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("islamic_notification_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["islamic-notifications", user?.id] });
      toast({
        title: "Settings saved",
        description: "Your Islamic notification preferences have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Toggle event reminders
  const toggleEventReminders = (enabled: boolean) => {
    updateSettingsMutation.mutate({ events_enabled: enabled });
  };

  // Toggle daily hadith
  const toggleDailyHadith = (enabled: boolean) => {
    updateSettingsMutation.mutate({ daily_hadith_enabled: enabled });
  };

  // Toggle prayer reminders
  const togglePrayerReminders = (enabled: boolean) => {
    updateSettingsMutation.mutate({ prayer_reminders_enabled: enabled });
  };

  // Update prayer selections
  const updatePrayerSelections = (prayers: string[]) => {
    updateSettingsMutation.mutate({ prayer_reminders_selected: prayers });
  };

  // Update hadith time
  const updateHadithTime = (time: string) => {
    updateSettingsMutation.mutate({ daily_hadith_time: time });
  };

  // Update event reminder time
  const updateEventReminderTime = (time: string) => {
    updateSettingsMutation.mutate({ events_send_time: time });
  };

  // Update prayer reminder minutes before
  const updatePrayerReminderMinutes = (minutes: number) => {
    updateSettingsMutation.mutate({ prayer_reminder_minutes_before: minutes });
  };

  // Update event reminder hours before
  const updateEventReminderHours = (hours: number) => {
    updateSettingsMutation.mutate({ events_hours_before: hours });
  };

  return {
    settings: settings as IslamicNotificationSettings | null,
    isLoading,
    error,
    isSaving: updateSettingsMutation.isPending,
    toggleEventReminders,
    toggleDailyHadith,
    togglePrayerReminders,
    updatePrayerSelections,
    updateHadithTime,
    updateEventReminderTime,
    updatePrayerReminderMinutes,
    updateEventReminderHours,
  };
}
