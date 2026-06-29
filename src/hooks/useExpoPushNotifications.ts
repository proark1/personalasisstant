import { useCallback } from "react";
import { ActionPerformed, PushNotificationSchema } from "@capacitor/push-notifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "./usePushNotifications";

// Compatibility wrapper for older callers. Capacitor provides native APNs/FCM
// tokens here, not Expo tokens, so Expo token output intentionally stays null.
export function useExpoPushNotifications() {
  const onNotificationReceived = useCallback((notification: PushNotificationSchema) => {
    toast(notification.title || "Notification", {
      description: notification.body,
    });
  }, []);

  const onNotificationAction = useCallback(async (action: ActionPerformed) => {
    const data = action.notification.data;

    if (data?.reminder_id) {
      await supabase
        .from("proactive_reminders")
        .update({
          read_at: new Date().toISOString(),
          action_taken: true,
          action_type: "opened",
        })
        .eq("id", data.reminder_id);

      await supabase
        .from("reminder_delivery_log")
        .update({ clicked_at: new Date().toISOString() })
        .eq("reminder_id", data.reminder_id)
        .eq("delivery_channel", "push");
    }

    if (data?.trigger_entity_type && data?.trigger_entity_id) {
      try {
        window.dispatchEvent(
          new CustomEvent("dori:open-entity", {
            detail: {
              type: String(data.trigger_entity_type),
              id: String(data.trigger_entity_id),
              source: "push",
            },
          }),
        );
      } catch (error) {
        console.error("open-entity dispatch failed", error);
      }
    }
  }, []);

  const push = usePushNotifications({
    onNotificationReceived,
    onNotificationAction,
  });

  return {
    token: push.token,
    expoPushToken: null as string | null,
    permissionStatus: push.permissionStatus,
    isNative: push.isNative,
    requestPermission: push.requestPermission,
    register: push.register,
  };
}
